#!/usr/bin/env node

import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;
const INITIAL_MIGRATION = '20260901000000_initial_schema';
const AUTH_MIGRATION = '20260901163000_real_auth_sessions';
const PHASE_2_MIGRATION = '20260901210000_data_lifecycle_config';
const PHASE_3_MIGRATION = '20260902120000_production_business_flows';

const BASELINE_TABLES = [
  'Course',
  'Feedback',
  'LandingConfig',
  'MenteeAssignment',
  'MentorshipComment',
  'Module',
  'Payment',
  'Plugin',
  'TTSGuide',
  'User',
  'UserProgress',
  'VideoDriveLink',
  'VideoNote',
];

const BASELINE_COLUMNS = [
  'User.id',
  'User.email',
  'User.role',
  'Course.id',
  'Course.title',
  'Module.courseId',
  'VideoDriveLink.moduleId',
  'Payment.userId',
  'MentorshipComment.videoId',
  'UserProgress.videoId',
  'LandingConfig.id',
  'Plugin.configJson',
];

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const prismaExecutable = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'prisma.cmd' : 'prisma',
);

function fail(message) {
  throw new Error(`No se puede adoptar el historial de migraciones: ${message}`);
}

function resolveAsApplied(migrationName) {
  accessSync(prismaExecutable, constants.X_OK);
  console.log(`Registrando migracion existente como aplicada: ${migrationName}`);
  const result = spawnSync(
    prismaExecutable,
    ['migrate', 'resolve', '--applied', migrationName],
    { cwd: projectRoot, env: process.env, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(`Prisma no pudo registrar ${migrationName} (codigo ${result.status ?? 'desconocido'}).`);
  }
}

async function getPublicTables(client) {
  const result = await client.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  return new Set(result.rows.map((row) => row.table_name));
}

async function getPublicColumns(client) {
  const result = await client.query(
    `SELECT table_name, column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'`,
  );
  return new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
}

async function getAppliedMigrations(client, tables) {
  if (!tables.has('_prisma_migrations')) return new Set();
  const result = await client.query(
    `SELECT migration_name
       FROM public._prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`,
  );
  return new Set(result.rows.map((row) => row.migration_name));
}

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) fail('DATABASE_URL no esta configurada.');

  const databaseUrl = new URL(connectionString);
  const requestedSchema = databaseUrl.searchParams.get('schema');
  if (requestedSchema && requestedSchema !== 'public') {
    fail(`solo se admite el esquema PostgreSQL public, no ${requestedSchema}.`);
  }

  const client = new Client({ connectionString });
  await client.connect();
  const migrationsToResolve = [];

  try {
    const tables = await getPublicTables(client);
    const applicationTables = [...tables].filter((table) => table !== '_prisma_migrations');
    if (applicationTables.length === 0) {
      console.log('Base de datos vacia: Prisma aplicara todas las migraciones formales.');
      return;
    }

    const columns = await getPublicColumns(client);
    const missingTables = BASELINE_TABLES.filter((table) => !tables.has(table));
    const missingColumns = BASELINE_COLUMNS.filter((column) => !columns.has(column));
    if (missingTables.length || missingColumns.length) {
      fail(
        `el esquema heredado es parcial o desconocido. Tablas faltantes: ${missingTables.join(', ') || 'ninguna'}; ` +
          `columnas faltantes: ${missingColumns.join(', ') || 'ninguna'}.`,
      );
    }

    const applied = await getAppliedMigrations(client, tables);
    if (!applied.has(INITIAL_MIGRATION)) {
      migrationsToResolve.push(INITIAL_MIGRATION);
    }

    const authFingerprint = [
      columns.has('User.passwordHash'),
      tables.has('Session'),
      tables.has('PasswordResetToken'),
      tables.has('AuditLog'),
    ];
    const authPresent = authFingerprint.filter(Boolean).length;
    if (authPresent > 0 && authPresent < authFingerprint.length) {
      fail('se detecto una aplicacion parcial de la migracion de autenticacion.');
    }
    if (authPresent === authFingerprint.length && !applied.has(AUTH_MIGRATION)) {
      migrationsToResolve.push(AUTH_MIGRATION);
    }

    const instanceColumns = [
      'InstanceConfig.id',
      'InstanceConfig.institutionName',
      'InstanceConfig.setupCompletedAt',
      'InstanceConfig.telemetryConsent',
    ];
    const phase2Fingerprint = instanceColumns.map((column) => columns.has(column));
    const phase2Present = phase2Fingerprint.filter(Boolean).length;
    if (phase2Present > 0 && phase2Present < phase2Fingerprint.length) {
      fail('se detecto una aplicacion parcial de la migracion de configuracion de Fase 2.');
    }
    if (phase2Present === phase2Fingerprint.length && !applied.has(PHASE_2_MIGRATION)) {
      migrationsToResolve.push(PHASE_2_MIGRATION);
    }

    const phase3Tables = [
      'CourseEnrollment',
      'CourseResource',
      'Certificate',
      'PaymentWebhookEvent',
    ];
    const phase3Fingerprint = phase3Tables.map((table) => tables.has(table));
    const phase3Present = phase3Fingerprint.filter(Boolean).length;
    if (phase3Present > 0 && phase3Present < phase3Fingerprint.length) {
      fail('se detecto una aplicacion parcial de la migracion de Fase 3.');
    }
    if (phase3Present === phase3Fingerprint.length && !applied.has(PHASE_3_MIGRATION)) {
      migrationsToResolve.push(PHASE_3_MIGRATION);
    }
  } finally {
    await client.end();
  }

  for (const migrationName of migrationsToResolve) {
    resolveAsApplied(migrationName);
  }

  console.log('Historial heredado verificado; los datos existentes no se modificaron.');
}

main().catch((error) => {
  const nestedErrors =
    error instanceof AggregateError
      ? error.errors.map((nested) => (nested instanceof Error ? nested.message : String(nested))).join('; ')
      : '';
  console.error(
    error instanceof Error
      ? error.message || nestedErrors || error.stack || error.name
      : String(error),
  );
  process.exitCode = 1;
});

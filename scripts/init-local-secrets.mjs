#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import dotenv from 'dotenv';

const envPath = path.resolve(process.cwd(), '.env');
let source = '';
try {
  source = await readFile(envPath, 'utf8');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const parsed = dotenv.parse(source);
const updates = new Map();

function composeQuoted(value) {
  return JSON.stringify(value.replaceAll('$', '$$'));
}

function databasePassword() {
  if (process.env.DOCENTOS_POSTGRES_PASSWORD) return process.env.DOCENTOS_POSTGRES_PASSWORD;
  try {
    const url = new URL(parsed.DATABASE_URL || '');
    const password = decodeURIComponent(url.password);
    if (password && !password.includes('<') && !password.includes('CHANGE_ME')) return password;
  } catch {
    // Una instalacion nueva recibe un secreto aleatorio abajo.
  }
  return randomBytes(36).toString('base64url');
}

if (!parsed.DOCENTOS_POSTGRES_PASSWORD) {
  updates.set('DOCENTOS_POSTGRES_PASSWORD', databasePassword());
}
if (!parsed.DOCENTOS_BACKUP_PASSPHRASE) {
  const passphrase = process.env.DOCENTOS_BACKUP_PASSPHRASE || randomBytes(48).toString('base64url');
  updates.set('DOCENTOS_BACKUP_PASSPHRASE', passphrase);
}

const legacyRuntimeVariables = {
  APP_NAME: 'VITE_APP_NAME',
  APP_TAGLINE: 'VITE_APP_TAGLINE',
  APP_LOGO_INITIAL: 'VITE_APP_LOGO_INITIAL',
  APP_LOGO_URL: 'VITE_APP_LOGO_URL',
  POWERED_BY_TEXT: 'VITE_POWERED_BY_TEXT',
  POWERED_BY_LINK: 'VITE_POWERED_BY_LINK',
  AUTHOR_CREDIT: 'VITE_AUTHOR_CREDIT',
  DEFAULT_LANG: 'VITE_DEFAULT_LANG',
  AI_ASSISTANT_NAME: 'VITE_AI_ASSISTANT_NAME',
};
for (const [runtimeName, legacyName] of Object.entries(legacyRuntimeVariables)) {
  if (!parsed[runtimeName] && parsed[legacyName]) {
    updates.set(runtimeName, parsed[legacyName]);
  }
}

if (updates.size) {
  let nextSource = source;
  const additions = [];

  for (const [name, value] of updates) {
    const assignment = `${name}=${composeQuoted(value)}`;
    const existingAssignment = new RegExp(`^${name}\\s*=.*$`, 'gm');
    if (existingAssignment.test(nextSource)) {
      nextSource = nextSource.replace(existingAssignment, assignment);
    } else {
      additions.push(assignment);
    }
  }

  if (additions.length) {
    const separator = nextSource.length && !nextSource.endsWith('\n') ? '\n' : '';
    nextSource += `${separator}\n# Valores locales generados; este archivo esta excluido de Git.\n${additions.join('\n')}\n`;
  }
  await writeFile(envPath, nextSource, { mode: 0o600 });
}
await chmod(envPath, 0o600);
console.log(
  updates.size
    ? `Valores locales preparados en .env (${[...updates.keys()].join(', ')}).`
    : 'Los secretos locales requeridos ya estaban configurados en .env.',
);

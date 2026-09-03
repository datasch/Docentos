/**
 * Capa opcional de IA sobre el plan de importacion.
 *
 * La IA **no decide la estructura del curso**: eso ya lo hizo el planificador
 * determinista. Aqui solo se le permite:
 *
 *   - reescribir el titulo del curso, su descripcion y su categoria,
 *   - renombrar modulos y lecciones,
 *   - reordenar lecciones y, cuando la carpeta vino plana (un unico modulo),
 *     repartirlas en modulos con sentido.
 *
 * Todo lo demas se ignora. La propuesta se acepta solo si cada leccion aparece
 * exactamente una vez y no aparece ninguna que no estuviera: si el modelo
 * inventa, resume o se deja lecciones por el camino, se descarta entera y se
 * devuelve el plan determinista. Perder una clase en una importacion de 200
 * archivos es un error que nadie detecta hasta que un alumno se queja.
 *
 * Al modelo se le mandan solo titulos con identificadores opacos (`l0`, `m1`):
 * ni identificadores de Drive, ni URLs, ni nada que permita alcanzar el
 * contenido desde fuera.
 */

import { AiError, requestAiJson, type AiCandidate, type AiJsonResult } from './aiProvider.js';
import type { ImportPlan, PlannedLesson, PlannedModule, PlannedResource } from './courseImportPlan.js';

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 600;

export interface AiPlanPayload {
  curso: string;
  modulos: { id: string; titulo: string; lecciones: { id: string; titulo: string }[] }[];
}

export interface OrganizeOutcome {
  plan: ImportPlan;
  /** `true` cuando la propuesta se acepto y el plan cambio. */
  organized: boolean;
  provider?: string;
  model?: string;
  elapsedMs?: number;
  /** Por que no se aplico, cuando no se aplico. */
  reason?: string;
}

/** Un plan de un solo modulo es una carpeta sin subcarpetas: ahi si vale reagrupar. */
export function allowsRegrouping(plan: ImportPlan): boolean {
  return plan.modules.length === 1;
}

/**
 * Reduce el plan a lo minimo que la IA necesita ver. Los identificadores son
 * posicionales y opacos a proposito.
 */
export function compactPlanForAi(plan: ImportPlan): {
  payload: AiPlanPayload;
  moduleByAiId: Map<string, PlannedModule>;
  lessonByAiId: Map<string, PlannedLesson>;
} {
  const moduleByAiId = new Map<string, PlannedModule>();
  const lessonByAiId = new Map<string, PlannedLesson>();
  const modulos: AiPlanPayload['modulos'] = [];

  plan.modules.forEach((moduleEntry, moduleIndex) => {
    const moduleId = `m${moduleIndex}`;
    moduleByAiId.set(moduleId, moduleEntry);
    const lecciones = moduleEntry.lessons.map((lesson, lessonIndex) => {
      const lessonId = `l${moduleIndex}_${lessonIndex}`;
      lessonByAiId.set(lessonId, lesson);
      return { id: lessonId, titulo: lesson.title };
    });
    modulos.push({ id: moduleId, titulo: moduleEntry.title, lecciones });
  });

  return { payload: { curso: plan.title, modulos }, moduleByAiId, lessonByAiId };
}

const SYSTEM_PROMPT = [
  'Eres un editor de catálogo de una plataforma de formación en español.',
  'Recibes el índice de un curso extraído de una carpeta de archivos y lo dejas presentable.',
  'Puedes: mejorar el título del curso, escribir una descripción breve, elegir su categoría,',
  'renombrar módulos y lecciones, y reordenar o reagrupar lecciones cuando se te autorice.',
  'NO puedes: inventar lecciones, eliminarlas, fusionarlas ni resumir varias en una.',
  'Cada identificador de lección que recibes debe aparecer exactamente una vez en tu respuesta.',
  'Conserva el idioma original de cada título; corrige mayúsculas, guiones y numeración sobrante.',
  'Responde únicamente con un objeto JSON válido, sin texto alrededor.',
].join(' ');

export function buildUserPrompt(payload: AiPlanPayload, options: { allowRegroup: boolean }): string {
  const rules = options.allowRegroup
    ? 'La carpeta venía sin subcarpetas: agrupa las lecciones en módulos temáticos coherentes (entre 3 y 12), respetando su orden pedagógico.'
    : 'Los módulos ya vienen definidos: mantén exactamente los mismos identificadores de módulo, sin añadir ni quitar ninguno.';

  return [
    rules,
    '',
    'Formato exacto de la respuesta:',
    '{"titulo":"...","descripcion":"...","categoria":"...","modulos":[{"id":"m0","titulo":"...","lecciones":[{"id":"l0_0","titulo":"..."}]}]}',
    '',
    'La descripción tiene como máximo dos frases. La categoría es una etiqueta corta.',
    '',
    'Índice del curso:',
    JSON.stringify(payload),
  ].join('\n');
}

// ── Verificacion de la propuesta ────────────────────────────────────

interface ParsedModule {
  id: string | null;
  titulo: string;
  lecciones: { id: string; titulo: string }[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function cleanText(value: unknown, maxLength: number): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function parseModules(value: unknown): ParsedModule[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => {
    const moduleEntry = asRecord(entry);
    const lecciones = Array.isArray(moduleEntry.lecciones) ? moduleEntry.lecciones : [];
    return {
      id: typeof moduleEntry.id === 'string' && moduleEntry.id ? moduleEntry.id : null,
      titulo: cleanText(moduleEntry.titulo ?? moduleEntry.title, MAX_TITLE),
      lecciones: lecciones.map((lesson) => {
        const lessonEntry = asRecord(lesson);
        return {
          id: String(lessonEntry.id ?? ''),
          titulo: cleanText(lessonEntry.titulo ?? lessonEntry.title, MAX_TITLE),
        };
      }),
    };
  });
}

export class AiPlanRejected extends Error {}

/**
 * Aplica la propuesta sobre el plan, o lanza `AiPlanRejected` explicando por
 * que no se puede confiar en ella. Nunca modifica el plan recibido.
 */
export function applyAiOrganization(
  plan: ImportPlan,
  proposal: unknown,
  options: { allowRegroup?: boolean } = {},
): ImportPlan {
  const allowRegroup = options.allowRegroup ?? allowsRegrouping(plan);
  const { moduleByAiId, lessonByAiId } = compactPlanForAi(plan);
  const parsed = asRecord(proposal);
  const modules = parseModules(parsed.modulos ?? parsed.modules);

  if (modules.length === 0) throw new AiPlanRejected('La IA no propuso ningún módulo.');
  if (modules.length > Math.max(12, plan.modules.length * 2)) {
    throw new AiPlanRejected('La IA propuso una cantidad de módulos desproporcionada.');
  }
  if (!allowRegroup) {
    const proposedIds = modules.map((entry) => entry.id).join('|');
    const originalIds = [...moduleByAiId.keys()].join('|');
    if (proposedIds !== originalIds) {
      throw new AiPlanRejected('La IA alteró los módulos y esta carpeta ya venía organizada en carpetas.');
    }
  }

  // El nucleo de la garantia: la propuesta tiene que cubrir todas las lecciones,
  // cada una una sola vez, y ninguna de fuera.
  const used = new Set<string>();
  for (const moduleEntry of modules) {
    for (const lesson of moduleEntry.lecciones) {
      if (!lessonByAiId.has(lesson.id)) {
        throw new AiPlanRejected(`La IA devolvió una lección que no existe (${lesson.id}).`);
      }
      if (used.has(lesson.id)) {
        throw new AiPlanRejected(`La IA repitió la lección ${lesson.id}.`);
      }
      used.add(lesson.id);
    }
  }
  if (used.size !== lessonByAiId.size) {
    const missing = lessonByAiId.size - used.size;
    throw new AiPlanRejected(
      missing === 1
        ? `La IA se dejó 1 lección por el camino de ${lessonByAiId.size}.`
        : `La IA se dejó ${missing} lecciones por el camino de ${lessonByAiId.size}.`,
    );
  }

  // Los recursos no los toca la IA: cada uno sigue a su modulo, y un subtitulo
  // sigue a la leccion que acompana aunque esa leccion cambie de modulo.
  const lessonIdByKey = new Map<string, string>();
  for (const [aiId, lesson] of lessonByAiId) lessonIdByKey.set(lesson.key, aiId);

  const rebuilt: PlannedModule[] = [];
  const placedResources = new Set<string>();

  modules.forEach((moduleEntry, index) => {
    const original = moduleEntry.id ? moduleByAiId.get(moduleEntry.id) : undefined;
    const lessons = moduleEntry.lecciones.map((lesson) => {
      const source = lessonByAiId.get(lesson.id)!;
      return { ...source, title: lesson.titulo || source.title } satisfies PlannedLesson;
    });
    const lessonKeys = new Set(lessons.map((lesson) => lesson.key));

    const resources: PlannedResource[] = [];
    for (const candidateModule of plan.modules) {
      for (const resource of candidateModule.resources) {
        if (placedResources.has(resource.key)) continue;
        const belongs = resource.pairedWithLessonKey
          ? lessonKeys.has(resource.pairedWithLessonKey)
          : original === candidateModule;
        if (!belongs) continue;
        placedResources.add(resource.key);
        resources.push(resource);
      }
    }

    rebuilt.push({
      key: original?.key ?? `ai-${index}`,
      title: moduleEntry.titulo || original?.title || `Módulo ${index + 1}`,
      originalName: original?.originalName ?? moduleEntry.titulo,
      path: original?.path ?? [],
      lessons,
      resources,
      include: original?.include ?? true,
    });
  });

  // Un recurso cuya leccion emparejada desaparecio del reparto, o que colgaba de
  // un modulo que la IA no conservo, no se pierde: va al ultimo modulo.
  const orphans: PlannedResource[] = [];
  for (const moduleEntry of plan.modules) {
    for (const resource of moduleEntry.resources) {
      if (!placedResources.has(resource.key)) orphans.push(resource);
    }
  }
  if (orphans.length > 0) rebuilt[rebuilt.length - 1].resources.push(...orphans);

  const title = cleanText(parsed.titulo ?? parsed.title, MAX_TITLE) || plan.title;
  const description = cleanText(parsed.descripcion ?? parsed.description, MAX_DESCRIPTION) || plan.description;
  const category = cleanText(parsed.categoria ?? parsed.category, 80) || plan.category;

  return {
    ...plan,
    title,
    description,
    category,
    modules: rebuilt,
    aiOrganized: true,
  };
}

export interface OrganizeDeps {
  fetchImpl?: typeof fetch;
  candidates?: AiCandidate[];
  requestJson?: (request: {
    system: string;
    user: string;
    fetchImpl?: typeof fetch;
    candidates?: AiCandidate[];
    maxOutputTokens?: number;
  }) => Promise<AiJsonResult>;
}

/**
 * Pide a la IA que pula el plan. Nunca falla hacia arriba: si la IA no esta
 * disponible o su propuesta no supera la verificacion, se devuelve el plan
 * determinista con el motivo, porque una importacion sin retoques sigue siendo
 * una importacion valida.
 */
export async function organizeImportPlan(
  plan: ImportPlan,
  deps: OrganizeDeps = {},
): Promise<OrganizeOutcome> {
  const allowRegroup = allowsRegrouping(plan);
  const { payload } = compactPlanForAi(plan);
  const request = deps.requestJson ?? requestAiJson;

  let result: AiJsonResult;
  try {
    result = await request({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(payload, { allowRegroup }),
      fetchImpl: deps.fetchImpl,
      candidates: deps.candidates,
      // Cada leccion son unos pocos tokens de salida; el margen evita que un
      // curso largo se corte a mitad del JSON.
      maxOutputTokens: Math.min(16_000, 1_200 + payload.modulos.reduce((n, m) => n + m.lecciones.length, 0) * 40),
    });
  } catch (error) {
    return {
      plan,
      organized: false,
      reason:
        error instanceof AiError
          ? error.message
          : `No se pudo consultar a la IA: ${error instanceof Error ? error.message : 'error desconocido'}`,
    };
  }

  try {
    return {
      plan: applyAiOrganization(plan, result.data, { allowRegroup }),
      organized: true,
      provider: result.provider,
      model: result.model,
      elapsedMs: result.elapsedMs,
    };
  } catch (error) {
    return {
      plan,
      organized: false,
      provider: result.provider,
      model: result.model,
      elapsedMs: result.elapsedMs,
      reason: error instanceof AiPlanRejected ? error.message : 'La propuesta de la IA no se pudo aplicar.',
    };
  }
}

/**
 * Servicio de Evaluaciones y Quizzes Interactivos (`server/quizService.ts`)
 *
 * Administra la persistencia de cuestionarios por módulo y la generación
 * automática de exámenes con Inteligencia Artificial (OpenAI / DeepSeek / Gemini)
 * o heurística estructurada dinámica y aleatorizada en caso de contingencia.
 */

import fs from 'node:fs';
import path from 'node:path';
import { prisma } from './prisma.js';
import { logger } from './logger.js';
import { requestAiJson, isAiEnabled, extractJsonObject } from './aiProvider.js';
import { config } from './config.js';
import { GoogleGenAI } from '@google/genai';

export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/**
 * Ruta del almacen antiguo.
 *
 * Los examenes vivian en este archivo dentro del contenedor. Se conserva **solo
 * para importarlo una vez** al arrancar: ver `importarExamenesHeredados`. No se
 * escribe nunca mas.
 */
const ARCHIVO_HEREDADO = path.join(path.resolve(process.cwd(), 'data'), 'quizzes.json');

/**
 * Deja una lista de preguntas en su forma canonica.
 *
 * Es la misma limpieza que hacia la version de archivo, intacta: como maximo
 * cuatro opciones, `correctIndex` dentro de rango —si no, cae a 0— y fuera las
 * preguntas sin enunciado o con menos de dos opciones.
 */
function limpiarPreguntas(questions: QuizQuestion[]): QuizQuestion[] {
  return (questions || [])
    .map((q, idx) => {
      const originalOptions = Array.isArray(q.options) ? q.options.map((o) => String(o).trim()) : [];
      const rawOptions = originalOptions.filter(Boolean).slice(0, 4);
      // El indice recibido apunta a la lista original, antes de quitar vacios.
      const adjustedIndex = originalOptions.slice(0, q.correctIndex).filter(Boolean).length;
      if (Number.isInteger(q.correctIndex) && q.correctIndex >= 0 &&
          q.correctIndex < originalOptions.length && !originalOptions[q.correctIndex]) return null;

      const validIndex =
        typeof q.correctIndex === 'number' &&
        q.correctIndex >= 0 &&
        q.correctIndex < originalOptions.length &&
        Boolean(originalOptions[q.correctIndex]) && adjustedIndex < rawOptions.length
          ? adjustedIndex
          : 0;

      return {
        id: q.id || `q_${Date.now()}_${idx + 1}`,
        text: String(q.text || '').trim(),
        options: rawOptions,
        correctIndex: validIndex,
        explanation: String(q.explanation || '').trim() || 'Respuesta validada por el temario del módulo.',
      };
    })
    .filter((q): q is QuizQuestion => q !== null && q.text.length > 0 && q.options.length >= 2);
}

function parsearPreguntas(questionsJson: string, moduleId: string): QuizQuestion[] {
  try {
    const parsed = JSON.parse(questionsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    logger.error('Examen ilegible en la base de datos', { moduleId, error: String(error) });
    return [];
  }
}

/**
 * Todos los examenes, indexados por modulo.
 *
 * Mantiene la forma que ya consumian el panel del mentor y el gestor de cursos:
 * un objeto `{ [moduleId]: preguntas[] }`.
 */
export async function getAllStoredQuizzes(): Promise<Record<string, QuizQuestion[]>> {
  const filas = await prisma.moduleQuiz.findMany();
  const salida: Record<string, QuizQuestion[]> = {};
  for (const fila of filas) {
    salida[fila.moduleId] = parsearPreguntas(fila.questionsJson, fila.moduleId);
  }
  return salida;
}

export async function getQuizByModuleId(moduleId: string): Promise<QuizQuestion[]> {
  const fila = await prisma.moduleQuiz.findUnique({ where: { moduleId } });
  return fila ? parsearPreguntas(fila.questionsJson, moduleId) : [];
}

/**
 * Guarda o reemplaza el examen de un modulo.
 *
 * Una sola escritura atomica sobre una fila. La version de archivo leia el JSON
 * entero, lo modificaba y lo reescribia: dos mentores guardando a la vez se
 * pisaban y uno perdia su trabajo sin enterarse.
 *
 * Guardar una lista vacia equivale a borrar el examen, igual que antes.
 */
export async function saveQuizForModule(moduleId: string, questions: QuizQuestion[]): Promise<QuizQuestion[]> {
  const cleaned = limpiarPreguntas(questions);

  if (cleaned.length === 0) {
    await deleteQuizForModule(moduleId);
    return cleaned;
  }

  const questionsJson = JSON.stringify(cleaned);
  await prisma.moduleQuiz.upsert({
    where: { moduleId },
    update: { questionsJson },
    create: { moduleId, questionsJson },
  });
  return cleaned;
}

export async function deleteQuizForModule(moduleId: string): Promise<boolean> {
  const borradas = await prisma.moduleQuiz.deleteMany({ where: { moduleId } });
  return borradas.count > 0;
}

/**
 * Cuantos modulos de un curso tienen examen, y de que tamaño.
 *
 * Devuelve **solo el recuento**: ni enunciados, ni opciones, ni la respuesta
 * correcta. Es lo unico que necesitan el temario —para pintar la fila «Examen
 * del Modulo»— y el candado de modulos. Antes esa misma pregunta se respondia
 * descargando el examen entero del modulo abierto, asi que las respuestas
 * viajaban al navegador del alumno sin que nadie hubiera empezado a rendirlo.
 */
export async function getQuizCountsByCourse(courseId: string): Promise<Record<string, number>> {
  const filas = await prisma.moduleQuiz.findMany({
    where: { module: { courseId } },
    select: { moduleId: true, questionsJson: true },
  });

  const salida: Record<string, number> = {};
  for (const fila of filas) {
    const total = parsearPreguntas(fila.questionsJson, fila.moduleId).length;
    if (total > 0) salida[fila.moduleId] = total;
  }
  return salida;
}

/**
 * Trae una sola vez los examenes que quedaron en el archivo antiguo.
 *
 * Se ejecuta al arrancar. Solo importa los modulos que existen en la base y que
 * todavia no tienen examen, asi que repetirlo no pisa nada. Un examen cuyo
 * modulo ya no existe se descarta: la clave foranea no lo admitiria, y ese
 * examen ya era inalcanzable.
 */
export async function importarExamenesHeredados(): Promise<number> {
  if (!fs.existsSync(ARCHIVO_HEREDADO)) return 0;

  let heredados: Record<string, QuizQuestion[]>;
  try {
    heredados = JSON.parse(fs.readFileSync(ARCHIVO_HEREDADO, 'utf-8') || '{}');
  } catch (error) {
    logger.error('No se pudo leer el archivo antiguo de examenes', { error: String(error) });
    return 0;
  }

  const idsDeArchivo = Object.keys(heredados);
  if (idsDeArchivo.length === 0) return 0;

  const modulosExistentes = new Set(
    (await prisma.module.findMany({ where: { id: { in: idsDeArchivo } }, select: { id: true } })).map((m) => m.id),
  );
  const yaImportados = new Set(
    (await prisma.moduleQuiz.findMany({ where: { moduleId: { in: idsDeArchivo } }, select: { moduleId: true } })).map(
      (q) => q.moduleId,
    ),
  );

  let importados = 0;
  for (const moduleId of idsDeArchivo) {
    if (!modulosExistentes.has(moduleId) || yaImportados.has(moduleId)) continue;
    const cleaned = limpiarPreguntas(heredados[moduleId]);
    if (cleaned.length === 0) continue;
    await prisma.moduleQuiz.create({ data: { moduleId, questionsJson: JSON.stringify(cleaned) } });
    importados++;
  }

  if (importados > 0) {
    logger.info('Examenes traidos del archivo antiguo a la base de datos', {
      importados,
      archivo: ARCHIVO_HEREDADO,
    });
  }
  return importados;
}

/**
 * Mezcla aleatoriamente las opciones de una pregunta y reubica el índice correcto.
 * Garantiza que la respuesta correcta quede distribuida de forma impredecible entre A, B, C y D.
 */
export function shuffleQuestionOptions(question: QuizQuestion): QuizQuestion {
  const originalOptions = [...question.options];
  if (originalOptions.length < 2) return question;

  const originalCorrectIndex =
    typeof question.correctIndex === 'number' &&
    question.correctIndex >= 0 &&
    question.correctIndex < originalOptions.length
      ? question.correctIndex
      : 0;

  const correctOptionValue = originalOptions[originalCorrectIndex];

  // Algoritmo Fisher-Yates para barajar las opciones
  const shuffled = [...originalOptions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const newCorrectIndex = shuffled.findIndex((opt) => opt === correctOptionValue);

  return {
    ...question,
    options: shuffled,
    correctIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
  };
}

function normalizeText(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'en', 'y', 'o', 'a', 'que', 'para', 'por', 'con', 'es', 'son',
  'al', 'se', 'su', 'sus', 'como', 'sobre', 'este', 'esta', 'estos', 'estas',
  'the', 'an', 'in', 'on', 'and', 'or', 'to', 'for', 'with', 'is', 'are',
]);

/**
 * Calcula una puntuación de similitud semántica y léxica (0.0 a 1.0) entre una opción de respuesta
 * y la justificación pedagógica de la pregunta.
 */
export function computeOptionExplanationScore(option: string, explanation: string): number {
  const normOpt = normalizeText(option);
  const normExp = normalizeText(explanation);
  if (!normOpt || !normExp) return 0;

  // Substring directo o frase inicial extensa
  if (normOpt.length >= 10 && normExp.includes(normOpt)) {
    return 1.0;
  }
  const prefix25 = normOpt.slice(0, 25);
  if (prefix25.length >= 12 && normExp.includes(prefix25)) {
    return 0.95;
  }

  const optWords = normOpt.split(' ').filter((w) => w.length > 2 && !STOP_WORDS.has(w));
  if (optWords.length === 0) return 0;

  let matchedWords = 0;
  for (const word of optWords) {
    if (normExp.includes(word)) {
      matchedWords++;
    }
  }

  const wordRatio = matchedWords / optWords.length;

  // Bonus por n-gramas / frases consecutivas de 2 palabras
  let bigramBonus = 0;
  if (optWords.length >= 2) {
    let matchedBigrams = 0;
    for (let i = 0; i < optWords.length - 1; i++) {
      const bigram = `${optWords[i]} ${optWords[i + 1]}`;
      if (normExp.includes(bigram)) matchedBigrams++;
    }
    bigramBonus = (matchedBigrams / (optWords.length - 1)) * 0.3;
  }

  return Math.min(1.0, wordRatio * 0.7 + bigramBonus);
}

export interface ReconcileResult {
  question: QuizQuestion;
  changed: boolean;
  oldIndex: number;
  newIndex: number;
  reason?: string;
}

/**
 * Concilia y asegura la consistencia semántica entre las opciones y la justificación pedagógica.
 * Si la opción marcada tiene baja coincidencia con la explicación pero otra opción tiene una
 * correspondencia evidente (como cuando el LLM alucina el índice numérico), reubica el índice correcto.
 */
export function reconcileQuestionCorrectIndex(question: QuizQuestion): ReconcileResult {
  const options = question.options || [];
  if (options.length < 2 || !question.explanation || !question.explanation.trim()) {
    return {
      question,
      changed: false,
      oldIndex: typeof question.correctIndex === 'number' ? question.correctIndex : 0,
      newIndex: typeof question.correctIndex === 'number' ? question.correctIndex : 0,
    };
  }

  const currentIdx =
    typeof question.correctIndex === 'number' && question.correctIndex >= 0 && question.correctIndex < options.length
      ? question.correctIndex
      : 0;

  const scores = options.map((opt) => computeOptionExplanationScore(opt, question.explanation));
  const currentScore = scores[currentIdx] ?? 0;

  let bestIdx = currentIdx;
  let bestScore = currentScore;

  for (let i = 0; i < scores.length; i++) {
    if (scores[i] > bestScore) {
      bestScore = scores[i];
      bestIdx = i;
    }
  }

  // Criterio de reconciliación seguro:
  // 1. Debe haber un candidato distinto al actual.
  // 2. La puntuación del candidato debe ser alta (>= 0.60).
  // 3. El margen de ventaja sobre la opción actualmente marcada debe ser contundente (>= 0.35).
  if (bestIdx !== currentIdx && bestScore >= 0.6 && (bestScore - currentScore) >= 0.35) {
    return {
      question: {
        ...question,
        correctIndex: bestIdx,
      },
      changed: true,
      oldIndex: currentIdx,
      newIndex: bestIdx,
      reason: `La justificación pedagógica describe la opción [${String.fromCharCode(65 + bestIdx)}] en lugar de [${String.fromCharCode(65 + currentIdx)}].`,
    };
  }

  return { question, changed: false, oldIndex: currentIdx, newIndex: currentIdx };
}

/**
 * Normaliza y valida una pregunta devuelta por la IA, admitiendo tanto el nuevo formato semántico
 * `{ text, correctAnswer, distractors, explanation }` como el formato legado `{ options, correctIndex }`.
 * Garantiza barajado determinista y consistencia semántica absoluta.
 */
export function normalizeAiQuestion(raw: any, fallbackModuleTitle: string, index: number): QuizQuestion {
  const text = String(raw.text || raw.question || `Pregunta ${index + 1} sobre ${fallbackModuleTitle}`).trim();
  const explanation = String(
    raw.explanation || raw.justification || raw.feedback || 'Respuesta verificada en las clases del módulo.'
  ).trim();

  // Caso 1: Nuevo formato semántico seguro: { text, correctAnswer, distractors: [3 items], explanation }
  if (raw.correctAnswer && Array.isArray(raw.distractors) && raw.distractors.length >= 2) {
    const correctText = String(raw.correctAnswer).trim();
    const cleanDistractors = raw.distractors
      .map((d: any) => String(d).trim())
      .filter((d: string) => d.length > 0 && d !== correctText)
      .slice(0, 3);

    while (cleanDistractors.length < 3) {
      cleanDistractors.push(`Alternativa ${cleanDistractors.length + 1}`);
    }

    const rawOptions = [correctText, ...cleanDistractors];

    // Barajado Fisher-Yates en Node.js
    const shuffled = [...rawOptions];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const correctIdx = shuffled.indexOf(correctText);

    const question: QuizQuestion = {
      id: `ai_q_${Date.now()}_${index + 1}`,
      text,
      options: shuffled,
      correctIndex: correctIdx >= 0 ? correctIdx : 0,
      explanation,
    };

    return reconcileQuestionCorrectIndex(question).question;
  }

  // Caso 2: Formato legado o alternativo con options [...]
  let options =
    Array.isArray(raw.options) && raw.options.length >= 2
      ? raw.options.map((o: any) => String(o).trim()).filter(Boolean).slice(0, 4)
      : ['Opción A', 'Opción B', 'Opción C', 'Opción D'];

  while (options.length < 4) {
    options.push(`Opción ${String.fromCharCode(65 + options.length)}`);
  }

  // Resolver índice correcto desde múltiples posibilidades de LLMs
  let resolvedIndex = 0;
  const rawCorrect =
    raw.correctIndex ??
    raw.correct_index ??
    raw.correctAnswer ??
    raw.correct_answer ??
    raw.correctOption ??
    raw.answer;

  if (typeof rawCorrect === 'number' && rawCorrect >= 0 && rawCorrect < options.length) {
    resolvedIndex = rawCorrect;
  } else if (typeof rawCorrect === 'string') {
    const trimmed = rawCorrect.trim();
    if (/^\d+$/.test(trimmed)) {
      const parsedNum = parseInt(trimmed, 10);
      if (parsedNum >= 0 && parsedNum < options.length) resolvedIndex = parsedNum;
    } else if (/^[A-Da-d]$/.test(trimmed)) {
      const letterIdx = trimmed.toUpperCase().charCodeAt(0) - 65;
      if (letterIdx >= 0 && letterIdx < options.length) resolvedIndex = letterIdx;
    } else {
      const matchIdx = options.findIndex((opt) => opt.toLowerCase() === trimmed.toLowerCase());
      if (matchIdx >= 0) resolvedIndex = matchIdx;
    }
  }

  const baseQuestion: QuizQuestion = {
    id: `ai_q_${Date.now()}_${index + 1}`,
    text,
    options,
    correctIndex: resolvedIndex,
    explanation,
  };

  // Reconciliación semántica previa por si el LLM emitió un índice desfasado
  const reconciled = reconcileQuestionCorrectIndex(baseQuestion);

  // Barajado determinista
  return shuffleQuestionOptions(reconciled.question);
}

export interface AuditRepairSummary {
  scannedModules: number;
  totalQuestions: number;
  inconsistentQuestionsCount: number;
  repairedModulesCount: number;
  repairedQuestions: Array<{
    moduleId: string;
    moduleTitle?: string;
    courseTitle?: string;
    questionText: string;
    oldCorrectIndex: number;
    newCorrectIndex: number;
    oldOptionText: string;
    newOptionText: string;
    explanation: string;
    reason: string;
  }>;
  dryRun: boolean;
}

/**
 * Audita y repara discrepancias entre respuestas correctas y justificaciones pedagógicas
 * en todos los exámenes almacenados en la base de datos de producción.
 */
export async function auditAndRepairAllQuizzes(options?: { dryRun?: boolean }): Promise<AuditRepairSummary> {
  const dryRun = options?.dryRun ?? false;
  const rows = await prisma.moduleQuiz.findMany({
    include: {
      module: {
        include: {
          course: { select: { title: true } },
        },
      },
    },
  });

  const summary: AuditRepairSummary = {
    scannedModules: rows.length,
    totalQuestions: 0,
    inconsistentQuestionsCount: 0,
    repairedModulesCount: 0,
    repairedQuestions: [],
    dryRun,
  };

  for (const row of rows) {
    const questions = parsearPreguntas(row.questionsJson, row.moduleId);
    summary.totalQuestions += questions.length;
    let moduleHasChanges = false;
    const updatedQuestions: QuizQuestion[] = [];

    for (const q of questions) {
      const reconcile = reconcileQuestionCorrectIndex(q);
      if (reconcile.changed) {
        moduleHasChanges = true;
        summary.inconsistentQuestionsCount++;
        summary.repairedQuestions.push({
          moduleId: row.moduleId,
          moduleTitle: row.module?.title,
          courseTitle: row.module?.course?.title,
          questionText: q.text,
          oldCorrectIndex: reconcile.oldIndex,
          newCorrectIndex: reconcile.newIndex,
          oldOptionText: q.options[reconcile.oldIndex] || '',
          newOptionText: q.options[reconcile.newIndex] || '',
          explanation: q.explanation,
          reason: reconcile.reason || 'Discrepancia entre la opción seleccionada y la justificación pedagógica.',
        });
        updatedQuestions.push(reconcile.question);
      } else {
        updatedQuestions.push(q);
      }
    }

    if (moduleHasChanges) {
      summary.repairedModulesCount++;
      if (!dryRun) {
        await saveQuizForModule(row.moduleId, updatedQuestions);
      }
    }
  }

  return summary;
}

/**
 * Genera un examen inteligente con IA a partir de los títulos y descripciones de las clases del módulo.
 */
export async function generateModuleQuizWithAi(moduleId: string, questionCount: number = 4): Promise<QuizQuestion[]> {
  const moduleData = await prisma.module.findUnique({
    where: { id: moduleId },
    include: {
      course: true,
      videos: { orderBy: { order: 'asc' } },
    },
  });

  if (!moduleData) {
    throw new Error('El módulo especificado no existe.');
  }

  const courseTitle = moduleData.course?.title || 'Curso Profesional';
  const moduleTitle = moduleData.title || 'Módulo de Aprendizaje';
  const lessonsSummary =
    moduleData.videos.map((v, i) => `${i + 1}. ${v.title}${v.description ? ` (${v.description})` : ''}`).join('\n') ||
    'Temario general del módulo.';

  const count = Math.min(Math.max(questionCount, 2), 6);

  // 1. Si Gemini API Key está configurada, intentar con Google GenAI
  if (config.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });
      const prompt = `Eres un diseñador pedagógico y evaluador experto para la plataforma LMS DocentOS.
Crea un examen interactivo de opción múltiple de exactamente ${count} preguntas para evaluar a los estudiantes sobre el siguiente contenido:

Curso: "${courseTitle}"
Módulo: "${moduleTitle}"
Lecciones y clases del módulo:
${lessonsSummary}

REGLAS ESTRICTAS DE CALIDAD PEDAGÓGICA:
- Genera exactamente ${count} preguntas relevantes, variadas y desafiantes sobre estos temas.
- Cada pregunta DEBE incluir:
  * "text": el enunciado claro de la pregunta.
  * "correctAnswer": el texto EXACTO y completo de la respuesta correcta.
  * "distractors": un arreglo con exactamente 3 opciones incorrectas pero creíbles.
  * "explanation": justificación pedagógica explicando con claridad por qué "correctAnswer" es la respuesta correcta.
- NUNCA devuelvas índices numéricos ni letras (A, B, C, D) para la opción correcta; devuelve el texto exacto en "correctAnswer". El sistema se encargará de barajar las opciones de forma equitativa.
- Devuelve ÚNICAMENTE un objeto JSON válido con la propiedad "questions" conteniendo el arreglo de preguntas.

Semilla de aleatoriedad: ${Date.now()}_${Math.random()}

Formato esperado:
{
  "questions": [
    {
      "text": "¿Pregunta sobre el contenido?",
      "correctAnswer": "Texto exacto de la respuesta correcta",
      "distractors": [
        "Opción incorrecta 1",
        "Opción incorrecta 2",
        "Opción incorrecta 3"
      ],
      "explanation": "Explicación clara y detallada del porqué."
    }
  ]
}`;

      const candidateModels = [
        process.env.GEMINI_MODEL || 'gemini-3.8-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-2.5-flash-lite',
      ];
      let responseText = '';
      
      for (const m of candidateModels) {
        try {
          // Sin plazo, un Gemini que no responde retiene la petición y su conexión
          // indefinidamente; el mismo tope que el resto de llamadas de IA.
          const resp = await ai.models.generateContent({
            model: m,
            contents: prompt,
            config: { abortSignal: AbortSignal.timeout(config.AI_REQUEST_TIMEOUT_MS) },
          });
          if (resp.text) {
            responseText = resp.text;
            break;
          }
        } catch (modelErr) {
          // Continuar con el siguiente modelo de la lista
        }
      }

      // responseText obtained from cascade
      const parsed = extractJsonObject(responseText) as { questions?: any[] };
      if (parsed && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed.questions.map((q, idx) => normalizeAiQuestion(q, moduleTitle, idx));
      }
    } catch (geminiError) {
      logger.warn('Fallo en generación con Gemini GenAI, probando proveedor secundario', { error: String(geminiError) });
    }
  }

  // 2. Si hay proveedor OpenAI o DeepSeek configurado en aiProvider
  if (isAiEnabled()) {
    try {
      const result = await requestAiJson({
        system:
          'Eres un diseñador pedagógico y evaluador para DocentOS. Devuelve únicamente un JSON con la lista de preguntas estructuradas con "text", "correctAnswer" (texto completo), "distractors" (3 opciones incorrectas) y "explanation".',
        user: `Genera ${count} preguntas de opción múltiple variadas sobre el módulo "${moduleTitle}" del curso "${courseTitle}".
Lecciones:
${lessonsSummary}

Semilla aleatoria: ${Date.now()}

Devuelve el JSON con:
{
  "questions": [
    {
      "text": "¿Pregunta sobre el contenido?",
      "correctAnswer": "Texto exacto de la respuesta correcta",
      "distractors": ["Opción incorrecta 1", "Opción incorrecta 2", "Opción incorrecta 3"],
      "explanation": "Explicación pedagógica clara del porqué."
    }
  ]
}`,
      });

      const parsed = result.data as { questions?: any[] } | undefined;
      if (parsed?.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        return parsed.questions.map((q, idx) => normalizeAiQuestion(q, moduleTitle, idx));
      }
    } catch (aiError) {
      logger.warn('Fallo en requestAiJson para examen, usando generador heurístico contextual', { error: String(aiError) });
    }
  }

  // 3. Generador Heurístico Contextual Inteligente y Dinámico (Garantiza funcionamiento offline con variación y aleatorización)
  return generateContextualQuiz(courseTitle, moduleTitle, moduleData.videos.map((v) => v.title), count);
}

/**
 * Generador pedagógico contextual dinámico basado en las lecciones para entornos sin API Keys conectadas.
 * Genera preguntas variadas y distribuye aleatoriamente las opciones para que la respuesta correcta nunca sea fija.
 */
function generateContextualQuiz(courseTitle: string, moduleTitle: string, lessonTitles: string[], count: number): QuizQuestion[] {
  const titles = lessonTitles.length > 0 ? lessonTitles : ['Fundamentos y Práctica', 'Aplicación en Proyecto', 'Mejores Técnicas', 'Optimización y Flujo'];

  // Barajar el orden de las lecciones disponibles para que cada invocación tome ángulos distintos
  const shuffledTitles = [...titles].sort(() => Math.random() - 0.5);

  const questionTemplates = [
    (lesson: string, mod: string, _crs: string) => ({
      text: `¿Cuál es el objetivo primordial abordado en la lección "${lesson}" dentro del módulo "${mod}"?`,
      correct: `Comprender y dominar la aplicación práctica de los principios desarrollados en "${lesson}".`,
      distractors: [
        'Omitir las pautas de validación y pasar directamente al siguiente temario.',
        'Ignorar las recomendaciones metodológicas expuestas en la sesión.',
        'Descartar las herramientas sugeridas por el mentor en esta lección.',
      ],
      explanation: `La lección "${lesson}" se enfoca en consolidar los conocimientos clave necesarios para dominar el módulo "${mod}".`,
    }),
    (lesson: string, mod: string, _crs: string) => ({
      text: `Al momento de poner en práctica lo explicado en "${lesson}", ¿cuál es el paso recomendado?`,
      correct: 'Seguir la metodología estructurada paso a paso y verificar los resultados de cada fase.',
      distractors: [
        'Saltar la fase de comprobación inicial para ahorrar tiempo de ejecución.',
        'Modificar la configuración general sin realizar pruebas de verificación.',
        'Evitar la revisión de las pautas técnicas establecidas para el módulo.',
      ],
      explanation: `Seguir un enfoque paso a paso y verificar los resultados garantiza una asimilación técnica sólida de "${lesson}".`,
    }),
    (lesson: string, mod: string, crs: string) => ({
      text: `¿Qué impacto positivo genera el dominio de "${mod}" en el avance global del curso "${crs}"?`,
      correct: `Proporciona las bases conceptuales y prácticas necesarias para abordar con éxito las etapas avanzadas de "${crs}".`,
      distractors: [
        'Provoca bloqueos obligatorios en el resto de los módulos disponibles.',
        'Reduce la efectividad de las evaluaciones formativas y certificaciones.',
        'Invalida el progreso previo completado en la plataforma.',
      ],
      explanation: `Completar satisfactoriamente "${mod}" asegura una base firme para el desarrollo integral del curso.`,
    }),
    (lesson: string, mod: string, _crs: string) => ({
      text: `En el contexto de la clase "${lesson}", ¿cómo se asegura la calidad y efectividad del aprendizaje?`,
      correct: 'Mediante la resolución de ejercicios prácticos, análisis de casos y autoevaluación reflexiva.',
      distractors: [
        'A través de la simple memorización pasiva sin interactuar con los ejemplos.',
        'Evitando contrastar los resultados con las explicaciones del mentor.',
        'Desestimando los recursos complementarios y guías de apoyo.',
      ],
      explanation: `La práctica activa y la autoevaluación consolidan las competencias técnicas expuestas en "${lesson}".`,
    }),
    (lesson: string, mod: string, _crs: string) => ({
      text: `¿Cuál de las siguientes afirmaciones describe con mayor precisión la importancia de "${lesson}"?`,
      correct: `Constituye un pilar fundamental para estructurar correctamente las tareas del módulo "${mod}".`,
      distractors: [
        'Es un contenido secundario que no tiene relación con los temas del curso.',
        'Debe evitarse en implementaciones reales por motivos de rendimiento.',
        'Reemplaza por completo a los estándares profesionales de la industria.',
      ],
      explanation: `"${lesson}" aporta conceptos esenciales que facilitan la comprensión integral del módulo.`,
    }),
    (lesson: string, mod: string, _crs: string) => ({
      text: `¿Qué buena práctica pedagógica se enfatiza al estudiar "${lesson}" en "${mod}"?`,
      correct: 'Revisar la retroalimentación y validar cada concepto antes de continuar al siguiente tema.',
      distractors: [
        'Avanzar velozmente sin comprobar la asimilación de los conceptos clave.',
        'Desactivar las validaciones de aprendizaje para terminar antes el curso.',
        'Ignorar los ejercicios de fijación sugeridos en el aula virtual.',
      ],
      explanation: 'Validar cada concepto y prestar atención a la retroalimentación asegura un aprendizaje duradero.',
    }),
  ];

  // Barajar las plantillas de preguntas para que no salgan en el mismo orden
  const shuffledTemplates = [...questionTemplates].sort(() => Math.random() - 0.5);

  const rawQuestions: QuizQuestion[] = [];

  for (let i = 0; i < count; i++) {
    const lesson = shuffledTitles[i % shuffledTitles.length];
    const templateFn = shuffledTemplates[i % shuffledTemplates.length];
    const data = templateFn(lesson, moduleTitle, courseTitle);

    // Barajar los distractores
    const shuffledDistractors = [...data.distractors].sort(() => Math.random() - 0.5);
    const rawOptions = [data.correct, ...shuffledDistractors];

    const q: QuizQuestion = {
      id: `ai_auto_${Date.now()}_${i + 1}_${Math.floor(Math.random() * 1000)}`,
      text: data.text,
      options: rawOptions,
      correctIndex: 0, // se baraja a continuación
      explanation: data.explanation,
    };

    rawQuestions.push(shuffleQuestionOptions(q));
  }

  return rawQuestions;
}

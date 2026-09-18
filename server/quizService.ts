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

const QUIZZES_DATA_DIR = path.resolve(process.cwd(), 'data');
const QUIZZES_FILE_PATH = path.join(QUIZZES_DATA_DIR, 'quizzes.json');

// Memoria caché para acceso ultrarrápido sincronizado
let quizzesCache: Record<string, QuizQuestion[]> | null = null;

/**
 * Asegura la existencia del directorio y archivo de datos.
 */
function ensureStorage(): void {
  if (!fs.existsSync(QUIZZES_DATA_DIR)) {
    fs.mkdirSync(QUIZZES_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(QUIZZES_FILE_PATH)) {
    fs.writeFileSync(QUIZZES_FILE_PATH, JSON.stringify({}, null, 2), 'utf-8');
  }
}

/**
 * Lee todos los cuestionarios persistidos.
 */
export function getAllStoredQuizzes(): Record<string, QuizQuestion[]> {
  try {
    ensureStorage();
    const raw = fs.readFileSync(QUIZZES_FILE_PATH, 'utf-8');
    quizzesCache = JSON.parse(raw || '{}');
    return quizzesCache || {};
  } catch (error) {
    logger.error('Error al leer quizzes.json', { error: String(error) });
    return quizzesCache || {};
  }
}

/**
 * Persiste los cuestionarios a disco de forma atómica.
 */
function persistQuizzes(data: Record<string, QuizQuestion[]>): void {
  ensureStorage();
  quizzesCache = data;
  const tempPath = `${QUIZZES_FILE_PATH}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tempPath, QUIZZES_FILE_PATH);
}

/**
 * Obtiene las preguntas de examen asociadas a un módulo.
 */
export function getQuizByModuleId(moduleId: string): QuizQuestion[] {
  const all = getAllStoredQuizzes();
  return all[moduleId] || [];
}

/**
 * Guarda o actualiza las preguntas de un módulo.
 */
export function saveQuizForModule(moduleId: string, questions: QuizQuestion[]): QuizQuestion[] {
  const all = { ...getAllStoredQuizzes() };

  // Limpieza y validación de las preguntas
  const cleaned: QuizQuestion[] = (questions || [])
    .map((q, idx) => {
      const rawOptions = (Array.isArray(q.options)
        ? q.options.map((o) => String(o).trim()).filter(Boolean)
        : []).slice(0, 4); // maximo 4 opciones
      
      // Asegurar que el correctIndex esté dentro del rango de opciones
      const validIndex =
        typeof q.correctIndex === 'number' &&
        q.correctIndex >= 0 &&
        q.correctIndex < rawOptions.length
          ? q.correctIndex
          : 0;

      return {
        id: q.id || `q_${Date.now()}_${idx + 1}`,
        text: String(q.text || '').trim(),
        options: rawOptions,
        correctIndex: validIndex,
        explanation: String(q.explanation || '').trim() || 'Respuesta validada por el temario del módulo.',
      };
    })
    .filter((q) => q.text.length > 0 && q.options.length >= 2);

  if (cleaned.length === 0) {
    delete all[moduleId];
  } else {
    all[moduleId] = cleaned;
  }

  persistQuizzes(all);
  return cleaned;
}

/**
 * Elimina las preguntas de un módulo.
 */
export function deleteQuizForModule(moduleId: string): boolean {
  const all = { ...getAllStoredQuizzes() };
  if (all[moduleId]) {
    delete all[moduleId];
    persistQuizzes(all);
    return true;
  }
  return false;
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

REGLAS ESTRICTAS:
- Genera exactamente ${count} preguntas relevantes, variadas y desafiantes sobre estos temas.
- Cada pregunta debe tener exactamente 4 opciones de respuesta coherentes.
- 'correctIndex' debe ser el índice numérico (0, 1, 2 o 3) de la opción correcta. IMPORTANTE: Distribuye la respuesta correcta aleatoriamente entre las 4 posiciones (no pongas siempre la opción 0 o 'A').
- 'explanation' debe explicar con claridad pedagógica por qué la respuesta es correcta.
- Devuelve ÚNICAMENTE un objeto JSON válido con la propiedad "questions" conteniendo el arreglo de preguntas.

Semilla de aleatoriedad: ${Date.now()}_${Math.random()}

Formato esperado:
{
  "questions": [
    {
      "text": "¿Pregunta sobre el contenido?",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctIndex": 2,
      "explanation": "Explicación clara del porqué."
    }
  ]
}`;

      const candidateModels = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-2.5-flash-lite'];
      let responseText = '';
      
      for (const m of candidateModels) {
        try {
          const resp = await ai.models.generateContent({
            model: m,
            contents: prompt,
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
        const rawList = parsed.questions.map((q, idx) => ({
          id: `ai_q_${Date.now()}_${idx + 1}`,
          text: String(q.text || `Pregunta ${idx + 1} sobre ${moduleTitle}`),
          options: Array.isArray(q.options) && q.options.length === 4 ? q.options.map(String) : ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
          correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3 ? q.correctIndex : 0,
          explanation: String(q.explanation || 'Respuesta verificada en las clases del módulo.'),
        }));
        return rawList.map(shuffleQuestionOptions);
      }
    } catch (geminiError) {
      logger.warn('Fallo en generación con Gemini GenAI, probando proveedor secundario', { error: String(geminiError) });
    }
  }

  // 2. Si hay proveedor OpenAI o DeepSeek configurado en aiProvider
  if (isAiEnabled()) {
    try {
      const result = await requestAiJson({
        system: 'Eres un diseñador pedagógico y evaluador para DocentOS. Devuelve únicamente un JSON con la lista de preguntas de opción múltiple estructuradas con respuestas correctas distribuidas aleatoriamente entre las 4 opciones.',
        user: `Genera ${count} preguntas de opción múltiple variadas sobre el módulo "${moduleTitle}" del curso "${courseTitle}".
Lecciones:
${lessonsSummary}

IMPORTANTE: Distribuye aleatoriamente el índice correctIndex (0, 1, 2 o 3) para que no todas las respuestas correctas sean la primera opción.
Semilla aleatoria: ${Date.now()}

Devuelve el JSON con { "questions": [ { "text": "...", "options": ["...", "...", "...", "..."], "correctIndex": 1, "explanation": "..." } ] }`,
      });

      const parsed = result.data as { questions?: any[] } | undefined;
      if (parsed?.questions && Array.isArray(parsed.questions) && parsed.questions.length > 0) {
        const rawList = parsed.questions.map((q, idx) => ({
          id: `ai_q_${Date.now()}_${idx + 1}`,
          text: String(q.text || `Pregunta ${idx + 1}`),
          options: Array.isArray(q.options) && q.options.length === 4 ? q.options.map(String) : ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
          correctIndex: typeof q.correctIndex === 'number' && q.correctIndex >= 0 && q.correctIndex <= 3 ? q.correctIndex : 0,
          explanation: String(q.explanation || 'Respuesta correcta según el contenido del módulo.'),
        }));
        return rawList.map(shuffleQuestionOptions);
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

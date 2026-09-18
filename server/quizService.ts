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
      const rawOptions = (Array.isArray(q.options)
        ? q.options.map((o) => String(o).trim()).filter(Boolean)
        : []).slice(0, 4);

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

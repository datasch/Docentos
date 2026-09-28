# 🧠 Integración de IA para Estructuración y Gestión de Cursos en Docentos

Este documento describe la arquitectura, prompts pedagógicos, ciclo de vida asíncrono y políticas de fidelidad del motor de Inteligencia Artificial para el **AI YouTube Course Builder**.

---

## 1. Principio Fundamental: Fidelidad al Contenido Real

> ⚠️ **REGLA DE ORO DE IA EN DOCENTOS**:  
> La IA **NUNCA** debe inventar contenido de un video como si lo hubiera visto.  
> Trabaja estrictamente con los metadatos disponibles (título, descripción, duración y posición). Si infiere un concepto complementario, lo formula como objetivo de aprendizaje o sugerencia de estudio, garantizando honestidad académica.

---

## 2. Proveedores de IA Soportados

El sistema soporta múltiples proveedores configurables mediante variables de entorno:

1. **Google Gemini (Recomendado)**:
   - Configurado con `GEMINI_API_KEY` o `AI_API_KEY`.
   - Utiliza modelos multimodales de última generación (`gemini-1.5-flash`, `gemini-1.5-pro`).
   - Fuerza un esquema JSON estricto (`responseSchema`) para garantizar que la salida sea 100% parseable y tipada.

2. **Generador Semántico Heurístico (Respaldo Autónomo)**:
   - Se activa de forma automática si no hay clave de API configurada o si el proveedor externo sufre una interrupción o limitación de tasa (rate limiting).
   - Analiza patrones lingüísticos en los títulos de los videos (palabras clave como "Introducción", "Fundamentos", "Hooks", "Avanzado", "Proyecto", "Deploy").
   - Agrupa los videos en módulos lógicos coherentes (Fundamentos -> Conceptos Clave -> Especialización -> Proyecto Final).
   - Genera objetivos de aprendizaje y descripciones estructuradas sin fallar la creación del curso.

---

## 3. Esquema de Entrada y Salida del Modelo

### Entrada Estructurada (`inputJson`):
```json
{
  "course_request": "Quiero crear un curso de React para desarrolladores junior. Organiza el contenido desde fundamentos hasta proyectos y genera objetivos de aprendizaje para cada módulo.",
  "videos": [
    {
      "id": "vid_1",
      "youtubeVideoId": "abc12345",
      "title": "01 - Introducción a React y Virtual DOM",
      "description": "Conceptos iniciales de React, sintaxis JSX y funcionamiento del Virtual DOM.",
      "duration": 720,
      "position": 1
    },
    {
      "id": "vid_2",
      "youtubeVideoId": "xyz67890",
      "title": "02 - Estado con useState y Renderizado",
      "description": "Cómo gestionar el estado de un componente con hooks.",
      "duration": 950,
      "position": 2
    }
  ]
}
```

### Salida Estructurada (`outputJson`):
```json
{
  "title": "React para Desarrolladores Junior: De Cero a Proyectos",
  "description": "Curso completo y práctico basado en la playlist oficial seleccionada.",
  "summary": "Domina la librería más demandada del desarrollo frontend contemporáneo.",
  "level": "BEGINNER",
  "category": "Desarrollo Web",
  "targetAudience": ["Desarrolladores JavaScript Junior", "Estudiantes de Programación Frontend"],
  "prerequisites": ["Conocimientos sólidos de JavaScript ES6", "HTML5 y CSS básico"],
  "learningOutcomes": [
    "Comprender la arquitectura basada en componentes y el Virtual DOM.",
    "Manejar el estado de la aplicación mediante React Hooks.",
    "Construir y desplegar una aplicación web completa con buenas prácticas."
  ],
  "modules": [
    {
      "title": "Módulo 1: Fundamentos y Sintaxis React",
      "description": "Bases conceptuales del Virtual DOM y componentes.",
      "objectives": ["Dominar la sintaxis JSX", "Estructurar componentes limpios"],
      "order": 1,
      "lessons": [
        {
          "title": "Introducción y Arquitectura",
          "description": "Visión global del ecosistema React.",
          "learningOutcomes": ["Explicar el ciclo de renderizado"],
          "videoYoutubeId": "abc12345",
          "durationSeconds": 720,
          "order": 1
        }
      ]
    }
  ]
}
```

---

## 4. Ciclo de Vida Asíncrono de un `AIJob`

Para evitar bloqueos de red o errores de timeout HTTP en peticiones largas, la generación se ejecuta en segundo plano:

```
[ POST /api/youtube/ai-generate ]
             │
             ▼
   Crea AIJob (PENDING) ───► Responde HTTP 200 { jobId, status: "PENDING" }
             │
   (Procesamiento Asíncrono)
             ▼
   Estado: PROCESSING (Progreso 20% -> 60% -> 80%)
             │
             ├──► Éxito: COMPLETED (Progreso 100%, outputJson guardado)
             │
             └──► Error: FAILED (Mensaje claro en campo `error`)
```

El frontend sondea el endpoint `GET /api/youtube/ai-jobs/:jobId` cada 2 segundos mostrando una barra de progreso informativa.

---

## 5. De la IA al Borrador y Publicación Humana

1. **Nunca se publica directamente**:
   El contenido estructurado por la IA se transforma en un **Curso BORRADOR** (`published: false`) al invocar `POST /api/youtube/ai-apply/:jobId`.
2. **Revisión del Mentor**:
   El mentor visualiza la estructura completa en el Dashboard y puede:
   - Modificar títulos y descripciones de módulos y lecciones.
   - Reordenar o excluir lecciones.
   - Ajustar los objetivos de aprendizaje generados.
3. **Publicación Formal**:
   Solo cuando el mentor hace clic en **"Publicar Curso"** (`POST /api/youtube/courses/:courseId/publish`), el curso pasa a estar disponible para los estudiantes en el catálogo general de Docentos.

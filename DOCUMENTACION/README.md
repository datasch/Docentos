# 📚 Documentación Técnica de DocentOS

Bienvenido a la carpeta de **DOCUMENTACIÓN** de DocentOS. En este directorio se registran de forma metódica y estructurada todos los cambios, procesos, decisiones arquitectónicas y pasos técnicos ejecutados en cada tarea del sistema.

---

## 🗂️ Índice de Tareas y Procesos

| Tarea / ID | Descripción | Módulos Afectados | Estado |
| :--- | :--- | :--- | :--- |
| [TAREA_01](./TAREA_01_FIRMA_DIGITAL_PLUGINS.md) | **Firma Digital en Configuración de Plugins** (Canvas de trazo, subida de imagen, caligrafía y estampado en Certificados PDF). | `PluginManagerView`, `SignaturePad`, `CertificateGenerator`, `PluginManager`, `CourseViewer` | ✅ Completado |
| [TAREA_02](./TAREA_02_PERSONALIZACION_CERTIFICADOS_LOGO_FONDO.md) | **Personalización Avanzada de Certificados** (Fondo Blanco/Negro, Logo Universitario, Descarga de Muestra y Exclusividad de Firma a CERTIFICATES). | `PluginManagerView`, `SignaturePad`, `CertificateGenerator`, `CourseViewer`, `PluginManager`, `seed` | ✅ Completado |
| [TAREA_03](./TAREA_03_DESIGN_SYSTEM_GIANTUCCHI_DOBLE_FIRMA.md) | **Giantucchi Design System + Logo por Defecto + Doble Firma Institucional** (Tokens CSS canónicos de la paleta de marca, logo Giantucchi por defecto en diplomas, sistema de co-certificación con Firma 1 Giantucchi derecha y Firma 2 Universidad/Instituto izquierda, metadatos centrados). | `src/index.css`, `CertificateGenerator`, `PluginManager`, `PluginManagerView`, `CourseViewer` | ✅ Completado |

---

## 📋 Protocolo de Documentación para Tareas Futuras

Para mantener la integridad y trazabilidad técnica en tareas subsiguientes, cada nueva intervención debe documentarse creando un archivo `TAREA_XX_<NOMBRE_CORTO>.md` con las siguientes secciones obligatorias:

1. **Objetivo del Requerimiento**: Descripción de lo solicitado y alcance.
2. **Diagnóstico y Análisis Previo**: Estado del código antes de la intervención.
3. **Arquitectura y Diseño**: Decisiones técnicas, interfaces y diagramas de flujo.
4. **Paso a Paso de la Implementación**: Detalle archivo por archivo de los cambios.
5. **Pruebas y Verificación**: Comprobaciones de tipos (TypeScript), pruebas funcionales y de regresión.
6. **Guía de Uso para el Usuario**: Instrucciones operativas en la interfaz gráfica.

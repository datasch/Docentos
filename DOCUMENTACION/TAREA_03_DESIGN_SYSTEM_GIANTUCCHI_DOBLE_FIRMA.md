# TAREA_03 — Giantucchi Design System, Logo por Defecto y Firma Institucional Opcional

**Fecha de Implementación:** Septiembre 2026  
**Módulo Principal:** Sistema de Certificados PDF Institucionales  
**Solicitado por:** Giancarlo Giantucchi (Mentor Director)  

---

## 1. Objetivo del Requerimiento

Implementar y perfeccionar el sistema de diplomas y acreditación de DocentOS con tres pilares fundamentales:

1. **Giantucchi Design System completo en CSS**: Integrar la paleta de marca oficial (`--color-brand-cyan`, `blue`, `purple`, `magenta`, `orange`, `yellow`) y los tokens de superficies oscuras como variables canónicas en `src/index.css`.

2. **Logo de Giantucchi por defecto**: Uso del logo oficial de Giantucchi (`/logo.avif`) de forma predeterminada con posibilidad de que las universidades o institutos suban su propio logo para sustituirlo.

3. **Sistema de Doble Firma Opcional y Layout Dinámico**:
   - **Firma 1 (Principal)**: Giantucchi (`Prof. Giancarlo Giantucchi - Mentor Director & Evaluador`).
   - **Firma 2 (Opcional)**: Universidad o Instituto acreditador (`Dirección Académica - Universidad / Instituto`).
   - Si la firma universitaria está desactivada (`enableUniversitySignature: false`), el diploma se emite con la firma de Giantucchi centrada y los metadatos distribuidos de forma simétrica.

---

## 2. Diagnóstico y Análisis Previo

### Estado antes de la intervención:
- Forzaba el layout de doble firma aún cuando la universidad no tenía firma configurada, generando textos ficticios como "Firma Decanato / Rectorado".
- `PluginManager.ts` y `PluginManagerView.tsx`: No poseían control para habilitar/deshabilitar la firma de la institución de forma opcional.
- `CourseViewer.tsx`: Emitía los certificados sin respetar el estado condicional de la segunda firma.

---

## 3. Arquitectura y Diseño

### 3.1 Paleta del Giantucchi Design System

| Token CSS | Hex | Uso |
|---|---|---|
| `--color-brand-cyan` | `#06b6d4` | Acento primario, foco, enlaces |
| `--color-brand-blue` | `#3b82f6` | Acento secundario, corporativo |
| `--color-brand-purple` | `#a855f7` | Innovación, creatividad |
| `--color-brand-magenta` | `#ec4899` | Firma Giantucchi, energía |
| `--color-brand-orange` | `#f97316` | CTA, elementos dinámicos |
| `--color-brand-yellow` | `#eab308` | Sello de verificación, diploma |
| `--color-dark-bg` | `#0a0a0f` | Fondo principal más profundo |
| `--color-dark-surface` | `#141420` | Tarjetas, secciones |
| `--color-dark-elevated` | `#1a1a2e` | Modales, dropdowns |
| `--color-dark-border` | `#2d2d44` | Separadores, bordes |

---

### 3.2 Layouts del Diploma — Canvas 1600x1130 px

#### A. Modo Firma Única Centrada (`enableUniversitySignature: false`)
```
[LOGO GIANTUCCHI o UNIVERSIDAD]
ACADEMIA GIANTUCCHI — ★ CERTIFICADO DE EXCELENCIA TÉCNICA ★
«Nombre del Estudiante»
«Título del Curso» (gradiente espectral)
(SELLO DORADO VERIFIED)

[Fecha de Emisión]         [Firma Central: Giantucchi]        [Código de Verificación]
X = 260                     canvas.width / 2 = 800             X = 1340
```

#### B. Modo Doble Firma / Co-Certificación (`enableUniversitySignature: true`)
```
[LOGO GIANTUCCHI o UNIVERSIDAD]
ACADEMIA GIANTUCCHI — ★ CERTIFICADO DE EXCELENCIA TÉCNICA ★
«Nombre del Estudiante»
«Título del Curso» (gradiente espectral)
(SELLO DORADO VERIFIED)

[Firma 2: Universidad]     [Metadatos Fecha + ID Centrales]   [Firma 1: Giantucchi]
leftCenterX = 310          canvas.width / 2 = 800              rightCenterX = 1290
```

---

### 3.3 Campos en CertificateData

```typescript
export interface CertificateData {
  studentName: string;
  courseTitle: string;
  institutionName?: string;
  // Firma 1 (Principal): Giantucchi
  signatoryTitle?: string;
  signatureImage?: string;
  // Firma 2 (Opcional - Izquierda): Universidades / Institutos
  enableUniversitySignature?: boolean;
  universitySignatoryTitle?: string;
  universitySignatureImage?: string;
  institutionLogo?: string;          // default: '/logo.avif'
  primaryColor?: string;
  backgroundColor?: 'dark' | 'white' | 'black';
  badgeText?: string;
  dateStr?: string;
  certificateId?: string;
}
```

---

## 4. Archivos Modificados

### 4.1 src/index.css
- Variables canonicas `--color-brand-*` y `--color-dark-*` en `@theme{}` y `:root{}`.
- Gradientes y utilidades del Design System.

### 4.2 src/plugins/CertificateGenerator.ts
- Sello dorado estándar con leyenda `VERIFIED / DOCENTOS ACADEMY`.
- Renderizado adaptativo de firmas (Firma Única vs Doble Firma).

### 4.3 src/plugins/PluginManager.ts
- Configuración inicial con `enableUniversitySignature: false`.

### 4.4 src/components/PluginManagerView.tsx
- Switch interactivo para **Habilitar/Deshabilitar la Firma Universitaria (Firma 2)** con colapso visual.
- Descarga de certificado de muestra respetando el estado del switch.

### 4.5 src/components/CourseViewer.tsx
- Envío de `enableUniversitySignature` al generar el diploma al 100% del curso.

---

## 5. Pruebas y Verificación

### Build de Producción
```bash
npm run build
# Exit Code: 0
# Vite 6.4.3 - 1751 módulos transformados sin errores TypeScript
```

---

## 6. Guía de Uso

### Administrador / Mentor
1. Navegar a **Administración -> Plugins -> Certificados PDF -> Configurar**.
2. **Firma Universitaria (Firma 2)**:
   - Activar el interruptor si existe convenio de co-certificación para ingresar el cargo del Decano/Rector y su firma.
   - Mantener desactivado si el certificado se emite exclusivamente bajo la firma de la Academia Giantucchi.
3. Clic en **Descargar Certificado de Muestra (PNG)** para previsualizar.

### Alumno
- Al completar el 100% del curso, hacer clic en **"Descargar diploma"**. El certificado se generará instantáneamente respetando la configuración institucional.

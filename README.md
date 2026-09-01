# 🎓 DocentOS — The AI-Native, Open-Source Learning Engine
> **Created and maintained by Giantucchi**

![License: MIT](https://img.shields.io/badge/License-MIT-06b6d4.svg)
![Version: 0.2.0-alpha.1](https://img.shields.io/badge/Version-0.2.0--alpha.1-a855f7.svg)
![Status: Alpha](https://img.shields.io/badge/Status-Alpha-f59e0b.svg)
![Architecture: AI--Native](https://img.shields.io/badge/Architecture-AI--Native-emerald400.svg)

> **Estado actual:** alpha funcional para desarrollo y evaluación local. La
> autenticación y las sesiones ya son individuales y persistentes; los pagos,
> backups y la automatización de releases aún no están listos para producción.

**DocentOS** es un motor de aprendizaje de código abierto, ultraligero, modular y nativamente potenciado por IA. Diseñado como la alternativa moderna frente a LMS tradicionales pesados o monolíticos como **Moodle** u **Odoo LMS**, DocentOS ofrece control total sobre el contenido (streaming nativo vía Google Drive API v3), gestión de roles RBAC, guías de voz motivacionales TTS sintetizadas por IA, sistema de mentoría directa e interactiva y arquitectura extensible basada en plugins.

---

## ✨ Características Principales

* 🧠 **AI-Native Learning Engine:** Asistente conversacional "Ian", generación automática de guiones de mentoría con Google Gemini AI y locución sintetizada TTS.
* 🎥 **Google Drive Video Streaming:** Reproductor nativo optimizado con indexación de archivos en tiempo real directamente desde carpetas conectadas.
* 👥 **Sistema RBAC & Mentorías:** Roles flexibles (Superadmin, Mentor, Mentee VIP, Público General) con seguimiento personalizado del progreso de estudiantes.
* 🧩 **Arquitectura Modular de Plugins:** Extensible en tiempo real con plugins para Certificados PDF firmados, Evaluaciones/Exámenes interactivos y Webhooks para Discord/Slack.
* 🎨 **100% White-Label:** Personaliza el nombre, lema, isotipo y enlaces institucionales desde variables de entorno (`.env`).
* 🏷️ **Distintivo de Marca Incorporado:** Footer predeterminado `Powered by DocentOS • Built by Giantucchi`.

---

## 🚀 Tecnologías (Stack)

* **Frontend:** React 19 (Vite), Tailwind CSS, Lucide Icons, i18next (Multilingüe: ES, EN, PT, FR, IT).
* **Backend:** Node.js, Express.js.
* **Inteligencia Artificial:** SDK oficial `@google/genai` (Gemini AI).
* **Base de Datos & ORM:** PostgreSQL con Prisma ORM y volumen persistente en Docker.

---

## 🛠️ Guía de Instalación Rápida

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/giantucchi-org/docentos.git
   cd docentos
   ```

2. **Instalar dependencias y configurar el entorno:**
   ```bash
   npm install
   cp .env.example .env
   ```
   Edita `.env` para incluir tus claves (Gemini API Key, Google Drive, Stripe, etc.):
   ```env
   VITE_APP_NAME="DocentOS"
   VITE_APP_TAGLINE="The AI-Native, Open-Source Learning Engine"
   VITE_POWERED_BY_TEXT="Powered by DocentOS • Built by Giantucchi"
   VITE_POWERED_BY_LINK="https://github.com/giantucchi/docentos"
   VITE_AI_ASSISTANT_NAME="Ian"
   ```

3. **Levantar PostgreSQL y preparar las tablas:**
   ```bash
   docker compose up -d db
   npm run prisma:generate
   npm run prisma:push
   npm run prisma:seed
   ```

4. **Ejecutar la aplicación:**
   ```bash
   npm run dev
   ```

   Abre [http://localhost:3000](http://localhost:3000). Puedes comprobar la conexión a PostgreSQL en `GET /api/health`.

   Para levantar toda la instalación local con Docker en un solo paso:
   ```bash
   docker compose up -d --build
   ```

### Cuentas locales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `giantucchi@academia.com` | `admin123` |
| Mentor | `sofia.mentor@giantucchi.com` | `mentor123` |
| Mentee | `carlos.vip@giantucchi.com` | `vip123` |
| Usuario público | `estudiante@gmail.com` | `user123` |

Estas credenciales se crean únicamente mediante el seed de demostración. Deben
reemplazarse o deshabilitarse antes de publicar una instalación en Internet.

---

## 🗺️ Estado y hoja de ruta

* **Versión actual:** v0.2.0-alpha.1.
* **Versión de la API:** GET /api/version.
* **Plan funcional:** [docs/PLAN_IMPLEMENTACION_FUNCIONAL.md](docs/PLAN_IMPLEMENTACION_FUNCIONAL.md).
* **Ediciones y versionado:** [docs/EDICIONES_Y_VERSIONADO.md](docs/EDICIONES_Y_VERSIONADO.md).
* **Historial de cambios:** [CHANGELOG.md](CHANGELOG.md).

La siguiente prioridad es formalizar migraciones, backups y restauración en la
Fase 2. No despliegues esta versión alpha en Internet con datos reales sin
cambiar las credenciales de demostración y configurar HTTPS.

---

## 📄 Licencia & Atribución

Este proyecto está distribuido bajo la **Licencia MIT**.

* **Entidad Creadora & Mantenedor:** Giantucchi
* **Repositorio Oficial:** [https://github.com/giantucchi-org/docentos](https://github.com/giantucchi-org/docentos) 

`Powered by DocentOS • Built by Giantucchi`

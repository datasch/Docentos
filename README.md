# 🎓 DocentOS — The AI-Native, Open-Source Learning Engine
> **Created and maintained by Giantucchi**

![License: MIT](https://img.shields.io/badge/License-MIT-06b6d4.svg)
![Version: 0.3.0-alpha.1](https://img.shields.io/badge/Version-0.3.0--alpha.1-a855f7.svg)
![Status: Alpha](https://img.shields.io/badge/Status-Alpha-f59e0b.svg)
![Architecture: AI--Native](https://img.shields.io/badge/Architecture-AI--Native-emerald400.svg)

> **Estado actual:** alpha funcional con autenticación persistente, migraciones
> versionadas, instalación segura y backups cifrados. Los pagos reales, la
> cobertura automatizada completa y la publicación de releases siguen pendientes.

**DocentOS** es un motor de aprendizaje de código abierto, ultraligero, modular y nativamente potenciado por IA. Diseñado como la alternativa moderna frente a LMS tradicionales pesados o monolíticos como **Moodle** u **Odoo LMS**, DocentOS ofrece control total sobre el contenido (streaming nativo vía Google Drive API v3), gestión de roles RBAC, guías de voz motivacionales TTS sintetizadas por IA, sistema de mentoría directa e interactiva y arquitectura extensible basada en plugins.

---

## ✨ Características Principales

* 🧠 **AI-Native Learning Engine:** Asistente conversacional "Ian", generación automática de guiones de mentoría con Google Gemini AI y locución sintetizada TTS.
* 🎥 **Google Drive Video Streaming:** Reproductor nativo optimizado con indexación de archivos en tiempo real directamente desde carpetas conectadas.
* 👥 **Sistema RBAC & Mentorías:** Roles flexibles (Superadmin, Mentor, Mentee VIP, Público General) con seguimiento personalizado del progreso de estudiantes.
* 🧩 **Arquitectura Modular de Plugins:** Extensible en tiempo real con plugins para Certificados PDF firmados, Evaluaciones/Exámenes interactivos y Webhooks para Discord/Slack.
* 🎨 **100% White-Label:** Personaliza nombre, lema, isotipo e idioma mediante configuración cargada en tiempo de ejecución, sin recompilar el frontend.
* 🏷️ **Distintivo de Marca Incorporado:** Footer predeterminado `Powered by DocentOS • Built by Giantucchi`.

---

## 🚀 Tecnologías (Stack)

* **Frontend:** React 19 (Vite), Tailwind CSS, Lucide Icons, i18next (Multilingüe: ES, EN, PT, FR, IT).
* **Backend:** Node.js, Express.js.
* **Inteligencia Artificial:** SDK oficial `@google/genai` (Gemini AI).
* **Base de Datos & ORM:** PostgreSQL con Prisma ORM y volumen persistente en Docker.

---

## 🛠️ Guía de instalación rápida

Requiere Docker con Compose y, para preparar el archivo local, Node.js 22.

1. **Clona el repositorio e instala las herramientas locales:**

   ```bash
   git clone https://github.com/giantucchi-org/docentos.git
   cd docentos
   npm ci
   ```

2. **Prepara la configuración y secretos aleatorios:**

   ```bash
   cp .env.example .env
   npm run secrets:init
   ```

   Para un servidor público cambia al menos `APP_URL` y `ALLOWED_ORIGIN` por el
   origen HTTPS exacto. No confirmes `.env` en Git.

3. **Construye e inicia la plataforma:**

   ```bash
   docker compose config --quiet
   docker compose up -d --build
   docker compose ps
   ```

   El contenedor aplica `prisma migrate deploy` antes de iniciar la API. Si una
   migración falla, la versión incompatible no arranca. PostgreSQL permanece en
   un volumen privado y su puerto `5432` no se publica.

4. **Completa el primer arranque:**

   Abre [http://localhost:3000](http://localhost:3000) y crea el primer
   administrador con el asistente. La operación es transaccional y de un solo
   uso. Puedes comprobar el servicio en `GET /api/health`.

La guía de [despliegue, actualización, backup y restauración](docs/DEPLOYMENT.md)
incluye los procedimientos completos para un servidor.

### Cuentas locales de demostración

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `giantucchi@academia.com` | `admin123` |
| Mentor | `sofia.mentor@giantucchi.com` | `mentor123` |
| Mentee | `carlos.vip@giantucchi.com` | `vip123` |
| Usuario público | `estudiante@gmail.com` | `user123` |

Estas credenciales no se crean en una instalación normal. El seed solo se
ejecuta con `SEED_DEMO_DATA=true` y DocentOS rechaza esa opción cuando
`DOCENTOS_ENV=production`.

---

## 🗺️ Estado y hoja de ruta

* **Versión actual:** v0.3.0-alpha.1.
* **Versión de la API:** GET /api/version.
* **Plan funcional:** [docs/PLAN_IMPLEMENTACION_FUNCIONAL.md](docs/PLAN_IMPLEMENTACION_FUNCIONAL.md).
* **Ediciones y versionado:** [docs/EDICIONES_Y_VERSIONADO.md](docs/EDICIONES_Y_VERSIONADO.md).
* **Historial de cambios:** [CHANGELOG.md](CHANGELOG.md).

La Fase 2 de ciclo de vida de datos está completada. La siguiente prioridad es
la Fase 3: pagos verificables, acceso comercial a cursos y funciones académicas
sin simulaciones. Esta versión sigue siendo alpha; antes de exponerla configura
HTTPS, entrega de recuperación de contraseña, almacenamiento S3 y alertas.

---

## 📄 Licencia & Atribución

Este proyecto está distribuido bajo la **Licencia MIT**.

* **Entidad Creadora & Mantenedor:** Giantucchi
* **Repositorio Oficial:** [https://github.com/giantucchi-org/docentos](https://github.com/giantucchi-org/docentos) 

`Powered by DocentOS • Built by Giantucchi`

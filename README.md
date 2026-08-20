# 🎓 DocentOS — The AI-Native, Open-Source Learning Engine
> **Created and maintained by Giantucchi**

![License: MIT](https://img.shields.io/badge/License-MIT-06b6d4.svg)
![Status: Production Ready](https://img.shields.io/badge/Status-v2.5_Enterprise-a855f7.svg)
![Architecture: AI--Native](https://img.shields.io/badge/Architecture-AI--Native-emerald400.svg)

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

* **Frontend:** React 18 (Vite), Tailwind CSS, Lucide Icons, i18next (Multilingüe: ES, EN, PT, FR, IT).
* **Backend:** Node.js, Express.js.
* **Inteligencia Artificial:** SDK oficial `@google/genai` (Gemini AI).
* **Base de Datos & ORM:** PostgreSQL con Prisma ORM (almacenamiento persistente en memoria / SQL).

---

## 🛠️ Guía de Instalación Rápida

1. **Clonar el repositorio:**
   ```bash
   git clone https://github.com/giantucchi-org/docentos.git
   cd docentos
   ```

2. **Configurar el entorno (.env):**
   ```bash
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

3. **Ejecutar la aplicación:**
   ```bash
   npm run dev
   ```

---

## 📄 Licencia & Atribución

Este proyecto está distribuido bajo la **Licencia MIT**.

* **Entidad Creadora & Mantenedor:** Giantucchi
* **Repositorio Oficial:** [https://github.com/giantucchi-org/docentos](https://github.com/giantucchi-org/docentos) 

`Powered by DocentOS • Built by Giantucchi`

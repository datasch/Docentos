# 🎓 DocentOS — The AI-Native, Open-Source Learning Engine
> **Created and maintained by Giantucchi**

![License: MIT](https://img.shields.io/badge/License-MIT-06b6d4.svg)
![Version: 0.5.0-beta.1](https://img.shields.io/badge/Version-0.5.0--beta.1-a855f7.svg)
![Status: Beta](https://img.shields.io/badge/Status-Beta-emerald400.svg)
![Architecture: AI--Native](https://img.shields.io/badge/Architecture-AI--Native-emerald400.svg)

> **Estado actual:** beta funcional con pagos verificables Stripe, eventos idempotentes,
> protección estricta de contenidos, streaming protegido, recursos descargables,
> emisión de certificados persistentes con código público y suite de pruebas de negocio.
> Antes de exponerla a Internet revisa `TRUST_PROXY` en la
> [guía de despliegue](docs/DEPLOYMENT.md): con un proxy delante debe declararse.

**DocentOS** es un motor de aprendizaje de código abierto, ultraligero, modular y nativamente potenciado por IA. Diseñado como la alternativa moderna frente a LMS tradicionales pesados o monolíticos como **Moodle** u **Odoo LMS**, DocentOS ofrece control total sobre el contenido (streaming nativo vía Google Drive API v3), gestión de roles RBAC, guías de voz motivacionales TTS sintetizadas por IA, sistema de mentoría directa e interactiva y arquitectura extensible basada en plugins.

---

## ✨ Características Principales

* 🧠 **AI-Native Learning Engine:** Asistente conversacional "Ian", generación automática de guiones de mentoría con Google Gemini AI y locución sintetizada TTS.
* 🎥 **Google Drive Video Streaming:** Reproductor nativo optimizado con indexación de archivos en tiempo real directamente desde carpetas conectadas.
* 📥 **Importación de cursos desde Drive:** Pega el enlace de una carpeta y DocentOS construye el temario completo: subcarpetas como módulos, vídeos como lecciones y ZIP, PDF o subtítulos como recursos descargables. Revisas el plan antes de crear nada, y opcionalmente dejas que OpenAI o DeepSeek pulan los títulos.
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

### Modo desarrollo (recarga en caliente)

El contenedor `app` sirve una copia compilada del código: editar un archivo no
cambia nada dentro hasta reconstruir la imagen. Para desarrollar conviene el
servidor de Vite, que recarga al guardar:

```bash
docker compose -f docker-compose.yml -f docker-compose.internal.yml up -d db
docker compose stop app          # libera el puerto 3000
npm run dev                      # http://localhost:3000 con recarga en caliente
```

El overlay `docker-compose.internal.yml` publica el puerto `5432` de PostgreSQL,
que la configuración de producción mantiene cerrado a propósito; así el
`DATABASE_URL` de tu `.env` apunta a la misma base de datos que usa el
contenedor. Los cambios en `src/` se reflejan solos; los de `server.ts` piden
reiniciar el proceso.

Antes de dar algo por cerrado, vuelve al contenedor: es lo único que prueba el
paquete minificado real, el usuario no-root y las migraciones del entrypoint.

```bash
docker compose up -d --build app
```

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

* **Versión actual:** v0.5.0-beta.1.
* **Versión de la API:** GET /api/version.
* **Plan funcional:** [docs/PLAN_IMPLEMENTACION_FUNCIONAL.md](docs/PLAN_IMPLEMENTACION_FUNCIONAL.md).
* **Ediciones y versionado:** [docs/EDICIONES_Y_VERSIONADO.md](docs/EDICIONES_Y_VERSIONADO.md).
* **Reproductor nativo (propuesta):** [docs/PLAN_REPRODUCTOR_NATIVO.md](docs/PLAN_REPRODUCTOR_NATIVO.md).
* **Historial de cambios:** [CHANGELOG.md](CHANGELOG.md).

Las Fases 0 a 5 del plan funcional están implementadas, más la importación de
cursos desde Google Drive (sección 5.2 del plan). Esta versión sigue siendo
beta; antes de exponerla configura HTTPS, `STRIPE_WEBHOOK_SECRET`, entrega de
recuperación de contraseña, almacenamiento S3 y alertas.

## 🧪 Ejecutar la suite de pruebas

Las pruebas se ejecutan contra PostgreSQL real y requieren los datos de
demostración cargados. El puerto de la base de datos de producción no se publica,
así que se usa una instancia desechable:

```bash
docker run -d --rm --name docentos_test_db \
  -e POSTGRES_USER=docentos_ci \
  -e POSTGRES_PASSWORD=docentos_ci_password \
  -e POSTGRES_DB=docentos_ci_db \
  -p 55432:5432 postgres:15-alpine

export DATABASE_URL='postgresql://docentos_ci:docentos_ci_password@localhost:55432/docentos_ci_db?schema=public'
export DOCENTOS_ENV=development SEED_DEMO_DATA=true

npx prisma migrate deploy
npx tsx prisma/seed.ts   # obligatorio: las pruebas usan los datos de demostración
npm test                 # 190 pruebas: negocio, sesiones, seguridad, importación desde Drive,
                         # exámenes por módulo y navegación del alumno

docker stop docentos_test_db
```

---

## 🤖 Integración continua y publicación de imágenes

El repositorio compila y publica sus propias imágenes en **GHCR** (GitHub
Container Registry); no hace falta compilar en el servidor.

| Workflow | Cuándo se dispara | Qué hace |
|---|---|---|
| `.github/workflows/ci.yml` | `push` y `pull_request` a `main` | Tipado, migraciones sobre PostgreSQL real, las 190 pruebas, auditoría de dependencias, compilación de la imagen y escaneo Trivy. Al integrar en `main` publica además `:edge`. |
| `.github/workflows/release.yml` | `push` de una etiqueta `v*` | Imagen multi-arquitectura (amd64 y arm64) con SBOM y procedencia, firmada con Cosign, más el GitHub Release. |

Dos etiquetas móviles con significados distintos: **`edge`** es el último `main`
verificado y **`latest`** solo aparece en versiones estables, nunca en `alpha`,
`beta` ni `rc`. Para un despliegue reproducible ancla el digest o el `sha-xxxxxxx`
en lugar de un nombre móvil.

```bash
# Última versión publicada
docker pull ghcr.io/giantucchi-org/docentos:0.5.0-beta.1

# Verificar la firma antes de desplegar
cosign verify ghcr.io/giantucchi-org/docentos:0.5.0-beta.1 \
  --certificate-identity-regexp '^https://github.com/giantucchi-org/docentos/' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
```

En el servidor se consume con `docker-compose.community.yml`, que no compila nada:

```bash
DOCENTOS_IMAGE=ghcr.io/giantucchi-org/docentos:0.5.0-beta.1 \
  docker compose -f docker-compose.community.yml up -d
```

### Puesta en marcha del CI (una sola vez)

1. **Settings → Actions → General → Workflow permissions:** marca *Read and
   write permissions*. Sin esto el workflow no puede publicar en Packages.
2. **Primera publicación:** el paquete nace privado. En *Packages → docentos →
   Package settings → Change package visibility* cámbialo a **Public** si el
   servidor debe descargarlo sin credenciales.
3. **Despliegue automático (opcional):** copia el *Deploy Webhook* de Coolify y
   guárdalo en *Settings → Secrets and variables → Actions* como
   `COOLIFY_WEBHOOK_URL`. Ambos workflows lo llaman al terminar; si el secreto
   no existe, el paso se omite y todo lo demás funciona igual.

### Publicar una versión

```bash
npm run verify                       # versión consistente, tipado y compilación
git tag -a v0.5.0-beta.1 -m "DocentOS 0.5.0-beta.1"
git push origin v0.5.0-beta.1
```

`npm run version:check` obliga a que `package.json` y `src/version.ts` coincidan,
así que una etiqueta nunca publica una imagen que se anuncia con otra versión.

> **Pendiente antes de volver a etiquetar.** `release.yml` construye hoy amd64 y
> arm64 en la misma máquina Intel, emulando ARM con QEMU. La emulación es tan
> lenta con las dependencias nativas de este proyecto que el trabajo agota su
> límite de tiempo sin llegar a publicar nada. Ver
> [Publicación multi-arquitectura](docs/DEPLOYMENT.md#publicación-multi-arquitectura-pendiente).

## 📄 Licencia & Atribución

Este proyecto está distribuido bajo la **Licencia MIT**.

* **Entidad Creadora & Mantenedor:** Giantucchi
* **Repositorio Oficial:** [https://github.com/giantucchi-org/docentos](https://github.com/giantucchi-org/docentos) 

`Powered by DocentOS • Built by Giantucchi`

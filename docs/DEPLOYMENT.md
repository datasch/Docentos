# Guía Completa de Despliegue de DocentOS (Zero-Config)

Esta guía detalla los pasos para desplegar **DocentOS** en cualquier infraestructura o panel de control moderno en menos de 5 minutos, utilizando arquitecturas contenerizadas listos para producción.

---

## 🛠️ Requisitos Previos

* Servidor VPS o Cloud (Mínimo recomendado: 1 vCPU, 2 GB RAM).
* Puertos Abiertos: `80`, `443` y `3000` (según el panel elegido).
* Dominio o Subdominio apuntando a la dirección IP de tu servidor.

---

## 🚀 Opción 1: Coolify (Recomendado)

[Coolify](https://coolify.io/) es un PaaS Open-Source autohospedado equivalente a Heroku o Vercel.

### Pasos de Instalación:
1. Ingresa a tu panel de Coolify.
2. Crea un **Nuevo Proyecto** y selecciona **Nuevo Servicio / Aplicación**.
3. Elige la fuente **Public Repository** o **GitHub Repository** e introduce la URL del repositorio de DocentOS.
4. En **Build Pack**, selecciona **Docker Compose**.
5. Coolify detectará automáticamente el archivo `docker-compose.yml` del repositorio.
6. En la configuración del servicio `app`:
   * Asigna tu dominio en el campo **FQDN** (ej. `https://academia.midominio.com`).
   * Configura las variables de entorno adicionales si deseas personalizar (ej. `VITE_APP_NAME`, `GOOGLE_DRIVE_API_KEY`).
7. Haz clic en **Deploy**.
8. Coolify levantará PostgreSQL y la aplicación con certificados SSL Let's Encrypt automáticos.

---

## ⚡ Opción 2: Easypanel

[Easypanel](https://easypanel.io/) es un panel de gestión visual basado en Docker para desplegar aplicaciones con un solo clic.

### Pasos de Instalación:
1. Abre tu panel de Easypanel y crea un **Nuevo Proyecto** (ej. `docentos`).
2. Haz clic en **+ App** y selecciona **Compose** o **Custom App**.
3. Copia y pega el contenido del archivo `docker-compose.yml` de este repositorio.
4. En la pestaña **Domains**, vincula tu dominio apuntando al puerto de la app (`3000`).
5. Presiona el botón **Deploy**.
6. Easypanel ejecutará `entrypoint.sh` automáticamente, creando las tablas en PostgreSQL y habilitando la plataforma.

---

## 🌐 Opción 3: aaPanel

[aaPanel](https://www.aapanel.com/) es un panel web para administradores Linux con soporte nativo para Docker y Node.js.

### Método A: Despliegue mediante Docker Manager (Recomendado)
1. Instala el módulo **Docker Manager** desde la App Store de aaPanel.
2. Abre la pestaña **Docker** -> **Compose** -> **Add Compose**.
3. Selecciona la carpeta donde clonaste el repositorio (`/www/wwwroot/docentos`).
4. Haz clic en **Run / Compose Up**.
5. En la pestaña **Website**, crea un **Reverse Proxy** (Proxy Inverso) en Nginx:
   * **Target URL:** `http://127.0.0.1:3000`
   * **Domain:** `tu-dominio.com`
6. Solicita el certificado SSL Let's Encrypt gratuito desde la configuración del sitio en aaPanel.

### Método B: Despliegue Nativo Node.js + PM2 (Sin Docker)
1. Instala **PM2 Manager** y **PostgreSQL Manager** desde aaPanel.
2. Clona el repositorio en `/www/wwwroot/docentos`.
3. Crea la base de datos en PostgreSQL Manager y copia las credenciales.
4. Crea el archivo `.env` configurando la variable `DATABASE_URL`.
5. Ejecuta en la terminal de aaPanel:
   ```bash
   npm install
   npx prisma generate
   npx prisma db push
   npm run build
   ```
6. En PM2 Manager, añade un nuevo proyecto seleccionando `dist/server.js` como punto de entrada en el puerto `3000`.

---

## 💻 Opción 4: Docker Nativo (VPS / Terminal)

Ideal para administradores de sistemas y servidores Debian, Ubuntu o CentOS con Docker instalado.

### Comandos de Despliegue:

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/docentos.git
cd docentos

# 2. Desplegar los servicios en segundo plano
docker compose up -d --build

# 3. Verificar el estado de los contenedores
docker compose ps

# 4. Ver los registros de inicio en tiempo real
docker compose logs -f app
```

La plataforma estará accesible inmediatamente en `http://TU_IP:3000`.

---

## 🔐 Configuración de Variables de Entorno Recomendadas

Para un entorno de producción seguro, puedes ajustar las siguientes variables en tu panel o en el archivo `.env`:

| Variable | Descripción | Valor por Defecto |
| :--- | :--- | :--- |
| `DATABASE_URL` | Cadena de conexión a PostgreSQL | `postgresql://docentos:docentos_secret_pass@db:5432/docentos_db` |
| `JWT_SECRET` | Clave secreta para tokens de autenticación | *Generada automáticamente si falta* |
| `VITE_APP_NAME` | Nombre de tu institución / academia | `DocentOS` |
| `VITE_APP_TAGLINE` | Lema o subtítulo | `Plataforma e-Learning Open Source` |
| `GOOGLE_DRIVE_API_KEY` | Key para streaming directo de videos | *(Opcional)* |

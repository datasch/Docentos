# 📺 Integración con YouTube Data API v3 y Google OAuth 2.0 en Docentos

Esta guía detalla la configuración, alcances (scopes), flujo de autenticación, manejo de privacidad de playlists y tratamiento de errores de la integración de YouTube en **Docentos**.

---

## 1. Requisitos y Configuración en Google Cloud Console

Para habilitar la sincronización de YouTube en Docentos, es necesario registrar un proyecto en **Google Cloud Console**:

1. Ingresar a [Google Cloud Console](https://console.cloud.google.com/).
2. Crear un proyecto nuevo (ej. `Docentos-LMS`).
3. En **APIs y Servicios** > **Biblioteca**, buscar y habilitar:
   - **YouTube Data API v3**
4. En **Pantalla de Consentimiento de OAuth**:
   - Seleccionar tipo de usuario (Externo o Interno).
   - Añadir los alcances (scopes) requeridos:
     - `https://www.googleapis.com/auth/youtube.readonly`
     - `https://www.googleapis.com/auth/userinfo.email`
5. En **Credenciales**:
   - Crear credencial **ID de cliente de OAuth 2.0** (Tipo: *Aplicación web*).
   - Configurar **URIs de redireccionamiento autorizados**:
     - `http://localhost:3000/api/youtube/callback` (desarrollo local)
     - `https://tudominio.com/api/youtube/callback` (producción)
6. Copiar el `Client ID` y `Client Secret` en el archivo `.env`:
   ```bash
   YOUTUBE_CLIENT_ID="xxxx-xxxx.apps.googleusercontent.com"
   YOUTUBE_CLIENT_SECRET="GOCSPX-xxxx"
   YOUTUBE_REDIRECT_URI="http://localhost:3000/api/youtube/callback"
   YOUTUBE_API_KEY="AIzaSy..." # Opcional: para consultas públicas sin OAuth
   ```

---

## 2. Alcances (Scopes) y Autorizaciones

| Scope | Propósito | Comportamiento si no está concedido |
|---|---|---|
| `youtube.readonly` | Lectura de playlists y videos de la cuenta vinculada | No se pueden listar ni importar playlists privadas o no listadas del mentor. Solo se podrán importar playlists 100% públicas mediante API Key. |
| `userinfo.email` | Identificar y mostrar la cuenta de Google vinculada en el panel | No se muestra el correo en el badge de estado del mentor. |

> **IMPORTANTE**: Docentos solicita únicamente acceso de solo lectura (`youtube.readonly`). En ningún momento solicita permisos de modificación ni eliminación de contenido en el canal de YouTube del mentor.

---

## 3. Matriz de Acceso a Playlists por Tipo de Privacidad

```
┌─────────────────┬──────────────────────────┬─────────────────────────────┐
│ Tipo de Lista   │ Sin Conexión OAuth       │ Con Cuenta de Mentor OAuth  │
├─────────────────┼──────────────────────────┼─────────────────────────────┤
│ 🌍 Pública      │ ✅ Acceso con API Key    │ ✅ Acceso con Token OAuth   │
├─────────────────┼──────────────────────────┼─────────────────────────────┤
│ 🔗 No Listada   │ ⚠️ Requiere ID o OAuth   │ ✅ Acceso garantizado       │
├─────────────────┼──────────────────────────┼─────────────────────────────┤
│ 🔒 Privada (de) │ ❌ Acceso denegado (403) │ ✅ Permitido si pertenece a │
│    la cuenta    │ (PLAYLIST_PRIVATE)       │    la cuenta autorizada     │
├─────────────────┼──────────────────────────┼─────────────────────────────┤
│ ⛔ Privada (de) │ ❌ Acceso denegado (403) │ ❌ Acceso denegado (403)    │
│    terceros     │                          │    (No autorizado por Google│
└─────────────────┴──────────────────────────┴─────────────────────────────┘
```

**Regla de Seguridad Fundamental**: Conocer la URL de una playlist privada ajena **NUNCA** permite el acceso en Docentos. El backend ejecuta la consulta directamente contra la API oficial de Google firmando la petición con el Access Token del mentor. Si Google devuelve `403 Forbidden` o `404 Not Found`, la aplicación bloquea la operación y notifica al usuario sin exponer datos sensibles.

---

## 4. Ciclo de Vida del Token y Cifrado

1. **Almacenamiento Seguro**:
   - `accessTokenEnc` y `refreshTokenEnc` se almacenan en PostgreSQL cifrados con **AES-256-GCM** utilizando la clave maestra `DOCENTOS_ENCRYPTION_KEY`.
   - Cada valor cifrado incluye un Vector de Inicialización (IV) único y una Etiqueta de Autenticación (Auth Tag) para evitar alteraciones.

2. **Renovación Automática (Auto-refresh)**:
   - Antes de cada llamada a la API de YouTube, el servicio verifica `tokenExpiresAt`.
   - Si faltan menos de 2 minutos para su expiración o si Google responde `401 Unauthorized`, Docentos ejecuta automáticamente el intercambio de `refresh_token`, actualiza los tokens cifrados en la base de datos y reintenta la solicitud sin interrumpir la experiencia del usuario.

3. **Revocación y Desconexión**:
   - Cuando el mentor pulsa **"Desconectar YouTube"**, Docentos invoca el endpoint oficial `https://oauth2.googleapis.com/revoke` y elimina el registro de `YouTubeConnection` de la base de datos.

---

## 5. Manejo de Errores y Códigos del Sistema

El servicio unifica los errores bajo la clase `YouTubeError` con códigos controlados:

| Código | Significado | Mensaje al Usuario |
|---|---|---|
| `NO_CONNECTION` | El mentor no ha conectado su cuenta | "Debes vincular tu cuenta de YouTube para continuar." |
| `INVALID_URL` | URL de playlist malformada | "El enlace proporcionado no es una playlist válida de YouTube." |
| `PLAYLIST_NOT_FOUND` | La playlist no existe o fue borrada | "No se encontró la playlist indicada en YouTube." |
| `PLAYLIST_PRIVATE` | Playlist privada no accesible | "La playlist es privada y no pertenece a tu cuenta autorizada." |
| `API_LIMIT_EXCEEDED`| Cuota de Google Cloud agotada | "Se alcanzó el límite temporal de peticiones a YouTube. Intenta más tarde." |
| `TOKEN_EXPIRED` | Credenciales expiradas y no renovables | "Tu sesión de YouTube ha expirado. Por favor, vuelve a vincularla." |

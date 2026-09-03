# Política de Privacidad y Telemetría de DocentOS

**Versión:** 0.5.0-beta.1 / 1.0.0 Ready  
**Fecha de actualización:** 2 de septiembre de 2026  
**Compromiso:** Privacidad por diseño, soberanía de datos y cero rastreo por defecto.

---

## 1. Principio Fundamental: Tus Datos Pertenecen a Tu Institución

DocentOS es una plataforma LMS 100% de código abierto diseñada para que cualquier institución educativa, academia o empresa sea la única y legítima dueña de su base de datos, contenidos e información de usuarios.

* **Cero telemetría por defecto:** DocentOS no envía ninguna señal, estadística o métrica hacia servidores de Giantucchi ni de terceros a menos que el administrador active voluntariamente la casilla de verificación correspondiente durante la instalación inicial.
* **Cero rastreo publicitario:** No existen cookies de terceros, píxeles de seguimiento ni conexiones a redes publicitarias.
* **Cifrado de credenciales:** Todas las contraseñas son procesadas con algoritmos de derivación de claves criptográficas robustas (bcrypt con salt aleatorio).
* **Sesiones HttpOnly y SameSite:** Las cookies de autenticación no son accesibles mediante scripts de frontend (protección XSS) y cuentan con política estricta de origen cruzado (CSRF).

---

## 2. Telemetría Opcional ("Call Home")

Durante el asistente de configuración inicial (`/setup`), el administrador puede opcionalmente permitir la notificación de activación de instancia.

### Datos mínimos transmitidos (únicamente con consentimiento explícito):
1. Correo electrónico del administrador (`adminEmail`).
2. Nombre del administrador (`adminName`).
3. Nombre asignado a la plataforma (`appName`).
4. Fecha y hora de instalación (`installedAt`).
5. Versión de DocentOS instalada (`version`).
6. Entorno de ejecución (`environment`: production / development).

### Datos que NUNCA se recopilan ni transmiten:
❌ Datos personales de estudiantes o mentores.  
❌ Notas, calificaciones, respuestas de exámenes o progresos de lecciones.  
❌ Comentarios o notas privadas de video.  
❌ Contraseñas, hashes criptográficos o secretos de sesión.  
❌ Archivos subidos, enlaces privados de Google Drive o claves API.  
❌ Datos de tarjetas bancarias, firmas de Stripe o registros contables.  

---

## 3. Modo Desconectado / Air-Gapped (Máxima Confidencialidad)

Para instituciones gubernamentales, bancarias, sanitarias o de investigación que operan en redes intranet o entornos aislados de internet (Air-Gapped):

1. Establece la siguiente variable de entorno en tu archivo `.env` o en `docker-compose.yml`:
   ```bash
   DISABLE_TELEMETRY=true
   ```
2. Al activar esta variable, el subsistema de telemetría queda completamente anulado en el código fuente, garantizando que el servidor nunca intente realizar peticiones salientes no solicitadas.

---

## 3.1 Organización de cursos con IA (opcional)

Al pulsar «Mejorar con IA» en la importación desde Drive, DocentOS envía a
OpenAI o DeepSeek **únicamente los títulos** del curso, sus módulos y sus
lecciones, acompañados de identificadores opacos (`m0`, `l3_2`). No salen de la
instancia los identificadores de Drive, las URL de reproducción o descarga, el
contenido de los archivos, ni ningún dato de alumnos.

Esta llamada solo ocurre cuando un administrador la pide expresamente. Sin
`OPENAI_API_KEY` ni `DEEPSEEK_API_KEY` la función queda desactivada y la
importación sigue funcionando completa: en una instalación aislada no hay
ninguna petición saliente que desactivar.

---

## 4. Auditoría y Logs Seguros

DocentOS incluye un logger estructurado con enmascaramiento automático de secretos. Si descargas o compartes los logs del servidor para soporte técnico:
* Los campos sensibles como `password`, `token`, `secret`, `authorization` y `cookie` son reemplazados automáticamente por `[REDACTED]`.
* Cada solicitud incluye una cabecera de correlación `X-Request-ID` para auditar accesos sin exponer identidades comprometidas.

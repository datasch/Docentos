# Manual de Operación y Respuesta ante Incidentes — DocentOS LMS

**Destinado a:** Administradores de Sistemas, Ingenieros DevOps y Equipos de Soporte Técnico.  
**Versión de plataforma:** 0.5.0-beta.1 / 1.0.0 Ready

---

## 1. Monitorización de Salud y Sondajes

DocentOS expone tres endpoints HTTP para verificar el estado operativo del servicio:

| Endpoint | Tipo | Finalidad | Código Esperado |
|---|---|---|---|
| `GET /api/health` | Liveness | Comprueba que el proceso Node.js está activo y responde en memoria. | `200 OK` |
| `GET /api/ready` | Readiness | Ejecuta `SELECT 1` contra PostgreSQL y mide la latencia de respuesta. | `200 OK` (503 si la BD falla) |
| `GET /api/admin/metrics` | Métricas | Informa uptime, memoria RSS/Heap, total de peticiones y latencia promedio/p95. | `200 OK` (Requiere rol ADMIN) |

### Diagnóstico rápido por CLI:
```bash
# 1. Comprobar que el proceso responde
curl -i http://localhost:3000/api/health

# 2. Comprobar que PostgreSQL está listo
curl -i http://localhost:3000/api/ready

# 3. Inspeccionar las métricas de memoria y peticiones
curl -i -H "Cookie: docentos_session=<token-admin>" http://localhost:3000/api/admin/metrics
```

---

## 2. Trazabilidad de Peticiones y Correlación con `X-Request-ID`

Cada solicitud HTTP procesada por DocentOS recibe una cabecera de respuesta `X-Request-ID` (ejemplo: `req_a1b2c3d4e5f60718`).

### Procedimiento para rastrear un error reportado por un usuario:
1. Solicita al usuario el código `X-Request-ID` que aparece en el mensaje de error o en la consola de red del navegador.
2. Filtra los logs estructurados del contenedor:
   ```bash
   docker compose logs app | grep "req_a1b2c3d4e5f60718"
   ```
3. Los logs mostrarán el método HTTP, la URL solicitada, el usuario autenticado, el código de estado y el mensaje de error exacto con los datos confidenciales enmascarados automáticamente (`[REDACTED]`).

---

## 3. Procedimientos de Respuesta ante Incidentes Críticos

### Incidente 1: La sonda `/api/ready` devuelve `503 Service Unavailable`
* **Causa:** El contenedor de la base de datos `docentos_db` se detuvo, se quedó sin conexiones o el archivo de secretos no es accesible.
* **Acciones de resolución:**
  1. Verificar el estado del contenedor de base de datos:
     ```bash
     docker compose ps db
     ```
  2. Inspeccionar los registros de PostgreSQL:
     ```bash
     docker compose logs --tail=50 db
     ```
  3. Si la base de datos se detuvo por falta de memoria o fallo de proceso, reiniciarla:
     ```bash
     docker compose restart db
     ```
  4. Verificar que la sonda vuelva a responder `200 OK`:
     ```bash
     curl -i http://localhost:3000/api/ready
     ```

---

### Incidente 2: Desastre o corrupción de datos $\rightarrow$ Restauración de Respaldo Cifrado
* **Causa:** Pérdida de disco, borrado accidental o corrupción grave de tablas.
* **Acciones de resolución:**
  1. Identificar el archivo de backup más reciente en el volumen `/backups`:
     ```bash
     docker compose run --rm backup ls -l /backups
     ```
  2. Ejecutar el script de restauración oficial con confirmación explícita del nombre de la base de datos:
     ```bash
     RESTORE_CONFIRM_DATABASE=docentos_db \
     BACKUP_FILE=/backups/docentos_backup_YYYY-MM-DD_HHMMSS.sql.enc \
     docker compose --profile restore run --rm restore
     ```
  3. Reiniciar la aplicación y verificar que `/api/ready` informe las tablas restauradas con éxito.

---

### Incidente 3: Sospecha de compromiso de cuenta o ataque de fuerza bruta
* **Causa:** Detección de intentos anómalos o sospecha de credenciales filtradas.
* **Acciones de resolución:**
  1. **Revocación masiva de sesiones activas:**
     Para cerrar la sesión a todos los usuarios inmediatamente sin afectar sus datos:
     ```bash
     docker compose exec app node -e '
       import("./generated/prisma/index.js").then(async ({ PrismaClient }) => {
         const p = new PrismaClient();
         const res = await p.session.deleteMany();
         console.log("Sesiones revocadas:", res.count);
         await p.$disconnect();
       });
     '
     ```
  2. **Bloqueo preventivo de IPs atacantes:**
     El middleware de rate limiting bloquea intentos excesivos en `/api/auth/*`. Si persiste el ataque, añadir una regla en el firewall host o proxy inverso (Cloudflare, Nginx, Traefik).

---

### Incidente 4: Fallos en Webhooks de Pagos de Stripe
* **Causa:** Notificaciones de pago no procesadas o inconsistencia en firmas.
* **Acciones de resolución:**
  1. Comprobar que `STRIPE_WEBHOOK_SECRET` coincida exactamente con la clave de firma del Dashboard de Stripe.
  2. Las peticiones de Stripe que hayan fallado pueden reenviarse directamente desde el panel de Stripe ("Resend event").
  3. **Idempotencia:** DocentOS almacena los IDs de evento procesados en `PaymentWebhookEvent`. Si un evento se reenvía, el servidor responderá `{ received: true, duplicate: true }` sin duplicar cobros ni matrículas.

### Incidente 5: La importación desde Google Drive falla o llega incompleta

* **Causa:** carpeta no compartida, formato de la página pública cambiado, o
  carpeta más grande que los topes de lectura.
* **Acciones de resolución:**
  1. **«No se pudo leer la carpeta» o «carpeta privada»:** sin credenciales,
     DocentOS lee la página pública, así que la carpeta debe estar compartida
     como «Cualquier persona con el enlace». Compruébalo abriendo el enlace en
     una ventana privada.
  2. **Lectura vacía con la carpeta bien compartida:** Google cambió el formato
     interno de esa página. Configura `GOOGLE_DRIVE_API_KEY` (ver
     `docs/DEPLOYMENT.md`) para pasar a la API oficial; no depende del formato.
  3. **El plan avisa de que está incompleto:** se alcanzó `DRIVE_IMPORT_MAX_DEPTH`,
     `DRIVE_IMPORT_MAX_NODES` o `DRIVE_IMPORT_TIMEOUT_MS`. Importa por
     subcarpetas o sube el tope correspondiente; el recorrido nunca entrega una
     parte del curso en silencio.
  4. **«Demasiadas importaciones seguidas»:** el límite es de 20 peticiones cada
     15 minutos por instancia. Espera o revisa si una pestaña está reintentando
     en bucle.
  5. **Duraciones marcadas con `~`:** son estimaciones por tamaño, no un fallo.
     Solo la API de Drive publica la duración real.
  6. **La IA no mejora los títulos:** revisa el motivo que muestra la interfaz.
     Si dice que se dejó o inventó lecciones, la propuesta se descartó a
     propósito y el curso conserva el plan determinista; volver a intentarlo es
     seguro. Los fallos del proveedor quedan en el log como `ai.request.failed`,
     con proveedor y modelo pero nunca con la clave.

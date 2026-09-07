# Plan: servir el video desde DocentOS en vez de incrustar Drive

Estado: **propuesta, sin implementar**. Este documento existe para que la
decisión y las mediciones no se pierdan; nada de lo descrito aquí está en el
código todavía.

Fecha del diagnóstico: 4 de septiembre de 2026, sobre la rama `redesign/courses`.

## El problema

Una clase se reproduce hoy dentro de un `<iframe>` que apunta a
`/api/content/videos/<id>`, y esa ruta redirige al `preview` de Google Drive
(`server.ts`, ruta `/api/content/videos/:videoId`).

Ese `preview` **no es un reproductor de Drive: es un reproductor de YouTube**.
Al abrirlo carga, entre otros:

```
https://youtube.googleapis.com/iframe_api
https://youtube.googleapis.com/s/player/<build>/www-embed-player-es6.vflset/www-embed-player-es6.js
https://youtube.googleapis.com/embed/?autohide=1&ps=docs&...
```

De ahí sale el fallo que reportaron los alumnos. Bloqueando peticiones una a una
en Chromium móvil (390×844), con el mismo archivo de Drive:

| Petición bloqueada | ¿Reproduce? |
|---|---|
| `play.google.com/log` (telemetría) | Sí |
| `lh3.googleusercontent.com/drive-storage/…` (póster) | Sí |
| `youtube.googleapis.com/**` | **No** — «Hubo un problema con la reproducción de este video» |

Cualquier bloqueador de contenido, escudo de Brave, AdGuard o DNS con lista de
filtrado que alcance `youtube.googleapis.com` deja al alumno mirando un botón de
play que no hace nada. No es un fallo de DocentOS y no se puede arreglar desde
nuestro CSS: la dependencia es de Google.

Hay un segundo problema, menor pero del mismo origen: el reproductor de Drive
maqueta su interior sobre **300 px de alto pase lo que pase** —su póster mide 300
aunque el marco mida 219— y coloca la barra de controles al final de esos 300. En
un teléfono de 390 px de ancho un 16:9 da 219, así que los 81 px que faltan se
llevan la barra por delante. No se puede corregir agrandando el marco: se probó
y cambia el reproductor que Google sirve. Ver el comentario largo en
`src/components/CourseViewer.tsx`, sobre el `<div>` del reproductor.

## La propuesta

Que DocentOS pida los bytes a Drive y los sirva él mismo a un `<video>` nativo.
Se acaban las dos cosas de golpe: no hay dominio de Google en el navegador del
alumno, y el reproductor es el del sistema operativo.

| | Hoy (iframe) | Propuesta (`<video>`) |
|---|---|---|
| Bloqueadores | Lo rompen | No lo ven: mismo origen |
| Pantalla completa en móvil | La de Google, a veces recortada | Nativa del sistema |
| Alto mínimo impuesto | 300 px | Ninguno; mandamos nosotros |
| URL del archivo | No llega al cliente | Sigue sin llegar |
| Control de acceso | Ya existe | El mismo, sin cambios |
| Ancho de banda | De Google al alumno | **Del servidor de DocentOS al alumno** |

Esa última fila es la única razón por la que esto no se implementó de una vez.
Es una decisión de operación, no de código.

## Lo que ya está verificado

Los archivos del catálogo se pueden pedir por rango **sin credenciales de la API
de Drive**, porque están compartidos como «cualquiera con el enlace»:

```
$ curl -sI -H 'Range: bytes=0-1023' \
    'https://drive.usercontent.google.com/download?id=<FILE_ID>&export=download'

HTTP/2 206
content-type: video/mp4
accept-ranges: bytes
content-range: bytes 0-1023/14372141
```

Los bytes devueltos son un MP4 real (`ISO Media, MP4 Base Media v1`).

Muestreo sobre archivos reales del catálogo (60 peticiones sobre las 182
lecciones, al azar y por duración):

| | |
|---|---|
| Mínimo | 1 MB |
| Mediana | 13 MB |
| Media | 26 MB |
| Máximo encontrado | 137 MB |
| Catálogo completo (estimado) | 4,7 GB |
| Curso *Learning to Learn* (54 lecciones) | 1,39 GB por alumno que lo termine |

Todas respondieron `206` con `accept-ranges: bytes` y `content-type: video/mp4`.

### `confirm=t` es obligatorio

Casi todas las lecciones están por debajo de 100 MB, pero **hay al menos una de
137 MB**, y ahí Drive cambia de comportamiento:

```
$ curl -sI -H 'Range: bytes=0-99' '…/download?id=<137MB>&export=download'
HTTP/2 200
content-type: text/html; charset=utf-8      ← pantalla de aviso antivirus

$ curl -sI -H 'Range: bytes=0-99' '…/download?id=<137MB>&export=download&confirm=t'
HTTP/2 206
content-type: video/mp4
content-range: bytes 0-99/137101239         ← el binario
```

Sin `confirm=t`, esa clase le entrega HTML al `<video>` y no se ve nada. Con él,
funciona y además admite salto: pedir `bytes=70000000-70000099` devuelve `206`.

Por eso la comprobación del `content-type` antes de empezar el pipe, descrita más
abajo, no es una precaución teórica: hay un archivo en el catálogo que la
necesita hoy.

## Diseño del endpoint

Ruta nueva, junto a la que ya existe:

```
GET /api/content/videos/:videoId/stream
```

Pasos:

1. Resolver el vídeo y **reutilizar el control de acceso que ya hay**. La ruta
   `/api/content/videos/:videoId` de `server.ts` ya hace exactamente esto con
   `userHasCourseAccess`; se extrae a una función y la comparten las dos. No se
   duplica la comprobación: si se duplica, algún día divergen.
2. Sacar el `FILE_ID` del `embedUrl` guardado. `parseVideoSource` de
   `src/lib/videoParser.ts` ya devuelve `videoId` para las URL de Drive, y el
   servidor ya lo importa desde `server/courseAccess.ts`.
3. Pedir el archivo a
   `https://drive.usercontent.google.com/download?id=<FILE_ID>&export=download&confirm=t`
   **reenviando la cabecera `Range` del alumno tal cual**.
4. Devolver el cuerpo tal cual, copiando `status` (`200` o `206`),
   `Content-Type`, `Content-Length`, `Content-Range` y `Accept-Ranges`.

El paso 4 es donde se cometen los errores. Notas concretas:

- **Hay que propagar el `206`.** Si se responde siempre `200`, el `<video>` no
  puede buscar dentro del archivo: la barra de progreso deja de funcionar y en
  iOS el vídeo directamente no arranca.
- **Responder `HEAD`** además de `GET`. Algunos navegadores lo usan para
  descubrir la duración antes de pedir el primer rango.
- **No acumular el cuerpo en memoria.** Pipe del stream de respuesta al `res` de
  Express. Un `await response.arrayBuffer()` con 60 MB por alumno concurrente
  tumba el contenedor.
- **Cerrar el stream de origen cuando el cliente se va** (`req.on('close')`). Un
  alumno que salta de lección deja la petición a Drive abierta si no se aborta.
- **No enviar cookies de sesión a Google** ni reenviar cabeceras del alumno que
  no sean `Range`.

### El limitador de peticiones

Esto es fácil de pasar por alto y rompe la función entera. `apiRateLimiter` en
`server.ts` permite **300 peticiones cada 15 minutos por IP**. Un solo vídeo
genera decenas de peticiones por rango, y más aún si el alumno usa la barra de
progreso. Con el limitador puesto, a los pocos minutos de clase todo devuelve
`429`.

La ruta `/stream` necesita su propio limitador, mucho más holgado, o quedar fuera
del general. Es un cambio de una línea que, si se olvida, produce un fallo que
parece de Drive y no lo es.

### Errores

| Situación | Respuesta |
|---|---|
| Sin acceso al curso | `403`, igual que hoy |
| Vídeo sin `embedUrl` | `404` (existe uno así: «Reparacion Ingles», del curso *Ingles*) |
| El `embedUrl` no es de Drive | `302` a la URL, como hoy: YouTube y Vimeo siguen por iframe |
| Drive responde HTML en vez de binario | `502` con mensaje propio, **nunca** pasar el HTML al `<video>` |
| Drive responde `404` o `403` | Propagar como `502`; el alumno no tiene que ver el error de Google |

Comprobar el `content-type` de la respuesta de Drive antes de empezar el pipe es
lo que separa «no se ve el vídeo» de «esta clase ya no está disponible, avisa a
tu mentor».

## El cliente

En `src/components/CourseViewer.tsx`, donde hoy está el `<iframe>`:

- Si el proveedor es `drive` → `<video controls playsInline preload="metadata">`
  con `src={`${currentVideo.playbackUrl}/stream`}`.
- Si es cualquier otro → el `<iframe>` de siempre, sin tocar.

El campo `provider` ya viaja desde el servidor (`serializeVideo` en
`server/courseAccess.ts`) precisamente para poder decidir esto sin exponer la URL
real.

Dos avisos sobre la caja del reproductor, aprendidos a golpes:

1. **No atar el ancho ni el alto a `dvh` por debajo de `lg`.** En un móvil `dvh`
   cambia cada vez que el navegador esconde o enseña su barra al hacer scroll: el
   límite se mueve, el elemento se redimensiona y el reproductor se reinicia a
   media clase. Con `<video>` nativo el daño es menor que con el iframe, pero
   sigue siendo un salto visible.
2. **No hacer el bloque `sticky`.** Ya está documentado en el propio componente.

Con `<video>` nativo desaparece el suelo de 300 px, así que el `aspect-video`
actual vale tal cual en todos los anchos.

Lo que **no** hay que tocar: `playbackUrl` sigue siendo la misma ruta, el enlace
«Abrir el video aparte» de `LessonMetaBar` sigue funcionando, y `serializeVideo`
sigue sin mandar `embedUrl` ni `driveFileId` al navegador.

## Lo que hay que decidir antes de escribir código

1. **Ancho de banda.** El tráfico de vídeo pasa a salir del servidor de DocentOS.
   Con los tamaños medidos, un alumno que termine el curso *Learning to Learn*
   (54 lecciones) descarga del orden de un giga y medio a través del contenedor.
   Multiplicar por los alumnos previstos y contrastarlo con el límite de tráfico
   del proveedor.
2. **El contenedor `app` del Compose** pasa a servir vídeo. Revisar límites de
   memoria y CPU en `docker-compose.yml`, aunque el pipe consume poca memoria si
   se hace en streaming.
3. **Si hay un reverse proxy delante** (Nginx, Traefik, Caddy), hay que
   desactivar el *buffering* de esta ruta y subir los tiempos de espera. Con
   buffering activado el proxy intenta guardar la respuesta entera antes de
   entregarla y el alumno espera con la pantalla en negro.
4. **Caché.** Sin caché, cada reproducción vuelve a bajar de Drive. Un caché en
   disco dentro del volumen del contenedor ahorraría mucho, pero añade
   invalidación y espacio; probablemente es una segunda fase, no la primera.
5. **Cuota de Drive.** Ver la sección siguiente: hoy no es un problema, pero
   marca el techo de esta solución.

## La cuota de Drive y hasta dónde aguanta

Google **no publica** una cifra por archivo para enlaces públicos; lo único
documentado son las cuotas de la API por proyecto y los topes de cuenta (750 GB
diarios de subida, del orden de 10 TB de bajada). Lo que sí se observa de forma
consistente es un límite **por archivo, en una ventana de unas 24 horas, contra
la cuenta dueña del archivo**: para archivos por debajo de 100 MB se reporta que
entre **50 y 100 vistas o descargas** en 24 horas lo disparan. Se desbloquea solo
en 24-48 horas. El alumno vería «Demasiados usuarios han visto o descargado este
archivo recientemente».

Contra la escala actual del proyecto —**20 alumnos**— eso deja un margen de 2,5×
a 5×, y eso suponiendo el peor caso de que los veinte vean la misma lección el
mismo día. El tráfico que pasaría por el servidor sería del orden de **1,5 a
2,5 GB al día**, despreciable para cualquier VPS.

**Conclusión para hoy: implementar el plan tal cual.** Con el endpoint público,
sin credenciales de Drive y sin caché. Las dos cosas siguientes son para cuando
haga falta, no antes.

### Cuándo volver a mirar esto

Hay un detalle contraintuitivo que conviene tener presente: **el proxy concentra
la carga**. Hoy, con el iframe, cada alumno descarga desde su propia IP y su
propia sesión de Google, así que el reparto es natural. Con el proxy, todas las
peticiones salen de una sola IP —la del servidor— y el `<video>` nativo pide por
rangos, o sea muchas peticiones por reproducción. A escala pequeña da igual; a
escala grande es justo el patrón que la detección de abuso marca antes.

Revisar cuando ocurra cualquiera de estas:

- Se pasa de **~50 alumnos**, o una cohorte entera ve la misma lección el mismo
  día.
- Empiezan a aparecer `502` de origen en los registros.
- Se sube contenido de vídeo notablemente más pesado.

Las salidas, en orden de coste:

1. **Credenciales de Drive.** `GOOGLE_DRIVE_CLIENT_EMAIL` y
   `GOOGLE_DRIVE_PRIVATE_KEY` ya existen en `.env.example` y hoy están vacías.
   Pedir el archivo por la API autenticada en vez del endpoint público da cuotas
   documentadas y mucho más altas, y quita la dependencia de que el archivo sea
   público.
2. **Caché en disco dentro del contenedor.** Convierte «N alumnos = N descargas
   de Drive» en «N alumnos = 1 descarga». Es lo que hace viable el punto 1 a
   escala, así que van juntos.
3. **Sacar el vídeo de Drive**: S3, R2, Bunny o similar. Es lo que hace cualquier
   plataforma con volumen. Drive no está pensado para servir un LMS.

## Comprobaciones antes de dar por buena la implementación

- [ ] Un curso de pago sigue devolviendo `403` en `/stream` sin sesión.
- [ ] Un curso publicado gratuito sigue siendo accesible (es el comportamiento
      actual: `free_published_course` en `server/courseAccess.ts`).
- [ ] La barra de progreso permite saltar al minuto 10 de una clase de 60 MB
      (verifica que el `206` se propaga).
- [ ] Pantalla completa en un teléfono real, en vertical y en horizontal.
- [ ] Reproduce **con un bloqueador de contenido activo**. Es el motivo de todo
      esto; si no se prueba, no se ha probado nada.
- [ ] `embedUrl` y `driveFileId` siguen sin aparecer en la respuesta de
      `/api/courses`.
- [ ] Una clase de YouTube o Vimeo sigue saliendo por iframe, sin cambios.
- [ ] **La lección de 137 MB reproduce y admite salto.** Es la que destapa el
      fallo del `confirm=t` y el del `content-type`.
- [ ] El limitador no corta una clase de treinta minutos seguidos.

## Mientras tanto

El reproductor actual funciona para quien no tiene bloqueador, en móvil y en
escritorio. Para el resto, la salida es el enlace **«Abrir el video aparte»** que
hay bajo el título de la lección: apunta a `/api/content/videos/<id>`, mantiene
el control de acceso y abre el vídeo fuera del marco.

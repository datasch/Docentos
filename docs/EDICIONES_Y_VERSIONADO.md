# Ediciones y estrategia de versionado

## Objetivo

Mantener un núcleo comunitario abierto, seguro y funcional, mientras Giantucchi
desarrolla integraciones o capacidades internas con un ciclo adelantado.

La edición pública no debe recibir versiones deliberadamente dañadas,
vulnerables o incompatibles con sus datos.

## Ediciones

| Capacidad | Community | Internal |
|---|---|---|
| Núcleo React, Express y Prisma | Incluido | Consume o extiende Community |
| Autenticación, RBAC y sesiones | Compartido y seguro | Compartido y seguro |
| Cursos, progreso y mentoría | Incluido | Incluido |
| Docker Compose base | Público | Overlay privado |
| Integraciones institucionales | Configurables | Extensiones privadas opcionales |
| Branding predeterminado | DocentOS | Configuración Giantucchi |
| Secretos y credenciales | Nunca incluidos | Gestionados fuera de Git |
| Datos de clientes | Nunca incluidos | Persisten fuera de la imagen |
| Soporte y automatización interna | No requerido | Repositorio privado |

## Organización recomendada

### Repositorio público

- Contiene el núcleo DocentOS.
- Publica versiones estables y documentación comunitaria.
- Publica la imagen ghcr.io/giantucchi-org/docentos.
- No contiene secretos, datos de clientes ni módulos privados.

### Repositorio privado

- Registra la versión pública utilizada como base.
- Mantiene overlays de Docker, configuración e integraciones internas.
- Puede construir la imagen ghcr.io/giantucchi-org/docentos-internal.
- Sincroniza correcciones del núcleo público de manera regular.

Un fork privado solo debe modificar el núcleo cuando una extensión o plugin no
sea suficiente. Esto reduce conflictos al incorporar nuevas versiones públicas.

## Canales de entrega

| Canal | Uso | Estabilidad |
|---|---|---|
| internal/edge | Desarrollo interno diario | Experimental |
| release-candidate | Validación y pruebas | Candidata |
| public/stable | Comunidad | Estable y soportada |

El avance interno debe medirse por hitos aprobados, no por publicar una edición
comunitaria obsoleta. Una versión solo se promueve al canal público después de
pasar seguridad, migraciones, pruebas de actualización y restauración.

## Versionado Semántico

- Mayor: cambios incompatibles o nueva generación de arquitectura.
- Menor: funciones compatibles hacia atrás.
- Parche: correcciones compatibles.
- Prelanzamiento: alpha, beta y rc.

Ejemplos:

- v0.1.0-alpha.1: línea base Docker y PostgreSQL.
- v0.2.0-alpha.1: versión actual con autenticación y sesiones reales.
- v0.5.0-rc.1: candidata a primera versión pública.
- v1.0.0: primera versión comunitaria estable.
- v1.4.0-internal.1: ejemplo de distribución interna adelantada.

## Etiquetas de contenedor

Cada release público debe producir:

- Versión exacta: 1.0.0.
- Serie menor: 1.0.
- Serie mayor: 1.
- Canal estable: latest.
- Commit: sha-COMMIT.

La etiqueta latest nunca debe apuntar a alpha, beta, rc o internal.

## Compatibilidad de datos

- Las imágenes no contienen la base de datos.
- Cada versión declara sus migraciones Prisma.
- Una actualización ejecuta migraciones antes de iniciar.
- La versión interna registra su versión pública base.
- Todo release estable debe demostrar actualización y restauración.

## Política de secretos

- Los archivos .env reales están excluidos de Git.
- .env.example contiene únicamente nombres y marcadores de ejemplo.
- GitHub Secrets o el panel de despliegue inyectan credenciales.
- Las imágenes publicadas no contienen claves privadas.
- Los respaldos están cifrados y separados de la imagen.

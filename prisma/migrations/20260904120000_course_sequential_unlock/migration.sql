-- Progresion secuencial por curso.
--
-- Con `sequentialUnlock` activo el alumno solo tiene abierto el primer modulo;
-- el siguiente se desbloquea cuando termina todas las lecciones del anterior.
-- Por defecto queda apagado para que los cursos ya publicados sigan abiertos
-- de principio a fin, como estaban antes de esta columna.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "sequentialUnlock" BOOLEAN NOT NULL DEFAULT false;

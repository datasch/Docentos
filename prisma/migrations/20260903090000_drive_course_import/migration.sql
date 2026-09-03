-- Importacion de cursos desde una carpeta de Google Drive.
--
-- `Course.driveFolderId` guarda la carpeta de origen. Sirve para dos cosas: al
-- volver a pegar el mismo enlace se reconoce el curso ya importado en vez de
-- crear un duplicado, y al reimportar se sabe de donde salio el contenido.
ALTER TABLE "Course" ADD COLUMN IF NOT EXISTS "driveFolderId" TEXT;

CREATE INDEX IF NOT EXISTS "Course_driveFolderId_idx"
  ON "Course" ("driveFolderId");

-- Al reimportar hay que saber que archivos de Drive ya estan en el curso para
-- anadir solo lo que falta. Sin estos indices, cada importacion recorreria las
-- tablas completas de videos y recursos.
CREATE INDEX IF NOT EXISTS "VideoDriveLink_driveFileId_idx"
  ON "VideoDriveLink" ("driveFileId");

CREATE INDEX IF NOT EXISTS "CourseResource_externalFileId_idx"
  ON "CourseResource" ("externalFileId");

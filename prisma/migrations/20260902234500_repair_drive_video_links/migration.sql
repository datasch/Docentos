-- Reparacion de enlaces de video rotos por pegar la URL de Drive en el campo de ID.
--
-- El formulario pedia "el ID" y el servidor construia el embed concatenando:
--     https://drive.google.com/file/d/<lo que sea>/preview
-- Al pegar el enlace completo de Compartir, el resultado era una URL anidada
-- invalida y el reproductor quedaba en negro sin ningun aviso. Aqui se extrae el
-- identificador real de esas filas y se reconstruye el enlace. Las filas cuyo
-- identificador no puede recuperarse se dejan intactas para que el
-- administrador vuelva a introducirlas desde el panel.

UPDATE "VideoDriveLink"
SET
  "driveFileId" = substring("driveFileId" from '/file/d/([A-Za-z0-9_-]+)'),
  "embedUrl" = 'https://drive.google.com/file/d/'
               || substring("driveFileId" from '/file/d/([A-Za-z0-9_-]+)')
               || '/preview'
WHERE "driveFileId" ~ '/file/d/[A-Za-z0-9_-]+'
  AND substring("driveFileId" from '/file/d/([A-Za-z0-9_-]+)') IS NOT NULL;

-- Los identificadores demasiado cortos (por ejemplo "12") nunca fueron validos:
-- se vacia el embed para que la interfaz los muestre como pendientes en lugar de
-- ofrecer un reproductor que no puede cargar nada.
UPDATE "VideoDriveLink"
SET "embedUrl" = ''
WHERE "embedUrl" LIKE 'https://drive.google.com/file/d/%/preview'
  AND length("driveFileId") < 10
  AND "driveFileId" NOT LIKE 'pending-%'
  AND "driveFileId" NOT LIKE 'external-%';

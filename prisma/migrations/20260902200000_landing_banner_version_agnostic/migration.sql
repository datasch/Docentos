-- El banner de portada fijaba "DocentOS v2.5" como valor por defecto, una version
-- que no corresponde a la real del producto y que quedaba obsoleta en cada release.
-- Se elimina la version del texto y se corrigen las instancias ya creadas que
-- todavia conservan el texto anterior sin haber sido personalizadas.

ALTER TABLE "LandingConfig"
  ALTER COLUMN "bannerText"
  SET DEFAULT '🚀 Motor de IA optimizado, gestión de guías vocales e integración nativa con Google Drive.';

UPDATE "LandingConfig"
SET "bannerText" = '🚀 Motor de IA optimizado, gestión de guías vocales e integración nativa con Google Drive.'
WHERE "bannerText" LIKE '%DocentOS v2.5%';

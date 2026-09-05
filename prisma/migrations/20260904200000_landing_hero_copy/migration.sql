-- Nueva portada: titular y bajada del hero.
--
-- La barra vertical del titular no es decorativa: marca donde empieza el tramo
-- que la portada pinta en gradiente. Sin barra el titular va entero en blanco,
-- asi que una instalacion que ya lo tuviera editado no se rompe.
--
-- Se cambia tambien la fila 'singleton' existente, pero solo si conserva el
-- texto de fabrica anterior: si alguien ya escribio el suyo, se respeta.
ALTER TABLE "LandingConfig"
  ALTER COLUMN "heroTitle" SET DEFAULT 'Una nueva forma de aprender | con inteligencia artificial.';

ALTER TABLE "LandingConfig"
  ALTER COLUMN "heroSubtitle" SET DEFAULT 'Supera los límites de la educación tradicional. DocentOS combina rutas de aprendizaje adaptativas, mentoría sintética 24/7 y evaluación cognitiva en tiempo real para acelerar tu dominio profesional.';

UPDATE "LandingConfig"
SET "heroTitle" = 'Una nueva forma de aprender | con inteligencia artificial.'
WHERE "heroTitle" = 'El Motor de Aprendizaje Abierto con IA Nativa & Mentoría';

UPDATE "LandingConfig"
SET "heroSubtitle" = 'Supera los límites de la educación tradicional. DocentOS combina rutas de aprendizaje adaptativas, mentoría sintética 24/7 y evaluación cognitiva en tiempo real para acelerar tu dominio profesional.'
WHERE "heroSubtitle" = 'DocentOS es la alternativa moderna, liviana y modular de código abierto frente a plataformas LMS tradicionales monolíticas como Moodle u Odoo LMS.';

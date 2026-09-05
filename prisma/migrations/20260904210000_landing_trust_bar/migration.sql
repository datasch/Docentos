-- Prueba social del hero: valoracion y volumen de alumnado.
--
-- Van vacias por defecto a proposito. Son cifras de marketing y solo quien
-- administra la instalacion sabe cuales son las suyas; una instalacion recien
-- montada no debe presumir de numeros que no tiene, asi que con cualquiera de
-- las dos vacia la portada no pinta la barra.
ALTER TABLE "LandingConfig" ADD COLUMN IF NOT EXISTS "trustRating" TEXT NOT NULL DEFAULT '';
ALTER TABLE "LandingConfig" ADD COLUMN IF NOT EXISTS "trustAudience" TEXT NOT NULL DEFAULT '';

-- Esta instalacion ya venia pidiendo estas cifras concretas.
UPDATE "LandingConfig" SET "trustRating" = '4.9/5', "trustAudience" = '+12,500' WHERE "id" = 'singleton';

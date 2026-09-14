-- Testimonios reales en la portada.
--
-- Hasta ahora los testimonios eran un JSON que se escribia a mano en el editor
-- de portada: texto inventado por quien administra, sin nadie detras. Pasan a
-- salir de las opiniones que dejan las propias personas usuarias, que ya se
-- guardaban en "Feedback" pero no se leian en ningun sitio publico.
--
-- Nada se publica solo: la portada es publica y cualquiera con cuenta puede
-- escribir, asi que se nace en PENDING y solo lo aprobado se pinta.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TestimonialStatus') THEN
    CREATE TYPE "TestimonialStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
  END IF;
END
$$;

ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "status" "TestimonialStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "moderatedAt" TIMESTAMP(3);
ALTER TABLE "Feedback" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Las opiniones que ya existian son del recorrido de bienvenida: se recogieron
-- para uso interno, sin avisar de que pudieran acabar en la portada. Se quedan
-- donde estan, en PENDING, hasta que alguien las apruebe una por una.

CREATE INDEX IF NOT EXISTS "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");

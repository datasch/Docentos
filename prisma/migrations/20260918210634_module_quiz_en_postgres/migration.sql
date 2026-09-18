-- Los examenes de los modulos pasan del sistema de ficheros a PostgreSQL.
--
-- Nota: `prisma migrate dev` volvio a proponer los cuatro `ALTER COLUMN ... DROP
-- DEFAULT` sobre Feedback, Meeting, MenteeAssignment y Payment. Es la misma
-- deriva entre versiones de Prisma que ya se retiro en la migracion del segundo
-- factor: quitar ese DEFAULT rompe cualquier INSERT que no pase por el cliente,
-- y no tiene nada que ver con este cambio. Se retiro a mano otra vez.

-- CreateTable
CREATE TABLE "ModuleQuiz" (
    "moduleId" TEXT NOT NULL,
    "questionsJson" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModuleQuiz_pkey" PRIMARY KEY ("moduleId")
);

-- AddForeignKey
ALTER TABLE "ModuleQuiz" ADD CONSTRAINT "ModuleQuiz_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "Module"("id") ON DELETE CASCADE ON UPDATE CASCADE;

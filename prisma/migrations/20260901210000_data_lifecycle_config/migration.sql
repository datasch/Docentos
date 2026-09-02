-- Fase 2: configuracion institucional persistente e instalador de un solo uso.
CREATE TABLE "InstanceConfig" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "institutionName" TEXT NOT NULL DEFAULT 'DocentOS',
    "appTagline" TEXT NOT NULL DEFAULT 'Plataforma e-Learning Open Source',
    "logoInitial" TEXT NOT NULL DEFAULT 'D',
    "logoUrl" TEXT NOT NULL DEFAULT '',
    "poweredByText" TEXT NOT NULL DEFAULT 'Powered by DocentOS LMS Engine',
    "poweredByLink" TEXT NOT NULL DEFAULT 'https://github.com/giantucchi-org/docentos',
    "authorCredit" TEXT NOT NULL DEFAULT 'DocentOS Community Edition',
    "defaultLanguage" TEXT NOT NULL DEFAULT 'es',
    "assistantName" TEXT NOT NULL DEFAULT 'Ian',
    "telemetryConsent" BOOLEAN NOT NULL DEFAULT false,
    "setupCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "InstanceConfig_pkey" PRIMARY KEY ("id")
);

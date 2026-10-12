-- La firma de contratos ya forma parte del esquema y de la API. Esta tabla
-- debe crearse mediante migrate deploy antes de arrancar la nueva versión.
CREATE TABLE "UserContractSignature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contractVersion" TEXT NOT NULL,
    "contractHash" TEXT NOT NULL,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "dataRetentionUntil" TIMESTAMP(3) NOT NULL,
    "acceptedTerms" BOOLEAN NOT NULL DEFAULT true,
    "acceptedPrivacy" BOOLEAN NOT NULL DEFAULT true,
    "acceptedDataPolicy" BOOLEAN NOT NULL DEFAULT true,
    "acceptedCommercials" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserContractSignature_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserContractSignature_userId_idx" ON "UserContractSignature"("userId");
CREATE INDEX "UserContractSignature_contractVersion_idx" ON "UserContractSignature"("contractVersion");

ALTER TABLE "UserContractSignature" ADD CONSTRAINT "UserContractSignature_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

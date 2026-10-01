CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "stateHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OAuthState_stateHash_key" ON "OAuthState"("stateHash");
CREATE INDEX "OAuthState_userId_idx" ON "OAuthState"("userId");
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");
ALTER TABLE "OAuthState" ADD CONSTRAINT "OAuthState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

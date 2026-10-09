-- CreateEnum
CREATE TYPE "AdminAuthChallengeType" AS ENUM ('EMAIL_VERIFICATION', 'TOTP_ENROLLMENT', 'LOGIN_MFA');

-- CreateEnum
CREATE TYPE "AdminAuthChallengeMethod" AS ENUM ('EMAIL', 'TOTP');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "totpConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "admin_auth_challenges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AdminAuthChallengeType" NOT NULL,
    "method" "AdminAuthChallengeMethod",
    "token" TEXT NOT NULL,
    "codeHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_auth_challenges_token_key" ON "admin_auth_challenges"("token");

-- AddForeignKey
ALTER TABLE "admin_auth_challenges" ADD CONSTRAINT "admin_auth_challenges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

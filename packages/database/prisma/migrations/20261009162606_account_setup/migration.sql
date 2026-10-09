-- AlterEnum
ALTER TYPE "AdminAuthChallengeType" ADD VALUE 'PASSWORD_SETUP';

-- AlterTable
ALTER TABLE "admin_auth_challenges" ADD COLUMN     "pendingEmail" TEXT;

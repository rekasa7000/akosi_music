-- CreateEnum
CREATE TYPE "CardOwnershipSource" AS ENUM ('ADMIN_RECORDED', 'FAN_CLAIM');

-- AlterTable
ALTER TABLE "card_ownerships" ADD COLUMN     "source" "CardOwnershipSource" NOT NULL DEFAULT 'ADMIN_RECORDED';

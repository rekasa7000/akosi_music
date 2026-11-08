-- AlterTable
ALTER TABLE "artists" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "releases" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tracks" ADD COLUMN     "deletedAt" TIMESTAMP(3);

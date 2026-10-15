-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "trackId" TEXT;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - A unique constraint covering the columns `[playerId]` on the table `Device` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "SessionFormat" ADD VALUE 'SINGLE';

-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'LOBBY';

-- Must commit before using new enum values in PostgreSQL
COMMIT;
BEGIN;

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "playerId" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "maxPlayers" INTEGER,
ADD COLUMN     "servesPerRotation" INTEGER NOT NULL DEFAULT 4,
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ALTER COLUMN "status" SET DEFAULT 'LOBBY';

-- CreateIndex
CREATE UNIQUE INDEX "Device_playerId_key" ON "Device"("playerId");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

/*
  Warnings:

  - A unique constraint covering the columns `[user_id,measured_at]` on the table `weight_history` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "weight_history_user_id_measured_at_idx";

-- AlterTable
ALTER TABLE "weight_history" ALTER COLUMN "measured_at" SET DATA TYPE DATE;

-- CreateIndex
CREATE INDEX "weight_history_user_id_measured_at_idx" ON "weight_history"("user_id", "measured_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "weight_history_user_id_measured_at_key" ON "weight_history"("user_id", "measured_at");

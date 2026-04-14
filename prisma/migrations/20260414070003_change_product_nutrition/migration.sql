/*
  Warnings:

  - You are about to drop the column `nutrition` on the `products` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "meal_items" DROP CONSTRAINT "meal_items_meal_id_fkey";

-- AlterTable
ALTER TABLE "products" DROP COLUMN "nutrition";

-- AddForeignKey
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_id_fkey" FOREIGN KEY ("meal_id") REFERENCES "meals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

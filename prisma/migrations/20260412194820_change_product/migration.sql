-- CreateEnum
CREATE TYPE "product_visibility" AS ENUM ('private', 'shared', 'public');

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "calories" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "carbs" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "fats" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "owner_id" TEXT,
ADD COLUMN     "proteins" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "visibility" "product_visibility" NOT NULL DEFAULT 'private';

-- CreateIndex
CREATE INDEX "products_owner_id_visibility_idx" ON "products"("owner_id", "visibility");

-- CreateIndex
CREATE INDEX "products_deleted_at_idx" ON "products"("deleted_at");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

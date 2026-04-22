/*
  Warnings:

  - The primary key for the `family_members` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropIndex
DROP INDEX "family_members_user_id_key";

-- AlterTable
ALTER TABLE "family_members" DROP CONSTRAINT "family_members_pkey",
ADD CONSTRAINT "family_members_pkey" PRIMARY KEY ("user_id");

/*
  Warnings:

  - The values [group] on the enum `chat_types` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `expired_at` on the `family_group_invitations` table. All the data in the column will be lost.
  - You are about to drop the column `read_at` on the `messages` table. All the data in the column will be lost.
  - Added the required column `expires_at` to the `family_group_invitations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "chat_types_new" AS ENUM ('private', 'family', 'consultation');
ALTER TABLE "chats" ALTER COLUMN "type" TYPE "chat_types_new" USING ("type"::text::"chat_types_new");
ALTER TYPE "chat_types" RENAME TO "chat_types_old";
ALTER TYPE "chat_types_new" RENAME TO "chat_types";
DROP TYPE "public"."chat_types_old";
COMMIT;

-- AlterTable
ALTER TABLE "family_group_invitations" DROP COLUMN "expired_at",
ADD COLUMN     "expires_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "messages" DROP COLUMN "read_at";

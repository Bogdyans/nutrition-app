/*
  Warnings:

  - A unique constraint covering the columns `[user_id]` on the table `family_members` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[meal_id,user_reaction_id]` on the table `meal_reactions` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "invitation_status" AS ENUM ('pending', 'accepted', 'declined', 'expired');

-- AlterTable
ALTER TABLE "family_members" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "family_group_invitations" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" "invitation_status" NOT NULL DEFAULT 'pending',
    "expired_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "group_id" TEXT NOT NULL,
    "invited_by_id" TEXT NOT NULL,
    "invited_user_id" TEXT,

    CONSTRAINT "family_group_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "family_group_invitations_token_key" ON "family_group_invitations"("token");

-- CreateIndex
CREATE INDEX "family_group_invitations_group_id_idx" ON "family_group_invitations"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "family_members_user_id_key" ON "family_members"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_reactions_meal_id_user_reaction_id_key" ON "meal_reactions"("meal_id", "user_reaction_id");

-- AddForeignKey
ALTER TABLE "family_group_invitations" ADD CONSTRAINT "family_group_invitations_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "family_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_group_invitations" ADD CONSTRAINT "family_group_invitations_invited_by_id_fkey" FOREIGN KEY ("invited_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_group_invitations" ADD CONSTRAINT "family_group_invitations_invited_user_id_fkey" FOREIGN KEY ("invited_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

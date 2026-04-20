-- CreateTable
CREATE TABLE "ProductReactionStat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mealsCount" INTEGER NOT NULL DEFAULT 0,
    "reactionMealsCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReactionStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductReactionDetail" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reactionId" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "severitySum" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReactionDetail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductReactionStat_userId_idx" ON "ProductReactionStat"("userId");

-- CreateIndex
CREATE INDEX "ProductReactionStat_productId_idx" ON "ProductReactionStat"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReactionStat_userId_productId_key" ON "ProductReactionStat"("userId", "productId");

-- CreateIndex
CREATE INDEX "ProductReactionDetail_userId_productId_idx" ON "ProductReactionDetail"("userId", "productId");

-- CreateIndex
CREATE INDEX "ProductReactionDetail_userId_reactionId_idx" ON "ProductReactionDetail"("userId", "reactionId");

-- CreateIndex
CREATE INDEX "ProductReactionDetail_productId_idx" ON "ProductReactionDetail"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductReactionDetail_userId_productId_reactionId_key" ON "ProductReactionDetail"("userId", "productId", "reactionId");

-- AddForeignKey
ALTER TABLE "ProductReactionStat" ADD CONSTRAINT "ProductReactionStat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReactionStat" ADD CONSTRAINT "ProductReactionStat_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReactionDetail" ADD CONSTRAINT "ProductReactionDetail_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReactionDetail" ADD CONSTRAINT "ProductReactionDetail_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductReactionDetail" ADD CONSTRAINT "ProductReactionDetail_reactionId_fkey" FOREIGN KEY ("reactionId") REFERENCES "reactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

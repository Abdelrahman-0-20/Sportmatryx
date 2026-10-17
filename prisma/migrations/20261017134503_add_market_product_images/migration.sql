-- CreateTable
CREATE TABLE "market_product_images" (
    "id" TEXT NOT NULL,
    "productKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_product_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_product_images_productKey_sortOrder_idx" ON "market_product_images"("productKey", "sortOrder");

-- AddForeignKey
ALTER TABLE "market_product_images" ADD CONSTRAINT "market_product_images_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

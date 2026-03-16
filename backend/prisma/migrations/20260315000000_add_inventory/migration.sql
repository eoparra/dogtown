-- Add InventoryItem and StockMovement tables

CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id"                TEXT NOT NULL,
  "sku"               TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "description"       TEXT,
  "category"          TEXT NOT NULL,
  "unitOfMeasure"     TEXT NOT NULL,
  "costPrice"         DOUBLE PRECISION NOT NULL,
  "sellingPrice"      DOUBLE PRECISION NOT NULL,
  "currentStock"      INTEGER NOT NULL DEFAULT 0,
  "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
  "expiryDate"        TIMESTAMP(3),
  "deletedAt"         TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_sku_key"       ON "InventoryItem"("sku");
CREATE INDEX        IF NOT EXISTS "InventoryItem_category_idx"  ON "InventoryItem"("category");
CREATE INDEX        IF NOT EXISTS "InventoryItem_deletedAt_idx" ON "InventoryItem"("deletedAt");

CREATE TABLE IF NOT EXISTS "StockMovement" (
  "id"            TEXT NOT NULL,
  "itemId"        TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "quantity"      INTEGER NOT NULL,
  "note"          TEXT,
  "performedById" TEXT NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StockMovement_itemId_createdAt_idx" ON "StockMovement"("itemId", "createdAt");

-- Foreign keys (idempotent)
DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_itemId_fkey"
    FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_performedById_fkey"
    FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

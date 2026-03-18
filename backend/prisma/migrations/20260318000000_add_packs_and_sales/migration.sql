-- Add ServicePack, Sale, and SaleLineItem tables with PackType and PaymentMethod enums

CREATE TYPE "PackType" AS ENUM ('DAYCARE_DAYS', 'HOTEL_NIGHTS');

CREATE TABLE "ServicePack" (
  "id"            TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "description"   TEXT,
  "packType"      "PackType" NOT NULL,
  "unitsIncluded" INTEGER NOT NULL,
  "priceSmall"    DOUBLE PRECISION NOT NULL,
  "priceMedium"   DOUBLE PRECISION NOT NULL,
  "priceLarge"    DOUBLE PRECISION NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServicePack_pkey" PRIMARY KEY ("id")
);

CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER');

CREATE TABLE "Sale" (
  "id"            TEXT NOT NULL,
  "clientId"      TEXT,
  "clientName"    TEXT NOT NULL,
  "clientPhone"   TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'COMPLETED',
  "total"         DOUBLE PRECISION NOT NULL,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaleLineItem" (
  "id"         TEXT NOT NULL,
  "saleId"     TEXT NOT NULL,
  "sourceType" TEXT NOT NULL,
  "sourceId"   TEXT NOT NULL,
  "itemName"   TEXT NOT NULL,
  "unitPrice"  DOUBLE PRECISION NOT NULL,
  "quantity"   INTEGER NOT NULL DEFAULT 1,
  "dogId"      TEXT,
  "dogName"    TEXT,
  CONSTRAINT "SaleLineItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Sale_clientId_idx" ON "Sale"("clientId");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");
CREATE INDEX "SaleLineItem_saleId_idx" ON "SaleLineItem"("saleId");

ALTER TABLE "Sale" ADD CONSTRAINT "Sale_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaleLineItem" ADD CONSTRAINT "SaleLineItem_saleId_fkey"
  FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

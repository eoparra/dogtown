-- Add size-dependent pricing to Service
-- Creates PricingType enum, makes price nullable, adds priceSmall/priceMedium/priceLarge

CREATE TYPE "PricingType" AS ENUM ('FIXED', 'BY_SIZE');

ALTER TABLE "Service" ADD COLUMN "pricingType" "PricingType" NOT NULL DEFAULT 'FIXED';
ALTER TABLE "Service" ALTER COLUMN "price" DROP NOT NULL;
ALTER TABLE "Service" ADD COLUMN "priceSmall"  DOUBLE PRECISION;
ALTER TABLE "Service" ADD COLUMN "priceMedium" DOUBLE PRECISION;
ALTER TABLE "Service" ADD COLUMN "priceLarge"  DOUBLE PRECISION;

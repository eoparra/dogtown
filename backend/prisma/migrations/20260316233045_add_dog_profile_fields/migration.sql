-- AlterTable
ALTER TABLE "Dog" ADD COLUMN     "character" TEXT,
ADD COLUMN     "color" TEXT,
ADD COLUMN     "foodAdditionalIndication" TEXT,
ADD COLUMN     "foodQuantity" TEXT,
ADD COLUMN     "foodType" TEXT,
ADD COLUMN     "sex" TEXT,
ADD COLUMN     "specialRequirements" TEXT,
ADD COLUMN     "sterilized" BOOLEAN NOT NULL DEFAULT false;

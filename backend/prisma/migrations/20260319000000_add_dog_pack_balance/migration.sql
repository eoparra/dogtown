-- CreateTable
CREATE TABLE "DogPackBalance" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "packType" "PackType" NOT NULL,
    "remainingUnits" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DogPackBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DogPackBalance_dogId_idx" ON "DogPackBalance"("dogId");

-- CreateIndex
CREATE UNIQUE INDEX "DogPackBalance_dogId_packType_key" ON "DogPackBalance"("dogId", "packType");

-- AddForeignKey
ALTER TABLE "DogPackBalance" ADD CONSTRAINT "DogPackBalance_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

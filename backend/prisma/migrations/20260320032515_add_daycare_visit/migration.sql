-- CreateTable
CREATE TABLE "DaycareVisit" (
    "id" TEXT NOT NULL,
    "dogId" TEXT NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutAt" TIMESTAMP(3),

    CONSTRAINT "DaycareVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DaycareVisit_dogId_idx" ON "DaycareVisit"("dogId");

-- AddForeignKey
ALTER TABLE "DaycareVisit" ADD CONSTRAINT "DaycareVisit_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

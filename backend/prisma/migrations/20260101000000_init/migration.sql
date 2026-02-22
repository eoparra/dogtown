-- Initial schema creation (idempotent — safe to run against an existing DB)

CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "role" TEXT NOT NULL DEFAULT 'CLIENT',
  "userType" TEXT NOT NULL DEFAULT 'REGULAR',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

CREATE TABLE IF NOT EXISTS "Dog" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "breed" TEXT NOT NULL,
  "age" INTEGER NOT NULL,
  "weight" DOUBLE PRECISION NOT NULL,
  "size" TEXT NOT NULL DEFAULT 'MEDIUM',
  "notes" TEXT,
  "vaccinationInfo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Dog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Dog_userId_idx" ON "Dog"("userId");

CREATE TABLE IF NOT EXISTS "Booking" (
  "id" TEXT NOT NULL,
  "dogId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "checkIn" TIMESTAMP(3) NOT NULL,
  "checkOut" TIMESTAMP(3) NOT NULL,
  "totalPrice" DOUBLE PRECISION NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Booking_dogId_status_checkIn_checkOut_idx" ON "Booking"("dogId", "status", "checkIn", "checkOut");

CREATE TABLE IF NOT EXISTS "HotelRate" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "pricePerNight" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HotelRate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "HotelRate_type_key" ON "HotelRate"("type");

CREATE TABLE IF NOT EXISTS "DaycareRate" (
  "id" TEXT NOT NULL,
  "pricePerDay" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DaycareRate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SpecialPeriod" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SpecialPeriod_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SpecialPeriod_startDate_endDate_idx" ON "SpecialPeriod"("startDate", "endDate");

CREATE TABLE IF NOT EXISTS "Capacity" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "maxCapacity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Capacity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Capacity_type_key" ON "Capacity"("type");

-- Foreign keys (wrapped in DO blocks so they're skipped if the constraint already exists)
DO $$ BEGIN
  ALTER TABLE "Dog" ADD CONSTRAINT "Dog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dogId_fkey" FOREIGN KEY ("dogId") REFERENCES "Dog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

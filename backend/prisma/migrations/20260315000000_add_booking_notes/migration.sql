-- Add notes field to Booking for special requests from clients
ALTER TABLE "Booking" ADD COLUMN IF NOT EXISTS "notes" TEXT;

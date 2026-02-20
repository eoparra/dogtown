import { Prisma } from '@prisma/client';
import { prisma } from '../index.js';

type BookingType = 'HOTEL' | 'DAYCARE';
type DbClient = Prisma.TransactionClient | typeof prisma;

// Get all dates in a range (inclusive of start, exclusive of end for hotel nights)
function getDatesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const current = new Date(start);
  current.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);

  while (current < endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// Check if two date ranges overlap
function rangesOverlap(start1: Date, end1: Date, start2: Date, end2: Date): boolean {
  return start1 < end2 && start2 < end1;
}

export async function checkAvailability(
  type: BookingType,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string,
  db: DbClient = prisma
): Promise<{ available: boolean; unavailableDates: string[] }> {
  const capacity = await db.capacity.findUnique({
    where: { type }
  });

  if (!capacity) {
    return { available: false, unavailableDates: [] };
  }

  const dates = getDatesInRange(checkIn, checkOut);
  const unavailableDates: string[] = [];

  for (const date of dates) {
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);

    // Count bookings that overlap this date
    const bookingsCount = await db.booking.count({
      where: {
        type,
        status: 'CONFIRMED',
        id: excludeBookingId ? { not: excludeBookingId } : undefined,
        AND: [
          { checkIn: { lt: nextDay } },
          { checkOut: { gt: date } }
        ]
      }
    });

    if (bookingsCount >= capacity.maxCapacity) {
      unavailableDates.push(date.toISOString().split('T')[0]);
    }
  }

  return {
    available: unavailableDates.length === 0,
    unavailableDates
  };
}

export async function checkDogAvailability(
  dogId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string,
  db: DbClient = prisma
): Promise<{ available: boolean; conflictingBooking?: { id: string; checkIn: Date; checkOut: Date } }> {
  // Check if dog has any overlapping bookings
  const conflicting = await db.booking.findFirst({
    where: {
      dogId,
      status: 'CONFIRMED',
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      AND: [
        { checkIn: { lt: checkOut } },
        { checkOut: { gt: checkIn } }
      ]
    },
    select: { id: true, checkIn: true, checkOut: true }
  });

  if (conflicting) {
    return {
      available: false,
      conflictingBooking: conflicting
    };
  }

  return { available: true };
}

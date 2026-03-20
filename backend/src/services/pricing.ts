import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

type BookingType = 'HOTEL' | 'DAYCARE';
type HotelRateType = 'REGULAR' | 'HOLIDAY' | 'LONG_WEEKEND' | 'VACATION';
type DbClient = Prisma.TransactionClient | typeof prisma;

// Get all dates in a range (inclusive of start, exclusive of end)
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

// Check if a date falls within a special period
function isDateInPeriod(date: Date, startDate: Date, endDate: Date): boolean {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  return d >= start && d <= end;
}

export interface PriceBreakdown {
  totalPrice: number;
  numberOfNights: number;
  packUnitsUsed: number;
  breakdown: {
    date: string;
    rateType: string;
    price: number;
  }[];
}

export async function calculateHotelPrice(
  checkIn: Date,
  checkOut: Date,
  db: DbClient = prisma,
  packUnitsAvailable = 0
): Promise<PriceBreakdown> {
  const dates = getDatesInRange(checkIn, checkOut);
  const breakdown: PriceBreakdown['breakdown'] = [];

  // Get all rates
  const rates = await db.hotelRate.findMany();
  const rateMap = new Map(rates.map(r => [r.type, r.pricePerNight]));

  // Get all special periods
  const specialPeriods = await db.specialPeriod.findMany();

  let totalPrice = 0;
  let packUsed = 0;

  for (const date of dates) {
    // Find matching special period (prioritize by type: VACATION > HOLIDAY > LONG_WEEKEND > REGULAR)
    let rateType: HotelRateType = 'REGULAR';

    for (const period of specialPeriods) {
      if (isDateInPeriod(date, period.startDate, period.endDate)) {
        // Higher priority rate types
        const priority: Record<HotelRateType, number> = {
          REGULAR: 0,
          LONG_WEEKEND: 1,
          HOLIDAY: 2,
          VACATION: 3
        };

        const periodType = period.type as HotelRateType;
        if (priority[periodType] > priority[rateType]) {
          rateType = periodType;
        }
      }
    }

    const normalPrice = rateMap.get(rateType) || rateMap.get('REGULAR') || 0;

    // Cover this night with pack if units are available
    if (packUsed < packUnitsAvailable) {
      packUsed++;
      breakdown.push({ date: date.toISOString().split('T')[0], rateType, price: 0 });
    } else {
      totalPrice += normalPrice;
      breakdown.push({ date: date.toISOString().split('T')[0], rateType, price: normalPrice });
    }
  }

  return {
    totalPrice,
    numberOfNights: dates.length,
    packUnitsUsed: packUsed,
    breakdown
  };
}

export async function calculateDaycarePrice(
  checkIn: Date,
  checkOut: Date,
  db: DbClient = prisma,
  packUnitsAvailable = 0
): Promise<{ totalPrice: number; numberOfDays: number; packUnitsUsed: number }> {
  const dates = getDatesInRange(checkIn, checkOut);
  const daycareRate = await db.daycareRate.findFirst();

  if (!daycareRate) {
    throw new Error('Daycare rate not configured');
  }

  const packUnitsUsed = Math.min(dates.length, packUnitsAvailable);
  const chargedDays = dates.length - packUnitsUsed;
  const totalPrice = chargedDays * daycareRate.pricePerDay;

  return {
    totalPrice,
    numberOfDays: dates.length,
    packUnitsUsed
  };
}

export async function calculatePrice(
  type: BookingType,
  checkIn: Date,
  checkOut: Date,
  db: DbClient = prisma,
  packUnitsAvailable = 0
): Promise<{ totalPrice: number; packUnitsUsed: number; details: unknown }> {
  if (type === 'HOTEL') {
    const result = await calculateHotelPrice(checkIn, checkOut, db, packUnitsAvailable);
    return { totalPrice: result.totalPrice, packUnitsUsed: result.packUnitsUsed, details: result };
  } else {
    const result = await calculateDaycarePrice(checkIn, checkOut, db, packUnitsAvailable);
    return { totalPrice: result.totalPrice, packUnitsUsed: result.packUnitsUsed, details: result };
  }
}

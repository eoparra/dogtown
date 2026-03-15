import { Prisma } from '@prisma/client';
import { prisma } from '../index.js';

type BookingType = 'HOTEL' | 'DAYCARE';
type HotelRateType = 'REGULAR' | 'HOLIDAY' | 'LONG_WEEKEND' | 'VACATION';
type UserType = 'REGULAR' | 'PREFERENT';
type DbClient = Prisma.TransactionClient | typeof prisma;

const PREFERENT_DISCOUNT_PERCENT = 10; // 10% off for preferent clients

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

function applyDiscount(price: number, userType: UserType): { finalPrice: number; discountAmount: number } {
  if (userType !== 'PREFERENT') {
    return { finalPrice: price, discountAmount: 0 };
  }
  const discountAmount = Math.round(price * (PREFERENT_DISCOUNT_PERCENT / 100) * 100) / 100;
  const finalPrice = Math.round((price - discountAmount) * 100) / 100;
  return { finalPrice, discountAmount };
}

export interface PriceBreakdown {
  totalPrice: number;
  originalPrice?: number;
  discountAmount?: number;
  discountPercent?: number;
  numberOfNights: number;
  breakdown: {
    date: string;
    rateType: string;
    price: number;
  }[];
}

export async function calculateHotelPrice(
  checkIn: Date,
  checkOut: Date,
  userType: UserType = 'REGULAR',
  db: DbClient = prisma
): Promise<PriceBreakdown> {
  const dates = getDatesInRange(checkIn, checkOut);
  const breakdown: PriceBreakdown['breakdown'] = [];

  // Get all rates
  const rates = await db.hotelRate.findMany();
  const rateMap = new Map(rates.map(r => [r.type, r.pricePerNight]));

  // Get all special periods
  const specialPeriods = await db.specialPeriod.findMany();

  let subtotal = 0;

  for (const date of dates) {
    // Find matching special period (prioritize by type: VACATION > HOLIDAY > LONG_WEEKEND > REGULAR)
    let rateType: HotelRateType = 'REGULAR';

    for (const period of specialPeriods) {
      if (isDateInPeriod(date, period.startDate, period.endDate)) {
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

    const price = rateMap.get(rateType) || rateMap.get('REGULAR') || 0;
    subtotal += price;

    breakdown.push({
      date: date.toISOString().split('T')[0],
      rateType,
      price
    });
  }

  const { finalPrice, discountAmount } = applyDiscount(subtotal, userType);

  return {
    totalPrice: finalPrice,
    ...(userType === 'PREFERENT' && {
      originalPrice: subtotal,
      discountAmount,
      discountPercent: PREFERENT_DISCOUNT_PERCENT,
    }),
    numberOfNights: dates.length,
    breakdown
  };
}

export async function calculateDaycarePrice(
  checkIn: Date,
  checkOut: Date,
  userType: UserType = 'REGULAR',
  db: DbClient = prisma
): Promise<{ totalPrice: number; originalPrice?: number; discountAmount?: number; discountPercent?: number; numberOfDays: number }> {
  const dates = getDatesInRange(checkIn, checkOut);
  const daycareRate = await db.daycareRate.findFirst();

  if (!daycareRate) {
    throw new Error('Daycare rate not configured');
  }

  const subtotal = dates.length * daycareRate.pricePerDay;
  const { finalPrice, discountAmount } = applyDiscount(subtotal, userType);

  return {
    totalPrice: finalPrice,
    ...(userType === 'PREFERENT' && {
      originalPrice: subtotal,
      discountAmount,
      discountPercent: PREFERENT_DISCOUNT_PERCENT,
    }),
    numberOfDays: dates.length
  };
}

export async function calculatePrice(
  type: BookingType,
  checkIn: Date,
  checkOut: Date,
  db: DbClient = prisma,
  userType: UserType = 'REGULAR'
): Promise<{ totalPrice: number; details: unknown }> {
  if (type === 'HOTEL') {
    const result = await calculateHotelPrice(checkIn, checkOut, userType, db);
    return { totalPrice: result.totalPrice, details: result };
  } else {
    const result = await calculateDaycarePrice(checkIn, checkOut, userType, db);
    return { totalPrice: result.totalPrice, details: result };
  }
}

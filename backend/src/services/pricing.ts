import { prisma } from '../index.js';

type BookingType = 'HOTEL' | 'DAYCARE';
type HotelRateType = 'REGULAR' | 'HOLIDAY' | 'LONG_WEEKEND' | 'VACATION';

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
  breakdown: {
    date: string;
    rateType: string;
    price: number;
  }[];
}

export async function calculateHotelPrice(
  checkIn: Date,
  checkOut: Date
): Promise<PriceBreakdown> {
  const dates = getDatesInRange(checkIn, checkOut);
  const breakdown: PriceBreakdown['breakdown'] = [];

  // Get all rates
  const rates = await prisma.hotelRate.findMany();
  const rateMap = new Map(rates.map(r => [r.type, r.pricePerNight]));

  // Get all special periods
  const specialPeriods = await prisma.specialPeriod.findMany();

  let totalPrice = 0;

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

    const price = rateMap.get(rateType) || rateMap.get('REGULAR') || 0;
    totalPrice += price;

    breakdown.push({
      date: date.toISOString().split('T')[0],
      rateType,
      price
    });
  }

  return {
    totalPrice,
    numberOfNights: dates.length,
    breakdown
  };
}

export async function calculateDaycarePrice(
  checkIn: Date,
  checkOut: Date
): Promise<{ totalPrice: number; numberOfDays: number }> {
  const dates = getDatesInRange(checkIn, checkOut);
  const daycareRate = await prisma.daycareRate.findFirst();

  if (!daycareRate) {
    throw new Error('Daycare rate not configured');
  }

  const totalPrice = dates.length * daycareRate.pricePerDay;

  return {
    totalPrice,
    numberOfDays: dates.length
  };
}

export async function calculatePrice(
  type: BookingType,
  checkIn: Date,
  checkOut: Date
): Promise<{ totalPrice: number; details: unknown }> {
  if (type === 'HOTEL') {
    const result = await calculateHotelPrice(checkIn, checkOut);
    return { totalPrice: result.totalPrice, details: result };
  } else {
    const result = await calculateDaycarePrice(checkIn, checkOut);
    return { totalPrice: result.totalPrice, details: result };
  }
}

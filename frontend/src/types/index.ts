export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'CLIENT' | 'ADMIN';
  createdAt: string;
}

export interface Dog {
  id: string;
  userId: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  notes: string | null;
  vaccinationInfo: string | null;
  createdAt: string;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  bookings?: Booking[];
  _count?: { bookings: number };
}

export interface Booking {
  id: string;
  dogId: string;
  type: 'HOTEL' | 'DAYCARE';
  checkIn: string;
  checkOut: string;
  totalPrice: number;
  status: 'CONFIRMED' | 'CANCELLED';
  createdAt: string;
  dog?: Pick<Dog, 'id' | 'name' | 'breed'> & { user?: Pick<User, 'id' | 'name' | 'email' | 'phone'> };
}

export interface HotelRate {
  id: string;
  type: 'REGULAR' | 'HOLIDAY' | 'LONG_WEEKEND' | 'VACATION';
  pricePerNight: number;
}

export interface DaycareRate {
  id: string;
  pricePerDay: number;
}

export interface SpecialPeriod {
  id: string;
  name: string;
  type: 'HOLIDAY' | 'LONG_WEEKEND' | 'VACATION';
  startDate: string;
  endDate: string;
}

export interface Capacity {
  id: string;
  type: 'HOTEL' | 'DAYCARE';
  maxCapacity: number;
}

export interface PriceBreakdown {
  date: string;
  rateType: string;
  price: number;
}

export interface HotelPriceDetails {
  totalPrice: number;
  numberOfNights: number;
  breakdown: PriceBreakdown[];
}

export interface DaycarePriceDetails {
  totalPrice: number;
  numberOfDays: number;
}

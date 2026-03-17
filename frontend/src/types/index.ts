export interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: 'CLIENT' | 'ADMIN';
  userType: 'REGULAR' | 'PREFERENT';
  createdAt: string;
}

export interface Dog {
  id: string;
  userId: string;
  name: string;
  breed: string;
  age: number;
  weight: number;
  size: 'SMALL' | 'MEDIUM' | 'LARGE';
  color: string | null;
  sex: 'MALE' | 'FEMALE' | null;
  sterilized: boolean;
  character: string | null;
  specialRequirements: string | null;
  foodType: string | null;
  foodQuantity: string | null;
  foodAdditionalIndication: string | null;
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

export type ItemCategory = 'PET_ACCESSORIES' | 'PET_FOOD' | 'VETERINARY';
export type MovementType = 'RECEIVE' | 'DEDUCT';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  category: ItemCategory;
  unitOfMeasure: string;
  costPrice: number;
  sellingPrice: number;
  currentStock: number;
  lowStockThreshold: number;
  expiryDate: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { movements: number };
}

export interface StockMovement {
  id: string;
  itemId: string;
  type: MovementType;
  quantity: number;
  note: string | null;
  performedById: string;
  createdAt: string;
  performedBy?: Pick<User, 'id' | 'name'>;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  price: number;
  createdAt: string;
  updatedAt: string;
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

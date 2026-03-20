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
  packBalances?: DogPackBalance[];
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
  pricingType: 'FIXED' | 'BY_SIZE';
  price: number | null;
  priceSmall: number | null;
  priceMedium: number | null;
  priceLarge: number | null;
  createdAt: string;
  updatedAt: string;
}

export type PackType = 'DAYCARE_DAYS' | 'HOTEL_NIGHTS';

export interface DogPackBalance {
  packType: PackType;
  remainingUnits: number;
}

export interface ServicePack {
  id: string;
  name: string;
  description: string | null;
  packType: PackType;
  unitsIncluded: number;
  priceSmall: number;
  priceMedium: number;
  priceLarge: number;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'TRANSFER';

export interface CatalogItem {
  id: string;
  sourceType: 'PRODUCT' | 'SERVICE' | 'PACK';
  name: string;
  description: string | null;
  price: number | null; // null = BY_SIZE item with no size context
  pricingType: 'FIXED' | 'BY_SIZE';
  currentStock?: number;
  unitOfMeasure?: string;
  priceSmall?: number | null;
  priceMedium?: number | null;
  priceLarge?: number | null;
  unitsIncluded?: number; // PACK only
}

export interface SaleLineItem {
  id: string;
  saleId: string;
  sourceType: 'PRODUCT' | 'SERVICE' | 'PACK';
  sourceId: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  dogId: string | null;
  dogName: string | null;
}

export interface Sale {
  id: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string | null;
  paymentMethod: PaymentMethod;
  status: string;
  total: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems?: SaleLineItem[];
  client?: Pick<User, 'id' | 'name' | 'email' | 'phone'> | null;
}

export interface ClientSearchUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  dogs: Array<{ id: string; name: string; size: string }>;
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

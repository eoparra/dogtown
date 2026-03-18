import type { User, Dog, Booking, HotelRate, DaycareRate, SpecialPeriod, Capacity, InventoryItem, StockMovement, Service } from '@/types';

// Use environment variable for API URL, fallback to relative path for local dev
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

let onUnauthorized: (() => void) | null = null;
let csrfToken: string | null = null;


function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()!.split(';').shift() || null;
  }
  return null;
}

let csrfBootstrapPromise: Promise<void> | null = null;

async function ensureCsrfToken(): Promise<void> {
  if (csrfToken) return;

  const existing = getCookieValue('csrf_token');
  if (existing) {
    csrfToken = existing;
    return;
  }

  if (!csrfBootstrapPromise) {
    csrfBootstrapPromise = fetch(`${API_BASE}/auth/csrf`, {
      method: 'GET',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    }).then(async (res) => {
      if (!res.ok) {
        throw new Error('Failed to initialize CSRF protection');
      }

      const data = await res.json().catch(() => ({} as { csrfToken?: string }));
      if (data.csrfToken) {
        csrfToken = data.csrfToken;
      }
    }).finally(() => {
      csrfBootstrapPromise = null;
    });
  }

  await csrfBootstrapPromise;
}


export function setOnUnauthorized(callback: () => void) {
  onUnauthorized = callback;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const method = (options.method || 'GET').toUpperCase();
    const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (isStateChanging) {
      await ensureCsrfToken();
    }

    const headerCsrfToken = csrfToken || getCookieValue('csrf_token');

    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...(headerCsrfToken ? { 'X-CSRF-Token': headerCsrfToken } : {}),
        ...options.headers,
      },
      credentials: 'include',
    });

    if (!res.ok) {
      if (res.status === 401 && !endpoint.startsWith('/auth/')) {
        onUnauthorized?.();
      }
      const error = await res.json().catch(() => ({ error: 'Request failed' }));
      const msg = Array.isArray(error.error)
        ? error.error.map((e: { message: string }) => e.message).join(', ')
        : error.error || 'Request failed';
      throw new Error(msg);
    }

    const data = await res.json();

    if (data && typeof data === 'object' && 'csrfToken' in data && typeof data.csrfToken === 'string') {
      csrfToken = data.csrfToken;
    } else if (endpoint === '/auth/logout') {
      csrfToken = null;
    }

    return data;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// Auth
export const auth = {
  register: (data: { email: string; password: string; name: string; phone?: string }) =>
    request<{ user: User }>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  login: (data: { email: string; password: string }) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

  logout: () =>
    request<{ success: boolean }>('/auth/logout', { method: 'POST' }),

  me: () =>
    request<{ user: User }>('/auth/me'),
};

// Dogs
export const dogs = {
  list: () =>
    request<{ dogs: Dog[] }>('/dogs'),

  get: (id: string) =>
    request<{ dog: Dog }>(`/dogs/${id}`),

  create: (data: Omit<Dog, 'id' | 'userId' | 'createdAt' | 'size'>) =>
    request<{ dog: Dog }>('/dogs', { method: 'POST', body: JSON.stringify(data) }),

  update: (id: string, data: Partial<Dog>) =>
    request<{ dog: Dog }>(`/dogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  delete: (id: string) =>
    request<{ success: boolean }>(`/dogs/${id}`, { method: 'DELETE' }),
};

// Bookings
export const bookings = {
  list: () =>
    request<{ bookings: Booking[] }>('/bookings'),

  checkAvailability: (data: { type: 'HOTEL' | 'DAYCARE'; checkIn: string; checkOut: string }) =>
    request<{ available: boolean; unavailableDates: string[] }>('/bookings/check-availability', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  calculatePrice: (data: { type: 'HOTEL' | 'DAYCARE'; checkIn: string; checkOut: string }) =>
    request<{ totalPrice: number; details: unknown }>('/bookings/calculate-price', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  create: (data: { dogId: string; type: 'HOTEL' | 'DAYCARE'; checkIn: string; checkOut: string }) =>
    request<{ booking: Booking; priceDetails: unknown }>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancel: (id: string) =>
    request<{ booking: Booking }>(`/bookings/${id}/cancel`, { method: 'PATCH' }),
};

// Admin
export const admin = {
  // Stats
  getStats: () =>
    request<{
      totalUsers: number;
      totalDogs: number;
      upcomingBookings: number;
      todayCheckins: number;
      todayCheckouts: number;
    }>('/admin/stats'),

  // Users
  getUsers: () =>
    request<{ users: (User & { _count: { dogs: number } })[] }>('/admin/users'),

  getUserDogs: (userId: string) =>
    request<{ dogs: Dog[] }>(`/admin/users/${userId}/dogs`),

  updateUser: (id: string, data: Partial<User>) =>
    request<{ user: User & { _count: { dogs: number } } }>(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteUser: (id: string) =>
    request<{ success: boolean }>(`/admin/users/${id}`, { method: 'DELETE' }),

  createUser: (data: { name: string; email: string; phone: string; userType?: 'REGULAR' | 'PREFERENT' }) =>
    request<{ user: User & { _count: { dogs: number } } }>('/admin/users', { method: 'POST', body: JSON.stringify(data) }),

  // Dogs
  getDogs: () =>
    request<{ dogs: Dog[] }>('/admin/dogs'),

  updateDog: (id: string, data: Partial<Dog>) =>
    request<{ dog: Dog }>(`/admin/dogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDog: (id: string) =>
    request<{ success: boolean }>(`/admin/dogs/${id}`, { method: 'DELETE' }),

  createDog: (data: { userId: string; name: string; breed: string; age: number; weight: number; size: 'SMALL' | 'MEDIUM' | 'LARGE'; color?: string | null; sex?: 'MALE' | 'FEMALE' | null; sterilized?: boolean; character?: string | null; specialRequirements?: string | null; foodType?: string | null; foodQuantity?: string | null; foodAdditionalIndication?: string | null; notes?: string | null; vaccinationInfo?: string | null }) =>
    request<{ dog: Dog }>('/admin/dogs', { method: 'POST', body: JSON.stringify(data) }),

  // Bookings
  getBookings: (params?: { status?: string; type?: string; upcoming?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    if (params?.type) query.set('type', params.type);
    if (params?.upcoming) query.set('upcoming', 'true');
    const queryStr = query.toString();
    return request<{ bookings: Booking[] }>(`/admin/bookings${queryStr ? `?${queryStr}` : ''}`);
  },

  updateBooking: (id: string, data: Partial<Booking>) =>
    request<{ booking: Booking }>(`/admin/bookings/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteBooking: (id: string) =>
    request<{ success: boolean }>(`/admin/bookings/${id}`, { method: 'DELETE' }),

  // Rates
  getRates: () =>
    request<{ hotelRates: HotelRate[]; daycareRate: DaycareRate | null }>('/admin/rates'),

  updateHotelRate: (type: string, pricePerNight: number) =>
    request<{ rate: HotelRate }>(`/admin/rates/hotel/${type}`, {
      method: 'PUT',
      body: JSON.stringify({ pricePerNight }),
    }),

  updateDaycareRate: (pricePerDay: number) =>
    request<{ rate: DaycareRate }>('/admin/rates/daycare', {
      method: 'PUT',
      body: JSON.stringify({ pricePerDay }),
    }),

  // Capacity
  getCapacity: () =>
    request<{ capacity: Capacity[] }>('/admin/capacity'),

  updateCapacity: (type: 'HOTEL' | 'DAYCARE', maxCapacity: number) =>
    request<{ capacity: Capacity }>(`/admin/capacity/${type}`, {
      method: 'PUT',
      body: JSON.stringify({ maxCapacity }),
    }),

  // Special Periods
  getSpecialPeriods: () =>
    request<{ periods: SpecialPeriod[] }>('/admin/special-periods'),

  createSpecialPeriod: (data: Omit<SpecialPeriod, 'id'>) =>
    request<{ period: SpecialPeriod }>('/admin/special-periods', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSpecialPeriod: (id: string, data: Partial<SpecialPeriod>) =>
    request<{ period: SpecialPeriod }>(`/admin/special-periods/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSpecialPeriod: (id: string) =>
    request<{ success: boolean }>(`/admin/special-periods/${id}`, { method: 'DELETE' }),

  // Inventory
  getInventory: (params?: { category?: string; lowStock?: boolean }) => {
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    if (params?.lowStock) query.set('lowStock', 'true');
    const queryStr = query.toString();
    return request<{ items: InventoryItem[] }>(`/admin/inventory${queryStr ? `?${queryStr}` : ''}`);
  },

  getLowStockCount: () =>
    request<{ count: number }>('/admin/inventory/low-stock-count'),

  createInventoryItem: (data: Omit<InventoryItem, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt' | '_count'>) =>
    request<{ item: InventoryItem }>('/admin/inventory', { method: 'POST', body: JSON.stringify(data) }),

  updateInventoryItem: (id: string, data: Partial<Omit<InventoryItem, 'id' | 'deletedAt' | 'createdAt' | 'updatedAt' | '_count'>>) =>
    request<{ item: InventoryItem }>(`/admin/inventory/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteInventoryItem: (id: string) =>
    request<{ success: boolean }>(`/admin/inventory/${id}`, { method: 'DELETE' }),

  receiveStock: (id: string, data: { quantity: number; note?: string }) =>
    request<{ movement: StockMovement; item: InventoryItem }>(`/admin/inventory/${id}/receive`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deductStock: (id: string, data: { quantity: number; note?: string }) =>
    request<{ movement: StockMovement; item: InventoryItem }>(`/admin/inventory/${id}/deduct`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getStockMovements: (id: string) =>
    request<{ movements: StockMovement[] }>(`/admin/inventory/${id}/movements`),

  // Services
  getServices: () =>
    request<{ services: Service[] }>('/admin/services'),

  createService: (data: {
    name: string;
    description?: string | null;
    pricingType: 'FIXED' | 'BY_SIZE';
    price?: number | null;
    priceSmall?: number | null;
    priceMedium?: number | null;
    priceLarge?: number | null;
  }) =>
    request<{ service: Service }>('/admin/services', { method: 'POST', body: JSON.stringify(data) }),

  updateService: (id: string, data: {
    name: string;
    description?: string | null;
    pricingType: 'FIXED' | 'BY_SIZE';
    price?: number | null;
    priceSmall?: number | null;
    priceMedium?: number | null;
    priceLarge?: number | null;
  }) =>
    request<{ service: Service }>(`/admin/services/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteService: (id: string) =>
    request<{ success: boolean }>(`/admin/services/${id}`, { method: 'DELETE' }),
};

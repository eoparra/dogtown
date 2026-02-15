import type { User, Dog, Booking, HotelRate, DaycareRate, SpecialPeriod, Capacity } from '@/types';

const API_BASE = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include',
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return res.json();
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

  // Dogs
  getDogs: () =>
    request<{ dogs: Dog[] }>('/admin/dogs'),

  updateDog: (id: string, data: Partial<Dog>) =>
    request<{ dog: Dog }>(`/admin/dogs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  deleteDog: (id: string) =>
    request<{ success: boolean }>(`/admin/dogs/${id}`, { method: 'DELETE' }),

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
};

import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { isProduction } from '../config.js';
import { requireAdmin } from '../middleware/auth.js';
import { checkAvailability, checkDogAvailability } from '../services/availability.js';
import { calculatePrice } from '../services/pricing.js';

const router = Router();

const MAX_BOOKING_DAYS = 90;

const uuidParam = z.string().uuid();

function sanitizeZodError(error: z.ZodError) {
  if (isProduction) {
    return 'Validation failed';
  }
  return error.errors;
}

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// Rate limiting for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' }
});

// All admin routes require admin role
router.use(requireAdmin);
router.use(adminLimiter);

// ============ USERS ============

// List all users
router.get('/users', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: 'ADMIN' } },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        userType: true,
        createdAt: true,
        _count: {
          select: { dogs: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ users });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create client user
router.post('/users', async (req, res) => {
  try {
    const createUserSchema = z.object({
      name: z.string().min(1).max(100),
      email: z.string().email().max(255),
      phone: z.string().regex(/^\d{10}$/, 'Phone must be exactly 10 digits'),
      userType: z.enum(['REGULAR', 'PREFERENT']).optional(),
    });

    const data = createUserSchema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      return res.status(400).json({ error: 'Email already in use' });
    }

    // Generate a random password — clients won't log in via the client interface initially
    const randomPassword = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(randomPassword, 10);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        phone: data.phone,
        userType: data.userType ?? 'REGULAR',
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        userType: true,
        createdAt: true,
        _count: { select: { dogs: true } },
      },
    });

    res.status(201).json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Get user's dogs
router.get('/users/:id/dogs', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    const dogs = await prisma.dog.findMany({
      where: { userId: req.params.id },
      include: {
        _count: { select: { bookings: true } }
      }
    });
    res.json({ dogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (req.params.id === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot modify your own admin account' });
    }

    const userSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      email: z.string().email().max(255).optional(),
      phone: z.string().max(20).optional().nullable(),
      userType: z.enum(['REGULAR', 'PREFERENT']).optional(),
    });

    const data = userSchema.parse(req.body);

    // Check email uniqueness if email is being changed
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing && existing.id !== req.params.id) {
        return res.status(400).json({ error: 'Email already in use' });
      }
    }

    const user = await prisma.user.update({
      where: { id: req.params.id, role: { not: 'ADMIN' } },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        userType: true,
        createdAt: true,
        _count: { select: { dogs: true } },
      },
    });

    res.json({ user });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid user ID format' });
    }

    if (req.params.id === req.user!.userId) {
      return res.status(400).json({ error: 'Cannot delete your own admin account' });
    }

    // Block deletion if user has dogs with active bookings
    const activeBookings = await prisma.booking.count({
      where: { dog: { userId: req.params.id }, status: 'CONFIRMED' }
    });
    if (activeBookings > 0) {
      return res.status(400).json({ error: 'Cannot delete user with active bookings. Cancel all bookings first.' });
    }

    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// ============ DOGS ============

// List all dogs
router.get('/dogs', async (req, res) => {
  try {
    const dogs = await prisma.dog.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ dogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// Create a dog for any user (admin)
router.post('/dogs', async (req, res) => {
  try {
    const createDogSchema = z.object({
      userId: z.string().uuid(),
      name: z.string().min(1).max(100),
      breed: z.string().min(1).max(100),
      age: z.number().int().min(0),
      weight: z.number().min(0),
      size: z.enum(['SMALL', 'MEDIUM', 'LARGE']),
      color: z.string().max(100).optional(),
      sex: z.enum(['MALE', 'FEMALE']).optional(),
      sterilized: z.boolean().optional(),
      character: z.string().max(2000).optional(),
      specialRequirements: z.string().max(2000).optional(),
      foodType: z.string().max(200).optional(),
      foodQuantity: z.string().max(200).optional(),
      foodAdditionalIndication: z.string().max(2000).optional(),
      notes: z.string().max(5000).optional(),
      vaccinationInfo: z.string().max(2000).optional(),
    });

    const data = createDogSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { id: data.userId, role: { not: 'ADMIN' } } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const dog = await prisma.dog.create({ data });

    res.status(201).json({ dog });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create dog' });
  }
});

// Update any dog
router.put('/dogs/:id', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid dog ID format' });
    }

    const dogSchema = z.object({
      name: z.string().min(1).max(100).optional(),
      breed: z.string().min(1).max(100).optional(),
      age: z.number().int().min(0).optional(),
      weight: z.number().min(0).optional(),
      size: z.enum(['SMALL', 'MEDIUM', 'LARGE']).optional(),
      color: z.string().max(100).nullable().optional(),
      sex: z.enum(['MALE', 'FEMALE']).nullable().optional(),
      sterilized: z.boolean().optional(),
      character: z.string().max(2000).nullable().optional(),
      specialRequirements: z.string().max(2000).nullable().optional(),
      foodType: z.string().max(200).nullable().optional(),
      foodQuantity: z.string().max(200).nullable().optional(),
      foodAdditionalIndication: z.string().max(2000).nullable().optional(),
      notes: z.string().max(5000).nullable().optional(),
      vaccinationInfo: z.string().max(2000).nullable().optional(),
    });

    const data = dogSchema.parse(req.body);

    // Check existence before update
    const existing = await prisma.dog.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    // Auto-update size when weight changes
    if (data.weight !== undefined && data.size === undefined) {
      data.size = data.weight < 10 ? 'SMALL' : data.weight <= 20 ? 'MEDIUM' : 'LARGE';
    }

    const dog = await prisma.dog.update({
      where: { id: req.params.id },
      data
    });

    res.json({ dog });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update dog' });
  }
});

// Delete any dog
router.delete('/dogs/:id', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid dog ID format' });
    }

    // Block deletion if dog has active bookings
    const activeBookings = await prisma.booking.count({
      where: { dogId: req.params.id, status: 'CONFIRMED' }
    });
    if (activeBookings > 0) {
      return res.status(400).json({ error: 'Cannot delete dog with active bookings. Cancel all bookings first.' });
    }

    await prisma.dog.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'Dog not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to delete dog' });
  }
});

// ============ BOOKINGS ============

// List all bookings
router.get('/bookings', async (req, res) => {
  try {
    const { status, type, upcoming } = req.query;

    const where: any = {};

    // Validate query parameters
    if (status) {
      const statusResult = z.enum(['CONFIRMED', 'CANCELLED']).safeParse(status);
      if (!statusResult.success) {
        return res.status(400).json({ error: 'Invalid status. Must be CONFIRMED or CANCELLED.' });
      }
      where.status = statusResult.data;
    }
    if (type) {
      const typeResult = z.enum(['HOTEL', 'DAYCARE']).safeParse(type);
      if (!typeResult.success) {
        return res.status(400).json({ error: 'Invalid type. Must be HOTEL or DAYCARE.' });
      }
      where.type = typeResult.data;
    }
    if (upcoming === 'true') {
      where.checkIn = { gte: new Date() };
      where.status = 'CONFIRMED';
    }

    const bookings = await prisma.booking.findMany({
      where,
      include: {
        dog: {
          include: {
            user: {
              select: { id: true, name: true, email: true, phone: true }
            }
          }
        }
      },
      orderBy: { checkIn: 'asc' }
    });
    res.json({ bookings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Update booking (wrapped in transaction to prevent race conditions)
router.put('/bookings/:id', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }

    const bookingSchema = z.object({
      checkIn: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }).optional(),
      checkOut: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }).optional(),
      status: z.enum(['CONFIRMED', 'CANCELLED']).optional()
    });

    const data = bookingSchema.parse(req.body);

    // If dates are being changed, use a transaction to prevent race conditions
    if (data.checkIn || data.checkOut) {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.booking.findUnique({
          where: { id: req.params.id }
        });
        if (!existing) {
          throw { status: 404, body: { error: 'Booking not found' } };
        }

        const newCheckIn = data.checkIn || existing.checkIn;
        const newCheckOut = data.checkOut || existing.checkOut;

        if (newCheckIn >= newCheckOut) {
          throw { status: 400, body: { error: 'Check-out must be after check-in' } };
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (newCheckIn < today) {
          throw { status: 400, body: { error: 'Check-in cannot be in the past' } };
        }

        if (daysBetween(newCheckIn, newCheckOut) > MAX_BOOKING_DAYS) {
          throw { status: 400, body: { error: `Booking cannot exceed ${MAX_BOOKING_DAYS} days` } };
        }

        // Re-check capacity (exclude this booking from count)
        const availability = await checkAvailability(existing.type as 'HOTEL' | 'DAYCARE', newCheckIn, newCheckOut, existing.id, tx);
        if (!availability.available) {
          throw { status: 400, body: { error: 'No availability for selected dates', unavailableDates: availability.unavailableDates } };
        }

        // Re-check dog availability (exclude this booking)
        const dogAvailability = await checkDogAvailability(existing.dogId, newCheckIn, newCheckOut, existing.id, tx);
        if (!dogAvailability.available) {
          throw { status: 400, body: { error: 'Dog already has a booking during this period' } };
        }

        // Recalculate price when dates change
        const priceResult = await calculatePrice(existing.type as 'HOTEL' | 'DAYCARE', newCheckIn, newCheckOut, tx);

        return await tx.booking.update({
          where: { id: req.params.id },
          data: {
            ...data,
            totalPrice: priceResult.totalPrice,
          },
          include: {
            dog: {
              include: {
                user: {
                  select: { id: true, name: true, email: true }
                }
              }
            }
          }
        });
      });

      return res.json({ booking: result });
    }

    // Status-only update — check existence first
    const existing = await prisma.booking.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = await prisma.booking.update({
      where: { id: req.params.id },
      data,
      include: {
        dog: {
          include: {
            user: {
              select: { id: true, name: true, email: true }
            }
          }
        }
      }
    });

    res.json({ booking });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    if (error?.status && error?.body) {
      return res.status(error.status).json(error.body);
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Delete booking (only cancelled bookings can be deleted)
router.delete('/bookings/:id', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }

    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'CANCELLED') {
      return res.status(400).json({ error: 'Only cancelled bookings can be deleted. Cancel the booking first.' });
    }

    await prisma.booking.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// ============ RATES ============

// Get all rates
router.get('/rates', async (req, res) => {
  try {
    const hotelRates = await prisma.hotelRate.findMany();
    const daycareRate = await prisma.daycareRate.findFirst();
    res.json({ hotelRates, daycareRate });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch rates' });
  }
});

// Update hotel rate — validate URL param with Zod
router.put('/rates/hotel/:type', async (req, res) => {
  try {
    const typeResult = z.enum(['REGULAR', 'HOLIDAY', 'LONG_WEEKEND', 'VACATION']).safeParse(req.params.type);
    if (!typeResult.success) {
      return res.status(400).json({ error: 'Invalid rate type. Must be REGULAR, HOLIDAY, LONG_WEEKEND, or VACATION.' });
    }
    const type = typeResult.data;

    const rateSchema = z.object({
      pricePerNight: z.number().min(0)
    });

    const data = rateSchema.parse(req.body);

    const rate = await prisma.hotelRate.upsert({
      where: { type },
      update: { pricePerNight: data.pricePerNight },
      create: { type, pricePerNight: data.pricePerNight }
    });

    res.json({ rate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

// Update daycare rate
router.put('/rates/daycare', async (req, res) => {
  try {
    const rateSchema = z.object({
      pricePerDay: z.number().min(0)
    });

    const data = rateSchema.parse(req.body);

    // Get existing or create new
    const existing = await prisma.daycareRate.findFirst();

    let rate;
    if (existing) {
      rate = await prisma.daycareRate.update({
        where: { id: existing.id },
        data: { pricePerDay: data.pricePerDay }
      });
    } else {
      rate = await prisma.daycareRate.create({
        data: { pricePerDay: data.pricePerDay }
      });
    }

    res.json({ rate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update rate' });
  }
});

// ============ CAPACITY ============

// Get capacity
router.get('/capacity', async (req, res) => {
  try {
    const capacity = await prisma.capacity.findMany();
    res.json({ capacity });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch capacity' });
  }
});

// Update capacity — validate URL param with Zod
router.put('/capacity/:type', async (req, res) => {
  try {
    const typeResult = z.enum(['HOTEL', 'DAYCARE']).safeParse(req.params.type);
    if (!typeResult.success) {
      return res.status(400).json({ error: 'Invalid capacity type. Must be HOTEL or DAYCARE.' });
    }
    const type = typeResult.data;

    const capacitySchema = z.object({
      maxCapacity: z.number().int().min(1)
    });

    const data = capacitySchema.parse(req.body);

    const capacity = await prisma.capacity.upsert({
      where: { type },
      update: { maxCapacity: data.maxCapacity },
      create: { type, maxCapacity: data.maxCapacity }
    });

    res.json({ capacity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update capacity' });
  }
});

// ============ SPECIAL PERIODS ============

// List special periods
router.get('/special-periods', async (req, res) => {
  try {
    const periods = await prisma.specialPeriod.findMany({
      orderBy: { startDate: 'asc' }
    });
    res.json({ periods });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch special periods' });
  }
});

// Create special period
router.post('/special-periods', async (req, res) => {
  try {
    const periodSchema = z.object({
      name: z.string().min(1).max(200),
      type: z.enum(['HOLIDAY', 'LONG_WEEKEND', 'VACATION']),
      startDate: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
      endDate: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' })
    });

    const data = periodSchema.parse(req.body);

    if (data.startDate >= data.endDate) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const period = await prisma.specialPeriod.create({
      data
    });

    res.status(201).json({ period });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create special period' });
  }
});

// Update special period — with date validation
router.put('/special-periods/:id', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid period ID format' });
    }

    const periodSchema = z.object({
      name: z.string().min(1).max(200).optional(),
      type: z.enum(['HOLIDAY', 'LONG_WEEKEND', 'VACATION']).optional(),
      startDate: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }).optional(),
      endDate: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }).optional()
    });

    const data = periodSchema.parse(req.body);

    // Fetch existing period to merge dates for validation
    const existing = await prisma.specialPeriod.findUnique({
      where: { id: req.params.id }
    });
    if (!existing) {
      return res.status(404).json({ error: 'Special period not found' });
    }

    // Validate date range using merged values
    const effectiveStart = data.startDate || existing.startDate;
    const effectiveEnd = data.endDate || existing.endDate;
    if (effectiveStart >= effectiveEnd) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    const period = await prisma.specialPeriod.update({
      where: { id: req.params.id },
      data
    });

    res.json({ period });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: sanitizeZodError(error) });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update special period' });
  }
});

// Delete special period
router.delete('/special-periods/:id', async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid period ID format' });
    }

    await prisma.specialPeriod.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return res.status(404).json({ error: 'Special period not found' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to delete special period' });
  }
});

// ============ DASHBOARD STATS ============

router.get('/stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      totalDogs,
      upcomingBookings,
      todayCheckins,
      todayCheckouts
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'CLIENT' } }),
      prisma.dog.count(),
      prisma.booking.count({
        where: {
          status: 'CONFIRMED',
          checkIn: { gte: today }
        }
      }),
      prisma.booking.count({
        where: {
          status: 'CONFIRMED',
          checkIn: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.booking.count({
        where: {
          status: 'CONFIRMED',
          checkOut: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    res.json({
      totalUsers,
      totalDogs,
      upcomingBookings,
      todayCheckins,
      todayCheckouts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;

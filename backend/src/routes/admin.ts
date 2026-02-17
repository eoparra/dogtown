import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

// All admin routes require admin role
router.use(requireAdmin);

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

// Get user's dogs
router.get('/users/:id/dogs', async (req, res) => {
  try {
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
    const userSchema = z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional().nullable(),
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
      where: { id: req.params.id },
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
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.params.id },
    });

    res.json({ success: true });
  } catch (error) {
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

// Update any dog
router.put('/dogs/:id', async (req, res) => {
  try {
    const dogSchema = z.object({
      name: z.string().min(1).optional(),
      breed: z.string().min(1).optional(),
      age: z.number().int().min(0).optional(),
      weight: z.number().min(0).optional(),
      size: z.enum(['SMALL', 'MEDIUM', 'LARGE']).optional(),
      notes: z.string().optional(),
      vaccinationInfo: z.string().optional()
    });

    const data = dogSchema.parse(req.body);

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
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update dog' });
  }
});

// Delete any dog
router.delete('/dogs/:id', async (req, res) => {
  try {
    await prisma.dog.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
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

    if (status) {
      where.status = status;
    }
    if (type) {
      where.type = type;
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

// Update booking
router.put('/bookings/:id', async (req, res) => {
  try {
    const bookingSchema = z.object({
      checkIn: z.string().transform(s => new Date(s)).optional(),
      checkOut: z.string().transform(s => new Date(s)).optional(),
      status: z.enum(['CONFIRMED', 'CANCELLED']).optional()
    });

    const data = bookingSchema.parse(req.body);

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
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// Delete booking
router.delete('/bookings/:id', async (req, res) => {
  try {
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

// Update hotel rate
router.put('/rates/hotel/:type', async (req, res) => {
  try {
    const rateSchema = z.object({
      pricePerNight: z.number().min(0)
    });

    const data = rateSchema.parse(req.body);
    const type = req.params.type as 'REGULAR' | 'HOLIDAY' | 'LONG_WEEKEND' | 'VACATION';

    const rate = await prisma.hotelRate.upsert({
      where: { type },
      update: { pricePerNight: data.pricePerNight },
      create: { type, pricePerNight: data.pricePerNight }
    });

    res.json({ rate });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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
      return res.status(400).json({ error: error.errors });
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

// Update capacity
router.put('/capacity/:type', async (req, res) => {
  try {
    const capacitySchema = z.object({
      maxCapacity: z.number().int().min(1)
    });

    const data = capacitySchema.parse(req.body);
    const type = req.params.type as 'HOTEL' | 'DAYCARE';

    const capacity = await prisma.capacity.upsert({
      where: { type },
      update: { maxCapacity: data.maxCapacity },
      create: { type, maxCapacity: data.maxCapacity }
    });

    res.json({ capacity });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
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
      name: z.string().min(1),
      type: z.enum(['HOLIDAY', 'LONG_WEEKEND', 'VACATION']),
      startDate: z.string().transform(s => new Date(s)),
      endDate: z.string().transform(s => new Date(s))
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
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create special period' });
  }
});

// Update special period
router.put('/special-periods/:id', async (req, res) => {
  try {
    const periodSchema = z.object({
      name: z.string().min(1).optional(),
      type: z.enum(['HOLIDAY', 'LONG_WEEKEND', 'VACATION']).optional(),
      startDate: z.string().transform(s => new Date(s)).optional(),
      endDate: z.string().transform(s => new Date(s)).optional()
    });

    const data = periodSchema.parse(req.body);

    const period = await prisma.specialPeriod.update({
      where: { id: req.params.id },
      data
    });

    res.json({ period });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to update special period' });
  }
});

// Delete special period
router.delete('/special-periods/:id', async (req, res) => {
  try {
    await prisma.specialPeriod.delete({
      where: { id: req.params.id }
    });
    res.json({ success: true });
  } catch (error) {
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

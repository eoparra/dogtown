import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { isProduction } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import { checkAvailability, checkDogAvailability } from '../services/availability.js';
import { calculatePrice } from '../services/pricing.js';

const router = Router();

const MAX_BOOKING_DAYS = 90;

const uuidParam = z.string().uuid();

const checkAvailabilitySchema = z.object({
  type: z.enum(['HOTEL', 'DAYCARE']),
  checkIn: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
  checkOut: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' })
});

const calculatePriceSchema = z.object({
  type: z.enum(['HOTEL', 'DAYCARE']),
  checkIn: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
  checkOut: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' })
});

const createBookingSchema = z.object({
  dogId: z.string().uuid(),
  type: z.enum(['HOTEL', 'DAYCARE']),
  checkIn: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
  checkOut: z.string().transform(s => new Date(s)).refine(d => !isNaN(d.getTime()), { message: 'Invalid date' }),
  notes: z.string().max(500).optional().nullable()
});

function daysBetween(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

// List user's bookings
router.get('/', requireAuth, async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        dog: {
          userId: req.user!.userId
        }
      },
      include: {
        dog: {
          select: { id: true, name: true, breed: true }
        }
      },
      orderBy: { checkIn: 'desc' }
    });
    res.json({ bookings });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Check availability
router.post('/check-availability', requireAuth, async (req, res) => {
  try {
    const data = checkAvailabilitySchema.parse(req.body);

    if (data.checkIn >= data.checkOut) {
      return res.status(400).json({ error: 'Check-out must be after check-in' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (data.checkIn < today) {
      return res.status(400).json({ error: 'Check-in cannot be in the past' });
    }

    if (daysBetween(data.checkIn, data.checkOut) > MAX_BOOKING_DAYS) {
      return res.status(400).json({ error: `Booking cannot exceed ${MAX_BOOKING_DAYS} days` });
    }

    const result = await checkAvailability(data.type, data.checkIn, data.checkOut);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: isProduction ? 'Validation failed' : error.errors });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to check availability' });
  }
});

// Calculate price
router.post('/calculate-price', requireAuth, async (req, res) => {
  try {
    const data = calculatePriceSchema.parse(req.body);

    if (data.checkIn >= data.checkOut) {
      return res.status(400).json({ error: 'Check-out must be after check-in' });
    }

    if (daysBetween(data.checkIn, data.checkOut) > MAX_BOOKING_DAYS) {
      return res.status(400).json({ error: `Booking cannot exceed ${MAX_BOOKING_DAYS} days` });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { userType: true }
    });
    const userType = (user?.userType as 'REGULAR' | 'PREFERENT') || 'REGULAR';

    const result = await calculatePrice(data.type, data.checkIn, data.checkOut, prisma, userType);
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: isProduction ? 'Validation failed' : error.errors });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate price' });
  }
});

// Create booking
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = createBookingSchema.parse(req.body);

    // Verify dog ownership and vaccination
    const dog = await prisma.dog.findFirst({
      where: {
        id: data.dogId,
        userId: req.user!.userId
      }
    });

    if (!dog) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    if (!dog.vaccinationInfo || dog.vaccinationInfo.trim().length < 10) {
      return res.status(400).json({ error: 'Dog must have detailed vaccination information (at least 10 characters) before booking' });
    }

    // Validate dates
    if (data.checkIn >= data.checkOut) {
      return res.status(400).json({ error: 'Check-out must be after check-in' });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (data.checkIn < today) {
      return res.status(400).json({ error: 'Check-in cannot be in the past' });
    }

    if (daysBetween(data.checkIn, data.checkOut) > MAX_BOOKING_DAYS) {
      return res.status(400).json({ error: `Booking cannot exceed ${MAX_BOOKING_DAYS} days` });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { userType: true }
    });
    const userType = (currentUser?.userType as 'REGULAR' | 'PREFERENT') || 'REGULAR';

    // Run availability checks and booking creation in a transaction
    // to prevent race conditions (two concurrent bookings exceeding capacity)
    const result = await prisma.$transaction(async (tx) => {
      const dogAvailability = await checkDogAvailability(data.dogId, data.checkIn, data.checkOut, undefined, tx);
      if (!dogAvailability.available) {
        throw { status: 400, body: { error: 'Dog already has a booking during this period' } };
      }

      const availability = await checkAvailability(data.type, data.checkIn, data.checkOut, undefined, tx);
      if (!availability.available) {
        throw { status: 400, body: { error: 'No availability for selected dates', unavailableDates: availability.unavailableDates } };
      }

      const priceResult = await calculatePrice(data.type, data.checkIn, data.checkOut, tx, userType);

      const booking = await tx.booking.create({
        data: {
          dogId: data.dogId,
          type: data.type,
          checkIn: data.checkIn,
          checkOut: data.checkOut,
          totalPrice: priceResult.totalPrice,
          notes: data.notes ?? null,
          status: 'CONFIRMED'
        },
        include: {
          dog: {
            select: { id: true, name: true, breed: true }
          }
        }
      });

      return { booking, priceDetails: priceResult.details };
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: isProduction ? 'Validation failed' : error.errors });
    }
    if (error?.status && error?.body) {
      return res.status(error.status).json(error.body);
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Cancel booking
router.patch('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const idResult = uuidParam.safeParse(req.params.id);
    if (!idResult.success) {
      return res.status(400).json({ error: 'Invalid booking ID format' });
    }

    // Verify booking belongs to user's dog
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id,
        dog: {
          userId: req.user!.userId
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Booking already cancelled' });
    }

    const updated = await prisma.booking.update({
      where: { id: req.params.id },
      data: { status: 'CANCELLED' },
      include: {
        dog: {
          select: { id: true, name: true, breed: true }
        }
      }
    });

    res.json({ booking: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

export default router;

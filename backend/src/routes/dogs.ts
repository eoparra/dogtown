import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../index.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

const dogSchema = z.object({
  name: z.string().min(1),
  breed: z.string().min(1),
  age: z.number().int().min(0),
  weight: z.number().min(0),
  notes: z.string().optional(),
  vaccinationInfo: z.string().optional()
});

// List user's dogs
router.get('/', requireAuth, async (req, res) => {
  try {
    const dogs = await prisma.dog.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ dogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// Get single dog
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const dog = await prisma.dog.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId
      },
      include: {
        bookings: {
          orderBy: { checkIn: 'desc' },
          take: 10
        }
      }
    });

    if (!dog) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    res.json({ dog });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dog' });
  }
});

// Create dog
router.post('/', requireAuth, async (req, res) => {
  try {
    const data = dogSchema.parse(req.body);

    const size = data.weight < 10 ? 'SMALL' : data.weight <= 20 ? 'MEDIUM' : 'LARGE';

    const dog = await prisma.dog.create({
      data: {
        ...data,
        size,
        userId: req.user!.userId
      }
    });

    res.status(201).json({ dog });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to create dog' });
  }
});

// Update dog
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const data = dogSchema.partial().parse(req.body);

    // Verify ownership
    const existing = await prisma.dog.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    // Auto-update size when weight changes
    const updateData: any = { ...data };
    if (data.weight !== undefined) {
      updateData.size = data.weight < 10 ? 'SMALL' : data.weight <= 20 ? 'MEDIUM' : 'LARGE';
    }

    const dog = await prisma.dog.update({
      where: { id: req.params.id },
      data: updateData
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

// Delete dog
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Verify ownership
    const existing = await prisma.dog.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Dog not found' });
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
    console.error(error);
    res.status(500).json({ error: 'Failed to delete dog' });
  }
});

export default router;

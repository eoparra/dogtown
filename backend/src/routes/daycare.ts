import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(requireAdmin);

// GET /admin/daycare — list active visits (checked in, not checked out)
router.get('/', async (req, res) => {
  try {
    const visits = await prisma.daycareVisit.findMany({
      where: { checkOutAt: null, cancelledAt: null },
      include: {
        dog: {
          select: {
            id: true,
            name: true,
            size: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
      orderBy: { checkInAt: 'desc' },
    });
    res.json({ visits });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch daycare visits' });
  }
});

// GET /admin/daycare/search?q= — search dogs for check-in
router.get('/search', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (q.length < 2) {
      return res.json({ dogs: [] });
    }

    // Find dogs already checked in
    const activeVisits = await prisma.daycareVisit.findMany({
      where: { checkOutAt: null, cancelledAt: null },
      select: { dogId: true },
    });
    const checkedInDogIds = activeVisits.map((v) => v.dogId);

    const dogs = await prisma.dog.findMany({
      where: {
        id: { notIn: checkedInDogIds.length > 0 ? checkedInDogIds : undefined },
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { user: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        id: true,
        name: true,
        size: true,
        user: { select: { id: true, name: true, email: true, phone: true } },
        packBalances: {
          where: { packType: 'DAYCARE_DAYS', remainingUnits: { gt: 0 } },
          select: { remainingUnits: true },
        },
      },
      take: 10,
    });

    res.json({ dogs });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to search dogs' });
  }
});

// GET /admin/daycare/history — paginated completed visits
router.get('/history', async (req, res) => {
  try {
    const { page, pageSize, q, startDate, endDate } = z.object({
      page:      z.coerce.number().int().positive().default(1),
      pageSize:  z.coerce.number().int().min(1).max(100).default(20),
      q:         z.string().optional(),
      startDate: z.string().optional(),
      endDate:   z.string().optional(),
    }).parse(req.query);

    const checkInAtFilter: { gte?: Date; lte?: Date } = {};

    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) {
        start.setUTCHours(0, 0, 0, 0);
        checkInAtFilter.gte = start;
      }
    }

    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setUTCHours(23, 59, 59, 999);
        checkInAtFilter.lte = end;
      }
    }

    const where = {
      checkOutAt:  { not: null } as const,
      cancelledAt: null,
      ...(Object.keys(checkInAtFilter).length > 0 ? { checkInAt: checkInAtFilter } : {}),
      ...(q && q.trim().length >= 2 ? {
        dog: {
          OR: [
            { name: { contains: q.trim(), mode: 'insensitive' as const } },
            { user: { name: { contains: q.trim(), mode: 'insensitive' as const } } },
          ],
        },
      } : {}),
    };

    const [total, visits] = await Promise.all([
      prisma.daycareVisit.count({ where }),
      prisma.daycareVisit.findMany({
        where,
        include: {
          dog: {
            select: {
              id: true,
              name: true,
              size: true,
              user: { select: { id: true, name: true, email: true, phone: true } },
            },
          },
        },
        orderBy: { checkInAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({ visits, total, page, pageSize });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid query parameters' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch daycare history' });
  }
});

// POST /admin/daycare/checkin — check in a dog
router.post('/checkin', async (req, res) => {
  try {
    const { dogId } = z.object({ dogId: z.string().uuid() }).parse(req.body);

    // Verify dog exists
    const dog = await prisma.dog.findUnique({ where: { id: dogId } });
    if (!dog) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    // Check not already checked in
    const existing = await prisma.daycareVisit.findFirst({
      where: { dogId, checkOutAt: null, cancelledAt: null },
    });
    if (existing) {
      return res.status(409).json({ error: 'Dog is already checked in' });
    }

    const visit = await prisma.daycareVisit.create({
      data: { dogId },
      include: {
        dog: {
          select: {
            id: true,
            name: true,
            size: true,
            user: { select: { id: true, name: true, email: true, phone: true } },
          },
        },
      },
    });

    res.status(201).json({ visit });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to check in dog' });
  }
});

// POST /admin/daycare/:visitId/checkout — check out a dog
router.post('/:visitId/checkout', async (req, res) => {
  try {
    const visitId = z.string().uuid().parse(req.params.visitId);

    const visit = await prisma.daycareVisit.findUnique({
      where: { id: visitId },
      include: { dog: { select: { id: true, name: true, size: true } } },
    });

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    if (visit.checkOutAt) {
      return res.status(409).json({ error: 'Dog is already checked out' });
    }

    // Always redirect to Sales — never deduct or set checkOutAt here
    const [balance, daycareRate, daycareService] = await Promise.all([
      prisma.dogPackBalance.findUnique({
        where: { dogId_packType: { dogId: visit.dogId, packType: 'DAYCARE_DAYS' } },
      }),
      prisma.daycareRate.findFirst(),
      prisma.service.findFirst({ where: { name: 'Daycare 1 day' } }),
    ]);

    const covered = !!(balance && balance.remainingUnits > 0);
    res.json({
      covered,
      remainingUnits: covered ? balance!.remainingUnits : undefined,
      price: covered ? 0 : (daycareRate?.pricePerDay ?? 0),
      serviceId: daycareService?.id ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid visit ID' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to check out dog' });
  }
});

// POST /admin/daycare/:visitId/finalize — complete checkout after payment in Sales page
router.post('/:visitId/finalize', async (req, res) => {
  try {
    const visitId = z.string().uuid().parse(req.params.visitId);

    const visit = await prisma.daycareVisit.findUnique({ where: { id: visitId } });
    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    if (visit.checkOutAt) {
      return res.status(409).json({ error: 'Already checked out' });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.daycareVisit.update({
        where: { id: visitId },
        data: { checkOutAt: new Date() },
      });

      const balance = await tx.dogPackBalance.findUnique({
        where: { dogId_packType: { dogId: visit.dogId, packType: 'DAYCARE_DAYS' } },
      });

      if (balance && balance.remainingUnits > 0) {
        await tx.dogPackBalance.update({
          where: { id: balance.id },
          data: { remainingUnits: { decrement: 1 } },
        });
        return { success: true, packDeducted: true, remainingUnits: balance.remainingUnits - 1 };
      }

      return { success: true, packDeducted: false };
    });

    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid visit ID' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to finalize checkout' });
  }
});

// DELETE /admin/daycare/:visitId — soft-delete an active visit (cancel accidental check-in)
router.delete('/:visitId', async (req, res) => {
  try {
    const visitId = z.string().uuid().parse(req.params.visitId);

    const visit = await prisma.daycareVisit.findUnique({ where: { id: visitId } });
    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }
    if (visit.checkOutAt) {
      return res.status(409).json({ error: 'Cannot delete a visit that has been checked out' });
    }
    if (visit.cancelledAt) {
      return res.status(409).json({ error: 'Visit is already cancelled' });
    }

    await prisma.daycareVisit.update({
      where: { id: visitId },
      data: { cancelledAt: new Date() },
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid visit ID' });
    }
    console.error(error);
    res.status(500).json({ error: 'Failed to delete visit' });
  }
});

export default router;

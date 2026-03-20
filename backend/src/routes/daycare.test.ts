import { describe, it, before, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { app, testPrisma, createAdminUser, makeAuthCookies } from '../test-helpers/index.js';

const request = supertest(app);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tracked = {
  userIds: [] as string[],
  dogIds: [] as string[],
  visitIds: [] as string[],
  serviceIds: [] as string[],
};

function clear() {
  tracked.userIds = [];
  tracked.dogIds = [];
  tracked.visitIds = [];
  tracked.serviceIds = [];
}

async function makeClient() {
  const user = await testPrisma.user.create({
    data: {
      email: `daycare-test-${Date.now()}-${Math.random()}@test.com`,
      passwordHash: 'hash',
      name: 'Daycare Test Client',
      role: 'CLIENT',
      tokenVersion: 0,
    },
  });
  tracked.userIds.push(user.id);
  return user;
}

async function makeDog(userId: string, overrides: Record<string, unknown> = {}) {
  const dog = await testPrisma.dog.create({
    data: {
      userId,
      name: 'Buddy',
      breed: 'Labrador',
      age: 3,
      weight: 25,
      size: 'LARGE',
      sterilized: false,
      ...overrides,
    },
  });
  tracked.dogIds.push(dog.id);
  return dog;
}

async function makeVisit(dogId: string) {
  const visit = await testPrisma.daycareVisit.create({ data: { dogId } });
  tracked.visitIds.push(visit.id);
  return visit;
}

async function ensureDaycareService() {
  // Uses the exact name the backend looks for. If already seeded, reuse it.
  const existing = await testPrisma.service.findFirst({ where: { name: 'Daycare 1 day' } });
  if (existing) return existing;
  const svc = await testPrisma.service.create({
    data: { name: 'Daycare 1 day', pricingType: 'FIXED', price: 35 },
  });
  tracked.serviceIds.push(svc.id);
  return svc;
}

async function ensureDaycareRate() {
  const existing = await testPrisma.daycareRate.findFirst();
  if (existing) return existing;
  return testPrisma.daycareRate.create({ data: { pricePerDay: 35 } });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('daycare routes', async () => {
  let cookieHeader: string;
  let csrfToken: string;

  before(async () => {
    const admin = await createAdminUser();
    ({ cookieHeader, csrfToken } = makeAuthCookies(admin.id));
    await ensureDaycareRate();
  });

  afterEach(async () => {
    await testPrisma.daycareVisit.deleteMany({ where: { id: { in: tracked.visitIds } } });
    await testPrisma.dog.deleteMany({ where: { id: { in: tracked.dogIds } } });
    await testPrisma.user.deleteMany({ where: { id: { in: tracked.userIds } } });
    await testPrisma.service.deleteMany({ where: { id: { in: tracked.serviceIds } } });
    clear();
  });

  it('unauthenticated request returns 401', async () => {
    const res = await request.get('/api/admin/daycare');
    assert.equal(res.status, 401);
  });

  // ─── GET / ───────────────────────────────────────────────────────────────

  describe('GET /api/admin/daycare', async () => {
    it('returns only active visits (checkOutAt is null)', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);

      // Also create a checked-out visit (should not appear)
      const dog2 = await makeDog(client.id, { name: 'Rex' });
      await testPrisma.daycareVisit.create({ data: { dogId: dog2.id, checkOutAt: new Date() } });
      // clean up manually (not tracked because we set checkOutAt directly)
      tracked.dogIds.push(dog2.id);

      const res = await request
        .get('/api/admin/daycare')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const ids = res.body.visits.map((v: { id: string }) => v.id);
      assert.ok(ids.includes(visit.id), 'active visit should be in results');
      assert.ok(res.body.visits.every((v: { checkOutAt: unknown }) => v.checkOutAt === null));
    });
  });

  // ─── GET /search ─────────────────────────────────────────────────────────

  describe('GET /api/admin/daycare/search', async () => {
    it('returns dogs matching the query, excluding already checked-in', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id, { name: 'UniqueDogX' });
      const checkedIn = await makeDog(client.id, { name: 'UniqueDogX-IN' });
      await makeVisit(checkedIn.id);

      const res = await request
        .get('/api/admin/daycare/search?q=UniqueDogX')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const ids = res.body.dogs.map((d: { id: string }) => d.id);
      assert.ok(ids.includes(dog.id), 'not-checked-in dog should appear');
      assert.ok(!ids.includes(checkedIn.id), 'checked-in dog should be excluded');
    });

    it('returns a dog whose previous visit was cancelled', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id, { name: 'UniqueDogCancelled' });
      // Create a cancelled (soft-deleted) visit for this dog
      const visit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, cancelledAt: new Date() },
      });
      tracked.visitIds.push(visit.id);

      const res = await request
        .get('/api/admin/daycare/search?q=UniqueDogCancelled')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const ids = res.body.dogs.map((d: { id: string }) => d.id);
      assert.ok(ids.includes(dog.id), 'dog with cancelled visit should appear in search');
    });

    it('returns empty array for query shorter than 2 chars', async () => {
      const res = await request
        .get('/api/admin/daycare/search?q=a')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.dogs, []);
    });
  });

  // ─── POST /checkin ────────────────────────────────────────────────────────

  describe('POST /api/admin/daycare/checkin', async () => {
    it('creates a visit for a valid dog', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);

      const res = await request
        .post('/api/admin/daycare/checkin')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ dogId: dog.id });

      assert.equal(res.status, 201);
      assert.equal(res.body.visit.dogId ?? res.body.visit.dog?.id, dog.id);
      tracked.visitIds.push(res.body.visit.id);
    });

    it('allows check-in for a dog whose previous visit was cancelled', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const cancelled = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, cancelledAt: new Date() },
      });
      tracked.visitIds.push(cancelled.id);

      const res = await request
        .post('/api/admin/daycare/checkin')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ dogId: dog.id });

      assert.equal(res.status, 201);
      tracked.visitIds.push(res.body.visit.id);
    });

    it('returns 409 if dog is already checked in', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      await makeVisit(dog.id);

      const res = await request
        .post('/api/admin/daycare/checkin')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ dogId: dog.id });

      assert.equal(res.status, 409);
    });

    it('returns 404 for non-existent dog', async () => {
      const res = await request
        .post('/api/admin/daycare/checkin')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken)
        .send({ dogId: '00000000-0000-0000-0000-000000000000' });

      assert.equal(res.status, 404);
    });
  });

  // ─── POST /:visitId/checkout ──────────────────────────────────────────────

  describe('POST /api/admin/daycare/:visitId/checkout', async () => {
    it('covered: true — returns price 0 and remainingUnits, does NOT set checkOutAt or deduct pack', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);

      await testPrisma.dogPackBalance.create({
        data: { dogId: dog.id, packType: 'DAYCARE_DAYS', remainingUnits: 5 },
      });

      const res = await request
        .post(`/api/admin/daycare/${visit.id}/checkout`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.covered, true);
      assert.equal(res.body.remainingUnits, 5);
      assert.equal(res.body.price, 0);

      // Visit should NOT be checked out yet
      const unchanged = await testPrisma.daycareVisit.findUnique({ where: { id: visit.id } });
      assert.equal(unchanged?.checkOutAt, null, 'checkOutAt should remain null until finalize');

      // Pack balance should NOT be decremented yet
      const balance = await testPrisma.dogPackBalance.findFirst({ where: { dogId: dog.id } });
      assert.equal(balance?.remainingUnits, 5, 'pack should not be deducted until finalize');

      // Cleanup
      await testPrisma.dogPackBalance.deleteMany({ where: { dogId: dog.id } });
    });

    it('covered: false — does NOT set checkOutAt, returns price and serviceId', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);

      const res = await request
        .post(`/api/admin/daycare/${visit.id}/checkout`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.covered, false);
      assert.ok(typeof res.body.price === 'number', 'price should be a number');
      // serviceId is either a UUID or null (null if "Daycare 1 day" not seeded)
      assert.ok(
        res.body.serviceId === null || typeof res.body.serviceId === 'string',
        'serviceId should be string or null'
      );

      // Visit should NOT be checked out
      const unchanged = await testPrisma.daycareVisit.findUnique({ where: { id: visit.id } });
      assert.equal(unchanged?.checkOutAt, null, 'checkOutAt should remain null');
    });

    it('covered: false — serviceId is a valid UUID when Daycare 1 day service exists', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);
      const svc = await ensureDaycareService();

      const res = await request
        .post(`/api/admin/daycare/${visit.id}/checkout`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.covered, false);
      // serviceId must be a UUID (not empty string) so Sales page can create a valid line item
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      assert.ok(
        res.body.serviceId && uuidRegex.test(res.body.serviceId),
        `serviceId "${res.body.serviceId}" should be a valid UUID`
      );
      assert.equal(res.body.serviceId, svc.id);
    });

    it('returns 404 for non-existent visit', async () => {
      const res = await request
        .post('/api/admin/daycare/00000000-0000-0000-0000-000000000000/checkout')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      assert.equal(res.status, 404);
    });

    it('returns 409 if already checked out', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkOutAt: new Date() },
      });
      tracked.visitIds.push(visit.id);

      const res = await request
        .post(`/api/admin/daycare/${visit.id}/checkout`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      assert.equal(res.status, 409);
    });
  });

  // ─── DELETE /:visitId ─────────────────────────────────────────────────────

  describe('DELETE /api/admin/daycare/:visitId', async () => {
    it('soft-deletes an active visit by setting cancelledAt', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);

      const res = await request
        .delete(`/api/admin/daycare/${visit.id}`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const updated = await testPrisma.daycareVisit.findUnique({ where: { id: visit.id } });
      assert.ok(updated?.cancelledAt, 'cancelledAt should be set');
      assert.equal(updated?.checkOutAt, null, 'checkOutAt should remain null');
    });

    it('excludes cancelled visits from GET /api/admin/daycare', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);

      await request
        .delete(`/api/admin/daycare/${visit.id}`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      const res = await request
        .get('/api/admin/daycare')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const ids = res.body.visits.map((v: { id: string }) => v.id);
      assert.ok(!ids.includes(visit.id), 'cancelled visit should not appear in active list');
    });

    it('returns 404 for non-existent visit', async () => {
      const res = await request
        .delete('/api/admin/daycare/00000000-0000-0000-0000-000000000000')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      assert.equal(res.status, 404);
    });

    it('returns 409 if visit is already checked out', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkOutAt: new Date() },
      });
      tracked.visitIds.push(visit.id);

      const res = await request
        .delete(`/api/admin/daycare/${visit.id}`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      assert.equal(res.status, 409);
    });

    it('returns 409 if visit is already cancelled', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, cancelledAt: new Date() },
      });
      tracked.visitIds.push(visit.id);

      const res = await request
        .delete(`/api/admin/daycare/${visit.id}`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      assert.equal(res.status, 409);
    });
  });

  // ─── POST /:visitId/finalize ──────────────────────────────────────────────

  describe('POST /api/admin/daycare/:visitId/finalize', async () => {
    it('sets checkOutAt on a pending visit', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);

      const res = await request
        .post(`/api/admin/daycare/${visit.id}/finalize`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.packDeducted, false);

      const updated = await testPrisma.daycareVisit.findUnique({ where: { id: visit.id } });
      assert.ok(updated?.checkOutAt, 'checkOutAt should be set after finalize');
    });

    it('deducts pack balance when dog has one, returns packDeducted and remainingUnits', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);

      await testPrisma.dogPackBalance.create({
        data: { dogId: dog.id, packType: 'DAYCARE_DAYS', remainingUnits: 5 },
      });

      const res = await request
        .post(`/api/admin/daycare/${visit.id}/finalize`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.equal(res.body.packDeducted, true);
      assert.equal(res.body.remainingUnits, 4);

      const balance = await testPrisma.dogPackBalance.findFirst({ where: { dogId: dog.id } });
      assert.equal(balance?.remainingUnits, 4, 'pack should be decremented on finalize');

      const updated = await testPrisma.daycareVisit.findUnique({ where: { id: visit.id } });
      assert.ok(updated?.checkOutAt, 'checkOutAt should be set');

      // Cleanup
      await testPrisma.dogPackBalance.deleteMany({ where: { dogId: dog.id } });
    });

    it('returns 404 for non-existent visit', async () => {
      const res = await request
        .post('/api/admin/daycare/00000000-0000-0000-0000-000000000000/finalize')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      assert.equal(res.status, 404);
    });

    it('returns 409 if already checked out', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkOutAt: new Date() },
      });
      tracked.visitIds.push(visit.id);

      const res = await request
        .post(`/api/admin/daycare/${visit.id}/finalize`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      assert.equal(res.status, 409);
    });
  });

  // ─── GET /history ─────────────────────────────────────────────────────────

  describe('GET /api/admin/daycare/history', async () => {
    it('returns only completed visits (checkOutAt set, cancelledAt null)', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id, { name: 'HistoryDogA' });

      const completed = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkOutAt: new Date() },
      });
      tracked.visitIds.push(completed.id);

      const active = await makeVisit(dog.id);

      const cancelled = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, cancelledAt: new Date() },
      });
      tracked.visitIds.push(cancelled.id);

      const res = await request
        .get('/api/admin/daycare/history')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const ids = res.body.visits.map((v: { id: string }) => v.id);
      assert.ok(ids.includes(completed.id), 'completed visit should appear');
      assert.ok(!ids.includes(active.id), 'active visit should not appear');
      assert.ok(!ids.includes(cancelled.id), 'cancelled visit should not appear');
    });

    it('returns pagination metadata', async () => {
      const res = await request
        .get('/api/admin/daycare/history?page=1&pageSize=5')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      assert.ok('total' in res.body);
      assert.ok('page' in res.body);
      assert.ok('pageSize' in res.body);
      assert.equal(res.body.page, 1);
      assert.equal(res.body.pageSize, 5);
    });

    it('filters by dog name', async () => {
      const client = await makeClient();
      const matchDog = await makeDog(client.id, { name: 'UniqueHistoryMatch' });
      const otherDog = await makeDog(client.id, { name: 'OtherHistoryDog' });

      const matchVisit = await testPrisma.daycareVisit.create({ data: { dogId: matchDog.id, checkOutAt: new Date() } });
      const otherVisit = await testPrisma.daycareVisit.create({ data: { dogId: otherDog.id, checkOutAt: new Date() } });
      tracked.visitIds.push(matchVisit.id, otherVisit.id);

      const res = await request
        .get('/api/admin/daycare/history?q=UniqueHistoryMatch')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const ids = res.body.visits.map((v: { id: string }) => v.id);
      assert.ok(ids.includes(matchVisit.id));
      assert.ok(!ids.includes(otherVisit.id));
    });

    it('filters by startDate', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id, { name: 'DateFilterDog' });

      const oldVisit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkInAt: new Date('2025-01-10T10:00:00Z'), checkOutAt: new Date('2025-01-10T17:00:00Z') },
      });
      const recentVisit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkInAt: new Date('2026-01-10T10:00:00Z'), checkOutAt: new Date('2026-01-10T17:00:00Z') },
      });
      tracked.visitIds.push(oldVisit.id, recentVisit.id);

      const res = await request
        .get('/api/admin/daycare/history?startDate=2026-01-01')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const ids = res.body.visits.map((v: { id: string }) => v.id);
      assert.ok(ids.includes(recentVisit.id));
      assert.ok(!ids.includes(oldVisit.id));
    });

    it('filters by endDate', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id, { name: 'EndDateFilterDog' });

      const oldVisit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkInAt: new Date('2024-06-01T10:00:00Z'), checkOutAt: new Date('2024-06-01T17:00:00Z') },
      });
      const recentVisit = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkInAt: new Date('2026-03-01T10:00:00Z'), checkOutAt: new Date('2026-03-01T17:00:00Z') },
      });
      tracked.visitIds.push(oldVisit.id, recentVisit.id);

      const res = await request
        .get('/api/admin/daycare/history?endDate=2024-12-31')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(res.status, 200);
      const ids = res.body.visits.map((v: { id: string }) => v.id);
      assert.ok(ids.includes(oldVisit.id));
      assert.ok(!ids.includes(recentVisit.id));
    });

    it('paginates results correctly with no overlap between pages', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id, { name: 'PaginationDog' });

      const v1 = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkInAt: new Date('2026-01-01T09:00:00Z'), checkOutAt: new Date('2026-01-01T17:00:00Z') },
      });
      const v2 = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkInAt: new Date('2026-01-02T09:00:00Z'), checkOutAt: new Date('2026-01-02T17:00:00Z') },
      });
      const v3 = await testPrisma.daycareVisit.create({
        data: { dogId: dog.id, checkInAt: new Date('2026-01-03T09:00:00Z'), checkOutAt: new Date('2026-01-03T17:00:00Z') },
      });
      tracked.visitIds.push(v1.id, v2.id, v3.id);

      const page1 = await request
        .get('/api/admin/daycare/history?q=PaginationDog&page=1&pageSize=2')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      const page2 = await request
        .get('/api/admin/daycare/history?q=PaginationDog&page=2&pageSize=2')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(page1.body.visits.length, 2);
      assert.equal(page1.body.total, 3);
      assert.equal(page2.body.visits.length, 1);

      const p1Ids = page1.body.visits.map((v: { id: string }) => v.id);
      const p2Ids = page2.body.visits.map((v: { id: string }) => v.id);
      assert.equal(p1Ids.filter((id: string) => p2Ids.includes(id)).length, 0, 'pages should not overlap');
    });
  });

  // ─── GET /admin/stats — dogsInDaycare ────────────────────────────────────

  describe('GET /api/admin/stats — dogsInDaycare count', async () => {
    it('does not count cancelled visits', async () => {
      const client = await makeClient();
      const dog = await makeDog(client.id);
      const visit = await makeVisit(dog.id);

      // Get baseline
      const before = await request
        .get('/api/admin/stats')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);
      const countBefore = before.body.dogsInDaycare as number;

      // Cancel the visit
      await request
        .delete(`/api/admin/daycare/${visit.id}`)
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      const after = await request
        .get('/api/admin/stats')
        .set('Cookie', cookieHeader)
        .set('x-csrf-token', csrfToken);

      assert.equal(after.body.dogsInDaycare, countBefore - 1, 'cancelled visit should not be counted');
    });
  });
});

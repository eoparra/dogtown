import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {
  app,
  testPrisma,
  createAdminUser,
  makeAuthCookies,
} from '../test-helpers/index.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function authedGet(path: string, cookieHeader: string) {
  return request(app).get(path).set('Cookie', cookieHeader);
}

function authedPost(path: string, cookieHeader: string, csrfToken: string, body: object) {
  return request(app)
    .post(path)
    .set('Cookie', cookieHeader)
    .set('x-csrf-token', csrfToken)
    .send(body);
}

function authedPut(path: string, cookieHeader: string, csrfToken: string, body: object) {
  return request(app)
    .put(path)
    .set('Cookie', cookieHeader)
    .set('x-csrf-token', csrfToken)
    .send(body);
}

function authedDelete(path: string, cookieHeader: string, csrfToken: string) {
  return request(app)
    .delete(path)
    .set('Cookie', cookieHeader)
    .set('x-csrf-token', csrfToken);
}

// ── suite ─────────────────────────────────────────────────────────────────────

test('services routes', async (t) => {
  let cookieHeader: string;
  let csrfToken: string;

  t.before(async () => {
    const admin = await createAdminUser();
    ({ cookieHeader, csrfToken } = makeAuthCookies(admin.id));
  });

  t.afterEach(async () => {
    await testPrisma.service.deleteMany({});
  });

  t.after(async () => {
    await testPrisma.$disconnect();
  });

  // ── auth guard ───────────────────────────────────────────────────────────────

  await t.test('unauthenticated request returns 401', async () => {
    const res = await request(app).get('/api/admin/services');
    assert.equal(res.status, 401);
  });

  // ── GET /api/admin/services ──────────────────────────────────────────────────

  await t.test('GET /api/admin/services', async (t) => {
    await t.test('returns empty array when no services', async () => {
      const res = await authedGet('/api/admin/services', cookieHeader);
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.services, []);
    });

    await t.test('returns all services', async () => {
      await testPrisma.service.create({ data: { name: 'Grooming', pricingType: 'FIXED', price: 30 } });
      await testPrisma.service.create({ data: { name: 'Bath', pricingType: 'FIXED', price: 20 } });

      const res = await authedGet('/api/admin/services', cookieHeader);
      assert.equal(res.status, 200);
      assert.equal(res.body.services.length, 2);
    });
  });

  // ── POST /api/admin/services ─────────────────────────────────────────────────

  await t.test('POST /api/admin/services', async (t) => {
    await t.test('creates a FIXED service', async () => {
      const res = await authedPost('/api/admin/services', cookieHeader, csrfToken, {
        name: 'Training',
        description: 'Basic obedience training',
        pricingType: 'FIXED',
        price: 50,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.service.name, 'Training');
      assert.equal(res.body.service.description, 'Basic obedience training');
      assert.equal(res.body.service.pricingType, 'FIXED');
      assert.equal(res.body.service.price, 50);
      assert.equal(res.body.service.priceSmall, null);
      assert.equal(res.body.service.priceMedium, null);
      assert.equal(res.body.service.priceLarge, null);
    });

    await t.test('creates a FIXED service without description', async () => {
      const res = await authedPost('/api/admin/services', cookieHeader, csrfToken, {
        name: 'Walk',
        pricingType: 'FIXED',
        price: 15,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.service.description, null);
    });

    await t.test('creates a BY_SIZE service with all three prices', async () => {
      const res = await authedPost('/api/admin/services', cookieHeader, csrfToken, {
        name: 'Bath',
        pricingType: 'BY_SIZE',
        priceSmall: 30,
        priceMedium: 50,
        priceLarge: 70,
      });
      assert.equal(res.status, 201);
      assert.equal(res.body.service.pricingType, 'BY_SIZE');
      assert.equal(res.body.service.price, null);
      assert.equal(res.body.service.priceSmall, 30);
      assert.equal(res.body.service.priceMedium, 50);
      assert.equal(res.body.service.priceLarge, 70);
    });

    await t.test('returns 400 when name is missing', async () => {
      const res = await authedPost('/api/admin/services', cookieHeader, csrfToken, {
        pricingType: 'FIXED',
        price: 10,
      });
      assert.equal(res.status, 400);
    });

    await t.test('returns 400 when FIXED but price is missing', async () => {
      const res = await authedPost('/api/admin/services', cookieHeader, csrfToken, {
        name: 'Walk',
        pricingType: 'FIXED',
      });
      assert.equal(res.status, 400);
    });

    await t.test('returns 400 when FIXED and price is negative', async () => {
      const res = await authedPost('/api/admin/services', cookieHeader, csrfToken, {
        name: 'Walk',
        pricingType: 'FIXED',
        price: -5,
      });
      assert.equal(res.status, 400);
    });

    await t.test('returns 400 when BY_SIZE but a size price is missing', async () => {
      const res = await authedPost('/api/admin/services', cookieHeader, csrfToken, {
        name: 'Bath',
        pricingType: 'BY_SIZE',
        priceSmall: 30,
        priceMedium: 50,
        // priceLarge missing
      });
      assert.equal(res.status, 400);
    });
  });

  // ── PUT /api/admin/services/:id ──────────────────────────────────────────────

  await t.test('PUT /api/admin/services/:id', async (t) => {
    await t.test('updates a FIXED service', async () => {
      const created = await testPrisma.service.create({
        data: { name: 'Old Name', pricingType: 'FIXED', price: 10 },
      });

      const res = await authedPut(`/api/admin/services/${created.id}`, cookieHeader, csrfToken, {
        name: 'New Name',
        description: 'Updated desc',
        pricingType: 'FIXED',
        price: 25,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.service.name, 'New Name');
      assert.equal(res.body.service.pricingType, 'FIXED');
      assert.equal(res.body.service.price, 25);
    });

    await t.test('updates a service from FIXED to BY_SIZE', async () => {
      const created = await testPrisma.service.create({
        data: { name: 'Bath', pricingType: 'FIXED', price: 30 },
      });

      const res = await authedPut(`/api/admin/services/${created.id}`, cookieHeader, csrfToken, {
        name: 'Bath',
        pricingType: 'BY_SIZE',
        priceSmall: 25,
        priceMedium: 40,
        priceLarge: 60,
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.service.pricingType, 'BY_SIZE');
      assert.equal(res.body.service.price, null);
      assert.equal(res.body.service.priceSmall, 25);
      assert.equal(res.body.service.priceMedium, 40);
      assert.equal(res.body.service.priceLarge, 60);
    });

    await t.test('returns 404 for non-existent service', async () => {
      const res = await authedPut(
        '/api/admin/services/00000000-0000-0000-0000-000000000000',
        cookieHeader,
        csrfToken,
        { name: 'X', pricingType: 'FIXED', price: 1 },
      );
      assert.equal(res.status, 404);
    });

    await t.test('returns 400 for invalid UUID', async () => {
      const res = await authedPut('/api/admin/services/not-a-uuid', cookieHeader, csrfToken, {
        name: 'X',
        pricingType: 'FIXED',
        price: 1,
      });
      assert.equal(res.status, 400);
    });
  });

  // ── DELETE /api/admin/services/:id ──────────────────────────────────────────

  await t.test('DELETE /api/admin/services/:id', async (t) => {
    await t.test('deletes a service', async () => {
      const created = await testPrisma.service.create({
        data: { name: 'To Delete', pricingType: 'FIXED', price: 5 },
      });

      const res = await authedDelete(`/api/admin/services/${created.id}`, cookieHeader, csrfToken);
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);

      const found = await testPrisma.service.findUnique({ where: { id: created.id } });
      assert.equal(found, null);
    });

    await t.test('returns 404 for non-existent service', async () => {
      const res = await authedDelete(
        '/api/admin/services/00000000-0000-0000-0000-000000000000',
        cookieHeader,
        csrfToken,
      );
      assert.equal(res.status, 404);
    });

    await t.test('returns 400 for invalid UUID', async () => {
      const res = await authedDelete('/api/admin/services/not-a-uuid', cookieHeader, csrfToken);
      assert.equal(res.status, 400);
    });
  });
});

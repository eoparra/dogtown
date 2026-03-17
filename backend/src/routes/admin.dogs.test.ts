import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { app, testPrisma, createAdminUser, makeAuthCookies } from '../test-helpers/index.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function authedGet(path: string, cookieHeader: string) {
  return request(app).get(path).set('Cookie', cookieHeader);
}

function authedPut(path: string, cookieHeader: string, csrfToken: string, body: object) {
  return request(app)
    .put(path)
    .set('Cookie', cookieHeader)
    .set('x-csrf-token', csrfToken)
    .send(body);
}

// ── suite ─────────────────────────────────────────────────────────────────────

test('admin dog routes', async (t) => {
  let cookieHeader: string;
  let csrfToken: string;
  let clientUserId: string;

  t.before(async () => {
    const admin = await createAdminUser();
    ({ cookieHeader, csrfToken } = makeAuthCookies(admin.id));

    const client = await testPrisma.user.upsert({
      where: { email: 'admin-dogs-test-client@dogtown.com' },
      update: {},
      create: {
        email: 'admin-dogs-test-client@dogtown.com',
        passwordHash: 'hash',
        name: 'Dogs Test Client',
        role: 'CLIENT',
        tokenVersion: 0,
      },
    });
    clientUserId = client.id;
  });

  t.afterEach(async () => {
    await testPrisma.dog.deleteMany({ where: { userId: clientUserId } });
  });

  t.after(async () => {
    await testPrisma.user.deleteMany({
      where: { email: 'admin-dogs-test-client@dogtown.com' },
    });
    await testPrisma.$disconnect();
  });

  // ── auth guard ──────────────────────────────────────────────────────────────

  await t.test('unauthenticated GET /api/admin/dogs returns 401', async () => {
    const res = await request(app).get('/api/admin/dogs');
    assert.equal(res.status, 401);
  });

  await t.test('unauthenticated PUT /api/admin/dogs/:id is rejected (CSRF fires before auth, returns 403)', async () => {
    // CSRF middleware intercepts state-changing requests before the auth check
    const res = await request(app)
      .put('/api/admin/dogs/00000000-0000-0000-0000-000000000000')
      .send({ name: 'Ghost' });
    assert.equal(res.status, 403);
  });

  // ── GET /api/admin/dogs ─────────────────────────────────────────────────────

  await t.test('GET /api/admin/dogs', async (t) => {
    await t.test('returns all dogs with user info', async () => {
      await testPrisma.dog.create({
        data: {
          userId: clientUserId,
          name: 'Rex',
          breed: 'Labrador',
          age: 3,
          weight: 25,
          size: 'LARGE',
        },
      });

      const res = await authedGet('/api/admin/dogs', cookieHeader);

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.body.dogs));
      const dog = res.body.dogs.find((d: { name: string }) => d.name === 'Rex');
      assert.ok(dog, 'Rex should be in the list');
      assert.equal(dog.user.name, 'Dogs Test Client');
      assert.equal(dog.user.email, 'admin-dogs-test-client@dogtown.com');
    });
  });

  // ── PUT /api/admin/dogs/:id ─────────────────────────────────────────────────

  await t.test('PUT /api/admin/dogs/:id', async (t) => {
    await t.test('updates basic fields', async () => {
      const dog = await testPrisma.dog.create({
        data: {
          userId: clientUserId,
          name: 'Buddy',
          breed: 'Poodle',
          age: 2,
          weight: 8,
          size: 'SMALL',
        },
      });

      const res = await authedPut(
        `/api/admin/dogs/${dog.id}`,
        cookieHeader,
        csrfToken,
        { name: 'Buddy Updated', breed: 'Poodle Mix', age: 3 },
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.dog.name, 'Buddy Updated');
      assert.equal(res.body.dog.breed, 'Poodle Mix');
      assert.equal(res.body.dog.age, 3);
    });

    await t.test('updates extended profile fields', async () => {
      const dog = await testPrisma.dog.create({
        data: {
          userId: clientUserId,
          name: 'Max',
          breed: 'Beagle',
          age: 4,
          weight: 12,
          size: 'MEDIUM',
        },
      });

      const res = await authedPut(
        `/api/admin/dogs/${dog.id}`,
        cookieHeader,
        csrfToken,
        {
          color: 'Brown',
          sex: 'MALE',
          sterilized: true,
          character: 'Friendly and energetic',
          specialRequirements: 'Needs daily exercise',
          foodType: 'Dry kibble',
          foodQuantity: '1.5 cups twice a day',
          foodAdditionalIndication: 'No treats',
        },
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.dog.color, 'Brown');
      assert.equal(res.body.dog.sex, 'MALE');
      assert.equal(res.body.dog.sterilized, true);
      assert.equal(res.body.dog.character, 'Friendly and energetic');
      assert.equal(res.body.dog.specialRequirements, 'Needs daily exercise');
      assert.equal(res.body.dog.foodType, 'Dry kibble');
      assert.equal(res.body.dog.foodQuantity, '1.5 cups twice a day');
      assert.equal(res.body.dog.foodAdditionalIndication, 'No treats');
    });

    await t.test('updates multiple extended fields in one request', async () => {
      const dog = await testPrisma.dog.create({
        data: {
          userId: clientUserId,
          name: 'Luna',
          breed: 'Husky',
          age: 5,
          weight: 22,
          size: 'LARGE',
          color: 'Black',
        },
      });

      const res = await authedPut(
        `/api/admin/dogs/${dog.id}`,
        cookieHeader,
        csrfToken,
        {
          name: 'Luna Updated',
          color: 'Black & White',
          sex: 'FEMALE',
          sterilized: false,
          vaccinationInfo: 'Rabies 2024-01-15, DHPP 2024-03-01',
        },
      );

      assert.equal(res.status, 200);
      assert.equal(res.body.dog.name, 'Luna Updated');
      assert.equal(res.body.dog.color, 'Black & White');
      assert.equal(res.body.dog.sex, 'FEMALE');
      assert.equal(res.body.dog.sterilized, false);
      assert.equal(res.body.dog.vaccinationInfo, 'Rabies 2024-01-15, DHPP 2024-03-01');
    });

    await t.test('rejects an invalid sex enum value', async () => {
      const dog = await testPrisma.dog.create({
        data: {
          userId: clientUserId,
          name: 'Fido',
          breed: 'Terrier',
          age: 1,
          weight: 5,
          size: 'SMALL',
        },
      });

      const res = await authedPut(
        `/api/admin/dogs/${dog.id}`,
        cookieHeader,
        csrfToken,
        { sex: 'UNKNOWN' },
      );

      assert.equal(res.status, 400);
    });

    await t.test('returns 404 for a non-existent dog ID', async () => {
      const res = await authedPut(
        '/api/admin/dogs/00000000-0000-0000-0000-000000000000',
        cookieHeader,
        csrfToken,
        { name: 'Ghost' },
      );
      assert.equal(res.status, 404);
    });

    await t.test('returns 400 for a malformed dog ID', async () => {
      const res = await authedPut(
        '/api/admin/dogs/not-a-uuid',
        cookieHeader,
        csrfToken,
        { name: 'Test' },
      );
      assert.equal(res.status, 400);
    });
  });
});

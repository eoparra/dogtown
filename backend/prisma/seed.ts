import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

function isStrongPassword(password: string): boolean {
  return password.length >= 14
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

async function main() {
  console.log('Seeding database...');

  const isProduction = process.env.NODE_ENV === 'production';

  const defaultAdminEmail = 'admin@dogtown.com';
  const adminEmail = isProduction
    ? (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
    : defaultAdminEmail;

  const adminPassword = isProduction
    ? (process.env.ADMIN_PASSWORD || '')
    : (crypto.randomUUID().replace(/-/g, '').slice(0, 20) + 'A1!');

  if (isProduction) {
    if (!adminEmail) {
      throw new Error('Production seed requires ADMIN_EMAIL.');
    }
    if (!adminPassword) {
      throw new Error('Production seed requires ADMIN_PASSWORD.');
    }
    if (adminEmail === defaultAdminEmail) {
      throw new Error('Production seed refuses default admin email admin@dogtown.com. Set ADMIN_EMAIL to a non-default value.');
    }
    if (!isStrongPassword(adminPassword)) {
      throw new Error('ADMIN_PASSWORD must be strong (>=14 chars, upper, lower, number, symbol).');
    }
  }

  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: 'Admin',
      role: 'ADMIN'
    }
  });
  console.log('Created admin user:', admin.email);

  // Create hotel rates
  const hotelRates = [
    { type: 'REGULAR' as const, pricePerNight: 50 },
    { type: 'HOLIDAY' as const, pricePerNight: 75 },
    { type: 'LONG_WEEKEND' as const, pricePerNight: 65 },
    { type: 'VACATION' as const, pricePerNight: 80 }
  ];

  for (const rate of hotelRates) {
    await prisma.hotelRate.upsert({
      where: { type: rate.type },
      update: { pricePerNight: rate.pricePerNight },
      create: rate
    });
  }
  console.log('Created hotel rates');

  // Create daycare rate
  const existingDaycareRate = await prisma.daycareRate.findFirst();
  if (!existingDaycareRate) {
    await prisma.daycareRate.create({
      data: { pricePerDay: 35 }
    });
  }
  console.log('Created daycare rate');

  // Create capacity settings
  const capacities = [
    { type: 'HOTEL' as const, maxCapacity: 20 },
    { type: 'DAYCARE' as const, maxCapacity: 30 }
  ];

  for (const cap of capacities) {
    await prisma.capacity.upsert({
      where: { type: cap.type },
      update: { maxCapacity: cap.maxCapacity },
      create: cap
    });
  }
  console.log('Created capacity settings');

  // Print admin credentials only outside production
  if (!isProduction) {
    console.log('\n' + '='.repeat(55));
    console.log('  Admin credentials (save these, shown only once):');
    console.log(`  Email:    ${admin.email}`);
    console.log(`  Password: ${adminPassword}`);
    console.log('='.repeat(55));
  }

  // Sample data is only created in non-production environments
  if (isProduction) {
    console.log('\nProduction mode: skipping sample data.');
    console.log('Database seeded successfully!');
    return;
  }

  // Create sample special periods
  const currentYear = new Date().getFullYear();
  const samplePeriods = [
    {
      name: 'Christmas & New Year',
      type: 'HOLIDAY' as const,
      startDate: new Date(`${currentYear}-12-20`),
      endDate: new Date(`${currentYear + 1}-01-05`)
    },
    {
      name: 'Summer Season',
      type: 'VACATION' as const,
      startDate: new Date(`${currentYear}-07-01`),
      endDate: new Date(`${currentYear}-08-31`)
    },
    {
      name: 'Memorial Day Weekend',
      type: 'LONG_WEEKEND' as const,
      startDate: new Date(`${currentYear}-05-24`),
      endDate: new Date(`${currentYear}-05-27`)
    }
  ];

  for (const period of samplePeriods) {
    const existing = await prisma.specialPeriod.findFirst({
      where: { name: period.name }
    });
    if (!existing) {
      await prisma.specialPeriod.create({ data: period });
    }
  }
  console.log('Created sample special periods');

  // Create sample client users with dogs (dev only)
  const samplePassword = crypto.randomUUID().replace(/-/g, '').slice(0, 20) + 'A1!';
  const clientPasswordHash = await bcrypt.hash(samplePassword, 10);

  const maria = await prisma.user.upsert({
    where: { email: 'maria@example.com' },
    update: {},
    create: {
      email: 'maria@example.com',
      passwordHash: clientPasswordHash,
      name: 'Maria Garcia',
      phone: '+1 555-0101',
      role: 'CLIENT',
    }
  });
  const mariaDogs = [
    { name: 'Luna', breed: 'Golden Retriever', age: 3, weight: 28, size: 'LARGE', userId: maria.id },
    { name: 'Coco', breed: 'French Bulldog', age: 5, weight: 11, size: 'MEDIUM', userId: maria.id },
    { name: 'Milo', breed: 'Chihuahua', age: 2, weight: 3, size: 'SMALL', userId: maria.id },
  ];
  for (const dog of mariaDogs) {
    const existing = await prisma.dog.findFirst({ where: { name: dog.name, userId: dog.userId } });
    if (!existing) await prisma.dog.create({ data: dog });
  }
  console.log('Created user Maria Garcia with 3 dogs');

  const james = await prisma.user.upsert({
    where: { email: 'james@example.com' },
    update: {},
    create: {
      email: 'james@example.com',
      passwordHash: clientPasswordHash,
      name: 'James Wilson',
      phone: '+1 555-0202',
      role: 'CLIENT',
    }
  });
  const jamesDogs = [
    { name: 'Rocky', breed: 'German Shepherd', age: 4, weight: 35, size: 'LARGE', userId: james.id },
    { name: 'Bella', breed: 'Beagle', age: 6, weight: 12, size: 'MEDIUM', userId: james.id },
  ];
  for (const dog of jamesDogs) {
    const existing = await prisma.dog.findFirst({ where: { name: dog.name, userId: dog.userId } });
    if (!existing) await prisma.dog.create({ data: dog });
  }
  console.log('Created user James Wilson with 2 dogs');

  const sofia = await prisma.user.upsert({
    where: { email: 'sofia@example.com' },
    update: {},
    create: {
      email: 'sofia@example.com',
      passwordHash: clientPasswordHash,
      name: 'Sofia Chen',
      phone: '+1 555-0303',
      role: 'CLIENT',
    }
  });
  const sofiaDogs = [
    { name: 'Daisy', breed: 'Pomeranian', age: 1, weight: 4, size: 'SMALL', userId: sofia.id },
  ];
  for (const dog of sofiaDogs) {
    const existing = await prisma.dog.findFirst({ where: { name: dog.name, userId: dog.userId } });
    if (!existing) await prisma.dog.create({ data: dog });
  }
  console.log('Created user Sofia Chen with 1 dog');

  console.log(`\nSample client password: ${samplePassword}`);
  console.log('Database seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

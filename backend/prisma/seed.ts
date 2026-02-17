import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@dogtown.com' },
    update: {},
    create: {
      email: 'admin@dogtown.com',
      passwordHash: adminPassword,
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

  // Create sample client users with dogs
  const clientPassword = await bcrypt.hash('password123', 10);

  const maria = await prisma.user.upsert({
    where: { email: 'maria@example.com' },
    update: {},
    create: {
      email: 'maria@example.com',
      passwordHash: clientPassword,
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
      passwordHash: clientPassword,
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
      passwordHash: clientPassword,
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

  console.log('Database seeded successfully!');
  console.log('\nDefault admin credentials:');
  console.log('  Email: admin@dogtown.com');
  console.log('  Password: admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

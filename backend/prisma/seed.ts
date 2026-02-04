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

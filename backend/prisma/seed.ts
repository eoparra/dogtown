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
      phone: '5550101001',
      role: 'CLIENT',
    }
  });
  const mariaDogs = [
    {
      name: 'Luna', breed: 'Golden Retriever', age: 3, weight: 28, size: 'LARGE', userId: maria.id,
      color: 'Golden', sex: 'FEMALE', sterilized: true,
      character: 'Friendly and energetic, loves to play fetch',
      specialRequirements: 'Needs extra exercise, sensitive to heat',
      foodType: 'Premium dry kibble', foodQuantity: '3 cups twice a day',
      foodAdditionalIndication: 'Add joint supplement to morning meal',
      vaccinationInfo: 'Rabies 2024-01, DHPP 2024-01',
    },
    {
      name: 'Coco', breed: 'French Bulldog', age: 5, weight: 11, size: 'MEDIUM', userId: maria.id,
      color: 'Brindle', sex: 'MALE', sterilized: true,
      character: 'Calm and affectionate, snores loudly',
      specialRequirements: 'Brachycephalic — avoid overheating, short walks only',
      foodType: 'Vet-prescribed dry food', foodQuantity: '1 cup twice a day',
      foodAdditionalIndication: null,
      vaccinationInfo: 'Rabies 2023-11, DHPP 2023-11',
    },
    {
      name: 'Milo', breed: 'Chihuahua', age: 2, weight: 3, size: 'SMALL', userId: maria.id,
      color: 'Tan & White', sex: 'MALE', sterilized: false,
      character: 'Bold and alert, can be territorial with strangers',
      specialRequirements: null,
      foodType: 'Small breed dry kibble', foodQuantity: '1/4 cup twice a day',
      foodAdditionalIndication: null,
      vaccinationInfo: 'Rabies 2024-03, DHPP 2024-03',
    },
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
      phone: '5550202002',
      role: 'CLIENT',
    }
  });
  const jamesDogs = [
    {
      name: 'Rocky', breed: 'German Shepherd', age: 4, weight: 35, size: 'LARGE', userId: james.id,
      color: 'Black & Tan', sex: 'MALE', sterilized: true,
      character: 'Intelligent and protective, well-trained',
      specialRequirements: 'Needs daily mental stimulation, dislikes other male dogs',
      foodType: 'High-protein dry food', foodQuantity: '4 cups twice a day',
      foodAdditionalIndication: 'No grain-based treats',
      vaccinationInfo: 'Rabies 2024-02, DHPP 2024-02, Bordetella 2024-02',
    },
    {
      name: 'Bella', breed: 'Beagle', age: 6, weight: 12, size: 'MEDIUM', userId: james.id,
      color: 'Tricolor', sex: 'FEMALE', sterilized: true,
      character: 'Curious and food-motivated, follows scents everywhere',
      specialRequirements: 'Prone to obesity — no extra treats',
      foodType: 'Weight-control dry kibble', foodQuantity: '1.5 cups twice a day',
      foodAdditionalIndication: 'Measure portions strictly',
      vaccinationInfo: 'Rabies 2023-09, DHPP 2023-09',
    },
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
      phone: '5550303003',
      role: 'CLIENT',
    }
  });
  const sofiaDogs = [
    {
      name: 'Daisy', breed: 'Pomeranian', age: 1, weight: 4, size: 'SMALL', userId: sofia.id,
      color: 'Cream', sex: 'FEMALE', sterilized: false,
      character: 'Playful and social, gets along with everyone',
      specialRequirements: 'Puppy — needs more frequent feeding and nap breaks',
      foodType: 'Puppy starter kibble', foodQuantity: '1/3 cup three times a day',
      foodAdditionalIndication: 'Transition to adult food at 12 months',
      vaccinationInfo: 'DHPP series in progress — 3rd dose due 2026-04-10',
    },
  ];
  for (const dog of sofiaDogs) {
    const existing = await prisma.dog.findFirst({ where: { name: dog.name, userId: dog.userId } });
    if (!existing) await prisma.dog.create({ data: dog });
  }
  console.log('Created user Sofia Chen with 1 dog');

  console.log(`\nSample client password: ${samplePassword}`);

  // ── Inventory items ────────────────────────────────────────────────────────

  const inventoryItems = [
    {
      sku: 'FOOD-001',
      name: 'Premium Dry Dog Food',
      category: 'PET_FOOD',
      unitOfMeasure: 'kg',
      costPrice: 28.0,
      sellingPrice: 42.0,
      currentStock: 120,
      lowStockThreshold: 20,
      description: 'High-protein kibble suitable for adult dogs of all breeds.',
    },
    {
      sku: 'FOOD-002',
      name: 'Wet Dog Food (Cans)',
      category: 'PET_FOOD',
      unitOfMeasure: 'can',
      costPrice: 2.5,
      sellingPrice: 4.0,
      currentStock: 8,
      lowStockThreshold: 24,
      description: 'Grain-free wet food in single-serve cans.',
    },
    {
      sku: 'FOOD-003',
      name: 'Puppy Starter Formula',
      category: 'PET_FOOD',
      unitOfMeasure: 'kg',
      costPrice: 32.0,
      sellingPrice: 48.0,
      currentStock: 45,
      lowStockThreshold: 10,
      description: 'DHA-enriched formula for puppies up to 12 months.',
    },
    {
      sku: 'FOOD-004',
      name: 'Senior Dog Kibble',
      category: 'PET_FOOD',
      unitOfMeasure: 'kg',
      costPrice: 30.0,
      sellingPrice: 45.0,
      currentStock: 3,
      lowStockThreshold: 15,
      description: 'Low-calorie, joint-support formula for dogs 7+ years.',
    },
    {
      sku: 'ACC-001',
      name: 'Adjustable Dog Leash',
      category: 'PET_ACCESSORIES',
      unitOfMeasure: 'unit',
      costPrice: 8.0,
      sellingPrice: 16.0,
      currentStock: 25,
      lowStockThreshold: 5,
      description: 'Retractable 5-metre leash, suitable for dogs up to 50 kg.',
    },
    {
      sku: 'ACC-002',
      name: 'Dog Collar (Medium)',
      category: 'PET_ACCESSORIES',
      unitOfMeasure: 'unit',
      costPrice: 5.0,
      sellingPrice: 12.0,
      currentStock: 30,
      lowStockThreshold: 10,
      description: 'Adjustable nylon collar for medium breeds (30–45 cm neck).',
    },
    {
      sku: 'ACC-003',
      name: 'Dog Bed (Large)',
      category: 'PET_ACCESSORIES',
      unitOfMeasure: 'unit',
      costPrice: 35.0,
      sellingPrice: 65.0,
      currentStock: 12,
      lowStockThreshold: 5,
      description: 'Orthopedic memory-foam bed, washable cover, 100 × 70 cm.',
    },
    {
      sku: 'VET-001',
      name: 'Flea & Tick Preventative',
      category: 'VETERINARY',
      unitOfMeasure: 'unit',
      costPrice: 12.0,
      sellingPrice: 22.0,
      currentStock: 60,
      lowStockThreshold: 15,
      description: 'Monthly topical treatment for dogs over 8 weeks old.',
    },
    {
      sku: 'VET-002',
      name: 'Ear Cleaning Solution',
      category: 'VETERINARY',
      unitOfMeasure: 'bottle',
      costPrice: 6.0,
      sellingPrice: 14.0,
      currentStock: 4,
      lowStockThreshold: 10,
      description: 'Gentle, alcohol-free solution for routine ear hygiene.',
    },
    {
      sku: 'VET-003',
      name: 'Disposable Gloves (box)',
      category: 'VETERINARY',
      unitOfMeasure: 'box',
      costPrice: 4.0,
      sellingPrice: 9.0,
      currentStock: 18,
      lowStockThreshold: 5,
      description: 'Powder-free nitrile gloves, 100 per box, size M.',
    },
  ];

  for (const item of inventoryItems) {
    await prisma.inventoryItem.upsert({
      where: { sku: item.sku },
      update: {},
      create: item,
    });
  }
  console.log(`  Seeded ${inventoryItems.length} inventory items`);

  // ── Services ───────────────────────────────────────────────────────────────

  const services = [
    {
      name: 'Bath',
      description: 'Full bath with blow-dry and towel finish.',
      pricingType: 'BY_SIZE' as const,
      price: null,
      priceSmall: 25,
      priceMedium: 40,
      priceLarge: 60,
    },
    {
      name: 'Full Grooming',
      description: 'Bath, haircut, nail trim, ear cleaning, and blow-dry.',
      pricingType: 'BY_SIZE' as const,
      price: null,
      priceSmall: 45,
      priceMedium: 65,
      priceLarge: 90,
    },
    {
      name: 'Nail Trim',
      description: 'Clipping and filing of all nails.',
      pricingType: 'FIXED' as const,
      price: 15,
      priceSmall: null,
      priceMedium: null,
      priceLarge: null,
    },
    {
      name: 'Rabies Vaccine',
      description: 'Annual rabies vaccination administered by our on-site vet.',
      pricingType: 'FIXED' as const,
      price: 30,
      priceSmall: null,
      priceMedium: null,
      priceLarge: null,
    },
    {
      name: 'Training Session (1h)',
      description: 'One-on-one obedience training session with a certified trainer.',
      pricingType: 'FIXED' as const,
      price: 75,
      priceSmall: null,
      priceMedium: null,
      priceLarge: null,
    },
  ];

  for (const service of services) {
    const existing = await prisma.service.findFirst({ where: { name: service.name } });
    if (!existing) await prisma.service.create({ data: service });
  }
  console.log(`  Seeded ${services.length} services`);

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

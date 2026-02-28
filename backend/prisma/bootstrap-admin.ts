import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = 'admin@dogtown.com';

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const arg = process.argv.find((value) => value.startsWith(prefix));
  return arg ? arg.slice(prefix.length).trim() : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function generateStrongPassword(): string {
  return `${crypto.randomUUID().replace(/-/g, '')}A1!`;
}

function isStrongPassword(password: string): boolean {
  return password.length >= 14
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /[0-9]/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

function usage(): string {
  return [
    'Usage: npm run admin:bootstrap -- --email=ops-admin@yourdomain.com [--password=StrongPassword123!] [--name="Ops Admin"] [--delete-default-admin] [--allow-default-email]',
    '',
    'If --password is omitted, a strong one-time password is generated and printed.',
    'Use --delete-default-admin to remove admin@dogtown.com after bootstrap.',
  ].join('\n');
}

async function main() {
  const email = (getArg('email') || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const providedPassword = (getArg('password') || process.env.ADMIN_PASSWORD || '').trim();
  const name = (getArg('name') || 'Admin').trim();
  const deleteDefaultAdmin = hasFlag('delete-default-admin') || process.env.DELETE_DEFAULT_ADMIN === 'true';
  const allowDefaultEmail = hasFlag('allow-default-email') || process.env.ALLOW_DEFAULT_EMAIL === 'true';

  if (!email) {
    throw new Error(`Missing admin email.\n\n${usage()}`);
  }

  if (email === DEFAULT_ADMIN_EMAIL && !allowDefaultEmail) {
    throw new Error('Refusing to bootstrap default admin email (admin@dogtown.com). Use a non-default email or pass --allow-default-email for controlled scenarios.');
  }

  const password = providedPassword || generateStrongPassword();
  if (!isStrongPassword(password)) {
    throw new Error('Admin password must be strong (>=14 chars, uppercase, lowercase, number, symbol).');
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {
      role: 'ADMIN',
      name,
      passwordHash,
      tokenVersion: { increment: 1 },
    },
    create: {
      email,
      passwordHash,
      name,
      role: 'ADMIN',
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
    },
  });

  if (deleteDefaultAdmin && email !== DEFAULT_ADMIN_EMAIL) {
    await prisma.user.deleteMany({
      where: {
        email: DEFAULT_ADMIN_EMAIL,
      },
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('Admin bootstrap completed successfully');
  console.log(`Email: ${admin.email}`);
  console.log(`Name:  ${admin.name}`);
  console.log(`Role:  ${admin.role}`);
  if (!providedPassword) {
    console.log(`Password (generated): ${password}`);
  }
  if (deleteDefaultAdmin && email !== DEFAULT_ADMIN_EMAIL) {
    console.log('Default admin account deletion requested (admin@dogtown.com).');
  }
  console.log('='.repeat(60));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

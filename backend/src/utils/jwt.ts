import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';

const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

export interface JwtPayload {
  userId: string;
  role: 'CLIENT' | 'ADMIN';
  tokenVersion: number;
  jti?: string;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, 'jti' | 'exp'>): string {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    if (!payload.jti) {
      return null;
    }

    const [revoked, user] = await Promise.all([
      prisma.revokedToken.findUnique({ where: { jti: payload.jti } }),
      prisma.user.findUnique({
        where: { id: payload.userId },
        select: { tokenVersion: true }
      })
    ]);

    if (revoked && revoked.expiresAt > new Date()) {
      return null;
    }

    if (!user || user.tokenVersion !== payload.tokenVersion) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export async function revokeToken(token: string): Promise<void> {
  try {
    const verified = jwt.verify(token, JWT_SECRET, {
      ignoreExpiration: true
    }) as JwtPayload;

    if (!verified?.jti || !verified?.exp) {
      return;
    }

    await prisma.revokedToken.upsert({
      where: { jti: verified.jti },
      update: {},
      create: {
        jti: verified.jti,
        expiresAt: new Date(verified.exp * 1000)
      }
    });
  } catch {
    // Token already invalid or store unavailable; nothing to revoke
  }
}

async function cleanupExpiredTokens(): Promise<void> {
  try {
    await prisma.revokedToken.deleteMany({
      where: { expiresAt: { lte: new Date() } }
    });
  } catch {
    // Ignore cleanup errors to avoid impacting request path
  }
}

const cleanupInterval = setInterval(() => {
  void cleanupExpiredTokens();
}, 15 * 60 * 1000);
cleanupInterval.unref();

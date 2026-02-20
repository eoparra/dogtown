import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config.js';

const JWT_SECRET = config.JWT_SECRET;
const JWT_EXPIRES_IN = '24h';

// In-memory token blacklist (JTI → expiration timestamp in seconds)
// For production scale, replace with Redis or DB-backed store
const revokedTokens = new Map<string, number>();

export interface JwtPayload {
  userId: string;
  role: 'CLIENT' | 'ADMIN';
  jti?: string;
  exp?: number;
}

export function signToken(payload: JwtPayload): string {
  const jti = crypto.randomUUID();
  return jwt.sign({ ...payload, jti }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;

    // Check if token has been revoked
    if (payload.jti && revokedTokens.has(payload.jti)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function revokeToken(token: string): void {
  try {
    const decoded = jwt.decode(token) as JwtPayload | null;
    if (decoded?.jti && decoded?.exp) {
      revokedTokens.set(decoded.jti, decoded.exp);
    }
  } catch {
    // Token already invalid, nothing to revoke
  }
}

function cleanupExpiredTokens(): void {
  const now = Math.floor(Date.now() / 1000);
  for (const [jti, exp] of revokedTokens) {
    if (now > exp) {
      revokedTokens.delete(jti);
    }
  }
}

// Clean up expired tokens every 15 minutes
const cleanupInterval = setInterval(cleanupExpiredTokens, 15 * 60 * 1000);
cleanupInterval.unref();

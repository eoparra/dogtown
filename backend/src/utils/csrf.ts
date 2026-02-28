import crypto from 'crypto';
import { CookieOptions, Response } from 'express';
import { isProduction } from '../config.js';

const CSRF_COOKIE_NAME = 'csrf_token';
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getCsrfCookieOptions(): CookieOptions {
  return {
    httpOnly: false,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: ONE_DAY_MS,
  };
}

export function issueCsrfToken(res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE_NAME, token, getCsrfCookieOptions());
  return token;
}

export function clearCsrfToken(res: Response): void {
  res.cookie(CSRF_COOKIE_NAME, '', {
    ...getCsrfCookieOptions(),
    expires: new Date(0),
    maxAge: 0,
  });
}

export function getCsrfCookieName(): string {
  return CSRF_COOKIE_NAME;
}

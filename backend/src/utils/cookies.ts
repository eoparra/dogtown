import { Response, CookieOptions } from 'express';
import { isProduction } from '../config.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function baseCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/'
  };
}

export function getAuthCookieOptions(): CookieOptions {
  return {
    ...baseCookieOptions(),
    maxAge: ONE_DAY_MS
  };
}

export function clearAuthCookie(res: Response): void {
  res.cookie('token', '', {
    ...baseCookieOptions(),
    expires: new Date(0),
    maxAge: 0
  });
}

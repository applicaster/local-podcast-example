import { Request } from 'express';

export function isUserLoggedIn(req?: Request): boolean {
  if (!req || !req.headers) {
    return false;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return false;
  }

  const authStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const trimmed = authStr.trim();

  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return false;
  }

  const token = trimmed.slice(7).trim();
  return token.length > 0;
}

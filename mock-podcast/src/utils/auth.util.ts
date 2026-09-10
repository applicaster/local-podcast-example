import { Request } from 'express';

export function getBearerToken(req?: Request): string | undefined {
  if (!req || !req.headers) {
    return undefined;
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return undefined;
  }

  const authStr = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const trimmed = authStr.trim();

  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  const token = trimmed.slice(7).trim();
  return token.length > 0 ? token : undefined;
}

export function isUserLoggedIn(req?: Request): boolean {
  return getBearerToken(req) !== undefined;
}

import { Request } from 'express';
import { isUserLoggedIn, getBearerToken } from './auth.util';

describe('isUserLoggedIn', () => {
  it('returns false when req or req.headers is undefined', () => {
    expect(isUserLoggedIn(undefined)).toBe(false);
    expect(isUserLoggedIn({} as Request)).toBe(false);
  });

  it('returns false when authorization header is missing', () => {
    const req = { headers: {} } as Request;
    expect(isUserLoggedIn(req)).toBe(false);
  });

  it('returns false when authorization header does not start with Bearer', () => {
    const req = { headers: { authorization: 'Basic 12345' } } as any;
    expect(isUserLoggedIn(req)).toBe(false);
  });

  it('returns false when Bearer token is empty or whitespace', () => {
    const req = { headers: { authorization: 'Bearer   ' } } as any;
    expect(isUserLoggedIn(req)).toBe(false);
  });

  it('returns true when valid Bearer token is provided', () => {
    const req = { headers: { authorization: 'Bearer my-token-123' } } as any;
    expect(isUserLoggedIn(req)).toBe(true);
  });

  it('handles case-insensitive Bearer prefix', () => {
    const req = { headers: { authorization: 'bearer my-token-123' } } as any;
    expect(isUserLoggedIn(req)).toBe(true);
  });
});

describe('getBearerToken', () => {
  const reqWith = (authorization?: string) =>
    ({ headers: authorization ? { authorization } : {} } as any);

  it('extracts the token regardless of header case', () => {
    expect(getBearerToken(reqWith('bearer tok'))).toBe('tok');
    expect(getBearerToken(reqWith('Bearer tok'))).toBe('tok');
  });
});

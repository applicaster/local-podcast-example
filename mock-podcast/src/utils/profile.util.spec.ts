import { getProfileFromRequest } from './profile.util';

describe('getProfileFromRequest', () => {
  const ctxParam = (value: unknown) =>
    Buffer.from(JSON.stringify(value), 'utf-8').toString('base64');

  const reqWith = (
    query: Record<string, unknown>,
    headers: Record<string, unknown> = {},
  ) => ({ query, headers } as any);

  it('prefers an explicit profile over the context', () => {
    const req = reqWith({ ctx: ctxParam({ profile: 'from-ctx' }) });

    expect(getProfileFromRequest(req, 'explicit')).toBe('explicit');
  });

  it('falls back to the profile inside ctx', () => {
    const req = reqWith({ ctx: ctxParam({ profile: 'a3JVE000007CgIn2AK' }) });

    expect(getProfileFromRequest(req)).toBe('a3JVE000007CgIn2AK');
  });

  it('decodes base64 that arrives without padding', () => {
    // Zapp clients strip the trailing "=" characters.
    const padded = ctxParam({ profile: '12345' });
    const req = reqWith({ ctx: padded.replace(/=+$/, '') });

    expect(getProfileFromRequest(req)).toBe('12345');
  });

  it('normalises a numeric profile to a string', () => {
    const req = reqWith({ ctx: ctxParam({ profile: 12345 }) });

    expect(getProfileFromRequest(req)).toBe('12345');
  });

  it('returns an empty string when there is no profile anywhere', () => {
    expect(getProfileFromRequest(reqWith({}))).toBe('');
    expect(getProfileFromRequest(undefined)).toBe('');
    expect(getProfileFromRequest(reqWith({ ctx: ctxParam({}) }))).toBe('');
  });

  it('survives a ctx that is not valid base64 json', () => {
    expect(getProfileFromRequest(reqWith({ ctx: 'not-base64-json' }))).toBe('');
    expect(getProfileFromRequest(reqWith({ ctx: '' }))).toBe('');
    expect(getProfileFromRequest(reqWith({ ctx: ['a', 'b'] }))).toBe('');
  });

  // The Zapp endpoint declares user_account.profile as an HTTP custom header
  // renamed `profile`, so it arrives on every request that endpoint governs.
  it('reads the profile header the endpoint config sends', () => {
    const req = reqWith({}, { profile: 'a3JVE000007CgIn2AK' });

    expect(getProfileFromRequest(req)).toBe('a3JVE000007CgIn2AK');
  });

  it('prefers the header over ctx', () => {
    const req = reqWith(
      { ctx: ctxParam({ profile: 'from-ctx' }) },
      { profile: 'from-header' },
    );

    expect(getProfileFromRequest(req)).toBe('from-header');
  });

  it('still lets an explicit profile win over the header', () => {
    const req = reqWith({}, { profile: 'from-header' });

    expect(getProfileFromRequest(req, 'explicit')).toBe('explicit');
  });

  it('ignores a header that is not a usable string', () => {
    expect(getProfileFromRequest(reqWith({}, { profile: '' }))).toBe('');
    expect(getProfileFromRequest(reqWith({}, { profile: ['a'] }))).toBe('');
  });
});

describe('getProfileFromRequest and X-VIEWER-ID', () => {
  const req = (headers: Record<string, unknown>, query = {}) =>
    ({ headers, query } as any);

  // The form screen's url cannot carry a parameter — the loader refuses any
  // url containing {{...}} — so the header is the only way it can say which
  // profile it is showing.
  it('reads the viewer id header', () => {
    expect(getProfileFromRequest(req({ 'x-viewer-id': 'kid' }))).toBe('kid');
  });

  it('prefers the profile header over the viewer id', () => {
    expect(
      getProfileFromRequest(req({ profile: 'named', 'x-viewer-id': 'viewer' })),
    ).toBe('named');
  });

  it('prefers an explicit profile over both', () => {
    expect(
      getProfileFromRequest(
        req({ profile: 'named', 'x-viewer-id': 'viewer' }),
        'explicit',
      ),
    ).toBe('explicit');
  });

  // What the client sends when the context key resolved to nothing. Taking it
  // literally would look up a profile called "undefined".
  it.each([['undefined'], ['null'], ['']])(
    'ignores the literal %p',
    (value) => {
      expect(getProfileFromRequest(req({ 'x-viewer-id': value }))).toBe('');
    },
  );

  it('still falls back to ctx', () => {
    const ctx = Buffer.from(JSON.stringify({ profile: 'from-ctx' })).toString(
      'base64',
    );

    expect(
      getProfileFromRequest(req({ 'x-viewer-id': 'undefined' }, { ctx })),
    ).toBe('from-ctx');
  });
});

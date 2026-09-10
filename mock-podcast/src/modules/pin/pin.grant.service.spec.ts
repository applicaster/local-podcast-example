import { GRANT_TTL_MS, PinGrantService } from './pin.grant.service';

describe('PinGrantService', () => {
  let grants: PinGrantService;

  beforeEach(() => {
    // `performance` is read-only on this runtime and fake-timers refuses to
    // hijack it; the grant only ever reads Date.now(), so leave it alone.
    jest.useFakeTimers({ doNotFake: ['performance'] });
    grants = new PinGrantService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports no grant for a profile that never had one', () => {
    expect(grants.has('owner')).toBe(false);
  });

  it('opens a window for the profile it was issued to', () => {
    grants.issue('owner');

    expect(grants.has('owner')).toBe(true);
    expect(grants.has('someone-else')).toBe(false);
  });

  it('keeps the window open for the whole ttl', () => {
    grants.issue('owner');

    jest.advanceTimersByTime(GRANT_TTL_MS - 1);

    expect(grants.has('owner')).toBe(true);
  });

  it('closes the window once the ttl has passed', () => {
    grants.issue('owner');

    jest.advanceTimersByTime(GRANT_TTL_MS);

    expect(grants.has('owner')).toBe(false);
  });

  it('starts the window again on a fresh issue', () => {
    grants.issue('owner');
    jest.advanceTimersByTime(GRANT_TTL_MS);
    expect(grants.has('owner')).toBe(false);

    grants.issue('owner');

    expect(grants.has('owner')).toBe(true);
  });

  // Callers pass whatever profile the payload named, and an event with no
  // profile means the app-wide PIN — which owns nothing and authorises nothing.
  it('never opens for an empty profile', () => {
    grants.issue('');

    expect(grants.has('')).toBe(false);
  });
});

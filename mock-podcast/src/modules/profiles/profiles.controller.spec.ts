import { UnauthorizedException } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';

describe('ProfilesController', () => {
  const feed = { id: 'viewer-profiles', entry: [] };
  const service = { getProfilesFeed: jest.fn(() => feed) };

  const req = (authorization?: string) =>
    ({ headers: authorization ? { authorization } : {} } as any);

  beforeEach(() => jest.clearAllMocks());

  it('requires a bearer token', () => {
    expect(() =>
      new ProfilesController(service as any, undefined as any, undefined as any).getProfilesFeed(req()),
    ).toThrow(UnauthorizedException);
    expect(service.getProfilesFeed).not.toHaveBeenCalled();
  });

  it('serves the feed the service builds', () => {
    const result = new ProfilesController(service as any, undefined as any, undefined as any).getProfilesFeed(
      req('Bearer tok'),
    );

    expect(result).toBe(feed);
  });
});

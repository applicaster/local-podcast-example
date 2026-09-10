import { UnauthorizedException } from '@nestjs/common';
import { ProfilesController } from './profiles.controller';

describe('ProfilesController', () => {
  const feed = { id: 'viewer-profiles', entry: [] };
  const service = { getProfilesFeed: jest.fn(async () => feed) };

  const controller = () => new ProfilesController(service as any);

  const req = (authorization?: string) =>
    ({ headers: authorization ? { authorization } : {} }) as any;

  beforeEach(() => jest.clearAllMocks());

  it('requires a bearer token', async () => {
    await expect(controller().getProfilesFeed(req())).rejects.toThrow(
      UnauthorizedException,
    );
    expect(service.getProfilesFeed).not.toHaveBeenCalled();
  });

  it('serves the feed the service builds', async () => {
    await expect(controller().getProfilesFeed(req('Bearer tok'))).resolves.toBe(
      feed,
    );
  });

  // The request carries the credentials the customer's backend authorises on,
  // so it has to reach the service that goes upstream.
  it('hands the request to the service', async () => {
    const request = req('Bearer tok');

    await controller().getProfilesFeed(request);

    expect(service.getProfilesFeed).toHaveBeenCalledWith(request);
  });
});

import { UnauthorizedException } from '@nestjs/common';
import { ProfilesFormController } from './profiles.form.controller';

describe('ProfilesFormController', () => {
  const form = { properties: [] };
  const formService = { getForm: jest.fn(async () => form) };
  const config = { get: jest.fn(() => undefined) };

  const controller = () =>
    new ProfilesFormController(formService as any, config as any);

  const req = (authorization?: string, headers = {}) =>
    ({
      headers: { ...(authorization ? { authorization } : {}), ...headers },
      protocol: 'http',
      get: (n: string) => (n === 'host' ? 'localhost:3000' : undefined),
      query: {},
    } as any);

  beforeEach(() => jest.clearAllMocks());

  it('requires a bearer token', async () => {
    await expect(
      controller().getProfileForm('kid', undefined, req()),
    ).rejects.toThrow(UnauthorizedException);
    expect(formService.getForm).not.toHaveBeenCalled();
  });

  it('serves the form the service builds', async () => {
    await expect(
      controller().getProfileForm('kid', undefined, req('Bearer tok')),
    ).resolves.toBe(form);
  });

  it('passes the profile, the request and the cloud events url on', async () => {
    const request = req('Bearer tok');

    await controller().getProfileForm('kid', undefined, request);

    expect(formService.getForm).toHaveBeenCalledWith(
      'kid',
      request,
      'http://localhost:3000/cloud-events',
    );
  });

  // The client's endpoint config attaches the profile as a header; a request
  // that names none in the query still has to find its subject.
  it('falls back to the profile the request carries', async () => {
    const request = req('Bearer tok', { profile: 'from-header' });

    await controller().getProfileForm(undefined, undefined, request);

    expect(formService.getForm).toHaveBeenCalledWith(
      'from-header',
      request,
      expect.any(String),
    );
  });
});

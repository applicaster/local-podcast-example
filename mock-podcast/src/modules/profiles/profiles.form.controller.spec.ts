import { UnauthorizedException } from '@nestjs/common';
import { ProfilesFormController } from './profiles.form.controller';

describe('ProfilesFormController', () => {
  const form = { properties: [] };
  const formService = { getForm: jest.fn(async () => form) };
  const config = { get: jest.fn(() => undefined) };

  const controller = () =>
    new ProfilesFormController(formService as any, config as any);

  const req = (authorization?: string, headers = {}, query = {}) =>
    ({
      headers: { ...(authorization ? { authorization } : {}), ...headers },
      protocol: 'http',
      get: (n: string) => (n === 'host' ? 'localhost:3000' : undefined),
      query,
    }) as any;

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

  it('passes the profile and the request on', async () => {
    const request = req('Bearer tok');

    await controller().getProfileForm('kid', undefined, request);

    expect(formService.getForm).toHaveBeenCalledWith('kid', request);
  });

  // The viewer is the parent while a child is being edited, so a header must
  // never decide whose form this is: it would point the PIN button at the
  // parent and change their code instead of the child's.
  it('refuses to take the subject from a header', async () => {
    const request = req('Bearer tok', { profile: 'the-parent' });

    await controller().getProfileForm(undefined, undefined, request);

    expect(formService.getForm).toHaveBeenCalledWith('', request);
  });

  // How Zapp puts a context key in a url: an endpoint configured with
  // `user_account.profile` sends it base64 in `ctx`, as the PIN feeds already
  // receive it. Still the url, so still not the viewer's header.
  it('reads the subject out of ctx', async () => {
    const ctx = Buffer.from(JSON.stringify({ profile: 'the-child' })).toString(
      'base64',
    );
    const request = req('Bearer tok', {}, { ctx });

    await controller().getProfileForm(undefined, undefined, request);

    expect(formService.getForm).toHaveBeenCalledWith('the-child', request);
  });

  it.each([['profileId'], ['profile_id'], ['id']])(
    'reads the subject from ?%s=',
    async (key) => {
      const request = req('Bearer tok', {}, { [key]: 'the-child' });

      await controller().getProfileForm(undefined, undefined, request);

      expect(formService.getForm).toHaveBeenCalledWith('the-child', request);
    },
  );
});

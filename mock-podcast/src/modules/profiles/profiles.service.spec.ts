import { HttpException } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  const pinService = (withPin: string[] = []) => ({
    hasPin: jest.fn((profile: string) => withPin.includes(profile)),
  });

  const sessionActions = [
    {
      type: 'sessionStorageSet',
      options: {
        content: {
          user_account: {
            profile: 'owner',
            kids: false,
            profile_selected: true,
          },
        },
      },
    },
    { type: 'finishHook', options: { success: true } },
  ];

  const feed = (withActions = false) => ({
    id: 'viewer-profiles',
    title: 'Viewer Profiles',
    type: { value: 'feed' },
    entry: ['owner', 'child'].map((id) => ({
      id,
      title: id,
      type: { value: 'profile' },
      media_group: [
        {
          type: 'image',
          media_item: [{ key: 'image_base', src: `https://cdn/${id}.webp` }],
        },
      ],
      extensions: {
        master: id === 'owner',
        ...(withActions ? { tap_actions: { actions: sessionActions } } : {}),
      },
    })),
  });

  /**
   * The repository is a stub: this service does not read the fixture, it caches
   * what the upstream answered and decorates whatever comes back.
   */
  const repository = (fallback: any) => {
    let held = fallback;

    return {
      getFeed: () => held,
      cache: jest.fn((f: any) => {
        held = f;
      }),
    };
  };

  const build = ({
    pins = [] as string[],
    upstreamFeed = feed() as any,
    fallback = feed() as any,
    fails = false,
    failsWith = undefined as HttpException | undefined,
  } = {}) => {
    const pin = pinService(pins);
    const repo = repository(fallback);
    const upstream = {
      get: jest.fn(async () => {
        if (failsWith) {
          throw failsWith;
        }

        if (fails) {
          throw new Error('ECONNREFUSED');
        }

        return upstreamFeed;
      }),
    };
    const service = new ProfilesService(
      pin as any,
      repo as any,
      upstream as any,
      { get: jest.fn(() => undefined) } as any,
    );

    return { service, pin, repo, upstream };
  };

  const entries = async (service: ProfilesService) =>
    (await service.getProfilesFeed()).entry as any[];

  const actionsOf = async (service: ProfilesService, id: string) =>
    (await entries(service)).find((e) => e.id === id).extensions.tap_actions
      .actions;

  describe('what it asks for', () => {
    it('fetches the customer list on every request', async () => {
      const { service, upstream } = build();

      await service.getProfilesFeed();
      await service.getProfilesFeed();

      expect(upstream.get).toHaveBeenCalledTimes(2);
    });

    // PinService asks ownerId() while handling a cloud event, where there is no
    // request to borrow credentials from. The answer has to already be here.
    it('caches what the upstream answered', async () => {
      const fresh = feed();
      const { service, repo } = build({ upstreamFeed: fresh });

      await service.getProfilesFeed();

      expect(repo.cache).toHaveBeenCalledWith(fresh);
    });

    // The mock exists to keep the client testable; refusing to serve profiles
    // because a QA environment is down would stop the work it supports.
    it('falls back to what it already had when the upstream is unreachable', async () => {
      const { service, repo } = build({ fails: true });

      expect((await entries(service)).map((e) => e.id)).toEqual([
        'owner',
        'child',
      ]);
      expect(repo.cache).not.toHaveBeenCalled();
    });

    it('falls back on a 5xx too — the backend is up but broken', async () => {
      const { service } = build({
        failsWith: new HttpException('boom', 503),
      });

      expect((await entries(service)).map((e) => e.id)).toEqual([
        'owner',
        'child',
      ]);
    });

    // A 401 means the token the client sent was rejected. Answering it with a
    // profile list hides that, and hands profiles to a caller who just failed
    // to authenticate.
    it('passes a refusal through rather than masking it', async () => {
      const { service } = build({
        failsWith: new HttpException('Unauthorized', 401),
      });

      await expect(service.getProfilesFeed()).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('what it rewrites', () => {
    it('answers has_pin from the pin store, not from upstream', async () => {
      const { service } = build({ pins: ['owner'] });

      expect(
        (await entries(service)).map((e) => [e.id, e.extensions.has_pin]),
      ).toEqual([
        ['owner', true],
        ['child', false],
      ]);
    });

    // A profile cell runs its tap actions. Left as `profile`, the client also
    // navigates to whatever that type maps to, so the home screen the chain
    // ends on is pushed a second time.
    it('turns the entry type into an action', async () => {
      const { service } = build();

      expect((await entries(service)).map((e) => e.type)).toEqual([
        { value: 'action' },
        { value: 'action' },
      ]);
    });

    it('keeps everything else the upstream sent', async () => {
      const { service } = build({ pins: ['owner'] });

      const owner = (await entries(service))[0];

      expect(owner.title).toBe('owner');
      expect(owner.extensions.master).toBe(true);
    });

    it('does not mutate what it cached', async () => {
      const fresh = feed();
      const { service } = build({ upstreamFeed: fresh });

      await service.getProfilesFeed();

      expect(fresh.entry[0].extensions).not.toHaveProperty('has_pin');
      expect(fresh.entry[0].type).toEqual({ value: 'profile' });
    });

    it('reflects a PIN being turned off on the next read', async () => {
      const { service, pin } = build({ pins: ['owner'] });

      expect((await entries(service))[0].extensions.has_pin).toBe(true);

      pin.hasPin.mockImplementation(() => false);

      expect((await entries(service))[0].extensions.has_pin).toBe(false);
    });
  });

  describe('what selecting a profile persists', () => {
    const sessionOf = async (service: ProfilesService, id: string) =>
      (await actionsOf(service, id)).find(
        (a: any) => a.type === 'sessionStorageSet',
      ).options.content.user_account;

    // The id is all that is stored today, and an id renders as nothing — the
    // navigation's profile button shows the avatar on every screen.
    it('adds the profile name and avatar', async () => {
      const { service } = build({ upstreamFeed: feed(true) });

      expect(await sessionOf(service, 'child')).toEqual({
        profile: 'owner',
        kids: false,
        profile_selected: true,
        profile_name: 'child',
        profile_avatar: 'https://cdn/child.webp',
      });
    });

    it('adds them to a protected profile too, behind its gate', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });

      const types = (await actionsOf(service, 'owner')).map((a: any) => a.type);
      expect(types).toEqual(['pinCode', 'sessionStorageSet', 'finishHook']);
      expect((await sessionOf(service, 'owner')).profile_name).toBe('owner');
    });

    it('leaves an entry with no image with an empty avatar', async () => {
      const noImage = {
        ...feed(true),
        entry: feed(true).entry.map((e: any) => ({ ...e, media_group: [] })),
      };
      const { service } = build({ upstreamFeed: noImage });

      expect((await sessionOf(service, 'child')).profile_avatar).toBe('');
    });

    it('touches no action other than the session write', async () => {
      const { service } = build({ upstreamFeed: feed(true) });

      const finish = (await actionsOf(service, 'child')).find(
        (a: any) => a.type === 'finishHook',
      );
      expect(finish.options).toEqual({ success: true });
    });
  });

  describe('gating a protected profile', () => {
    // Entering a protected profile asks for THAT profile's own PIN, and a
    // cancelled pinCode stops the chain — so the session is never written.
    it('puts a pinCode verify in front of the session actions', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });

      expect(
        (await actionsOf(service, 'owner')).map((a: any) => a.type),
      ).toEqual(['pinCode', 'sessionStorageSet', 'finishHook']);
    });

    it('asks for the profile own id, not some other profile', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });

      expect((await actionsOf(service, 'owner'))[0].options).toEqual({
        typeMapping: 'parent-lock',
        flow: 'verify-pin',
        cloudEventPayload: { profile: 'owner' },
      });
    });

    it('leaves an unprotected profile untouched', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });

      expect(
        (await actionsOf(service, 'child')).map((a: any) => a.type),
      ).toEqual(['sessionStorageSet', 'finishHook']);
    });

    it('stops gating once the PIN is turned off', async () => {
      const { service, pin } = build({
        pins: ['owner'],
        upstreamFeed: feed(true),
      });

      expect((await actionsOf(service, 'owner'))[0].type).toBe('pinCode');

      pin.hasPin.mockImplementation(() => false);

      expect((await actionsOf(service, 'owner'))[0].type).toBe(
        'sessionStorageSet',
      );
    });

    it('copes with a profile that has no tap actions at all', async () => {
      const { service } = build({ pins: ['owner'] });

      expect(
        (await actionsOf(service, 'owner')).map((a: any) => a.type),
      ).toEqual(['pinCode']);
    });
  });
});

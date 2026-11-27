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
        denied_actions: id === 'child' ? { change_name: true } : {},
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
      ownerId: () => 'owner',
    };
  };

  const build = ({
    pins = [] as string[],
    upstreamFeed = feed() as any,
    fallback = feed() as any,
    fails = false,
    failsWith = undefined as HttpException | undefined,
    config = {} as Record<string, unknown>,
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
      { get: jest.fn((key: string) => config[key]) } as any,
    );

    return { service, pin, repo, upstream };
  };

  const entries = async (service: ProfilesService) =>
    (await service.getProfilesFeed()).entry as any[];

  const actionsOf = async (service: ProfilesService, id: string) =>
    (await entries(service)).find((e) => e.id === id).extensions.tap_actions
      .actions;

  // BR-4: the same list, asked a different question — not "who is watching"
  // but "whose settings am I about to change".
  describe('manage mode', () => {
    const viewing = (profile: string) => ({ headers: { profile } }) as any;

    const manageActions = async (viewer: string, tile: string) => {
      const { service } = build({
        pins: ['owner', 'child'],
        upstreamFeed: feed(true),
      });

      const all = (await service.getProfilesFeed(viewing(viewer), 'manage'))
        .entry as any[];

      return all.find((e) => e.id === tile).extensions.tap_actions.actions;
    };

    // The code was asked for at the manage button; asking again on the tile
    // is exactly what NR-3 forbids, and makes that gate decorative.
    it('never puts a PIN in front of a tile', async () => {
      const actions = await manageActions('owner', 'child');

      expect(actions.map((a: any) => a.type)).not.toContain('pinCode');
    });

    // goHome ends the chain for someone who has chosen a profile to watch as.
    // Here it would close the screen the parent has only just opened.
    it('does not send the parent home', async () => {
      const actions = await manageActions('owner', 'child');

      expect(actions.map((a: any) => a.type)).not.toContain('goHome');
    });

    // The load-bearing step: the form that opens next reads the ACTIVE
    // profile as its subject, so the tapped profile has to become active
    // first, or the parent edits themselves under the child's name.
    it('makes the tapped profile active, then opens its form', async () => {
      const actions = await manageActions('owner', 'child');

      expect(actions.map((a: any) => a.type)).toEqual([
        'sessionStorageSet',
        'navigateToScreen',
      ]);

      expect(actions[1].options).toEqual(
        expect.objectContaining({ typeMapping: 'profile-edit' }),
      );
    });

    it('lets a profile open its own settings', async () => {
      const actions = await manageActions('child', 'child');

      expect(actions.map((a: any) => a.type)).toContain('navigateToScreen');
    });

    it("turns a child away from somebody else's tile", async () => {
      const actions = await manageActions('child', 'owner');

      expect(actions.map((a: any) => a.type)).toEqual(['showAlert']);
    });
  });

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
      expect(types).toEqual(['pinCode', 'sessionStorageSet', 'goHome']);
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

    // A chain may hold more than one session write. One that writes a
    // different namespace must come through untouched — giving it a
    // user_account it never had would be inventing state, not carrying it.
    it('leaves a session write for another namespace alone', async () => {
      const withOther = {
        ...feed(true),
        entry: feed(true).entry.map((e: any) => ({
          ...e,
          extensions: {
            ...e.extensions,
            tap_actions: {
              actions: [
                {
                  type: 'sessionStorageSet',
                  options: {
                    content: {
                      'quick-brick-login-flow': { account_token: 'x' },
                    },
                  },
                },
                ...e.extensions.tap_actions.actions,
              ],
            },
          },
        })),
      };
      const { service } = build({ upstreamFeed: withOther });

      const writes = (await actionsOf(service, 'child')).filter(
        (a: any) => a.type === 'sessionStorageSet',
      );

      expect(writes[0].options.content).toEqual({
        'quick-brick-login-flow': { account_token: 'x' },
      });
      expect(writes[1].options.content.user_account.profile_name).toBe('child');
    });

    // The profile list is not always presented as a hook, and finishHook on a
    // screen that is not one has nothing to finish.
    it('ends the chain with goHome instead of finishHook', async () => {
      const { service } = build({ upstreamFeed: feed(true) });

      const actions = await actionsOf(service, 'child');

      expect(actions.some((a: any) => a.type === 'finishHook')).toBe(false);
      expect(actions[actions.length - 1]).toEqual({ type: 'goHome' });
    });
  });

  describe('gating a protected profile', () => {
    // Entering a protected profile asks for THAT profile's own PIN, and a
    // cancelled pinCode stops the chain — so the session is never written.
    it('puts a pinCode verify in front of the session actions', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });

      expect(
        (await actionsOf(service, 'owner')).map((a: any) => a.type),
      ).toEqual(['pinCode', 'sessionStorageSet', 'goHome']);
    });

    it('asks for the profile own id, not some other profile', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });

      expect((await actionsOf(service, 'owner'))[0].options).toEqual({
        typeMapping: 'parent-lock',
        flow: 'verify-pin',
        cloudEventPayload: { profile: 'owner' },
        promptText: 'Enter the PIN for owner',
      });
    });

    it('leaves an unprotected profile untouched', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });

      expect(
        (await actionsOf(service, 'child')).map((a: any) => a.type),
      ).toEqual(['sessionStorageSet', 'goHome']);
    });

    // The badge reads truthy as "open", so a protected profile must say
    // false — `has_pin` alone would show an open padlock on the shut ones.
    it('marks a protected profile as not unlocked, for the lock badge', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });
      const all = await entries(service);

      expect(all.find((e) => e.id === 'owner').extensions.unlocked).toBe(false);
      expect(all.find((e) => e.id === 'child').extensions.unlocked).toBe(true);
    });

    // The profile form declares the permission checkboxes and carries none of
    // their values: the form screen fills itself from the entry that navigated
    // to it. Drop this and every box renders empty, which reads as "denied".
    it('carries the permission values the form screen will read', async () => {
      const { service } = build({ pins: [], upstreamFeed: feed(true) });
      const all = await entries(service);

      const child = all.find((e) => e.id === 'child').extensions.form_data;

      expect(child.allowChangeName).toBe(false);
      expect(child.allowComment).toBe(true);
    });

    // BR-P3: every prompt offers a way out for someone without the code.
    it('offers the way out when events have somewhere to go', async () => {
      const { service } = build({
        pins: ['child'],
        upstreamFeed: feed(true),
        config: { '@lib/mock-podcast.config.cloudEventsUrl': 'https://ev' },
      });

      const gate = (await actionsOf(service, 'child'))[0];

      expect(gate.options.forgotText).toBe('Forgot your PIN?');
      expect(gate.options.forgotActions.map((a: any) => a.type)).toEqual([
        'sendCloudEvent',
        'showToast',
      ]);
      expect(gate.options.forgotActions[0].options.data).toEqual({
        profile: 'child',
      });
    });

    // A button that cannot do anything is worse than no button.
    it('offers no way out when nothing can receive the event', async () => {
      const { service } = build({ pins: ['child'], upstreamFeed: feed(true) });

      const gate = (await actionsOf(service, 'child'))[0];

      expect(gate.options).not.toHaveProperty('forgotActions');
    });

    // §4 wants the prompt to name the profile; the plugin's configured string
    // is one for the whole app, so the feed has to say it.
    it('names the profile the code is wanted for', async () => {
      const { service } = build({ pins: ['child'], upstreamFeed: feed(true) });

      expect((await actionsOf(service, 'child'))[0].options.promptText).toBe(
        'Enter the PIN for child',
      );
    });

    it('drops the name when the profile has none', async () => {
      const nameless = feed(true);
      nameless.entry[0].title = '';

      const { service } = build({ pins: ['owner'], upstreamFeed: nameless });

      expect((await actionsOf(service, 'owner'))[0].options.promptText).toBe(
        'Enter the PIN',
      );
    });

    // §4: re-selecting the already active profile is not entering anything.
    it('does not ask the viewer for the PIN of the profile they are in', async () => {
      const { service } = build({ pins: ['owner'], upstreamFeed: feed(true) });

      const entry = (
        (await service.getProfilesFeed({
          headers: { profile: 'owner' },
        } as any)) as any
      ).entry.find((e: any) => e.id === 'owner');

      expect(
        entry.extensions.tap_actions.actions.map((a: any) => a.type),
      ).toEqual(['sessionStorageSet', 'goHome']);

      // The tile still says the profile is protected — the lock icon is about
      // the profile, not about this tap.
      expect(entry.extensions.has_pin).toBe(true);
    });

    it('still gates every other protected profile for that viewer', async () => {
      const { service } = build({
        pins: ['owner', 'child'],
        upstreamFeed: feed(true),
      });

      const entry = (
        (await service.getProfilesFeed({
          headers: { profile: 'owner' },
        } as any)) as any
      ).entry.find((e: any) => e.id === 'child');

      expect(entry.extensions.tap_actions.actions[0].type).toBe('pinCode');
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

import { ProfilesService } from './profiles.service';

describe('ProfilesService', () => {
  const pinService = (withPin: string[] = []) => ({
    hasPin: jest.fn((profile: string) => withPin.includes(profile)),
    seedIfEmpty: jest.fn(async () => true),
  });

  const feed = {
    id: 'viewer-profiles',
    title: 'Viewer Profiles',
    type: { value: 'feed' },
    entry: [
      { id: 'owner', title: 'Owner', extensions: { master: true } },
      { id: 'child', title: 'Child', extensions: { master: false } },
    ],
  };

  /**
   * The repository is a stub rather than the real thing: this service no
   * longer reads the fixture, it decorates whatever it is handed.
   */
  const repository = (
    loaded: any = feed,
    defaults: Record<string, string> = {},
  ) => ({
    getFeed: () => loaded,
    profileIds: () =>
      Array.isArray(loaded?.entry)
        ? loaded.entry.map((e: any) => String(e.id))
        : [],
    defaultPinFor: (profile: string) => defaults[profile] || '1111',
  });

  const build = async (
    pins: string[] = [],
    loaded: any = feed,
    defaults: Record<string, string> = {},
  ): Promise<{
    service: ProfilesService;
    pin: ReturnType<typeof pinService>;
  }> => {
    const pin = pinService(pins);
    const service = new ProfilesService(
      pin as any,
      repository(loaded, defaults) as any,
    );
    await service.onModuleInit();

    return { service, pin };
  };

  it('answers has_pin from the pin store, not the fixture', async () => {
    const { service } = await build(['owner']);

    const entries = service.getProfilesFeed().entry;

    expect(entries.map((e: any) => [e.id, e.extensions.has_pin])).toEqual([
      ['owner', true],
      ['child', false],
    ]);
  });

  it('keeps everything else about a profile untouched', async () => {
    const { service } = await build(['owner']);

    const owner = service.getProfilesFeed().entry[0] as any;

    expect(owner.title).toBe('Owner');
    expect(owner.extensions.master).toBe(true);
  });

  it('does not mutate the loaded fixture', async () => {
    const { service } = await build(['owner']);

    service.getProfilesFeed();

    expect(feed.entry[0].extensions).not.toHaveProperty('has_pin');
  });

  it('reflects a PIN being turned off on the next read', async () => {
    const pin = pinService(['owner']);
    const service = new ProfilesService(pin as any, repository() as any);
    await service.onModuleInit();

    expect((service.getProfilesFeed().entry[0] as any).extensions.has_pin).toBe(
      true,
    );

    pin.hasPin.mockImplementation(() => false);

    expect((service.getProfilesFeed().entry[0] as any).extensions.has_pin).toBe(
      false,
    );
  });

  it('seeds the default pin for every profile it loaded', async () => {
    const { pin } = await build();

    expect(pin.seedIfEmpty).toHaveBeenCalledWith([
      { profile: 'owner', pinCode: '1111' },
      { profile: 'child', pinCode: '1111' },
    ]);
  });

  // Kids start on their own code so a PIN prompt during a local run says
  // which kind of profile it belongs to without opening the store.
  // Which profile gets which code is the repository's call; this service
  // only asks and passes it on.
  it('seeds each profile with the code the repository names', async () => {
    const { pin } = await build([], feed, { owner: '0000' });

    expect(pin.seedIfEmpty).toHaveBeenCalledWith([
      { profile: 'owner', pinCode: '0000' },
      { profile: 'child', pinCode: '1111' },
    ]);
  });

  describe('gating a protected profile', () => {
    const withActions = {
      ...feed,
      entry: feed.entry.map((e) => ({
        ...e,
        extensions: {
          ...e.extensions,
          tap_actions: {
            actions: [
              { type: 'sessionStorageSet', options: {} },
              { type: 'finishHook', options: { success: true } },
            ],
          },
        },
      })),
    };

    const actionsOf = (service: ProfilesService, id: string) =>
      (service.getProfilesFeed().entry.find((e: any) => e.id === id) as any)
        .extensions.tap_actions.actions;

    // Entering a protected profile asks for THAT profile's own PIN, and a
    // cancelled pinCode stops the chain — so the session is never written.
    it('puts a pinCode verify in front of the session actions', async () => {
      const { service } = await build(['owner'], withActions);

      expect(actionsOf(service, 'owner').map((a: any) => a.type)).toEqual([
        'pinCode',
        'sessionStorageSet',
        'finishHook',
      ]);
    });

    it('asks for the profile own id, not some other profile', async () => {
      const { service } = await build(['owner'], withActions);

      expect(actionsOf(service, 'owner')[0].options).toEqual({
        typeMapping: 'parent-lock',
        flow: 'verify-pin',
        cloudEventPayload: { profile: 'owner' },
      });
    });

    it('leaves an unprotected profile untouched', async () => {
      const { service } = await build(['owner'], withActions);

      expect(actionsOf(service, 'child').map((a: any) => a.type)).toEqual([
        'sessionStorageSet',
        'finishHook',
      ]);
    });

    it('stops gating once the PIN is turned off', async () => {
      const pin = pinService(['owner']);
      const service = new ProfilesService(
        pin as any,
        repository(withActions) as any,
      );
      await service.onModuleInit();

      expect(actionsOf(service, 'owner')[0].type).toBe('pinCode');

      pin.hasPin.mockImplementation(() => false);

      expect(actionsOf(service, 'owner')[0].type).toBe('sessionStorageSet');
    });

    it('copes with a profile that has no tap actions at all', async () => {
      const { service } = await build(['owner']);

      expect(actionsOf(service, 'owner').map((a: any) => a.type)).toEqual([
        'pinCode',
      ]);
    });
  });
});

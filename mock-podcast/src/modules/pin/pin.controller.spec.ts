import { UnauthorizedException } from '@nestjs/common';
import { PinController } from './pin.controller';
import { CLOUD_EVENT_TYPES } from '../../constants/cloud-event-types.constants';

const OWNER = 'owner-profile';

/** The fixture side of the controller: who, if anyone, holds authority. */
const ownerRepo = (ownerId: string = OWNER, ids: string[] = [ownerId]) => ({
  ownerId: () => ownerId,
  profileIds: () => ids,
  // The fixture the controller reads names nobody in these tests; the prompts
  // fall back to wording that names nobody, which is what we assert.
  nameOf: () => '',
});

describe('PinController', () => {
  const controller = new PinController(
    { hasPin: jest.fn(() => false) } as any,
    undefined as any,
    ownerRepo() as any,
  );

  const req = (authorization?: string) =>
    ({
      headers: authorization ? { authorization } : {},
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
    }) as any;

  it('requires a bearer token', () => {
    expect(() =>
      controller.getRecoveryFeed('http://localhost:3000/pin/recover', req()),
    ).toThrow(UnauthorizedException);
  });

  it('returns a single entry that sends the recovery event', () => {
    const feed = controller.getRecoveryFeed(
      'http://localhost:3000/pin/recover',
      req('Bearer tok'),
    );

    expect(feed.entry).toHaveLength(1);
    expect(feed.entry[0].extensions.tap_actions.actions).toEqual([
      {
        type: 'sendCloudEvent',
        options: {
          url: 'http://localhost:3000/cloud-events',
          type: CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED,
          subject: 'recover_pin_code',
          data: { profile: '' },
        },
      },
    ]);
  });

  // The screen has no profile of its own, so an unnamed profile would send
  // the reminder about the app-wide PIN instead of the one being viewed.
  it('carries the profile the request identifies', () => {
    const withProfile = {
      headers: { authorization: 'Bearer tok', profile: '12345' },
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
    } as any;

    const feed = controller.getRecoveryFeed(
      'http://localhost:3000/pin/recover',
      withProfile,
    );

    expect(
      (feed.entry[0] as any).extensions.tap_actions.actions[0].options.data,
    ).toEqual({ profile: '12345' });
  });

  it('derives the cloud events url from the request host', () => {
    const feed = controller.getRecoveryFeed(
      'https://zapp-ran-demo.web.app/pin/recover',
      req('Bearer tok'),
    );

    expect(
      (feed.entry[0] as any).extensions.tap_actions.actions[0].options.url,
    ).toBe('https://zapp-ran-demo.web.app/cloud-events');
  });
});

describe('PinController actions feed', () => {
  const pinService = (hasPin: boolean) => ({ hasPin: jest.fn(() => hasPin) });

  const req = (authorization?: string) =>
    ({
      headers: authorization ? { authorization } : {},
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
    }) as any;

  const feedFor = (hasPin: boolean, profile?: string) =>
    new PinController(
      pinService(hasPin) as any,
      undefined as any,
      ownerRepo() as any,
    ).getPinActionsFeed(
      profile,
      'http://localhost:3000/pin/actions',
      req('Bearer tok'),
    );

  const actionTypes = (entry: any) =>
    entry.extensions.tap_actions.actions.map((a: any) => a.type);

  it('requires a bearer token', () => {
    expect(() =>
      new PinController(
        pinService(false) as any,
        undefined as any,
        ownerRepo() as any,
      ).getPinActionsFeed('12345', 'http://localhost:3000/pin/actions', req()),
    ).toThrow(UnauthorizedException);
  });

  it('offers only set when the profile has no pin', () => {
    const feed = feedFor(false, '12345');

    expect(feed.entry.map((e: any) => e.id)).toEqual(['set-pin']);
    expect(actionTypes(feed.entry[0])).toEqual(['pinCode', 'refreshComponent']);
    expect(feed.entry[0].extensions.tap_actions.actions[0].options).toEqual({
      typeMapping: 'parent-lock',
      flow: 'set-pin',
      cloudEventPayload: { profile: '12345' },
    });
  });

  // The owner's control has its own feed, but is offered here too while the
  // app has no Manage Profiles screen — see the note on getPinActionsFeed.
  // The owner's control says whose code it wants: on a profile's own settings
  // it sits beside that profile's own Change PIN.
  it('names the owner on the control offered in a profile own settings', () => {
    const feed = feedFor(true, '12345');
    const entry: any = feed.entry.find((e: any) => e.id === 'manage-pin');

    expect(entry.title).toBe('Change PIN (account owner)');
  });

  it('offers change, disable, the owner control and forgot when a pin is set', () => {
    const feed = feedFor(true, '12345');

    expect(feed.entry.map((e: any) => e.id)).toEqual([
      'change-pin',
      'disable-pin',
      'manage-pin',
      'forgot-pin',
    ]);
  });

  // BR-12. The owner's code is what authorises every parental act, so taking
  // it away while there is anyone to be a parent to leaves the other profiles'
  // PINs unsettable for good.
  it('hides disable on the owner once the account has a second profile', () => {
    const feed = new PinController(
      pinService(true) as any,
      undefined as any,
      ownerRepo(OWNER, [OWNER, 'kid']) as any,
    ).getPinActionsFeed(
      OWNER,
      'http://localhost:3000/pin/actions',
      req('Bearer tok'),
    ) as any;

    expect(feed.entry.map((e: any) => e.id)).not.toContain('disable-pin');
  });

  // Nobody to be a parent to, so the code guards nothing but its own profile.
  it('leaves disable on a lone owner', () => {
    const feed = new PinController(
      pinService(true) as any,
      undefined as any,
      ownerRepo(OWNER, [OWNER]) as any,
    ).getPinActionsFeed(
      OWNER,
      'http://localhost:3000/pin/actions',
      req('Bearer tok'),
    ) as any;

    expect(feed.entry.map((e: any) => e.id)).toContain('disable-pin');
  });

  it('drops the owner control when the fixture has no owner to authorise it', () => {
    const feed = new PinController(
      pinService(true) as any,
      undefined as any,
      ownerRepo('') as any,
    ).getPinActionsFeed(
      '12345',
      'http://localhost:3000/pin/actions',
      req('Bearer tok'),
    ) as any;

    expect(feed.entry.map((e: any) => e.id)).toEqual([
      'change-pin',
      'disable-pin',
      'forgot-pin',
    ]);
  });

  it('asks for confirmation before disabling', () => {
    const feed = feedFor(true, '12345');
    const disable: any = feed.entry.find((e: any) => e.id === 'disable-pin');

    expect(actionTypes(disable)).toEqual([
      'confirmDialog',
      'pinCode',
      'sendCloudEvent',
      'refreshComponent',
    ]);

    // The existing verify-pin flow does the checking; a cancelled pinCode
    // stops the chain, so the event below never fires on a wrong code.
    expect(disable.extensions.tap_actions.actions[1].options.flow).toBe(
      'verify-pin',
    );

    const cloudEvent: any = disable.extensions.tap_actions.actions[2];
    expect(cloudEvent.options.type).toBe(CLOUD_EVENT_TYPES.PIN_CODE_CHANGE);
    expect(cloudEvent.options.data).toEqual({
      step: 'disable',
      profile: '12345',
    });
  });

  it('builds the forgot chain', () => {
    const feed = feedFor(true, '12345');
    const forgot: any = feed.entry.find((e: any) => e.id === 'forgot-pin');

    // No confirmDialog and no pinCode: a reminder changes nothing, so there
    // is nothing to confirm and no code to prove.
    expect(actionTypes(forgot)).toEqual([
      'sendCloudEvent',
      'showToast',
      'refreshComponent',
    ]);

    const cloudEvent: any = forgot.extensions.tap_actions.actions[0];
    expect(cloudEvent.options.url).toBe('http://localhost:3000/cloud-events');
    expect(cloudEvent.options.type).toBe(
      CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED,
    );
    expect(cloudEvent.options.subject).toBe('recover_pin_code');
    expect(cloudEvent.options.data).toEqual({ profile: '12345' });
  });

  // Two PIN screens in a row asking for two different codes: without naming
  // them, the person types the wrong one first.
  it('names whose code each screen wants', () => {
    const named = new PinController(
      pinService(true) as any,
      undefined as any,
      {
        ownerId: () => OWNER,
        nameOf: (id: string) => (id === OWNER ? 'Keith' : 'Abigail'),
      } as any,
    ).getManageActionsFeed(
      'kid',
      'http://localhost:3000/pin/actions/manage',
      req('Bearer tok'),
    ) as any;

    const actions = named.entry[0].extensions.tap_actions.actions;

    expect(actions[0].options.promptText).toBe(
      "Enter the account owner's PIN (Keith)",
    );
    expect(actions[1].options.promptText).toBe('Set a new PIN for Abigail');
  });

  // The control offered here is the owner's, not the profile's own: it asks
  // for the OWNER's PIN, so the profile looking at its settings cannot use it
  // alone. Without this the entry would be a one-tap way past a parental lock.
  it('asks for the owner pin, then sets a code on this profile', () => {
    const feed = feedFor(true, '12345');
    const entry: any = feed.entry.find((e: any) => e.id === 'manage-pin');
    const actions: any[] = entry.extensions.tap_actions.actions;

    expect(actions[0].options).toEqual({
      typeMapping: 'parent-lock',
      flow: 'verify-pin',
      cloudEventPayload: { profile: OWNER, purpose: 'manage' },
      promptText: "Enter the account owner's PIN",
    });

    // The owner types the new code; the plugin sends it named for the target.
    expect(actions[1].options).toEqual({
      typeMapping: 'parent-lock',
      flow: 'set-pin',
      cloudEventPayload: { profile: '12345' },
      promptText: 'Set a new PIN',
    });
  });

  it('asks the service about the profile from the query', () => {
    const service = pinService(false);
    new PinController(
      service as any,
      undefined as any,
      ownerRepo() as any,
    ).getPinActionsFeed(
      '999',
      'http://localhost:3000/pin/actions',
      req('Bearer tok'),
    );

    expect(service.hasPin).toHaveBeenCalledWith('999');
  });

  it('falls back to the profile-less record when no profile is given', () => {
    const service = pinService(false);
    new PinController(
      service as any,
      undefined as any,
      ownerRepo() as any,
    ).getPinActionsFeed(
      undefined,
      'http://localhost:3000/pin/actions',
      req('Bearer tok'),
    );

    expect(service.hasPin).toHaveBeenCalledWith('');
  });
});

describe('PinController actions feed, profile from ctx', () => {
  const ctxParam = (value: unknown) =>
    Buffer.from(JSON.stringify(value), 'utf-8').toString('base64');

  const reqWith = (query: Record<string, unknown>) =>
    ({
      headers: { authorization: 'Bearer tok' },
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
      query,
    }) as any;

  // A dev override that rewrites the url drops its query, so ctx is the only
  // carrier that survives to the server.
  it('reads the profile out of the ctx query param', () => {
    const service = { hasPin: jest.fn(() => false) };

    new PinController(
      service as any,
      undefined as any,
      ownerRepo() as any,
    ).getPinActionsFeed(
      undefined,
      'http://localhost:3000/pin/actions',
      reqWith({ ctx: ctxParam({ profile: 'a3JVE000007CgIn2AK' }) }),
    );

    expect(service.hasPin).toHaveBeenCalledWith('a3JVE000007CgIn2AK');
  });

  // The url names whose buttons these are; ctx names who is asking. Here the
  // owner asks about somebody else, which is the one pairing where the two
  // differ and the feed is still served.
  it('lets an explicit profile win over ctx', () => {
    const service = { hasPin: jest.fn(() => false) };

    new PinController(
      service as any,
      undefined as any,
      ownerRepo() as any,
    ).getPinActionsFeed(
      '12345',
      'http://localhost:3000/pin/actions',
      reqWith({ ctx: ctxParam({ profile: OWNER }) }),
    );

    expect(service.hasPin).toHaveBeenCalledWith('12345');
  });

  // BR-12: a child sees the PIN buttons on its own profile and nowhere else.
  it('serves nothing to a profile asking about somebody else', () => {
    const service = { hasPin: jest.fn(() => true) };

    const feed = new PinController(
      service as any,
      undefined as any,
      ownerRepo() as any,
    ).getPinActionsFeed(
      '12345',
      'http://localhost:3000/pin/actions',
      reqWith({ ctx: ctxParam({ profile: 'another-child' }) }),
    );

    expect(feed.entry).toEqual([]);
  });

  it('puts the ctx profile into the action payloads', () => {
    const service = { hasPin: jest.fn(() => false) };

    const feed = new PinController(
      service as any,
      undefined as any,
      ownerRepo() as any,
    ).getPinActionsFeed(
      undefined,
      'http://localhost:3000/pin/actions',
      reqWith({ ctx: ctxParam({ profile: 'a3JVE000007CgIn2AK' }) }),
    );

    expect(
      (feed.entry[0] as any).extensions.tap_actions.actions[0].options
        .cloudEventPayload,
    ).toEqual({ profile: 'a3JVE000007CgIn2AK' });
  });
});

describe('PinController actions feed refreshes after every action', () => {
  const req = () =>
    ({
      headers: { authorization: 'Bearer tok' },
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
      query: {},
    }) as any;

  const feedFor = (hasPin: boolean) =>
    new PinController(
      { hasPin: jest.fn(() => hasPin) } as any,
      undefined as any,
      ownerRepo() as any,
    ).getPinActionsFeed('12345', 'http://localhost:3000/pin/actions', req());

  // Every action here can flip whether a PIN exists, which is exactly what
  // decides the feed's contents — so each chain must end by refreshing.
  it('ends every entry of the unprotected feed with refreshComponent', () => {
    const feed = feedFor(false);

    feed.entry.forEach((entry: any) => {
      const actions = entry.extensions.tap_actions.actions;
      expect(actions[actions.length - 1]).toEqual({
        type: 'refreshComponent',
      });
    });
  });

  it('ends every entry of the protected feed with refreshComponent', () => {
    const feed = feedFor(true);

    expect(feed.entry).toHaveLength(4);
    feed.entry.forEach((entry: any) => {
      const actions = entry.extensions.tap_actions.actions;
      expect(actions[actions.length - 1]).toEqual({
        type: 'refreshComponent',
      });
    });
  });
});

describe('PinController cloud events url', () => {
  const req = () =>
    ({
      headers: { authorization: 'Bearer tok' },
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
      query: {},
    }) as any;

  const controllerWith = (cloudEventsUrl?: string) =>
    new PinController(
      { hasPin: () => true } as any,
      {
        get: jest.fn((key: string) =>
          key === '@lib/mock-podcast.config.cloudEventsUrl'
            ? cloudEventsUrl
            : undefined,
        ),
      } as any,
      ownerRepo() as any,
    );

  const eventUrls = (feed: any) =>
    feed.entry
      .flatMap((e: any) => e.extensions.tap_actions.actions)
      .filter((a: any) => a.type === 'sendCloudEvent')
      .map((a: any) => a.options.url);

  // The client looks the url up in pipes_endpoints to attach the bearer token
  // and the profile header. A localhost url matches no endpoint, so the
  // request goes out bare and the mock answers 401 — the feed has to name the
  // public url and let the dev override redirect it.
  it('uses the configured public url so the endpoint config still applies', () => {
    const feed = controllerWith(
      'https://zapp-ran-demo.web.app/cloud-events',
    ).getPinActionsFeed('12345', 'http://localhost:3000/pin/actions', req());

    // Disable and forgot; the owner's control sends nothing of its own —
    // the plugin posts the set event once the code has been typed.
    expect(eventUrls(feed)).toEqual([
      'https://zapp-ran-demo.web.app/cloud-events',
      'https://zapp-ran-demo.web.app/cloud-events',
    ]);
  });

  it('falls back to the request origin when nothing is configured', () => {
    const feed = controllerWith(undefined).getPinActionsFeed(
      '12345',
      'http://localhost:3000/pin/actions',
      req(),
    );

    expect(eventUrls(feed)).toEqual([
      'http://localhost:3000/cloud-events',
      'http://localhost:3000/cloud-events',
    ]);
  });

  it('applies to the recovery feed too', () => {
    const feed = controllerWith(
      'https://zapp-ran-demo.web.app/cloud-events',
    ).getRecoveryFeed('http://localhost:3000/pin/recover', req()) as any;

    expect(eventUrls(feed)).toEqual([
      'https://zapp-ran-demo.web.app/cloud-events',
    ]);
  });
});

describe('PinController manage actions feed', () => {
  const req = (authorization = 'Bearer tok', headers: any = {}) =>
    ({
      headers: { authorization, ...headers },
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
      query: {},
    }) as any;

  const feedFor = (hasPin: boolean, owner: string = OWNER, profile = 'kid') =>
    new PinController(
      { hasPin: jest.fn(() => hasPin) } as any,
      undefined as any,
      ownerRepo(owner) as any,
    ).getManageActionsFeed(
      profile,
      'http://localhost:3000/pin/actions/manage',
      req(),
    ) as any;

  const actionsOf = (feed: any) => feed.entry[0].extensions.tap_actions.actions;

  it('requires a bearer token', () => {
    expect(() =>
      new PinController(
        { hasPin: () => true } as any,
        undefined as any,
        ownerRepo() as any,
      ).getManageActionsFeed(
        'kid',
        'http://localhost:3000/pin/actions/manage',
        // not `req(undefined)`: that hits the default and stays authorised
        { headers: {}, query: {} } as any,
      ),
    ).toThrow(UnauthorizedException);
  });

  it('offers a single entry', () => {
    const feed = feedFor(true);

    expect(feed.entry.map((e: any) => e.id)).toEqual(['manage-pin']);
    expect(feed.entry[0].title).toBe('Change PIN');
  });

  // Giving a profile its first PIN and replacing one it has are a single
  // parental right, so this is one entry that renames itself.
  it('renames itself when the profile has no pin yet', () => {
    expect(feedFor(false).entry[0].title).toBe('Set PIN');
  });

  it('proves the owner pin before letting them set one', () => {
    const feed = feedFor(true);

    expect(actionsOf(feed).map((a: any) => a.type)).toEqual([
      'pinCode',
      'pinCode',
      'refreshComponent',
    ]);

    // The marker is what separates this from the owner merely entering their
    // own profile — only a marked verify opens the management window.
    expect(actionsOf(feed)[0].options).toEqual({
      typeMapping: 'parent-lock',
      flow: 'verify-pin',
      cloudEventPayload: { profile: OWNER, purpose: 'manage' },
      promptText: "Enter the account owner's PIN",
    });
  });

  // The requirement is that the owner chooses the code, so the second step is
  // the set flow aimed at the target — not a reset to something we picked.
  it('has the owner type a code for the target profile', () => {
    expect(actionsOf(feedFor(true))[1].options).toEqual({
      typeMapping: 'parent-lock',
      flow: 'set-pin',
      cloudEventPayload: { profile: 'kid' },
      promptText: 'Set a new PIN',
    });
  });

  // The requirements limit who may do this, not whose PIN it may be done to.
  it('offers the same entry for an adult profile', () => {
    expect(feedFor(true, OWNER, 'adult').entry[0].id).toBe('manage-pin');
  });

  // With nobody holding parental authority there is nothing to offer, and a
  // chain that verified an empty profile would fail on the first step.
  it('is empty when the fixture has no owner', () => {
    expect(feedFor(true, '').entry).toEqual([]);
  });

  // Nothing is mailed: the owner is standing there typing the code.
  it('sends no cloud event of its own and promises no email', () => {
    const types = actionsOf(feedFor(true)).map((a: any) => a.type);

    expect(types).not.toContain('sendCloudEvent');
    expect(types).not.toContain('showToast');
  });
});

describe('PinController when the owner has no pin', () => {
  const req = () =>
    ({
      headers: { authorization: 'Bearer tok' },
      protocol: 'http',
      get: (name: string) => (name === 'host' ? 'localhost:3000' : undefined),
      query: {},
    }) as any;

  // The target holds a PIN, the owner does not.
  const controller = new PinController(
    { hasPin: jest.fn((profile: string) => profile !== OWNER) } as any,
    undefined as any,
    ownerRepo() as any,
  );

  const managePinActions = (feed: any) =>
    feed.entry
      .find((e: any) => e.id === 'manage-pin')
      .extensions.tap_actions.actions.map((a: any) => a.type);

  // Asking for a PIN that does not exist protects nothing: the verify comes
  // back "PIN is not set", and the step the owner actually came for would
  // never be reached.
  it('drops the verify step from the manage feed', () => {
    const feed = controller.getManageActionsFeed(
      'kid',
      'http://localhost:3000/pin/actions/manage',
      req(),
    ) as any;

    expect(managePinActions(feed)).toEqual(['pinCode', 'refreshComponent']);
  });

  it('drops it from the profile own feed too', () => {
    const feed = controller.getPinActionsFeed(
      'kid',
      'http://localhost:3000/pin/actions',
      req(),
    ) as any;

    expect(managePinActions(feed)).toEqual(['pinCode', 'refreshComponent']);
  });

  it('keeps the verify step once the owner has one', () => {
    const withOwnerPin = new PinController(
      { hasPin: jest.fn(() => true) } as any,
      undefined as any,
      ownerRepo() as any,
    );

    const feed = withOwnerPin.getManageActionsFeed(
      'kid',
      'http://localhost:3000/pin/actions/manage',
      req(),
    ) as any;

    expect(managePinActions(feed)).toEqual([
      'pinCode',
      'pinCode',
      'refreshComponent',
    ]);
  });
});

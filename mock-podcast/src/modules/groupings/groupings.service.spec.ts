import { HttpException } from '@nestjs/common';
import { GroupingsService } from './groupings.service';

describe('GroupingsService', () => {
  const OWNER = 'owner';
  const CHILD = 'child';

  const episode = (id: string, sensitive = '', extra: any = {}) => ({
    id,
    type: { value: 'audio-detail' },
    title: id,
    link: { href: `https://cms/audio-video/${id}`, rel: 'self' },
    extensions: { sensitive_content: sensitive },
    ...extra,
  });

  const grouping = (entry: any[]) => ({
    id: 'grouping-detail',
    type: { value: 'feed' },
    entry,
  });

  const build = ({
    upstreamFeed = grouping([episode('clean'), episode('mature', 'Mature')]),
    owner = OWNER,
    pins = [OWNER],
    config = {} as Record<string, unknown>,
    failsWith = undefined as HttpException | undefined,
  } = {}) => {
    const upstream = {
      get: jest.fn(async () => {
        if (failsWith) {
          throw failsWith;
        }

        return upstreamFeed;
      }),
    };
    const service = new GroupingsService(
      { hasPin: jest.fn((p: string) => pins.includes(p)) } as any,
      { ownerId: () => owner } as any,
      upstream as any,
      { get: jest.fn((key: string) => config[key]) } as any,
    );

    return { service, upstream };
  };

  const request = (profile?: string, url = '/groupings/2227?ctx=abc') =>
    ({
      originalUrl: url,
      headers: profile ? { 'x-viewer-id': profile } : {},
      query: {},
    }) as any;

  const entryOf = async (service: GroupingsService, id: string, req: any) =>
    ((await service.getFeed('2227', req)).entry as any[]).find(
      (e) => e.id === id,
    );

  describe('what it asks for', () => {
    it('proxies the same path and query from the customer CMS', async () => {
      const { service, upstream } = build();

      await service.getFeed(
        'listen/more',
        request(CHILD, '/groupings/listen/more?ctx=abc'),
      );

      expect(upstream.get).toHaveBeenCalledWith(
        'Groupings',
        'https://api-qa.aio.focusonthefamily.com/CMS/groupings/listen/more?ctx=abc',
        expect.anything(),
      );
    });

    it('passes an upstream refusal through', async () => {
      const { service } = build({ failsWith: new HttpException('no', 401) });

      await expect(service.getFeed('2227', request(CHILD))).rejects.toThrow(
        HttpException,
      );
    });
  });

  describe('gating mature content', () => {
    it('asks a non-master profile for the owner PIN, then navigates', async () => {
      const { service } = build();

      const entry = await entryOf(service, 'mature', request(CHILD));

      expect(entry.type).toEqual({ value: 'action' });
      expect(entry.extensions.tap_actions.actions).toEqual([
        {
          type: 'pinCode',
          options: {
            typeMapping: 'parent-lock',
            flow: 'verify-pin',
            cloudEventPayload: { profile: OWNER },
            promptText: "Enter the account owner's PIN to unlock this",
          },
        },
        {
          type: 'navigateToScreen',
          options: {
            typeMapping: 'audio-detail',
            navigationAction: 'push',
            entry: episode('mature', 'Mature'),
          },
        },
      ]);
    });

    // An action cell with a link has that link opened as a url scheme after
    // the chain, and an https link is a scheme no plugin handles.
    it('drops the link from the cell but keeps it on the navigated entry', async () => {
      const { service } = build();

      const entry = await entryOf(service, 'mature', request(CHILD));

      expect(entry).not.toHaveProperty('link');
      expect(
        entry.extensions.tap_actions.actions[1].options.entry.link,
      ).toEqual({
        href: 'https://cms/audio-video/mature',
        rel: 'self',
      });
    });

    it('keeps the tap actions the entry already had, behind the gate', async () => {
      const own = { type: 'showToast', options: { message: 'hi' } };
      const { service } = build({
        upstreamFeed: grouping([
          episode('mature', 'Mature', {
            extensions: {
              sensitive_content: 'Mature',
              tap_actions: { actions: [own] },
            },
          }),
        ]),
      });

      const types = (
        await entryOf(service, 'mature', request(CHILD))
      ).extensions.tap_actions.actions.map((a: any) => a.type);

      expect(types).toEqual(['pinCode', 'showToast', 'navigateToScreen']);
    });

    it('only prepends the gate to an entry that is already an action', async () => {
      const { service } = build({
        upstreamFeed: grouping([
          episode('mature', 'Mature', { type: { value: 'action' } }),
        ]),
      });

      const entry = await entryOf(service, 'mature', request(CHILD));

      expect(entry.link).toBeDefined();
      expect(
        entry.extensions.tap_actions.actions.map((a: any) => a.type),
      ).toEqual(['pinCode']);
    });

    // BR-P3, and the code here is the owner's — so the reminder is theirs.
    it('offers the owner a way out when events have somewhere to go', async () => {
      const { service } = build({
        config: { '@lib/mock-podcast.config.cloudEventsUrl': 'https://ev' },
      });

      const gate = (await entryOf(service, 'mature', request(CHILD))).extensions
        .tap_actions.actions[0];

      expect(gate.options.forgotText).toBe('Forgot your PIN?');
      expect(gate.options.forgotActions[0].options.data).toEqual({
        profile: OWNER,
      });
    });

    it('leaves content that is not mature untouched', async () => {
      const { service } = build();

      expect(await entryOf(service, 'clean', request(CHILD))).toEqual(
        episode('clean'),
      );
    });

    // The cell style draws the padlock from one key and reads truthy as
    // unlocked, so a gated entry says `false` and an open one says nothing.
    it('marks a gated entry for the padlock, and only that entry', async () => {
      const { service } = build();

      expect(
        (await entryOf(service, 'mature', request(CHILD))).extensions.unlocked,
      ).toBe(false);

      expect(
        (await entryOf(service, 'clean', request(CHILD))).extensions,
      ).not.toHaveProperty('unlocked');
    });

    it('does not gate the account owner', async () => {
      const { service } = build();

      expect(await entryOf(service, 'mature', request(OWNER))).toEqual(
        episode('mature', 'Mature'),
      );
    });

    // Not knowing who is watching is not the same as knowing it is the owner.
    it('gates when the request names no profile', async () => {
      const { service } = build();

      const entry = await entryOf(service, 'mature', request());

      expect(entry.extensions.tap_actions.actions[0].type).toBe('pinCode');
    });

    it('gates mature entries nested inside a feed of feeds', async () => {
      const { service } = build({
        upstreamFeed: grouping([
          {
            id: 'row',
            type: { value: 'feed' },
            entry: [episode('mature', 'Mature')],
          },
        ]),
      });

      const feed = await service.getFeed('listen', request(CHILD));
      const nested = (feed.entry as any[])[0].entry[0];

      expect(nested.type).toEqual({ value: 'action' });
    });
  });

  // BR-P1: with no owner PIN the entry is locked rather than gated. A verify
  // against a PIN that does not exist resolves Error, and a chain carries on
  // past an Error — a pinCode gate would protect nothing here.
  describe('locking mature content when the owner has no PIN', () => {
    const locked = () => build({ pins: [] });

    it('offers an explanation and no way in', async () => {
      const { service } = locked();

      const entry = await entryOf(service, 'mature', request(CHILD));

      expect(entry.type).toEqual({ value: 'action' });
      expect(entry).not.toHaveProperty('link');
      expect(entry.extensions.locked).toBe(true);
      expect(entry.extensions.unlocked).toBe(false);
      expect(entry.extensions.tap_actions.actions).toEqual([
        {
          type: 'showAlert',
          options: {
            title: 'Locked',
            message:
              'This is restricted for this profile. Ask the account owner to set up a PIN to unlock it.',
            okButtonText: 'OK',
          },
        },
      ]);
    });

    it('takes the copy from the config when it is set', async () => {
      const { service } = build({
        pins: [],
        config: {
          '@lib/mock-podcast.config.lockedTitle': 'Ask a grown-up',
          '@lib/mock-podcast.config.lockedMessage': 'Whit says no.',
        },
      });

      const actions = (await entryOf(service, 'mature', request(CHILD)))
        .extensions.tap_actions.actions;

      expect(actions[0].options.title).toBe('Ask a grown-up');
      expect(actions[0].options.message).toBe('Whit says no.');
    });

    // A locked episode must not keep working buttons of its own.
    it('drops the tap actions and the "…" menu the entry already had', async () => {
      const { service } = build({
        pins: [],
        upstreamFeed: grouping([
          episode('mature', 'Mature', {
            extensions: {
              sensitive_content: 'Mature',
              tap_actions: {
                actions: [{ type: 'showToast', options: { message: 'hi' } }],
              },
              entry_action: [{ button: { alias: 'add_to_queue' } }],
            },
          }),
        ]),
      });

      const entry = await entryOf(service, 'mature', request(CHILD));

      expect(
        entry.extensions.tap_actions.actions.map((a: any) => a.type),
      ).toEqual(['showAlert']);

      expect(entry.extensions).not.toHaveProperty('entry_action');
      expect(entry.extensions.sensitive_content).toBe('Mature');
    });

    it('locks an entry that is already an action too', async () => {
      const { service } = build({
        pins: [],
        upstreamFeed: grouping([
          episode('mature', 'Mature', { type: { value: 'action' } }),
        ]),
      });

      const entry = await entryOf(service, 'mature', request(CHILD));

      expect(entry).not.toHaveProperty('link');
      expect(
        entry.extensions.tap_actions.actions.map((a: any) => a.type),
      ).toEqual(['showAlert']);
    });

    it('leaves the owner alone', async () => {
      const { service } = locked();

      expect(await entryOf(service, 'mature', request(OWNER))).toEqual(
        episode('mature', 'Mature'),
      );
    });

    it('leaves content that is not mature alone', async () => {
      const { service } = locked();

      expect(await entryOf(service, 'clean', request(CHILD))).toEqual(
        episode('clean'),
      );
    });
  });

  // The style shows its `unlocked_badge` on a truthy value, so saying so on
  // every open entry is opt-in: otherwise the whole catalogue wears a padlock.
  describe('marking what the viewer may open', () => {
    const marking = (extra = {}) =>
      build({
        config: { '@lib/mock-podcast.config.markUnlockedEntries': true },
        ...extra,
      });

    it('says nothing unless the config asks', async () => {
      const { service } = build();

      expect(
        (await entryOf(service, 'clean', request(CHILD))).extensions,
      ).not.toHaveProperty('unlocked');
    });

    it('marks an open entry, and leaves a gated one locked', async () => {
      const { service } = marking();

      expect(
        (await entryOf(service, 'clean', request(CHILD))).extensions.unlocked,
      ).toBe(true);

      expect(
        (await entryOf(service, 'mature', request(CHILD))).extensions.unlocked,
      ).toBe(false);
    });

    it('marks mature content for the owner, who may open it', async () => {
      const { service } = marking();

      expect(
        (await entryOf(service, 'mature', request(OWNER))).extensions.unlocked,
      ).toBe(true);
    });

    it('leaves a locked entry locked', async () => {
      const { service } = marking({ pins: [] });

      expect(
        (await entryOf(service, 'mature', request(CHILD))).extensions.unlocked,
      ).toBe(false);
    });

    // A row is not something you open.
    it('does not mark a feed of feeds', async () => {
      const { service } = marking({
        upstreamFeed: grouping([
          { id: 'row', type: { value: 'feed' }, entry: [episode('clean')] },
        ]),
      });

      const feed = await service.getFeed('listen', request(CHILD));
      const row = (feed.entry as any[])[0];

      expect(row.extensions).toBeUndefined();
      expect(row.entry[0].extensions.unlocked).toBe(true);
    });

    it('does not mutate what the upstream returned', async () => {
      const upstreamFeed = grouping([episode('mature', 'Mature')]);
      const { service } = build({ upstreamFeed });

      await service.getFeed('2227', request(CHILD));

      expect(upstreamFeed.entry[0]).toEqual(episode('mature', 'Mature'));
    });
  });
});

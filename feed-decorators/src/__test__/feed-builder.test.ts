import {
  ActionsBuilder,
  EntryBuilder,
  ZappEntry,
  buildPreferenceFeed,
  buildDynamicCollectionFeed,
  buildCollectionSelectorFeed,
} from '../index';

describe('buildPreferenceFeed with actionBuilder', () => {
  it('should pre-inflate actions and set role:preference_editor', () => {
    const feed = buildPreferenceFeed(
      {},
      {
        key: 'genres',
        entries: [{ id: 'horror' }, { id: 'comedy' }],
        actionBuilder: (entry: ZappEntry) =>
          new EntryBuilder(
            new ActionsBuilder().toggleStorageFlag({ key: 'genres' }),
            entry,
          ).build(),
      },
    );
    expect(feed.extensions?.role).toBe('preference_editor');
    expect(feed.entry?.[0]?.extensions?.tap_actions).toBeDefined();
    expect(
      feed.entry?.[1]?.extensions?.tap_actions?.actions?.[0]?.type,
    ).toMatch(/ToggleFlag/);
  });

  it('should keep role:preference_editor if no actionBuilder is passed', () => {
    const feed = buildPreferenceFeed(
      {},
      {
        key: 'genres',
        entries: [{ id: 'horror' }],
      },
    );
    expect(feed.extensions?.role).toBe('preference_editor');
  });
});

describe('buildDynamicCollectionFeed', () => {
  it('should build feed with dynamic_collection role and options', () => {
    const feed = buildDynamicCollectionFeed(
      { title: 'My Collections' },
      {
        postUrl: 'http://localhost/cloud-events',
        operations: 'add,remove,reorder',
        addActions: [{ type: 'sendCloudEvent' }],
        entries: [{ id: 'col-1' }],
      },
    );

    expect(feed.title).toBe('My Collections');
    expect(feed.extensions?.role).toBe('dynamic_collection');
    expect(feed.extensions?.dynamic_collection_options?.postUrl).toBe(
      'http://localhost/cloud-events',
    );
    expect(feed.extensions?.dynamic_collection_options?.operations).toBe(
      'add,remove,reorder',
    );
    expect(feed.extensions?.dynamic_collection_options?.events?.add).toBeDefined();
    expect(feed.entry).toHaveLength(1);
  });
});

describe('buildCollectionSelectorFeed', () => {
  it('should build feed with collection_selector role and behavior', () => {
    const feed = buildCollectionSelectorFeed(
      { title: 'Select Collection' },
      {
        postUrl: 'http://localhost/cloud-events',
        selectMode: 'multi',
        currentSelection: ['col-1'],
        entries: [{ id: 'col-1' }],
      },
    );

    expect(feed.extensions?.role).toBe('collection_selector');
    expect(feed.extensions?.behavior?.select_mode).toBe('multi');
    expect(feed.extensions?.behavior?.current_selection).toEqual(['col-1']);
    expect(feed.extensions?.dynamic_collection_options?.postUrl).toBe(
      'http://localhost/cloud-events',
    );
  });
});

describe('EntryBuilder upNextFeed', () => {
  it('should set upNextFeed extension with string URL', () => {
    const entry = new EntryBuilder(new ActionsBuilder(), { id: 'track-1' })
      .setUpNextFeed('https://example.com/pipes/up-next')
      .build();

    expect(entry.extensions?.upNextFeed).toBe(
      'https://example.com/pipes/up-next',
    );
  });

  it('should set upNextFeed extension with object data source', () => {
    const dataSource = {
      source: 'https://example.com/pipes/up-next',
      mapping: 'custom_mapper',
    };
    const entry = new EntryBuilder(new ActionsBuilder(), { id: 'track-2' })
      .setUpNextFeed(dataSource)
      .build();

    expect(entry.extensions?.upNextFeed).toEqual(dataSource);
  });
});


import { ActionsBuilder, ZappEntry, buildPreferenceFeed } from '../index';

describe('buildPreferenceFeed with actionBuilder', () => {
  it('should pre-inflate actions and omit role:preference_editor', () => {
    const feed = buildPreferenceFeed(
      {},
      {
        key: 'genres',
        entries: [{ id: 'horror' }, { id: 'comedy' }],
        actionBuilder: (entry: ZappEntry) =>
          new ActionsBuilder(entry)
            .toggleStorageFlag({ key: 'genres' })
            .build(),
      },
    );
    expect(feed.extensions?.role).toBeUndefined();
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

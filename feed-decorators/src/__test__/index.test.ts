import {
  buildPreferenceFeed,
  ActionsBuilder,
  validateActionPayload,
} from '../index';

describe('Preference Feed Builder DSL', () => {
  it('should build a multi-select local storage feed', () => {
    const feed = buildPreferenceFeed(
      {},
      {
        storage: 'local',
        type: 'multi',
        key: 'genres',
        entries: [{ id: 'horror' }, { id: 'comedy' }],
      },
    );
    expect(feed.extensions!.role).toBe('preference_editor');
    expect(feed.extensions!.preference_editor_options.select_mode).toBe(
      'multi',
    );
    expect(feed.entry?.length).toBe(2);
  });

  it('should build actions for an entry', () => {
    const entry = new ActionsBuilder({ id: 'horror' })
      .toggleStorageFlag({ key: 'genres' })
      .sendCloudEvent({ url: 'https://example.com' })
      .build();
    const actions = entry.extensions?.tap_actions?.actions ?? [];
    expect(actions.length).toBe(2);
    expect(actions[0]?.type).toMatch(/ToggleFlag/);
    expect(actions[1]?.type).toBe('sendCloudEvent');
    // Validate each action payload
    actions.forEach((action) => {
      expect(validateActionPayload(action.type, action.options)).toBe(true);
    });
  });
});

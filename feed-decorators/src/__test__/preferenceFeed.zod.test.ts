import {
  buildPreferenceFeed,
  validatePreferenceEditorOptions,
  validateBehavior,
  validateZappFeed,
} from '../index';

describe('Preference Feed Builder Zod validation', () => {
  it('should produce a valid feed structure (without behavior block)', () => {
    const feed = buildPreferenceFeed(
      {},
      {
        storage: 'local',
        type: 'multi',
        key: 'genres',
        entries: [{ id: 'horror' }, { id: 'comedy' }],
      },
    );
    expect(validateZappFeed(feed)).toBe(true);
    if (feed.extensions) {
      expect(
        validatePreferenceEditorOptions(
          feed.extensions.preference_editor_options,
        ),
      ).toBe(true);
      // behavior block should NOT be present if role is present
      expect(feed.extensions.behavior).toBeUndefined();
    }
  });

  it('should produce a valid feed structure (pre-inflated, with behavior block)', () => {
    const feed = buildPreferenceFeed(
      {},
      {
        storage: 'local',
        type: 'multi',
        key: 'genres',
        entries: [{ id: 'horror' }, { id: 'comedy' }],
        actionBuilder: (entry) => entry, // simulate pre-inflation
      },
    );
    expect(validateZappFeed(feed)).toBe(true); // ZappFeedSchema now allows pre-inflated feeds
    if (feed.extensions) {
      expect(
        validatePreferenceEditorOptions(
          feed.extensions.preference_editor_options,
        ),
      ).toBe(true);
      expect(feed.extensions.behavior).toBeDefined();
      expect(validateBehavior(feed.extensions.behavior)).toBe(true);
    }
  });

  it('should fail validation for missing key in preference_editor_options', () => {
    expect(() =>
      buildPreferenceFeed(
        {},
        {
          storage: 'local',
          type: 'multi',
          key: '',
          entries: [{ id: 'horror' }],
        },
      ),
    ).toThrow("PreferenceFeedOptions: 'key' is required");
  });

  it('should fail validation for invalid select_mode in behavior (pre-inflated)', () => {
    const feed = buildPreferenceFeed(
      {},
      {
        storage: 'local',
        type: 'multi',
        key: 'genres',
        entries: [{ id: 'horror' }],
        actionBuilder: (entry) => entry,
      },
    );
    // Tamper with select_mode
    if (feed.extensions && feed.extensions.behavior) {
      feed.extensions.behavior.select_mode = 'invalid_mode';
      expect(validateBehavior(feed.extensions.behavior)).toBe(false);
    }
  });
});

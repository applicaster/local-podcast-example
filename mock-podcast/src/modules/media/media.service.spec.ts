import { MediaService } from './media.service';

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(() => {
    service = new MediaService();
  });

  it('returns default radio feed without legacy Toggle entry', () => {
    const feed = service.getRadioFeed();

    expect(feed.type.value).toBe('feed');
    expect(feed.title).toBe('Live Radio');
    expect(feed.entry.length).toBeGreaterThan(0);
    expect(feed.entry.some((entry) => entry.id === 'toggle_collections')).toBe(
      false,
    );
  });

  it('returns entries for ids preserving order and skipping unknown ids', () => {
    const entries = service.getEntriesForIds(['retro', 'unknown', 'slay']);

    expect(entries.map((entry) => entry.id)).toEqual(['retro', 'slay']);
    expect(entries.every((entry) => entry.type.value === 'audio')).toBe(true);
  });

  it('sets dismiss_on_action=true for radio entry actions and includes Playlist, Queue and Open Bottom Sheet actions', () => {
    const feed = service.getRadioFeed();
    const firstAudioEntry = feed.entry.find(
      (entry) => entry.type.value === 'audio',
    );
    const entryActions = firstAudioEntry?.extensions?.entry_action;

    expect(entryActions).toHaveLength(2);

    const addPlaylistAction = entryActions?.[0];
    expect(addPlaylistAction?.button?.alias).toBe('add_to_playlist');
    expect(addPlaylistAction?.dismiss_on_action).toBe(false);
    expect(addPlaylistAction?.actions?.[0]?.type).toBe('openBottomSheet');

    const addQueueAction = entryActions?.[1];
    expect(addQueueAction?.button?.alias).toBe('add_to_queue');
    expect(addQueueAction?.dismiss_on_action).toBe(true);
    expect(addQueueAction?.actions?.[0]?.type).toBe('addToQueue');
  });

  it('returns cached feed instance for repeated default feed calls', () => {
    const first = service.getRadioFeed();
    const second = service.getRadioFeed();

    expect(second).toBe(first);
  });
});

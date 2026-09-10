import { CollectionsService } from './collections.service';
import { CollectionEntity } from './collections.types';

describe('CollectionsService', () => {
  const createAudioEntry = (id: string) => ({
    id,
    type: { value: 'audio' },
    title: id,
    media_group: [
      {
        type: 'image' as const,
        media_item: [{ key: 'image_base', src: null }],
      },
    ],
    extensions: {},
  });

  const mediaService = {
    getEntriesForIds: jest.fn((ids: string[]) =>
      ids.map((id) => createAudioEntry(id)),
    ),
  };

  const persistenceService = {
    loadCollections: jest.fn(async (defaults: CollectionEntity[]) => defaults),
    saveCollections: jest.fn(async () => undefined),
  };

  let service: CollectionsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new CollectionsService(
      mediaService as any,
      persistenceService as any,
    );
    await service.onModuleInit();
  });

  it('adds continue-watching sourceCollectionId to collection playback entries', async () => {
    const source = await service.createCollection('Source List');
    await service.toggleItemInCollection(source.id, 'slay');

    const feed = service.getCollectionFeedById(source.id);
    const audioEntry = feed.entry.find((entry) => entry.type.value === 'audio');

    expect(audioEntry?.extensions?.['continue-watching']).toEqual({
      sourceCollectionId: source.id,
    });
  });

  describe('addItemToCollection', () => {
    it('adds item to collection', async () => {
      const playlist = await service.createCollection('My Playlist');
      await service.addItemToCollection(playlist.id, 'slay');

      const feed = service.getCollectionFeedById(playlist.id);
      const audioIds = feed.entry
        .filter((entry) => entry.type.value === 'audio')
        .map((entry) => entry.id);

      expect(audioIds).toEqual(['slay']);
    });

    it('is idempotent — adding same item twice does not duplicate', async () => {
      const playlist = await service.createCollection('My Playlist');
      await service.addItemToCollection(playlist.id, 'slay');
      await service.addItemToCollection(playlist.id, 'slay');

      const feed = service.getCollectionFeedById(playlist.id);
      const audioIds = feed.entry
        .filter((entry) => entry.type.value === 'audio')
        .map((entry) => entry.id);

      expect(audioIds).toEqual(['slay']);
    });

    it('throws NotFoundException for unknown collection', async () => {
      await expect(
        service.addItemToCollection('non-existent', 'slay'),
      ).rejects.toThrow('not found');
    });
  });

  describe('removeItemFromCollection', () => {
    it('removes item from collection', async () => {
      const playlist = await service.createCollection('My Playlist');
      await service.addItemToCollection(playlist.id, 'slay');
      await service.addItemToCollection(playlist.id, 'retro');
      await service.removeItemFromCollection(playlist.id, 'slay');

      const feed = service.getCollectionFeedById(playlist.id);
      const audioIds = feed.entry
        .filter((entry) => entry.type.value === 'audio')
        .map((entry) => entry.id);

      expect(audioIds).toEqual(['retro']);
    });

    it('is idempotent — removing absent item is a no-op', async () => {
      const playlist = await service.createCollection('My Playlist');
      await service.addItemToCollection(playlist.id, 'slay');
      await service.removeItemFromCollection(playlist.id, 'retro');

      const feed = service.getCollectionFeedById(playlist.id);
      const audioIds = feed.entry
        .filter((entry) => entry.type.value === 'audio')
        .map((entry) => entry.id);

      expect(audioIds).toEqual(['slay']);
    });

    it('throws NotFoundException for unknown collection', async () => {
      await expect(
        service.removeItemFromCollection('non-existent', 'slay'),
      ).rejects.toThrow('not found');
    });
  });

  describe('collections feed tap_actions', () => {
    it('includes role: "collection_selector" and select_mode behavior in extensions when itemId is provided', () => {
      const feed = service.getCollectionsFeed('slay');
      expect(feed.extensions?.role).toBe('collection_selector');
      expect(feed.extensions?.behavior).toEqual({
        select_mode: 'multi',
        current_selection: expect.any(Array),
      });
    });

    it('includes role: "dynamic_collection" and operations in extensions when editable is true', () => {
      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
        undefined,
        true,
        true,
      );
      expect(feed.extensions?.role).toBe('dynamic_collection');
      expect(feed.extensions?.dynamic_collection_options).toEqual(
        expect.objectContaining({
          postUrl: 'http://localhost:3000/cloud-events',
          operations: 'add,remove,reorder',
        }),
      );
    });
  });

  describe('upNextFeed decoration', () => {
    it('sets upNextFeed on the last item of a collection feed', async () => {
      const playlist = await service.createCollection('Playlist with UpNext');
      await service.addItemToCollection(playlist.id, 'retro');
      await service.addItemToCollection(playlist.id, 'slay');

      const feed = service.getCollectionFeedById(
        playlist.id,
        undefined,
        'http://localhost:3000',
      );

      expect(feed.entry).toHaveLength(2);
      expect(feed.entry[0].extensions?.upNextFeed).toBeUndefined();
      expect(feed.entry[1].extensions?.upNextFeed).toBe(
        'http://localhost:3000/media/up-next',
      );
    });

    it('sets play_next_feed_url for non-last items and upNextFeed for the last item in getPlayNextFeed', async () => {
      const playlist = await service.createCollection('Sequential Playlist');
      await service.addItemToCollection(playlist.id, 'retro');
      await service.addItemToCollection(playlist.id, 'slay');

      // First item: should have play_next_feed_url
      const firstFeed = service.getPlayNextFeed(
        playlist.id,
        'retro',
        'http://localhost:3000',
      );
      expect(firstFeed.entry[0].extensions?.play_next_feed_url).toContain(
        `/user/collections/${playlist.id}/play_next/slay`,
      );
      expect(firstFeed.entry[0].extensions?.upNextFeed).toBeUndefined();

      // Last item: should have upNextFeed
      const lastFeed = service.getPlayNextFeed(
        playlist.id,
        'slay',
        'http://localhost:3000',
      );
      expect(lastFeed.entry[0].extensions?.play_next_feed_url).toBeUndefined();
      expect(lastFeed.entry[0].extensions?.upNextFeed).toBe(
        'http://localhost:3000/media/up-next',
      );
    });
  });
});

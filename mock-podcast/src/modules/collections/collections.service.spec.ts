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
    extensions: {} as Record<string, any>,
  });

  const mediaService = {
    getEntriesForIds: jest.fn((ids: string[]) =>
      ids.map((id) => createAudioEntry(id)),
    ),
    getUpNextEntries: jest.fn(
      (
        baseUrl?: string,
        _isLoggedIn = true,
        _seedItemId?: string,
        excludeIds: string[] = [],
        limit = 5,
      ) => {
        const pool = ['rec_1', 'rec_2', 'rec_3', 'rec_4', 'rec_5', 'rec_6'];
        return pool
          .filter((id) => !excludeIds.includes(id))
          .slice(0, limit)
          .map((id) => {
            const entry = createAudioEntry(id);
            if (baseUrl) {
              entry.extensions.upNextFeed = `${baseUrl}/media/up-next?seedItemId=${id}`;
            }
            return entry;
          });
      },
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

    it('puts confirmDialog before delete_collection on user playlists', async () => {
      const playlist = await service.createCollection('Morning Mix');
      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
      );
      const entry = feed.entry.find((item) => item.id === playlist.id);
      const deleteAction = entry?.extensions?.entry_action?.find(
        (action: { button?: { alias?: string } }) =>
          action.button?.alias === 'delete_collection',
      );

      expect(deleteAction?.dismiss_on_action).toBe(false);
      expect(
        deleteAction?.actions?.map((action: { type: string }) => action.type),
      ).toEqual([
        'confirmDialog',
        'dismissBottomSheet',
        'sendCloudEvent',
        'refreshComponent',
      ]);
      expect(deleteAction?.actions?.[0]?.options?.message).toContain(
        'Morning Mix',
      );
    });

    it('does not add delete_collection on system collections', () => {
      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
      );
      const systemEntries = feed.entry.filter(
        (item) => item.extensions?.is_system === true,
      );

      expect(systemEntries.length).toBeGreaterThan(0);

      for (const entry of systemEntries) {
        const deleteAction = entry.extensions?.entry_action?.find(
          (action: { button?: { alias?: string } }) =>
            action.button?.alias === 'delete_collection',
        );

        expect(deleteAction).toBeUndefined();
      }
    });

    it('bulk selector tap_actions add collection, toast, then dismiss', async () => {
      const target = await service.createCollection('Morning Mix');
      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
        'system_gsc',
      );
      const row = feed.entry.find((entry) => entry.id === target.id);
      const types = row?.extensions?.tap_actions?.actions?.map(
        (action: { type: string }) => action.type,
      );

      expect(feed.extensions?.role).toBe('collection_selector');
      expect(feed.extensions?.behavior).toEqual({
        select_mode: 'none',
        current_selection: [],
      });
      expect(feed.entry.find((entry) => entry.id === 'system_gsc')).toBeUndefined();
      expect(types).toEqual([
        'sendCloudEvent',
        'showToast',
        'refreshComponent',
        'dismissBottomSheet',
      ]);

      const toast = row?.extensions?.tap_actions?.actions?.find(
        (action: { type: string }) => action.type === 'showToast',
      );
      expect(toast?.options?.message).toBe('Added to playlist');

      const event = row?.extensions?.tap_actions?.actions?.find(
        (action: { type: string }) => action.type === 'sendCloudEvent',
      );
      expect(event?.options?.type).toBe(
        'com.applicaster.collection.add.collection.v1',
      );
      expect(event?.options?.data).toEqual({
        collectionId: target.id,
        sourceCollectionId: 'system_gsc',
      });
    });
  });

  describe('upNextFeed and collection_up_next_feed decoration', () => {
    it('sets collection_up_next_feed and parameterized upNextFeed on all items in a collection feed', async () => {
      const playlist = await service.createCollection('Playlist with UpNext');
      await service.addItemToCollection(playlist.id, 'retro');
      await service.addItemToCollection(playlist.id, 'slay');

      const feed = service.getCollectionFeedById(
        playlist.id,
        undefined,
        'http://localhost:3000',
      );

      expect(feed.entry).toHaveLength(2);
      expect(feed.entry[0].extensions?.upNextFeed).toBe(
        'http://localhost:3000/media/up-next?seedItemId=retro',
      );
      expect(feed.entry[0].extensions?.collection_up_next_feed).toBe(
        `http://localhost:3000/user/collections/${playlist.id}/up-next?afterItemId=retro`,
      );
      expect(feed.entry[1].extensions?.upNextFeed).toBe(
        'http://localhost:3000/media/up-next?seedItemId=slay',
      );
      expect(feed.entry[1].extensions?.collection_up_next_feed).toBe(
        `http://localhost:3000/user/collections/${playlist.id}/up-next?afterItemId=slay`,
      );
    });

    it('returns remaining collection items in order after afterItemId', async () => {
      const feed = service.getCollectionUpNextFeed(
        'system_gsc',
        'gsc_cherrygrove_city',
        'http://localhost:3000',
      );

      expect(feed.entry.map((e) => e.id)).toEqual([
        'gsc_pokemon_center',
        'gsc_azalea_town',
        'gsc_goldenrod_city',
        'gsc_national_park',
        'gsc_ecruteak_city',
      ]);
      expect(feed.entry[0].extensions?.['continue-watching']).toEqual({
        sourceCollectionId: 'system_gsc',
      });
      expect(feed.entry[0].extensions?.upNextFeed).toBe(
        'http://localhost:3000/media/up-next?seedItemId=gsc_pokemon_center',
      );
    });

    it('pads tail with recommendations when fewer than 5 collection items remain', () => {
      const feed = service.getCollectionUpNextFeed(
        'system_gsc',
        'gsc_goldenrod_city',
        'http://localhost:3000',
      );

      expect(feed.entry.map((e) => e.id)).toEqual([
        'gsc_national_park',
        'gsc_ecruteak_city',
        'rec_1',
        'rec_2',
        'rec_3',
      ]);
    });

    it('returns up-next recommendations when afterItemId is the last item in collection', () => {
      const feed = service.getCollectionUpNextFeed(
        'system_gsc',
        'gsc_ecruteak_city',
        'http://localhost:3000',
      );

      expect(feed.entry.map((e) => e.id)).toEqual([
        'rec_1',
        'rec_2',
        'rec_3',
        'rec_4',
        'rec_5',
      ]);
    });

    it('throws NotFoundException when collection does not exist for up-next', () => {
      expect(() =>
        service.getCollectionUpNextFeed('missing-col', 'retro'),
      ).toThrow('not found');
    });

    it('sets parameterized upNextFeed, collection_up_next_feed, and play_next_feed_url in getPlayNextFeed', async () => {
      const playlist = await service.createCollection('Sequential Playlist');
      await service.addItemToCollection(playlist.id, 'retro');
      await service.addItemToCollection(playlist.id, 'slay');

      // First item: should have play_next_feed_url, collection_up_next_feed, and upNextFeed
      const firstFeed = service.getPlayNextFeed(
        playlist.id,
        'retro',
        'http://localhost:3000',
      );
      expect(firstFeed.entry[0].extensions?.play_next_feed_url).toContain(
        `/user/collections/${playlist.id}/play_next/slay`,
      );
      expect(firstFeed.entry[0].extensions?.collection_up_next_feed).toBe(
        `http://localhost:3000/user/collections/${playlist.id}/up-next?afterItemId=retro`,
      );
      expect(firstFeed.entry[0].extensions?.upNextFeed).toBe(
        'http://localhost:3000/media/up-next?seedItemId=retro',
      );

      // Last item: should have upNextFeed and collection_up_next_feed, and no play_next_feed_url
      const lastFeed = service.getPlayNextFeed(
        playlist.id,
        'slay',
        'http://localhost:3000',
      );
      expect(lastFeed.entry[0].extensions?.play_next_feed_url).toBeUndefined();
      expect(lastFeed.entry[0].extensions?.collection_up_next_feed).toBe(
        `http://localhost:3000/user/collections/${playlist.id}/up-next?afterItemId=slay`,
      );
      expect(lastFeed.entry[0].extensions?.upNextFeed).toBe(
        'http://localhost:3000/media/up-next?seedItemId=slay',
      );
    });

    it('dispatches addAllToQueue at top with startPlayback when system collection has only one item', () => {
      const singleItemCollection = {
        id: 'single_item_sys',
        name: 'Single System',
        itemIds: ['slay'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSystem: true,
      };

      const entry = (service as any).toFeedEntry(
        singleItemCollection,
        'http://localhost:3000/events',
        undefined,
        'http://localhost:3000',
        false,
      );

      const playAllActionWrapper = entry.extensions?.entry_action?.find(
        (ea: any) => ea.button?.alias === 'play_all',
      );
      expect(playAllActionWrapper).toBeDefined();

      const playAllAction = playAllActionWrapper.actions?.find(
        (a: any) => a.type === 'addAllToQueue',
      );
      expect(playAllAction).toBeDefined();
      expect(playAllAction.options).toEqual({
        url: 'http://localhost:3000/user/collections/single_item_sys',
        position: 'top',
        startPlayback: true,
      });
    });

    it('dispatches addAllToQueue at top with startPlayback when system collection has multiple items', () => {
      const multiItemCollection = {
        id: 'multi_item_sys',
        name: 'Multi System',
        itemIds: ['slay', 'gsc_title_screen'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSystem: true,
      };

      const entry = (service as any).toFeedEntry(
        multiItemCollection,
        'http://localhost:3000/events',
        undefined,
        'http://localhost:3000',
        false,
      );

      const playAllActionWrapper = entry.extensions?.entry_action?.find(
        (ea: any) => ea.button?.alias === 'play_all',
      );
      expect(playAllActionWrapper).toBeDefined();

      const playAllAction = playAllActionWrapper.actions?.find(
        (a: any) => a.type === 'addAllToQueue',
      );
      expect(playAllAction).toBeDefined();
      expect(playAllAction.options).toEqual({
        url: 'http://localhost:3000/user/collections/multi_item_sys',
        position: 'top',
        startPlayback: true,
      });
    });
  });
});

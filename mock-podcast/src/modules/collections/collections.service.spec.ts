import { CollectionsService } from './collections.service';
import { CollectionEntity } from './collections.types';

describe('CollectionsService queue logic', () => {
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

  const queueItems = (): string[] =>
    service
      .getCollectionFeedById('queue')
      .entry.filter((entry) => entry.type.value === 'audio')
      .map((entry) => entry.id);

  it('trims queue above current item when playback starts from queue', async () => {
    await service.toggleItemInCollection('queue', 'slay');
    await service.toggleItemInCollection('queue', 'retro');
    await service.toggleItemInCollection('queue', 'plaza');

    await service.handleVideoStarted('retro', 'queue');

    expect(queueItems()).toEqual(['retro', 'plaza']);
  });

  it('replaces queue with source collection tail when playback starts from non-queue collection', async () => {
    const source = await service.createCollection('Source List');

    await service.toggleItemInCollection(source.id, 'slay');
    await service.toggleItemInCollection(source.id, 'retro');
    await service.toggleItemInCollection(source.id, 'plaza');

    await service.toggleItemInCollection('queue', 'provodach');
    await service.toggleItemInCollection('queue', 'slay');

    await service.handleVideoStarted('retro', source.id);

    expect(queueItems()).toEqual(['retro', 'plaza']);
  });

  it('does not change queue when started item is missing in source collection', async () => {
    const source = await service.createCollection('Source List');

    await service.toggleItemInCollection(source.id, 'slay');
    await service.toggleItemInCollection(source.id, 'retro');

    await service.toggleItemInCollection('queue', 'provodach');
    await service.toggleItemInCollection('queue', 'plaza');

    await service.handleVideoStarted('non-existing-id', source.id);

    expect(queueItems()).toEqual(['provodach', 'plaza']);
  });

  it('removes completed item from queue on video stopped', async () => {
    await service.toggleItemInCollection('queue', 'retro');
    await service.toggleItemInCollection('queue', 'slay');

    await service.handleVideoStopped('retro', 'COMPLETED');

    expect(queueItems()).toEqual(['slay']);
  });

  it('keeps queue unchanged when video stopped status is not COMPLETED', async () => {
    await service.toggleItemInCollection('queue', 'retro');
    await service.toggleItemInCollection('queue', 'slay');

    await service.handleVideoStopped('retro', 'VIDEO_STOPPED');

    expect(queueItems()).toEqual(['retro', 'slay']);
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
      await service.addItemToCollection('queue', 'slay');

      expect(queueItems()).toEqual(['slay']);
    });

    it('is idempotent — adding same item twice does not duplicate', async () => {
      await service.addItemToCollection('queue', 'slay');
      await service.addItemToCollection('queue', 'slay');

      expect(queueItems()).toEqual(['slay']);
    });

    it('throws NotFoundException for unknown collection', async () => {
      await expect(
        service.addItemToCollection('non-existent', 'slay'),
      ).rejects.toThrow('not found');
    });
  });

  describe('removeItemFromCollection', () => {
    it('removes item from collection', async () => {
      await service.addItemToCollection('queue', 'slay');
      await service.addItemToCollection('queue', 'retro');
      await service.removeItemFromCollection('queue', 'slay');

      expect(queueItems()).toEqual(['retro']);
    });

    it('is idempotent — removing absent item is a no-op', async () => {
      await service.addItemToCollection('queue', 'slay');
      await service.removeItemFromCollection('queue', 'retro');

      expect(queueItems()).toEqual(['slay']);
    });

    it('throws NotFoundException for unknown collection', async () => {
      await expect(
        service.removeItemFromCollection('non-existent', 'slay'),
      ).rejects.toThrow('not found');
    });
  });

  describe('collections feed tap_actions', () => {
    it('does not include the Queue in collections feed when itemId is provided', () => {
      const feed = service.getCollectionsFeed('slay');
      const queueEntry = feed.entry.find((e) => e.title === 'Queue');
      expect(queueEntry).toBeUndefined();
    });

    it('emits add event type when item is not in custom collection', async () => {
      const customCollection = await service.createCollection('My Playlist');
      const feed = service.getCollectionsFeed('slay');
      const customEntry = feed.entry.find((e) => e.id === customCollection.id);
      const cloudEventAction =
        customEntry?.extensions?.tap_actions?.actions?.[0];

      expect(cloudEventAction?.options?.type).toBe(
        'com.applicaster.collection.add.item.v1',
      );
      expect(cloudEventAction?.options?.subject).toBe('add_item_to_collection');
    });

    it('emits add collection event type and dismissBottomSheet when collection_id is provided', async () => {
      const customCollection = await service.createCollection('My Playlist');
      const feed = service.getCollectionsFeed(undefined, undefined, 'system_jazz');
      const customEntry = feed.entry.find((e) => e.id === customCollection.id);
      const actions = customEntry?.extensions?.tap_actions?.actions;

      expect(actions?.[0]?.options?.type).toBe(
        'com.applicaster.collection.add.collection.v1',
      );
      expect(actions?.[0]?.options?.subject).toBe(
        'add_collection_to_collection',
      );
      expect(actions?.[2]?.type).toBe('dismissBottomSheet');
    });

    it('emits remove event type when item is already in custom collection', async () => {
      const customCollection = await service.createCollection('My Playlist');
      await service.addItemToCollection(customCollection.id, 'slay');

      const feed = service.getCollectionsFeed('slay');
      const customEntry = feed.entry.find((e) => e.id === customCollection.id);
      const cloudEventAction =
        customEntry?.extensions?.tap_actions?.actions?.[0];

      expect(cloudEventAction?.options?.type).toBe(
        'com.applicaster.collection.remove.v1',
      );
      expect(cloudEventAction?.options?.subject).toBe(
        'remove_item_from_collection',
      );
    });
  });

  describe('collection item entry actions', () => {
    it('adds a "Remove item" entry action with refresh in default collection screen', async () => {
      await service.addItemToCollection('queue', 'slay');

      const feed = service.getCollectionFeedById('queue');
      const audioEntry = feed.entry.find((entry) => entry.id === 'slay');
      const actions = audioEntry?.extensions?.entry_action;
      const removeAction = actions?.[0];

      expect(actions).toHaveLength(1);
      expect(removeAction?.button?.alias).toBe('remove_item');
      expect(removeAction?.dismiss_on_action).toBe(true);
      expect(removeAction?.actions?.[0]?.type).toBe('sendCloudEvent');
      expect(removeAction?.actions?.[0]?.options?.type).toBe(
        'com.applicaster.collection.remove.v1',
      );
      expect(removeAction?.actions?.[1]?.type).toBe('refreshComponent');
    });

    it('uses the same "Remove item" entry action in remove_item mode', async () => {
      await service.addItemToCollection('queue', 'slay');

      const feed = service.getCollectionFeedById('queue', 'remove_item');
      const audioEntry = feed.entry.find((entry) => entry.id === 'slay');
      const actions = audioEntry?.extensions?.entry_action;
      const removeAction = actions?.[0];

      expect(actions).toHaveLength(1);
      expect(removeAction?.button?.alias).toBe('remove_item');
      expect(removeAction?.dismiss_on_action).toBe(true);
      expect(removeAction?.actions?.[0]?.type).toBe('sendCloudEvent');
      expect(removeAction?.actions?.[1]?.type).toBe('refreshComponent');
    });
  });

  describe('collections list entry actions', () => {
    it('adds Create collection entry in default mode', () => {
      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
      );
      const createEntry = feed.entry.find(
        (entry) => entry.id === 'create_collection',
      );

      expect(createEntry).toBeDefined();
      expect(createEntry?.title).toBe('Create collection');
      expect(createEntry?.type.value).toBe('action');
      expect(
        createEntry?.extensions?.tap_actions?.actions?.[0]?.options?.type,
      ).toBe('com.applicaster.collection.create.v1');
      expect(createEntry?.extensions?.tap_actions?.actions?.[1]?.type).toBe(
        'refreshComponent',
      );
    });

    it('does not add Create collection entry in item_id mode', () => {
      const feed = service.getCollectionsFeed('slay', 'http://localhost:3000');
      const createEntry = feed.entry.find(
        (entry) => entry.id === 'create_collection',
      );

      expect(createEntry).toBeUndefined();
    });

    it('adds Delete collection action for non-system collections', async () => {
      const customCollection = await service.createCollection('My Playlist');

      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
      );
      const customEntry = feed.entry.find(
        (entry) => entry.id === customCollection.id,
      );
      const actions = customEntry?.extensions?.entry_action;
      const deleteAction = actions?.find(a => a.button?.alias === 'delete_collection');

      expect(actions?.length).toBeGreaterThanOrEqual(1);
      expect(deleteAction?.button?.alias).toBe('delete_collection');
      expect(deleteAction?.dismiss_on_action).toBe(true);
      expect(deleteAction?.actions?.[0]?.type).toBe('sendCloudEvent');
      expect(deleteAction?.actions?.[0]?.options?.type).toBe(
        'com.applicaster.collection.delete.v1',
      );
      expect(deleteAction?.actions?.[0]?.options?.subject).toBe(
        'delete_collection',
      );
      expect(deleteAction?.actions?.[0]?.options?.data).toEqual({
        collectionId: customCollection.id,
      });
      expect(deleteAction?.actions?.[1]?.type).toBe('refreshComponent');
    });

    it('does not add Delete collection action for Queue', () => {
      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
      );
      const queueEntry = feed.entry.find((entry) => entry.title === 'Queue');

      expect(queueEntry?.extensions?.entry_action).toBeUndefined();
    });

    it('adds an editCollection action (not a screen navigation) for non-system collections', async () => {
      const customCollection = await service.createCollection('My Playlist');

      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
      );
      const customEntry = feed.entry.find(
        (entry) => entry.id === customCollection.id,
      );
      const actions = customEntry?.extensions?.entry_action;
      const editAction = actions?.find((a) => a.button?.alias === 'edit');

      expect(editAction).toBeDefined();
      expect(editAction?.actions?.[0]?.type).toBe('editCollection');
      expect(editAction?.actions?.[0]?.options?.collectionId).toBe(
        customCollection.id,
      );
      expect(editAction?.actions?.[0]?.options?.url).toBe(
        `http://localhost:3000/user/collections/${customCollection.id}`,
      );
      // The edit action must not navigate to a screen by type.
      expect(
        actions?.some((a) =>
          a.actions?.some((inner) => inner.type === 'navigateToScreen'),
        ),
      ).toBe(false);
    });

    it('does not add an editCollection action for system collections', () => {
      const feed = service.getCollectionsFeed(
        undefined,
        'http://localhost:3000',
      );
      const systemEntry = feed.entry.find((entry) => entry.id === 'system_gsc');
      const editAction = systemEntry?.extensions?.entry_action?.find(
        (a) => a.button?.alias === 'edit',
      );

      expect(editAction).toBeUndefined();
    });
  });
});

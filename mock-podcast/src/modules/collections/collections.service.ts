import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { MediaService } from '../media/media.service';
import {
  CollectionEntity,
  CollectionEntry,
  CollectionsFeed,
} from './collections.types';
import { Feed, Entry } from '../../types/feed';
import { CollectionsPersistenceService } from './persistence.service';
import { CLOUD_EVENT_TYPES } from '../../constants/cloud-event-types.constants';
import { UI_LABELS } from '../../constants/ui-labels.constants';
import { SystemCollectionEntryBuilder } from '../../builders/SystemCollectionEntryBuilder';
import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';

@Injectable()
export class CollectionsService implements OnModuleInit {
  private static readonly CLOUD_EVENTS_PATH = '/cloud-events';
  private static readonly QUEUE_NAME = UI_LABELS.COLLECTION.QUEUE_NAME;
  private static readonly QUEUE_ALIAS = 'queue';
  private readonly logger = new Logger(CollectionsService.name);

  private collections: CollectionEntity[] = [];

  constructor(
    private readonly mediaService: MediaService,
    private readonly persistenceService: CollectionsPersistenceService,
  ) {}

  async onModuleInit() {
    const queueCollection: CollectionEntity = {
      id: randomUUID(),
      name: UI_LABELS.COLLECTION.QUEUE_NAME,
      itemIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isSystem: true,
    };
    const defaultCollections: CollectionEntity[] = [
      queueCollection
    ];
    this.collections =
      await this.persistenceService.loadCollections(defaultCollections);

    const systemGscId = 'system_gsc';
    let needsSave = false;

    // Prune deprecated system_jazz and system_funk collections if loaded from persistence
    const originalLength = this.collections.length;
    this.collections = this.collections.filter(
      (c) => c.id !== 'system_jazz' && c.id !== 'system_funk',
    );
    if (this.collections.length !== originalLength) {
      needsSave = true;
    }

    const existingQueue = this.collections.find(
      (c) => c.isSystem && c.name === UI_LABELS.COLLECTION.QUEUE_NAME,
    );
    if (!existingQueue) {
      this.collections.unshift(queueCollection);
      needsSave = true;
    }

    if (!this.collections.some((c) => c.id === systemGscId)) {
      this.collections.push({
        id: systemGscId,
        name: 'Pokémon GSC',
        itemIds: [
          'gsc_title_screen',
          'gsc_new_bark_town',
          'gsc_elm_lab',
          'gsc_route_29',
          'gsc_cherrygrove_city',
          'gsc_pokemon_center',
          'gsc_azalea_town',
          'gsc_goldenrod_city',
          'gsc_national_park',
          'gsc_ecruteak_city',
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isSystem: true,
      });
      needsSave = true;
    }

    if (needsSave) {
      await this.persistenceService.saveCollections(this.collections);
    }

    this.logger.log(
      `Initialized with ${this.collections.length} collection(s)`,
    );
  }

  getSystemCollectionsFeed(baseUrl?: string, isLoggedIn = true): CollectionsFeed {
    const cloudEventsUrl = this.cloudEventsUrl(baseUrl);
    const systemCollections = this.collections.filter(
      (c) => c.isSystem && c.name !== CollectionsService.QUEUE_NAME,
    );
    const entries = systemCollections.map((collection) => {
      const baseFeedEntry = this.toFeedEntry(collection, cloudEventsUrl);
      const builder = new SystemCollectionEntryBuilder(baseFeedEntry);

      // 1. Add all to Queue
      if (baseUrl) {
        builder.addAllToQueue(baseUrl, collection.id);
      }

      // 2. Play All
      if (collection.itemIds.length > 0) {
        const firstItemId = collection.itemIds[0];
        const firstEntryArray = this.mediaService.getEntriesForIds([firstItemId], isLoggedIn);
        if (firstEntryArray.length > 0) {
          const firstEntry = firstEntryArray[0];
          this.decorateEntriesWithPlaybackSource([firstEntry], collection.id);
          if (baseUrl) {
            const playNextUrl = this.getPlayNextUrl(
              collection.id,
              collection.itemIds,
              firstItemId,
              baseUrl,
            );
            if (playNextUrl) {
              firstEntry.extensions = {
                ...firstEntry.extensions,
                play_next_feed_url: playNextUrl,
              };
            }
          }

          builder.playAll(firstEntry);
        }
      }

      // 3. Add all to Playlist
      if (baseUrl && isLoggedIn) {
        builder.addAllToPlaylist(baseUrl, collection.id);
      }

      return builder.build() as CollectionEntry;
    });

    return {
      id: randomUUID(),
      type: { value: 'feed' },
      title: 'System Collections',
      entry: entries,
      extensions: {},
    };
  }

  getCollectionsFeed(
    itemId?: string,
    baseUrl?: string,
    collectionId?: string,
    isLoggedIn = true,
  ): CollectionsFeed {
    if (!isLoggedIn) {
      return {
        id: randomUUID(),
        type: { value: 'feed' },
        title: UI_LABELS.FEED_TITLES.YOUR_COLLECTIONS,
        entry: [],
        extensions: {
          ...((itemId || collectionId) && {
            role: 'collection_selector',
            behavior: {
              select_mode: 'multi',
              current_selection: [],
            },
          }),
        },
      };
    }

    const cloudEventsUrl = this.cloudEventsUrl(baseUrl);

    const collectionsToRender = (itemId || collectionId)
      ? this.collections.filter(
          (collection) =>
            !(
              collection.isSystem &&
              collection.name === CollectionsService.QUEUE_NAME
            ),
        )
      : this.collections;

    const selectedCollectionIds = itemId
      ? collectionsToRender
          .filter((collection) => collection.itemIds.includes(itemId))
          .map((collection) => collection.id)
      : [];

    const entries = collectionsToRender.map((collection) =>
      this.toFeedEntry(collection, cloudEventsUrl, itemId || collectionId, baseUrl, !!collectionId),
    );

    if (!itemId && !collectionId) {
      entries.push(this.createCreateCollectionEntry(cloudEventsUrl));
    }

    return {
      id: randomUUID(),
      type: { value: 'feed' },
      title: UI_LABELS.FEED_TITLES.YOUR_COLLECTIONS,
      entry: entries,
      extensions: {
        ...((itemId || collectionId) && {
          role: 'collection_selector',
          behavior: {
            select_mode: 'multi',
            current_selection: selectedCollectionIds,
          },
        }),
      },
    };
  }

  private getPlayNextUrl(
    collectionId: string,
    collectionItemIds: string[],
    currentItemId: string,
    baseUrl: string,
  ): string | undefined {
    const currentIndex = collectionItemIds.indexOf(currentItemId);
    if (currentIndex !== -1 && currentIndex < collectionItemIds.length - 1) {
      const nextItemId = collectionItemIds[currentIndex + 1];
      return `${baseUrl}/user/collections/${collectionId}/play_next/${nextItemId}`;
    }
    return undefined;
  }

  getPlayNextFeed(
    collectionId: string,
    itemId: string,
    baseUrl?: string,
    isLoggedIn = true,
  ): Feed {
    const collection = this.findCollectionByIdOrAlias(collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} was not found`);
    }

    const entries = this.mediaService.getEntriesForIds([itemId], isLoggedIn);
    if (entries.length === 0) {
      throw new NotFoundException(`Item ${itemId} was not found`);
    }

    this.decorateEntriesWithPlaybackSource(entries, collection.id);

    if (baseUrl) {
      const playNextUrl = this.getPlayNextUrl(
        collection.id,
        collection.itemIds,
        itemId,
        baseUrl,
      );
      if (playNextUrl) {
        entries[0].extensions = {
          ...entries[0].extensions,
          play_next_feed_url: playNextUrl,
        };
      }
    }

    return {
      id: randomUUID(),
      type: { value: 'feed' },
      title: entries[0].title,
      entry: entries,
      extensions: {},
    };
  }

  async addAllItemsToCollection(
    sourceCollectionId: string,
    targetCollectionId: string,
  ): Promise<CollectionEntity> {
    const sourceCollection = this.findCollectionByIdOrAlias(sourceCollectionId);
    if (!sourceCollection) {
      throw new NotFoundException(
        `Source collection ${sourceCollectionId} was not found`,
      );
    }

    const targetCollection = this.findCollectionByIdOrAlias(targetCollectionId);
    if (!targetCollection) {
      throw new NotFoundException(
        `Target collection ${targetCollectionId} was not found`,
      );
    }

    const newItemIds = [...targetCollection.itemIds];
    sourceCollection.itemIds.forEach((id) => {
      if (!newItemIds.includes(id)) {
        newItemIds.push(id);
      }
    });

    targetCollection.itemIds = newItemIds;
    targetCollection.updatedAt = new Date().toISOString();

    await this.persistenceService.saveCollections(this.collections);
    return targetCollection;
  }

  getCollectionFeedById(
    id: string,
    action?: string,
    baseUrl?: string,
    isLoggedIn = false,
  ): Feed {
    const cloudEventsUrl = this.cloudEventsUrl(baseUrl);
    const collection = this.findCollectionByIdOrAlias(id);
    if (!collection) {
      throw new NotFoundException(`Collection ${id} was not found`);
    }

    const entries = this.mediaService.getEntriesForIds(collection.itemIds, isLoggedIn);
    this.decorateEntriesWithPlaybackSource(entries, collection.id);

    if (action === 'remove_item') {
      // Edit mode: expose remove item action in entry action menu
      this.decorateEntriesWithRemoveAction(
        entries,
        collection.id,
        cloudEventsUrl,
      );
    } else {
      // Default mode: add remove entry_action to each entry
      this.decorateEntriesWithRemoveAction(
        entries,
        collection.id,
        cloudEventsUrl,
      );

    }

    return {
      id: randomUUID(),
      type: { value: 'feed' },
      title: collection.name,
      entry: entries,
      extensions: {},
    };
  }


  private createCreateCollectionEntry(cloudEventsUrl: string): CollectionEntry {
    const tapActions = new ActionsBuilder({})
      .sendCloudEvent({
        url: cloudEventsUrl,
        type: CLOUD_EVENT_TYPES.COLLECTION_CREATE,
        subject: 'create_collection',
        data: {},
      })
      .refreshComponent();

    const entry = new EntryBuilder(tapActions, {
      id: 'create_collection',
      type: { value: 'action' },
    })
      .setTitle(UI_LABELS.ENTRY_TITLES.CREATE_COLLECTION)
      .addCoverImageByAlias('create_collection')
      .addExtension('item_count', 0)
      .addExtension('is_system', false);

    return entry.build() as unknown as CollectionEntry;
  }

  async createCollection(name?: string): Promise<CollectionEntity> {
    const trimmedName = name?.trim();
    const collectionName =
      trimmedName && trimmedName.length > 0
        ? trimmedName
        : this.nextDefaultName();

    const now = new Date().toISOString();
    const newCollection: CollectionEntity = {
      id: randomUUID(),
      name: collectionName,
      itemIds: [],
      createdAt: now,
      updatedAt: now,
      isSystem: false,
    };

    this.collections.push(newCollection);
    await this.persistenceService.saveCollections(this.collections);
    return newCollection;
  }

  async deleteCollection(id: string): Promise<{ deleted: true; id: string }> {
    const collection = this.findCollectionByIdOrAlias(id);
    if (!collection) {
      throw new NotFoundException(`Collection ${id} was not found`);
    }

    const index = this.collections.findIndex(
      (item) => item.id === collection.id,
    );
    if (index === -1) {
      throw new NotFoundException(`Collection ${id} was not found`);
    }

    if (this.collections[index].isSystem) {
      throw new BadRequestException('System collections cannot be deleted');
    }

    this.collections.splice(index, 1);
    await this.persistenceService.saveCollections(this.collections);
    return { deleted: true, id: collection.id };
  }

  async addItemToCollection(
    collectionId: string,
    itemId: string,
  ): Promise<CollectionEntity> {
    const collection = this.findCollectionByIdOrAlias(collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} was not found`);
    }

    if (!collection.itemIds.includes(itemId)) {
      collection.itemIds.push(itemId);
      collection.updatedAt = new Date().toISOString();
      await this.persistenceService.saveCollections(this.collections);
    }

    return collection;
  }

  async toggleItemInCollection(
    collectionId: string,
    itemId: string,
  ): Promise<CollectionEntity> {
    const collection = this.findCollectionByIdOrAlias(collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} was not found`);
    }

    const itemIndex = collection.itemIds.indexOf(itemId);
    if (itemIndex === -1) {
      collection.itemIds.push(itemId);
    } else {
      collection.itemIds.splice(itemIndex, 1);
    }

    collection.updatedAt = new Date().toISOString();
    await this.persistenceService.saveCollections(this.collections);
    return collection;
  }

  async removeItemFromCollection(
    collectionId: string,
    itemId: string,
  ): Promise<CollectionEntity> {
    const collection = this.findCollectionByIdOrAlias(collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} was not found`);
    }

    const itemIndex = collection.itemIds.indexOf(itemId);
    if (itemIndex !== -1) {
      collection.itemIds.splice(itemIndex, 1);
    }

    collection.updatedAt = new Date().toISOString();
    await this.persistenceService.saveCollections(this.collections);
    return collection;
  }

  async handleVideoStarted(
    videoId: string,
    sourceCollectionId?: string,
  ): Promise<void> {
    const queue = this.getQueueCollection();
    if (!queue) {
      this.logger.warn(
        'Queue collection was not found while handling video started event',
      );
      return;
    }

    if (sourceCollectionId) {
      const sourceCollection =
        this.findCollectionByIdOrAlias(sourceCollectionId);
      if (!sourceCollection) {
        this.logger.warn(
          `Source collection "${sourceCollectionId}" was not found for video started event`,
        );
      } else if (sourceCollection.id !== queue.id) {
        const sourceItemIndex = sourceCollection.itemIds.indexOf(videoId);
        if (sourceItemIndex === -1) {
          this.logger.warn(
            `Video "${videoId}" was not found in source collection "${sourceCollection.id}"; queue was not updated`,
          );
          return;
        }

        queue.itemIds = sourceCollection.itemIds.slice(sourceItemIndex);
        queue.updatedAt = new Date().toISOString();
        await this.persistenceService.saveCollections(this.collections);
        return;
      }
    }

    const currentItemIndex = queue.itemIds.indexOf(videoId);
    if (currentItemIndex <= 0) {
      return;
    }

    queue.itemIds.splice(0, currentItemIndex);
    queue.updatedAt = new Date().toISOString();
    await this.persistenceService.saveCollections(this.collections);
  }

  async handleVideoStopped(videoId: string, status?: string): Promise<void> {
    if (status !== 'COMPLETED') {
      return;
    }

    const queue = this.getQueueCollection();
    if (!queue) {
      this.logger.warn(
        'Queue collection was not found while handling video stopped event',
      );
      return;
    }

    const filteredItemIds = queue.itemIds.filter(
      (itemId) => itemId !== videoId,
    );
    if (filteredItemIds.length === queue.itemIds.length) {
      return;
    }

    queue.itemIds = filteredItemIds;
    queue.updatedAt = new Date().toISOString();
    await this.persistenceService.saveCollections(this.collections);
  }

  private nextDefaultName(): string {
    const defaultNamePattern = new RegExp(
      `^${UI_LABELS.COLLECTION.DEFAULT_PLAYLIST_PREFIX}(\\d+)$`,
    );
    const maxCurrentNumber = this.collections.reduce((acc, item) => {
      const match = item.name.match(defaultNamePattern);
      if (!match) {
        return acc;
      }

      return Math.max(acc, Number(match[1]));
    }, 0);

    return `${UI_LABELS.COLLECTION.DEFAULT_PLAYLIST_PREFIX}${
      maxCurrentNumber + 1
    }`;
  }

  private getQueueCollection(): CollectionEntity | undefined {
    return this.collections.find(
      (collection) =>
        collection.isSystem &&
        collection.name === CollectionsService.QUEUE_NAME,
    );
  }

  private decorateEntriesWithPlaybackSource(
    entries: Entry[],
    sourceCollectionId: string,
  ): void {
    entries.forEach((entry) => {
      entry.extensions = {
        ...(entry.extensions ?? {}),
        'continue-watching': {
          sourceCollectionId,
        },
      };
    });
  }

  private decorateEntriesWithRemoveAction(
    entries: Entry[],
    collectionId: string,
    cloudEventsUrl: string,
  ): void {
    entries.forEach((entry) => {
      const removeActions = new ActionsBuilder({})
        .sendCloudEvent({
          url: cloudEventsUrl,
          type: CLOUD_EVENT_TYPES.COLLECTION_REMOVE,
          subject: 'remove_item_from_collection',
          data: {
            collectionId,
            itemId: entry.id,
          },
        })
        .refreshComponent()
        .build().extensions.tap_actions.actions;

      entry.extensions = {
        ...(entry.extensions ?? {}),
        // Collection screen should only expose remove action for items.
        entry_action: [
          {
            button: { alias: 'remove_item' },
            dismiss_on_action: true,
            actions: removeActions,
          },
        ],
      };
    });
  }

  private cloudEventsUrl(baseUrl?: string): string {
    return `${baseUrl}${CollectionsService.CLOUD_EVENTS_PATH}`;
  }

  private isQueueAlias(idOrAlias: string): boolean {
    return idOrAlias.trim().toLowerCase() === CollectionsService.QUEUE_ALIAS;
  }

  private findCollectionByIdOrAlias(
    idOrAlias: string,
  ): CollectionEntity | undefined {
    if (this.isQueueAlias(idOrAlias)) {
      return this.getQueueCollection();
    }

    return this.collections.find((collection) => collection.id === idOrAlias);
  }

  private toFeedEntry(
    collection: CollectionEntity,
    cloudEventsUrl: string,
    itemId?: string,
    baseUrl?: string,
    isCollectionMode?: boolean,
  ): CollectionEntry {
    const isQueue = collection.name === CollectionsService.QUEUE_NAME;

    // Build cell tap actions for selector mode (item_id / collection_id).
    const tapActions = new ActionsBuilder({});
    if (itemId) {
      const isMember = collection.itemIds.includes(itemId);
      tapActions
        .sendCloudEvent({
          url: cloudEventsUrl,
          type: isCollectionMode
            ? CLOUD_EVENT_TYPES.COLLECTION_ADD_COLLECTION
            : isMember
              ? CLOUD_EVENT_TYPES.COLLECTION_REMOVE
              : CLOUD_EVENT_TYPES.COLLECTION_ADD_ITEM,
          subject: isCollectionMode
            ? 'add_collection_to_collection'
            : isMember
              ? 'remove_item_from_collection'
              : 'add_item_to_collection',
          data: isCollectionMode
            ? { collectionId: collection.id, sourceCollectionId: itemId }
            : { collectionId: collection.id, itemId },
        })
        .refreshComponent();

      if (isCollectionMode) {
        tapActions.addAction({ type: 'dismissBottomSheet', options: {} });
      }
    }

    const builder = new EntryBuilder(tapActions, {
      id: collection.id,
      type: { value: itemId ? 'action' : 'collection' },
    })
      .setTitle(collection.name)
      .addCoverImageByAlias('collection_list')
      .addExtension('item_count', collection.itemIds.length)
      .addExtension('is_system', collection.isSystem);

    // Entry action menu (default mode only).
    if (!itemId && ((!isQueue && baseUrl) || !collection.isSystem)) {
      if (!isQueue && baseUrl) {
        const addAllActions = new ActionsBuilder({}).addAction({
          type: 'addAllToQueue',
          options: {
            url: `${baseUrl}/user/collections/${collection.id}`,
          },
        });
        builder.addEntryActionByAlias('add_all_to_queue', addAllActions, true);
      }

      if (!collection.isSystem) {
        // Edit collection: opens a bottom sheet modal (client-side, added later)
        // to remove/re-order items. Emitted as a dedicated action instead of a
        // screen navigation.
        const editActions = new ActionsBuilder({}).addAction({
          type: 'editCollection',
          options: {
            collectionId: collection.id,
            ...(baseUrl && {
              url: `${baseUrl}/user/collections/${collection.id}`,
            }),
          },
        });
        builder.addEntryActionByAlias('edit', editActions, false);

        const deleteActions = new ActionsBuilder({})
          .sendCloudEvent({
            url: cloudEventsUrl,
            type: CLOUD_EVENT_TYPES.COLLECTION_DELETE,
            subject: 'delete_collection',
            data: { collectionId: collection.id },
          })
          .refreshComponent();
        builder.addEntryActionByAlias('delete_collection', deleteActions, true);
      }
    }

    return this.finalizeEntry(builder);
  }

  /**
   * Builds an entry and removes the empty `tap_actions` block that the
   * ActionsBuilder always injects, so default-mode cells keep their native
   * (non-overridden) tap behavior.
   */
  private finalizeEntry(builder: EntryBuilder): CollectionEntry {
    const built = builder.build() as any;
    const tapActions = built.extensions?.tap_actions;
    if (
      tapActions &&
      Array.isArray(tapActions.actions) &&
      tapActions.actions.length === 0
    ) {
      delete built.extensions.tap_actions;
    }

    return built as CollectionEntry;
  }
}

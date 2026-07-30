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
import {
  EntryBuilder,
  ActionsBuilder,
  buildDynamicCollectionFeed,
  buildCollectionSelectorFeed,
} from '@lib/feed-decorators';
import { SystemCollectionEntryBuilder } from '../../builders/SystemCollectionEntryBuilder';
import { UserCollectionEntryBuilder } from '../../builders/UserCollectionEntryBuilder';

@Injectable()
export class CollectionsService implements OnModuleInit {
  private static readonly CLOUD_EVENTS_PATH = '/cloud-events';
  private static readonly DEFAULT_PLAYLIST_PREFIX = 'Playlist #';
  private static readonly YOUR_COLLECTIONS_TITLE = 'Your Collections';
  private static readonly CREATE_COLLECTION_TITLE = 'Create collection';
  private readonly logger = new Logger(CollectionsService.name);

  private collections: CollectionEntity[] = [];

  constructor(
    private readonly mediaService: MediaService,
    private readonly persistenceService: CollectionsPersistenceService,
  ) {}

  async onModuleInit() {
    this.collections =
      await this.persistenceService.loadCollections([]);

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
      (c) => c.isSystem,
    );
    const entries = systemCollections.map((collection) =>
      this.toFeedEntry(
        collection,
        cloudEventsUrl,
        undefined,
        baseUrl,
        false,
        isLoggedIn,
      ),
    );

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
    editable = false,
  ): CollectionsFeed {
    const cloudEventsUrl = this.cloudEventsUrl(baseUrl);
    if (!isLoggedIn) {
      return {
        id: randomUUID(),
        type: { value: 'feed' },
        title: CollectionsService.YOUR_COLLECTIONS_TITLE,
        entry: [],
        extensions: {
          ...(editable
            ? {
                role: 'dynamic_collection',
                dynamic_collection_options: {
                  postUrl: cloudEventsUrl,
                  operations: 'remove,reorder',
                },
              }
            : (itemId || collectionId) && {
                role: 'collection_selector',
                behavior: {
                  select_mode: itemId ? 'multi' : 'none',
                  current_selection: [],
                },
              }),
        },
      };
    }

    const collectionsToRender = (itemId || collectionId)
      ? this.collections.filter(
          (collection) => !collectionId || collection.id !== collectionId,
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

    const baseFeed = {
      id: randomUUID(),
      type: { value: 'feed' },
      title: CollectionsService.YOUR_COLLECTIONS_TITLE,
      entry: entries,
    };

    const addEventActions = this.createCreateCollectionActions(
      cloudEventsUrl,
      itemId,
      collectionId,
    ).buildActions();

    if (editable) {
      return buildDynamicCollectionFeed(baseFeed, {
        postUrl: cloudEventsUrl,
        operations: 'add,remove,reorder',
        addActions: addEventActions,
      }) as CollectionsFeed;
    }

    if (itemId || collectionId) {
      return buildCollectionSelectorFeed(baseFeed, {
        postUrl: cloudEventsUrl,
        selectMode: itemId ? 'multi' : 'none',
        currentSelection: selectedCollectionIds,
        addActions: addEventActions,
      }) as CollectionsFeed;
    }

    return baseFeed as CollectionsFeed;
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
    editable = false,
  ): Feed {
    const cloudEventsUrl = this.cloudEventsUrl(baseUrl);
    const collection = this.findCollectionByIdOrAlias(id);
    if (!collection) {
      throw new NotFoundException(`Collection ${id} was not found`);
    }

    const entries = this.mediaService.getEntriesForIds(collection.itemIds, isLoggedIn);
    this.decorateEntriesWithPlaybackSource(entries, collection.id);

    const isEditMode = editable || action === 'remove_item';

    if (isEditMode) {
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
      extensions: {
        ...(isEditMode && {
          role: 'dynamic_collection',
          dynamic_collection_options: {
            postUrl: cloudEventsUrl,
            operations: 'remove,reorder',
          },
        }),
      },
    };
  }


  private createCreateCollectionActions(
    cloudEventsUrl: string,
    itemId?: string,
    sourceCollectionId?: string,
  ): ActionsBuilder {
    return new ActionsBuilder().showTextInput({
      headerTitle: 'Create New Playlist',
      inputLabel: 'Name your playlist',
      defaultValue: '',
      buttonLabel: 'Create',
      action: {
        type: 'sendCloudEvent',
        options: {
          url: cloudEventsUrl,
          type: CLOUD_EVENT_TYPES.COLLECTION_CREATE,
          subject: 'create_collection',
          data: {
            ...(itemId && { itemId }),
            ...(sourceCollectionId && { sourceCollectionId }),
          },
        },
      },
    });
  }

  private createCreateCollectionEntry(cloudEventsUrl: string): CollectionEntry {
    const tapActions = this.createCreateCollectionActions(cloudEventsUrl)
      .refreshComponent();

    const entry = new EntryBuilder(tapActions, {
      id: 'create_collection',
      type: { value: 'action' },
    })
      .setTitle(CollectionsService.CREATE_COLLECTION_TITLE)
      .addCoverImageByAlias('create_collection')
      .addExtension('item_count', 0)
      .addExtension('is_system', false);

    return entry.build() as unknown as CollectionEntry;
  }

  async createCollection(
    name?: string,
    itemId?: string,
    sourceCollectionId?: string,
  ): Promise<CollectionEntity> {
    const trimmedName = name?.trim();
    const collectionName =
      trimmedName && trimmedName.length > 0
        ? trimmedName
        : this.nextDefaultName();

    let initialItemIds: string[] = [];
    if (itemId) {
      initialItemIds = [itemId];
    } else if (sourceCollectionId) {
      const source = this.findCollectionByIdOrAlias(sourceCollectionId);
      if (source) {
        initialItemIds = [...source.itemIds];
      }
    }

    const now = new Date().toISOString();
    const newCollection: CollectionEntity = {
      id: randomUUID(),
      name: collectionName,
      itemIds: initialItemIds,
      createdAt: now,
      updatedAt: now,
      isSystem: false,
    };

    this.collections.push(newCollection);
    await this.persistenceService.saveCollections(this.collections);
    return newCollection;
  }

  async renameCollection(id: string, name: string): Promise<CollectionEntity> {
    const collection = this.findCollectionByIdOrAlias(id);
    if (!collection) {
      throw new NotFoundException(`Collection ${id} was not found`);
    }

    if (collection.isSystem) {
      throw new BadRequestException('System collections cannot be renamed');
    }

    const trimmedName = name?.trim();
    if (!trimmedName) {
      throw new BadRequestException('Collection name cannot be empty');
    }

    collection.name = trimmedName;
    collection.updatedAt = new Date().toISOString();
    await this.persistenceService.saveCollections(this.collections);
    return collection;
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

  private nextDefaultName(): string {
    const defaultNamePattern = new RegExp(
      `^${CollectionsService.DEFAULT_PLAYLIST_PREFIX}(\\d+)$`,
    );
    const maxCurrentNumber = this.collections.reduce((acc, item) => {
      const match = item.name.match(defaultNamePattern);
      if (!match) {
        return acc;
      }

      return Math.max(acc, Number(match[1]));
    }, 0);

    return `${CollectionsService.DEFAULT_PLAYLIST_PREFIX}${
      maxCurrentNumber + 1
    }`;
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

  async updateCollectionItemOrder(
    collectionId: string,
    itemIds: string[],
  ): Promise<CollectionEntity> {
    const collection = this.findCollectionByIdOrAlias(collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} was not found`);
    }

    collection.itemIds = itemIds;
    collection.updatedAt = new Date().toISOString();
    await this.persistenceService.saveCollections(this.collections);
    return collection;
  }

  async reorderItemInCollection(
    collectionId: string,
    fromIndex: number,
    toIndex: number,
  ): Promise<CollectionEntity> {
    const collection = this.findCollectionByIdOrAlias(collectionId);
    if (!collection) {
      throw new NotFoundException(`Collection ${collectionId} was not found`);
    }

    if (
      fromIndex < 0 ||
      fromIndex >= collection.itemIds.length ||
      toIndex < 0 ||
      toIndex >= collection.itemIds.length
    ) {
      throw new BadRequestException('Invalid reorder indices');
    }

    const [movedId] = collection.itemIds.splice(fromIndex, 1);
    collection.itemIds.splice(toIndex, 0, movedId);
    collection.updatedAt = new Date().toISOString();
    await this.persistenceService.saveCollections(this.collections);
    return collection;
  }

  private decorateEntriesWithRemoveAction(
    entries: Entry[],
    collectionId: string,
    cloudEventsUrl: string,
  ): void {
    entries.forEach((entry) => {
      const removeActions = new ActionsBuilder()
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
        .build();

      const reorderActions = new ActionsBuilder()
        .sendCloudEvent({
          url: cloudEventsUrl,
          type: CLOUD_EVENT_TYPES.COLLECTION_REORDER,
          subject: 'reorder_item_in_collection',
          data: {
            collectionId,
          },
        })
        .refreshComponent()
        .build();

      entry.extensions = {
        ...(entry.extensions ?? {}),
        entry_action: [
          {
            button: { alias: 'remove_item' },
            dismiss_on_action: true,
            actions: removeActions,
          },
          {
            button: { alias: 'reorder_item' },
            dismiss_on_action: false,
            actions: reorderActions,
          },
        ],
      };
    });
  }

  private cloudEventsUrl(baseUrl?: string): string {
    return `${baseUrl}${CollectionsService.CLOUD_EVENTS_PATH}`;
  }

  private findCollectionByIdOrAlias(
    idOrAlias: string,
  ): CollectionEntity | undefined {
    return this.collections.find((collection) => collection.id === idOrAlias);
  }

  private toFeedEntry(
    collection: CollectionEntity,
    cloudEventsUrl: string,
    itemId?: string,
    baseUrl?: string,
    isCollectionMode?: boolean,
    isLoggedIn = true,
  ): CollectionEntry {
    // Build cell tap actions for selector mode (item_id / collection_id).
    const tapActions = new ActionsBuilder();
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

    let builder: EntryBuilder;
    const baseEntryData = {
      id: collection.id,
      type: { value: itemId ? 'action' : 'collection' },
    };

    if (!itemId && !collection.isSystem) {
      builder = new UserCollectionEntryBuilder(baseEntryData);
    } else if (!itemId && collection.isSystem) {
      builder = new SystemCollectionEntryBuilder(baseEntryData);
    } else {
      builder = new EntryBuilder(tapActions, baseEntryData);
    }

    builder
      .setTitle(collection.name)
      .addCoverImageByAlias('collection_list')
      .addExtension('item_count', collection.itemIds.length)
      .addExtension('is_system', collection.isSystem);

    // Entry action menu (default mode only).
    if (!itemId && (baseUrl || !collection.isSystem)) {
      if (baseUrl && builder instanceof SystemCollectionEntryBuilder) {
        // 1. Add all to Queue
        builder.addAllToQueue(baseUrl, collection.id);

        // 2. Play All
        if (collection.itemIds.length > 0) {
          const firstItemId = collection.itemIds[0];
          const firstEntryArray = this.mediaService.getEntriesForIds(
            [firstItemId],
            isLoggedIn,
          );
          if (firstEntryArray.length > 0) {
            const firstEntry = firstEntryArray[0];
            this.decorateEntriesWithPlaybackSource(
              [firstEntry],
              collection.id,
            );
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

            builder.playAll(firstEntry);
          }
        }

        // 3. Add all to Playlist
        if (isLoggedIn) {
          builder.addAllToPlaylist(baseUrl, collection.id);
        }
      }

      if (!collection.isSystem && builder instanceof UserCollectionEntryBuilder) {
        builder.editCollection(baseUrl, collection.id, collection.name);
        builder.editName(cloudEventsUrl, collection.id, collection.name);
        builder.deleteCollection(cloudEventsUrl, collection.id);
      }
    }

    return this.finalizeEntry(builder);
  }

  /**
   * Builds an entry and casts it to a CollectionEntry.
   */
  private finalizeEntry(builder: EntryBuilder): CollectionEntry {
    return builder.build() as CollectionEntry;
  }
}

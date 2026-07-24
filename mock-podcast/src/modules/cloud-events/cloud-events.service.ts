import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CollectionsService } from '../collections/collections.service';
import { CLOUD_EVENT_TYPES } from '../../constants/cloud-event-types.constants';

type CloudEventData = {
  collectionId?: string;
  itemId?: string;
  name?: string;
  videoId?: string;
  status?: string;
  sourceCollectionId?: string;
  ['continue-watching']?: {
    sourceCollectionId?: string;
  };
  continueWatching?: {
    sourceCollectionId?: string;
  };
  entry?: {
    extensions?: {
      ['continue-watching']?: {
        sourceCollectionId?: string;
      };
      continueWatching?: {
        sourceCollectionId?: string;
      };
    };
  };
};

@Injectable()
export class CloudEventsService {
  private readonly logger = new Logger(CloudEventsService.name);

  constructor(private readonly collectionsService: CollectionsService) {}

  async handleEvent(body: Record<string, unknown>) {
    const eventType = body?.type as string | undefined;
    this.logger.log(
      `Received event type="${eventType}" data=${JSON.stringify(
        body?.data ?? body,
      )}`,
    );

    const rawData = body?.data;
    let data: CloudEventData;

    if (typeof rawData === 'string') {
      try {
        data = JSON.parse(rawData) as CloudEventData;
      } catch (error) {
        this.logger.warn(
          `Invalid cloud event data JSON: ${(error as Error).message}`,
        );
        throw new BadRequestException('Invalid cloud event data payload');
      }
    } else {
      data = (rawData ?? body) as CloudEventData;
    }

    // todo: check how it actually comes and remove redundant checks
    const sourceCollectionId =
      data.sourceCollectionId ??
      data['continue-watching']?.sourceCollectionId ??
      data.continueWatching?.sourceCollectionId ??
      data.entry?.extensions?.['continue-watching']?.sourceCollectionId ??
      data.entry?.extensions?.continueWatching?.sourceCollectionId;

    if (eventType === CLOUD_EVENT_TYPES.VIDEO_STARTED && data.videoId) {
      this.logger.log(
        `Handling video started for videoId="${
          data.videoId
        }" from sourceCollectionId="${sourceCollectionId ?? 'N/A'}"`,
      );
      await this.collectionsService.handleVideoStarted(
        data.videoId,
        sourceCollectionId,
      );
    } else if (eventType === CLOUD_EVENT_TYPES.VIDEO_STOPPED && data.videoId) {
      this.logger.log(
        `Handling video stopped for videoId="${data.videoId}" with status="${
          data.status ?? 'UNKNOWN'
        }"`,
      );
      await this.collectionsService.handleVideoStopped(
        data.videoId,
        data.status,
      );
    } else if (eventType === CLOUD_EVENT_TYPES.COLLECTION_CREATE) {
      this.logger.log('Creating collection via cloud event');
      await this.collectionsService.createCollection(data.name);
    } else if (
      eventType === CLOUD_EVENT_TYPES.COLLECTION_DELETE &&
      data.collectionId
    ) {
      this.logger.log(`Deleting collectionId="${data.collectionId}"`);
      await this.collectionsService.deleteCollection(data.collectionId);
    } else if (
      (eventType === CLOUD_EVENT_TYPES.COLLECTION_ADD_COLLECTION ||
        eventType === 'com.applicaster.collection.add.collection.v1') &&
      data.collectionId &&
      data.sourceCollectionId
    ) {
      this.logger.log(
        `Adding all items from sourceCollectionId="${data.sourceCollectionId}" to collectionId="${data.collectionId}"`,
      );
      await this.collectionsService.addAllItemsToCollection(
        data.sourceCollectionId,
        data.collectionId,
      );
    } else if (data.collectionId && (data.itemId || data.sourceCollectionId || (data as any).itemIds || (data as any).fromIndex !== undefined || (data as any).from !== undefined)) {
      if (
        eventType === CLOUD_EVENT_TYPES.COLLECTION_ADD_ITEM ||
        eventType === CLOUD_EVENT_TYPES.COLLECTION_ADD ||
        eventType === 'com.applicaster.collection.add.v1'
      ) {
        if (data.sourceCollectionId) {
          this.logger.log(
            `Adding all items from sourceCollectionId="${data.sourceCollectionId}" to collectionId="${data.collectionId}"`,
          );
          await this.collectionsService.addAllItemsToCollection(
            data.sourceCollectionId,
            data.collectionId,
          );
        } else {
          this.logger.log(
            `Adding itemId="${data.itemId}" to collectionId="${data.collectionId}"`,
          );
          await this.collectionsService.addItemToCollection(
            data.collectionId,
            data.itemId!,
          );
        }
      } else if (eventType === CLOUD_EVENT_TYPES.COLLECTION_REMOVE && data.itemId) {
        this.logger.log(
          `Removing itemId="${data.itemId}" from collectionId="${data.collectionId}"`,
        );
        await this.collectionsService.removeItemFromCollection(
          data.collectionId,
          data.itemId,
        );
      } else if (
        (eventType === CLOUD_EVENT_TYPES.COLLECTION_REORDER ||
          eventType === 'com.applicaster.collection.reorder.v1') &&
        data.collectionId
      ) {
        if (
          Array.isArray((data as any).itemIds) &&
          (data as any).itemIds.length > 0
        ) {
          this.logger.log(
            `Updating item order for collectionId="${data.collectionId}" to ${JSON.stringify(
              (data as any).itemIds,
            )}`,
          );
          await this.collectionsService.updateCollectionItemOrder(
            data.collectionId,
            (data as any).itemIds,
          );
        } else if (
          typeof ((data as any).fromIndex ?? (data as any).from) === 'number' &&
          typeof ((data as any).toIndex ?? (data as any).to) === 'number'
        ) {
          const fromIndex = ((data as any).fromIndex ?? (data as any).from)!;
          const toIndex = ((data as any).toIndex ?? (data as any).to)!;
          this.logger.log(
            `Reordering item fromIndex="${fromIndex}" toIndex="${toIndex}" in collectionId="${data.collectionId}"`,
          );
          await this.collectionsService.reorderItemInCollection(
            data.collectionId,
            fromIndex,
            toIndex,
          );
        }
      } else if (data.itemId) {
        this.logger.log(
          `Toggling itemId="${data.itemId}" in collectionId="${data.collectionId}"`,
        );
        await this.collectionsService.toggleItemInCollection(
          data.collectionId,
          data.itemId,
        );
      }
    } else {
      this.logger.warn(
        `Unsupported or incomplete event data: ${JSON.stringify(data)}`,
      );
    }

    return {
      specversion: '1.0',
      type: CLOUD_EVENT_TYPES.EVENT_RECEIVED,
      source: 'podcast-server',
      subject: 'Event was successfully received',
      id: randomUUID(),
      time: new Date().toISOString(),
    };
  }
}

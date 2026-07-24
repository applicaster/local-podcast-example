import { CloudEventsService } from './cloud-events.service';
import { BadRequestException } from '@nestjs/common';

describe('CloudEventsService', () => {
  const collectionsService = {
    handleVideoStarted: jest.fn(async () => undefined),
    handleVideoStopped: jest.fn(async () => undefined),
    createCollection: jest.fn(async () => undefined),
    addItemToCollection: jest.fn(async () => undefined),
    addAllItemsToCollection: jest.fn(async () => undefined),
    removeItemFromCollection: jest.fn(async () => undefined),
    deleteCollection: jest.fn(async () => undefined),
    renameCollection: jest.fn(async () => undefined),
    toggleItemInCollection: jest.fn(async () => undefined),
  };

  let service: CloudEventsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CloudEventsService(collectionsService as any);
  });

  it('routes video.started event and extracts sourceCollectionId from continue-watching payload', async () => {
    await service.handleEvent({
      type: 'com.applicaster.video.started.v1',
      data: {
        videoId: 'retro',
        'continue-watching': {
          sourceCollectionId: 'playlist-1',
        },
      },
    });

    expect(collectionsService.handleVideoStarted).toHaveBeenCalledWith(
      'retro',
      'playlist-1',
    );
  });

  it('routes video.stopped event with status', async () => {
    await service.handleEvent({
      type: 'com.applicaster.video.stopped.v1',
      data: {
        videoId: 'retro',
        status: 'COMPLETED',
      },
    });

    expect(collectionsService.handleVideoStopped).toHaveBeenCalledWith(
      'retro',
      'COMPLETED',
    );
  });

  it('routes collection add item event', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.add.item.v1',
      data: {
        collectionId: 'queue',
        itemId: 'retro',
      },
    });

    expect(collectionsService.addItemToCollection).toHaveBeenCalledWith(
      'queue',
      'retro',
    );
    expect(collectionsService.removeItemFromCollection).not.toHaveBeenCalled();
    expect(collectionsService.toggleItemInCollection).not.toHaveBeenCalled();
  });

  it('routes collection add collection event', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.add.collection.v1',
      data: {
        collectionId: 'playlist-1',
        sourceCollectionId: 'system_jazz',
      },
    });

    expect(collectionsService.addAllItemsToCollection).toHaveBeenCalledWith(
      'system_jazz',
      'playlist-1',
    );
  });

  it('routes collection create event', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.create.v1',
      data: {
        name: 'My Playlist',
      },
    });

    expect(collectionsService.createCollection).toHaveBeenCalledWith(
      'My Playlist',
    );
  });

  it('routes collection rename event', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.rename.v1',
      data: {
        collectionId: 'playlist-123',
        name: 'Renamed Playlist',
      },
    });

    expect(collectionsService.renameCollection).toHaveBeenCalledWith(
      'playlist-123',
      'Renamed Playlist',
    );
  });

  it('routes collection remove event', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.remove.v1',
      data: {
        collectionId: 'queue',
        itemId: 'retro',
      },
    });

    expect(collectionsService.removeItemFromCollection).toHaveBeenCalledWith(
      'queue',
      'retro',
    );
    expect(collectionsService.addItemToCollection).not.toHaveBeenCalled();
    expect(collectionsService.toggleItemInCollection).not.toHaveBeenCalled();
  });

  it('routes collection delete event', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.delete.v1',
      data: {
        collectionId: 'playlist-1',
      },
    });

    expect(collectionsService.deleteCollection).toHaveBeenCalledWith(
      'playlist-1',
    );
    expect(collectionsService.addItemToCollection).not.toHaveBeenCalled();
    expect(collectionsService.removeItemFromCollection).not.toHaveBeenCalled();
    expect(collectionsService.toggleItemInCollection).not.toHaveBeenCalled();
  });

  it('defaults to toggle for collection event payloads with unknown type', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.toggle.v1',
      data: {
        collectionId: 'queue',
        itemId: 'retro',
      },
    });

    expect(collectionsService.toggleItemInCollection).toHaveBeenCalledWith(
      'queue',
      'retro',
    );
  });

  it('returns CloudEvents ack response', async () => {
    const response = await service.handleEvent({
      type: 'com.applicaster.collection.toggle.v1',
      data: {
        collectionId: 'queue',
        itemId: 'slay',
      },
    });

    expect(response.specversion).toBe('1.0');
    expect(response.type).toBe('com.applicaster.event.received.v1');
    expect(response.source).toBe('podcast-server');
    expect(response.subject).toBe('Event was successfully received');
    expect(response.id).toEqual(expect.any(String));
    expect(response.time).toEqual(expect.any(String));
  });

  it('supports sourceCollectionId nested under entry.extensions', async () => {
    await service.handleEvent({
      type: 'com.applicaster.video.started.v1',
      data: {
        videoId: 'plaza',
        entry: {
          extensions: {
            'continue-watching': {
              sourceCollectionId: 'queue',
            },
          },
        },
      },
    });

    expect(collectionsService.handleVideoStarted).toHaveBeenCalledWith(
      'plaza',
      'queue',
    );
  });

  it('throws BadRequestException for invalid stringified event data', async () => {
    await expect(
      service.handleEvent({
        type: 'com.applicaster.collection.toggle.v1',
        data: 'not-json',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(collectionsService.toggleItemInCollection).not.toHaveBeenCalled();
    expect(collectionsService.removeItemFromCollection).not.toHaveBeenCalled();
    expect(collectionsService.handleVideoStarted).not.toHaveBeenCalled();
    expect(collectionsService.handleVideoStopped).not.toHaveBeenCalled();
  });
});

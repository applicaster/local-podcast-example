import { CloudEventsService } from './cloud-events.service';
import { BadRequestException } from '@nestjs/common';

describe('CloudEventsService', () => {
  const collectionsService = {
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

  it('handles video.started event without throwing', async () => {
    const res = await service.handleEvent({
      type: 'com.applicaster.video.started.v1',
      data: {
        videoId: 'retro',
        'continue-watching': {
          sourceCollectionId: 'playlist-1',
        },
      },
    });

    expect(res.type).toBe('com.applicaster.event.received.v1');
  });

  it('handles video.stopped event without throwing', async () => {
    const res = await service.handleEvent({
      type: 'com.applicaster.video.stopped.v1',
      data: {
        videoId: 'retro',
        status: 'COMPLETED',
      },
    });

    expect(res.type).toBe('com.applicaster.event.received.v1');
  });

  it('routes collection add item event', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.add.item.v1',
      data: {
        collectionId: 'playlist-1',
        itemId: 'retro',
      },
    });

    expect(collectionsService.addItemToCollection).toHaveBeenCalledWith(
      'playlist-1',
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
        sourceCollectionId: 'system_gsc',
      },
    });

    expect(collectionsService.addAllItemsToCollection).toHaveBeenCalledWith(
      'system_gsc',
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
      undefined,
      undefined,
    );
  });

  it('routes collection create event with itemId and sourceCollectionId', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.create.v1',
      data: {
        name: 'Triggered Playlist',
        itemId: 'retro',
        sourceCollectionId: 'src-123',
      },
    });

    expect(collectionsService.createCollection).toHaveBeenCalledWith(
      'Triggered Playlist',
      'retro',
      'src-123',
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
        collectionId: 'playlist-1',
        itemId: 'retro',
      },
    });

    expect(collectionsService.removeItemFromCollection).toHaveBeenCalledWith(
      'playlist-1',
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
        collectionId: 'playlist-1',
        itemId: 'retro',
      },
    });

    expect(collectionsService.toggleItemInCollection).toHaveBeenCalledWith(
      'playlist-1',
      'retro',
    );
  });

  it('returns CloudEvents ack response', async () => {
    const response = await service.handleEvent({
      type: 'com.applicaster.collection.toggle.v1',
      data: {
        collectionId: 'playlist-1',
        itemId: 'slay',
      },
    });

    expect(response).toMatchObject({
      specversion: '1.0',
      type: 'com.applicaster.event.received.v1',
      source: 'podcast-server',
    });
  });

  it('handles stringified json payload', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.toggle.v1',
      data: JSON.stringify({
        collectionId: 'playlist-1',
        itemId: 'slay',
      }),
    });

    expect(collectionsService.toggleItemInCollection).toHaveBeenCalledWith(
      'playlist-1',
      'slay',
    );
  });

  it('throws BadRequestException for invalid JSON payload', async () => {
    await expect(
      service.handleEvent({
        type: 'com.applicaster.collection.toggle.v1',
        data: '{invalid-json',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('handles flat event payloads where data fields exist at root level', async () => {
    await service.handleEvent({
      type: 'com.applicaster.collection.add.v1',
      collectionId: 'playlist-1',
      sourceCollectionId: 'playlist-2',
    });

    expect(collectionsService.addAllItemsToCollection).toHaveBeenCalledWith(
      'playlist-2',
      'playlist-1',
    );
  });
});

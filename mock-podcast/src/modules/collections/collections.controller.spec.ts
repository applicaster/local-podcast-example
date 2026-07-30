import { UnauthorizedException } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CloudEventsController } from '../cloud-events/cloud-events.controller';
import { MediaController } from '../media/media.controller';

describe('Controllers Authorization Checks', () => {
  let collectionsController: CollectionsController;
  let cloudEventsController: CloudEventsController;
  let mediaController: MediaController;

  const mockCollectionsService: any = {
    getCollectionsFeed: jest.fn((itemId, baseUrl, collectionId, isLoggedIn) => ({
      entry: isLoggedIn ? [{ id: 'col-1' }] : [],
    })),
    getSystemCollectionsFeed: jest.fn((baseUrl, isLoggedIn) => ({
      entry: [{ id: 'system_gsc' }],
    })),
    createCollection: jest.fn((name) => ({ id: 'new-col', name })),
    deleteCollection: jest.fn((id) => ({ deleted: true, id })),
  };

  const mockCloudEventsService: any = {
    handleEvent: jest.fn(async () => ({ status: 'ok' })),
  };

  const mockMediaService: any = {
    getRadioFeed: jest.fn((baseUrl, isLoggedIn) => ({
      entry: isLoggedIn
        ? [{ id: 'radio-1', actions: ['add_to_playlist', 'add_to_queue'] }]
        : [{ id: 'radio-1', actions: ['add_to_queue'] }],
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    collectionsController = new CollectionsController(mockCollectionsService);
    cloudEventsController = new CloudEventsController(mockCloudEventsService);
    mediaController = new MediaController(mockMediaService);
  });

  describe('CollectionsController', () => {
    it('returns empty feed for GET /user/collections when unauthenticated', () => {
      const unauthReq = { headers: {} } as any;
      const res = collectionsController.getCollections(
        undefined,
        undefined,
        undefined,
        undefined,
        unauthReq,
      );

      expect(mockCollectionsService.getCollectionsFeed).toHaveBeenCalledWith(
        undefined,
        'https://localhost:3000',
        undefined,
        false,
        false,
      );
      expect(res.entry).toEqual([]);
    });

    it('returns user collections for GET /user/collections when authenticated', () => {
      const authReq = { headers: { authorization: 'Bearer my-token' } } as any;
      const res = collectionsController.getCollections(
        undefined,
        undefined,
        undefined,
        undefined,
        authReq,
      );

      expect(mockCollectionsService.getCollectionsFeed).toHaveBeenCalledWith(
        undefined,
        'https://localhost:3000',
        undefined,
        true,
        false,
      );
      expect(res.entry).toHaveLength(1);
    });

    it('throws UnauthorizedException on POST /user/collections when unauthenticated', () => {
      const unauthReq = { headers: {} } as any;

      expect(() =>
        collectionsController.createCollection(unauthReq, { name: 'Test' }),
      ).toThrow(UnauthorizedException);
    });

    it('creates collection on POST /user/collections when authenticated', () => {
      const authReq = { headers: { authorization: 'Bearer my-token' } } as any;
      const res = collectionsController.createCollection(authReq, {
        name: 'Test',
      });

      expect(res).toEqual({ id: 'new-col', name: 'Test' });
    });

    it('throws UnauthorizedException on DELETE /user/collections/:id when unauthenticated', () => {
      const unauthReq = { headers: {} } as any;

      expect(() =>
        collectionsController.deleteCollection(unauthReq, 'col-1'),
      ).toThrow(UnauthorizedException);
    });

    it('deletes collection on DELETE /user/collections/:id when authenticated', () => {
      const authReq = { headers: { authorization: 'Bearer my-token' } } as any;
      const res = collectionsController.deleteCollection(authReq, 'col-1');

      expect(res).toEqual({ deleted: true, id: 'col-1' });
    });
  });

  describe('CloudEventsController', () => {
    it('throws UnauthorizedException on POST /cloud-events when unauthenticated', async () => {
      const unauthReq = { headers: {} } as any;

      await expect(
        cloudEventsController.handleCloudEvent(unauthReq, {}),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('handles event on POST /cloud-events when authenticated', async () => {
      const authReq = { headers: { authorization: 'Bearer my-token' } } as any;
      const res = await cloudEventsController.handleCloudEvent(authReq, {});

      expect(res).toEqual({ status: 'ok' });
    });
  });

  describe('MediaController', () => {
    it('passes isLoggedIn=false for GET /media/collections/radio when unauthenticated', () => {
      const unauthReq = { headers: {} } as any;
      mediaController.getRadioCollection(undefined, unauthReq);

      expect(mockMediaService.getRadioFeed).toHaveBeenCalledWith(
        'https://localhost:3000',
        false,
      );
    });

    it('passes isLoggedIn=true for GET /media/collections/radio when authenticated', () => {
      const authReq = {
        headers: { authorization: 'Bearer valid-token' },
      } as any;
      mediaController.getRadioCollection(undefined, authReq);

      expect(mockMediaService.getRadioFeed).toHaveBeenCalledWith(
        'https://localhost:3000',
        true,
      );
    });
  });
});

import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentRoute, isUserLoggedIn } from '../../utils';
import { CollectionsService } from './collections.service';


@Controller('user/collections')
export class CollectionsController {
  private readonly logger = new Logger(CollectionsController.name);

  constructor(private readonly collectionsService: CollectionsService) {}

  /**
   * GET /user/collections
   * 
   * Retrieves custom user collections or selector feeds.
   * 
   * @param itemId Optional track ID for "selector mode" (`GET /user/collections?item_id=<id>`), returning collections with `role: "collection_selector"`.
   * @param collectionId Optional collection ID filter.
   * @param editable Optional flag (`editable=true`) to tag collections with `role: "dynamic_collection"` for editable list views.
   * @returns Standard Zapp DSP Feed containing user collections.
   */
  @Get()
  getCollections(
    @Query('item_id') itemId?: string,
    @Query('collection_id') collectionId?: string,
    @Query('editable') editable?: string,
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    const loggedIn = isUserLoggedIn(req);
    return this.collectionsService.getCollectionsFeed(
      itemId,
      cleanBaseUrl,
      collectionId,
      loggedIn,
      editable === 'true',
    );
  }

  /**
   * GET /user/collections/system
   * 
   * Retrieves read-only preloaded system collections (e.g. curated playlists).
   * 
   * @returns Standard Zapp DSP Feed containing system collections.
   */
  @Get('system')
  getSystemCollections(
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    const loggedIn = isUserLoggedIn(req);
    return this.collectionsService.getSystemCollectionsFeed(
      cleanBaseUrl,
      loggedIn,
    );
  }

  /**
   * GET /user/collections/:collectionId/play_next/:itemId
   * 
   * Retrieves remaining tracks in collection `:collectionId` after `:itemId` for continuous playback chaining (`play_next_feed_url`).
   * 
   * @param collectionId Target collection ID.
   * @param itemId Current track ID.
   * @returns Standard Zapp DSP Feed with remaining tracks.
   */
  @Get(':collectionId/play_next/:itemId')
  getPlayNextItem(
    @Param('collectionId') collectionId: string,
    @Param('itemId') itemId: string,
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    const loggedIn = isUserLoggedIn(req);
    return this.collectionsService.getPlayNextFeed(
      collectionId,
      itemId,
      cleanBaseUrl,
      loggedIn,
    );
  }

  /**
   * GET /user/collections/:id
   * 
   * Retrieves a single collection feed by ID.
   * 
   * @param id Collection ID.
   * @param action Optional action filter (e.g. `remove_item`).
   * @param editable Optional flag (`editable=true`) to enable `role: "dynamic_collection"` with `operations: "remove,reorder"`.
   * @returns Standard Zapp DSP Feed for the single collection.
   */
  @Get(':id')
  getCollectionById(
    @Param('id') id: string,
    @Query('action') action?: string,
    @Query('editable') editable?: string,
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    const loggedIn = isUserLoggedIn(req);
    return this.collectionsService.getCollectionFeedById(
      id,
      action,
      cleanBaseUrl,
      loggedIn,
      editable === 'true',
    );
  }

  /**
   * POST /user/collections
   * 
   * Creates a new custom user collection. Requires Bearer Token.
   * 
   * @param body Payload `{ name?: string }`.
   * @returns Newly created collection object.
   */
  @Post()
  createCollection(
    @Req() req: Request,
    @Body() body: Record<string, any>,
  ) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    if (body?.specversion && body?.type) {
      this.logger.warn(
        `Ignoring cloud event mistakenly sent to collections endpoint (type="${body.type}"). ` +
          `The event should be handled by /cloud-events.`,
      );

      throw new Error(
        'Ignoring cloud event mistakenly sent to collections endpoint',
      );
    }

    return this.collectionsService.createCollection(body?.name);
  }

  /**
   * DELETE /user/collections/:id
   * 
   * Deletes a custom collection by ID. Protected system collections cannot be deleted.
   * Requires Bearer Token.
   * 
   * @param id Collection ID to delete.
   */
  @Delete(':id')
  deleteCollection(@Req() req: Request, @Param('id') id: string) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    return this.collectionsService.deleteCollection(id);
  }

  private extractBaseUrl(baseUrl?: string, req?: Request): string | undefined {
    if (!baseUrl && !req) {
      return undefined;
    }

    const url = baseUrl || '';
    try {
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch {
      if (req) {
        const protocol = req.protocol || 'https';
        const host =
          (typeof req.get === 'function'
            ? req.get('host')
            : (req.headers?.['host'] as string)) || 'localhost:3000';
        return `${protocol}://${host}`;
      }
      return undefined;
    }
  }
}

/**
 * Controller for system collection feeds.
 */
@Controller('system/collections')
export class SystemCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  /**
   * GET /system/collections
   * 
   * Retrieves read-only preloaded system collections.
   */
  @Get()
  getSystemCollections(
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    const loggedIn = isUserLoggedIn(req);
    return this.collectionsService.getSystemCollectionsFeed(
      cleanBaseUrl,
      loggedIn,
    );
  }

  private extractBaseUrl(baseUrl?: string, req?: Request): string | undefined {
    if (!baseUrl && !req) {
      return undefined;
    }

    const url = baseUrl || '';
    try {
      const urlObj = new URL(url);
      return urlObj.origin;
    } catch {
      if (req) {
        const protocol = req.protocol || 'https';
        const host = req.get('host') || 'localhost:3000';
        return `${protocol}://${host}`;
      }
      return undefined;
    }
  }
}

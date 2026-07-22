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

  @Get()
  getCollections(
    @Query('item_id') itemId?: string,
    @Query('collection_id') collectionId?: string,
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
    );
  }

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

  @Get(':id')
  getCollectionById(
    @Param('id') id: string,
    @Query('action') action?: string,
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
    );
  }

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
      // Return just the origin (protocol + host)
      return urlObj.origin;
    } catch {
      // Fallback: if baseUrl is not a full URL, try to construct from request
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

@Controller('system/collections')
export class SystemCollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

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

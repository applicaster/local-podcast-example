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
} from '@nestjs/common';
import { Request } from 'express';
import { CurrentRoute } from '@lib/utils';
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
    return this.collectionsService.getCollectionsFeed(itemId, cleanBaseUrl, collectionId);
  }

  @Get('system')
  getSystemCollections(
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    return this.collectionsService.getSystemCollectionsFeed(cleanBaseUrl);
  }

  @Get(':collectionId/play_next/:itemId')
  getPlayNextItem(
    @Param('collectionId') collectionId: string,
    @Param('itemId') itemId: string,
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    return this.collectionsService.getPlayNextFeed(collectionId, itemId, cleanBaseUrl);
  }

  @Get(':id')
  getCollectionById(
    @Param('id') id: string,
    @Query('action') action?: string,
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    return this.collectionsService.getCollectionFeedById(
      id,
      action,
      cleanBaseUrl,
    );
  }

  @Post()
  createCollection(@Body() body: Record<string, any>) {
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
  deleteCollection(@Param('id') id: string) {
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
        const host = req.get('host') || 'localhost:3000';
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
    return this.collectionsService.getSystemCollectionsFeed(cleanBaseUrl);
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

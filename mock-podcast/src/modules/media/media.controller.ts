import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentRoute } from '@lib/utils';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('collections/radio')
  getRadioCollection(
    @CurrentRoute() baseUrl?: string,
    @Req() req?: Request,
  ) {
    const cleanBaseUrl = this.extractBaseUrl(baseUrl, req);
    return this.mediaService.getRadioFeed(cleanBaseUrl);
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

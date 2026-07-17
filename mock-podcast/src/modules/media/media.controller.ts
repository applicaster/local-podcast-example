import { Controller, Get } from '@nestjs/common';
import { MediaService } from './media.service';

@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('collections/radio')
  getRadioCollection() {
    return this.mediaService.getRadioFeed();
  }
}

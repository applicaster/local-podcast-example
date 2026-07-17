import { Body, Controller, Post } from '@nestjs/common';
import { CloudEventsService } from './cloud-events.service';

@Controller('cloud-events')
export class CloudEventsController {
  constructor(private readonly cloudEventsService: CloudEventsService) {}

  @Post()
  async handleCloudEvent(@Body() body: Record<string, any>) {
    return this.cloudEventsService.handleEvent(body);
  }
}

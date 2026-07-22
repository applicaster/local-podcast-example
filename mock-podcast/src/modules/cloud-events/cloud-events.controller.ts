import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { isUserLoggedIn } from '../../utils';
import { CloudEventsService } from './cloud-events.service';

@Controller('cloud-events')
export class CloudEventsController {
  constructor(private readonly cloudEventsService: CloudEventsService) {}

  @Post()
  async handleCloudEvent(
    @Req() req: Request,
    @Body() body: Record<string, any>,
  ) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    return this.cloudEventsService.handleEvent(body);
  }
}

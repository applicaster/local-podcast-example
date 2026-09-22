import {
  Controller,
  Get,
  Param,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { isUserLoggedIn } from '../../utils';
import { GroupingsService } from './groupings.service';

@Controller('groupings')
export class GroupingsController {
  constructor(private readonly groupings: GroupingsService) {}

  /**
   * GET /groupings/<anything>
   *
   * Mirrors the customer's `CMS/groupings/<anything>`, so a feed url changes
   * host and nothing else. Mature entries are gated behind the owner's PIN for
   * every other profile.
   */
  @Get('*')
  async getGrouping(@Param('0') path: string, @Req() req: Request) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    return this.groupings.getFeed(path, req);
  }
}

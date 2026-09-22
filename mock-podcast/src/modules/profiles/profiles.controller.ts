import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { isUserLoggedIn } from '../../utils';
import { ProfilesService } from './profiles.service';

@Controller('viewer-profiles')
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  /**
   * GET /viewer-profiles
   *
   * The customer's own profile list, proxied and rewritten: `has_pin` comes
   * from this server's PIN store, a protected profile is gated behind its own
   * PIN, and `type` becomes `action` so the cell does not navigate twice.
   *
   * `?mode=manage` answers the same list for the Manage Profiles screen: the
   * tiles edit a profile rather than enter one (BR-4). A flag rather than a
   * second feed, so the rule about who may manage whom stays on the server.
   */
  @Get()
  async getProfilesFeed(@Req() req?: Request, @Query('mode') mode?: string) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    return this.profilesService.getProfilesFeed(req, mode);
  }
}

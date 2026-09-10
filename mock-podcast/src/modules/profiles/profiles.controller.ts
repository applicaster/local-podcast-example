import { Controller, Get, Req, UnauthorizedException } from '@nestjs/common';
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
   */
  @Get()
  async getProfilesFeed(@Req() req?: Request) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    return this.profilesService.getProfilesFeed(req);
  }
}

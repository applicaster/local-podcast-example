import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import {
  CurrentRoute,
  getProfileFromRequest,
  isUserLoggedIn,
} from '../../utils';
import { ProfilesFormService } from './profiles.form.service';

/**
 * Served at `/profiles/form`, not under `/viewer-profiles`, because that is the
 * path the client asks for — it mirrors the customer's own `CMS/profiles/form`.
 * A dev override hid the difference locally by replacing the whole url;
 * deployed there was nothing to hide it, and the request 404ed.
 */
@Controller('profiles')
export class ProfilesFormController {
  constructor(
    private readonly formService: ProfilesFormService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * GET /profiles/form?profile=<id>
   *
   * The customer's own profile edit form, proxied from their backend with one
   * control added: resetting that profile's PIN.
   *
   * The profile arrives in the query because the real form does not take one
   * — it is served the same for every profile and finds out which one it is
   * editing from screen state. Naming it here is what lets the reset button
   * be built server-side, with a real id rather than a token the screen may
   * or may not publish.
   */
  @Get('form')
  async getProfileForm(
    @Query('profile') profile?: string,
    @CurrentRoute() currentRoute?: string,
    @Req() req?: Request,
  ) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    return this.formService.getForm(
      getProfileFromRequest(req, profile),
      req,
      this.cloudEventsUrl(currentRoute, req),
    );
  }

  /**
   * Same rule as the PIN feeds: the PUBLIC url, so the client finds it in
   * `pipes_endpoints` and attaches the bearer token. Redirecting it to the
   * mock is the dev override's job.
   */
  private cloudEventsUrl(currentRoute?: string, req?: Request): string {
    const configured = this.configService?.get(
      '@lib/mock-podcast.config.cloudEventsUrl',
    );

    if (typeof configured === 'string' && configured) {
      return configured;
    }

    try {
      return `${new URL(currentRoute || '').origin}/cloud-events`;
    } catch {
      const protocol = req?.protocol || 'https';
      const host =
        (typeof req?.get === 'function' ? req.get('host') : undefined) ||
        'localhost:3000';

      return `${protocol}://${host}/cloud-events`;
    }
  }
}

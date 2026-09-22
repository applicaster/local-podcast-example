import {
  Controller,
  Get,
  Logger,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { getProfileFromRequest, isUserLoggedIn } from '../../utils';
import { PinService } from '../pin/pin.service';
import { ProfilesRepository } from './profiles.repository';

/** Placeholders until the customer's own wording arrives (BR-3). */
export const OWNER_LABEL = 'Manage Profiles';
export const CHILD_LABEL = 'Manage Profile';

@Controller('profiles')
export class ProfilesManageController {
  private readonly logger = new Logger(ProfilesManageController.name);

  constructor(
    private readonly pinService: PinService,
    private readonly profiles: ProfilesRepository,
  ) {}

  /**
   * GET /profiles/manage-entry
   *
   * The way into Manage Profiles, and the only place a code is asked for on
   * that journey (NR-2). One entry, whose label and whose chain both follow
   * the profile in session — which is why a static button cannot do this job:
   * it can carry neither.
   *
   * Plural for the owner, singular for a child. One manages everybody, the
   * other manages only itself.
   */
  @Get('manage-entry')
  getManageEntry(@Req() req?: Request) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    const viewer = getProfileFromRequest(req);
    const isOwner = !!viewer && viewer === this.profiles.ownerId();
    const gated = this.pinService.hasPin(viewer);

    this.logger.log(
      `Manage entry for ${
        viewer ? `profile="${viewer}"` : 'an unnamed viewer'
      }: ${isOwner ? 'the account owner' : 'not the owner'}, ${
        gated ? 'asking for their PIN' : 'no PIN to ask for'
      }`,
    );

    return {
      id: 'manage-profiles-entry-feed',
      title: OWNER_LABEL,
      type: { value: 'feed' },
      entry: [
        {
          id: 'manage-profiles',
          title: isOwner ? OWNER_LABEL : CHILD_LABEL,
          type: { value: 'action' },
          extensions: {
            tap_actions: { actions: this.actions(viewer, gated) },
          },
        },
      ],
    };
  }

  /**
   * The gate, then the screen.
   *
   * `purpose: "manage"` is what separates this from unlocking a profile to
   * watch as: the same event, verified the same way, but only one of the two
   * is a claim of authority. Without the marker, entering your own profile
   * would quietly buy the right to rewrite everybody's PIN.
   *
   * A profile with no PIN is sent straight through. There is no code to ask
   * for, and a gate nobody can pass is not security — it is a door with no
   * key behind it (BR-3).
   */
  private actions(viewer: string, gated: boolean): unknown[] {
    const open = {
      type: 'navigateToScreen',
      options: {
        typeMapping: 'profiles-manage',
        navigationAction: 'push',
      },
    };

    if (!gated) {
      return [open];
    }

    return [
      {
        type: 'pinCode',
        options: {
          typeMapping: 'parent-lock',
          flow: 'verify-pin',
          cloudEventPayload: { profile: viewer, purpose: 'manage' },
        },
      },
      open,
    ];
  }
}

import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ActionsBuilder } from '@lib/feed-decorators';
import {
  CurrentRoute,
  getProfileFromRequest,
  isUserLoggedIn,
} from '../../utils';
import { CLOUD_EVENT_TYPES } from '../../constants/cloud-event-types.constants';
import { PinService } from './pin.service';
import { ProfilesRepository } from '../profiles/profiles.repository';
import { buildResetActions, RESET_EMAIL_MESSAGE } from './pin.actions';

const configModule = '@lib/mock-podcast';

@Controller('pin')
export class PinController {
  constructor(
    private readonly pinService: PinService,
    private readonly configService: ConfigService,
    private readonly profiles: ProfilesRepository,
  ) {}

  /**
   * Where a feed tells the client to post its cloud events.
   *
   * Must be the PUBLIC url, not this server's own: the client looks it up in
   * `pipes_endpoints` to attach the bearer token and the profile header, and
   * a localhost url matches no endpoint — the request would go out bare and
   * come back 401. Redirecting it to the mock is the dev override's job, a
   * layer below this one.
   *
   * Falls back to the request's origin, which is right for curl and for a
   * mock reached directly.
   */
  private cloudEventsUrl(currentRoute?: string, req?: Request): string {
    const configured = this.configService?.get(
      `${configModule}.config.cloudEventsUrl`,
    );

    return typeof configured === 'string' && configured
      ? configured
      : `${this.baseUrl(currentRoute, req)}/cloud-events`;
  }
  /**
   * GET /pin/actions?profile=<id>
   *
   * The PIN actions that apply to a profile right now: "set" while it is
   * unprotected, "change" / "disable" / "forgot" once it is. Action shapes
   * follow docs/feed-examples.json in quick-brick-parent-lock.
   *
   * The profile names whose PIN is being managed, so a master profile asks
   * for a child's actions by passing the child's id.
   */
  @Get('actions')
  getPinActionsFeed(
    @Query('profile') profile?: string,
    @CurrentRoute() currentRoute?: string,
    @Req() req?: Request,
  ) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    const profileKey = getProfileFromRequest(req, profile);
    const cloudEventsUrl = this.cloudEventsUrl(currentRoute, req);

    const owner = this.profiles.ownerId();

    const entry = this.pinService.hasPin(profileKey)
      ? [
          this.pinFlowEntry('change-pin', 'Change PIN', profileKey),
          this.disableEntry(profileKey, cloudEventsUrl),
          // Reset belongs to Manage Profiles and has its own feed below. It
          // is offered here too because the app has no Manage Profiles screen
          // yet, and this is the only surface a tester can reach. It opens no
          // hole: the chain asks for the OWNER's PIN, so the profile looking
          // at its own settings cannot get through it alone.
          ...(owner
            ? [this.resetEntry(profileKey, owner, cloudEventsUrl)]
            : []),
          this.forgotEntry(profileKey, cloudEventsUrl),
        ]
      : [this.pinFlowEntry('set-pin', 'Set PIN', profileKey)];

    return {
      id: 'pin-actions-feed',
      title: 'PIN Actions',
      type: { value: 'pin-actions-feed' },
      entry,
    };
  }

  /**
   * GET /pin/actions/manage?profile=<id>
   *
   * What the ACCOUNT OWNER may do to another profile, as opposed to what a
   * profile may do to itself. A separate route rather than a flag on the
   * other one: the two answer different questions, and a forgotten query
   * parameter would quietly hand the wrong buttons to the wrong person.
   *
   * The target may be any profile, child or adult — the requirements limit
   * who authorises a reset, not who can be reset. Empty when the fixture has
   * no owner: with nobody holding parental authority there is nothing to
   * offer.
   */
  @Get('actions/manage')
  getManageActionsFeed(
    @Query('profile') profile?: string,
    @CurrentRoute() currentRoute?: string,
    @Req() req?: Request,
  ) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    const target = getProfileFromRequest(req, profile);
    const owner = this.profiles.ownerId();

    return {
      id: 'pin-manage-actions-feed',
      title: 'Manage PIN',
      type: { value: 'pin-actions-feed' },
      entry: owner
        ? [
            this.resetEntry(
              target,
              owner,
              this.cloudEventsUrl(currentRoute, req),
            ),
          ]
        : [],
    };
  }

  /**
   * Reset, as one entry of an actions feed. The chain itself is shared with
   * the profile form — see {@link buildResetActions}.
   */
  private resetEntry(profile: string, owner: string, cloudEventsUrl: string) {
    const actions = buildResetActions({
      target: profile,
      owner,
      ownerHasPin: this.pinService.hasPin(owner),
      cloudEventsUrl,
    });

    return {
      // The requirements treat giving a profile its first PIN and replacing
      // one it already has as a single parental right, so this is one entry
      // that renames itself rather than two that behave identically.
      id: 'reset-pin',
      title: this.pinService.hasPin(profile) ? 'Reset PIN' : 'Set PIN',
      type: { value: 'action' },
      extensions: { tap_actions: { actions } },
    };
  }

  /** A bare pinCode flow entry — the client drives the whole exchange. */
  private pinFlowEntry(flow: string, title: string, profile: string) {
    const actions = new ActionsBuilder()
      .addAction({
        type: 'pinCode',
        options: {
          typeMapping: 'parent-lock',
          flow,
          cloudEventPayload: { profile },
        },
      })
      // The feed's own contents depend on whether a PIN exists, so every
      // action that can change that has to refresh the component it sits in.
      .refreshComponent()
      .build();

    return {
      id: flow,
      title,
      type: { value: 'action' },
      extensions: { tap_actions: { actions } },
    };
  }

  /**
   * Disabling needs no flow of its own: the existing verify-pin flow collects
   * and checks the current code, and a cancelled pinCode stops the action
   * chain — so the cloud event below is only ever reached once the PIN was
   * entered correctly.
   */
  private disableEntry(profile: string, cloudEventsUrl: string) {
    const actions = new ActionsBuilder()
      .confirmDialog({
        title: 'Disable PIN?',
        message:
          'Content will no longer be protected. You will need the current PIN to continue.',
        okButtonText: 'Disable',
        cancelButtonText: 'Cancel',
      })
      .addAction({
        type: 'pinCode',
        options: {
          typeMapping: 'parent-lock',
          flow: 'verify-pin',
          cloudEventPayload: { profile },
        },
      })
      .sendCloudEvent({
        url: cloudEventsUrl,
        type: CLOUD_EVENT_TYPES.PIN_CODE_CHANGE,
        subject: 'disable_pin',
        data: { step: 'disable', profile },
      })
      .refreshComponent()
      .build();

    return {
      id: 'disable-pin',
      title: 'Disable PIN',
      type: { value: 'action' },
      extensions: { tap_actions: { actions } },
    };
  }

  /**
   * "Forgot PIN" — asks the account to be emailed a way back in.
   *
   * No confirmation and no PIN entry: not knowing the code is the premise, so
   * there is nothing to prove and nothing to confirm. The mock has no mail
   * server and sets a known code instead, which is why this is a test rig and
   * not the product.
   */
  private forgotEntry(profile: string, cloudEventsUrl: string) {
    const actions = new ActionsBuilder()
      .sendCloudEvent({
        url: cloudEventsUrl,
        type: CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED,
        subject: 'recover_pin_code',
        data: { profile },
      })
      .showToast(RESET_EMAIL_MESSAGE, {
        id: 'pin_reset_email_sent',
        timeout: 3000,
      })
      // Nothing here changes whether a PIN exists, so this refresh is the one
      // in the feed that cannot alter what comes back. It stays for the sake
      // of the rule — every action in this feed ends by refreshing — rather
      // than leaving one entry to be explained.
      .refreshComponent()
      .build();

    return {
      id: 'forgot-pin',
      title: 'Forgot PIN',
      type: { value: 'action' },
      extensions: { tap_actions: { actions } },
    };
  }

  /**
   * GET /pin/recover
   *
   * Feed for the "forgot PIN" screen, the same request the actions feed's
   * "Forgot PIN" entry makes. The reminder is emailed; the PIN stays.
   *
   * This route takes no profile of its own — it is reached from a screen, not
   * from a row — so the profile comes off the request the way it does
   * everywhere else. Without it the event would name no profile at all and
   * ask about the app-wide PIN instead of the one the user is looking at.
   */
  @Get('recover')
  getRecoveryFeed(@CurrentRoute() currentRoute?: string, @Req() req?: Request) {
    if (!isUserLoggedIn(req)) {
      throw new UnauthorizedException(
        'Authorization header with Bearer token is required',
      );
    }

    const cloudEventsUrl = this.cloudEventsUrl(currentRoute, req);
    const profile = getProfileFromRequest(req);

    const actions = new ActionsBuilder()
      .sendCloudEvent({
        url: cloudEventsUrl,
        type: CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED,
        subject: 'recover_pin_code',
        data: { profile },
      })
      .build();

    return {
      id: 'recover-pin-code-feed',
      title: 'Recover Pin Code',
      type: { value: 'recover-pin-code-feed' },
      entry: [
        {
          id: 'recover-pin-code',
          title: 'Recover Pin Code',
          type: { value: 'action' },
          extensions: {
            tap_actions: { actions },
          },
        },
      ],
    };
  }

  private baseUrl(currentRoute?: string, req?: Request): string {
    try {
      return new URL(currentRoute || '').origin;
    } catch {
      const protocol = req?.protocol || 'https';
      const host =
        (typeof req?.get === 'function' ? req.get('host') : undefined) ||
        'localhost:3000';
      return `${protocol}://${host}`;
    }
  }
}

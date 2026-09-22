import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { buildManagePinActions } from '../pin/pin.actions';
import { PinService } from '../pin/pin.service';
import {
  buildOwnerNudge,
  buildParentalControls,
} from '../../builders/ParentalControlsBuilder';
import { ProfilesRepository } from './profiles.repository';
import { UpstreamService } from './upstream.service';

const configModule = '@lib/mock-podcast';

/** Where the real form lives when nothing is configured. */
export const DEFAULT_PROFILES_FORM_URL =
  'https://api-qa.aio.focusonthefamily.com/CMS/profiles/form';

type FormProperty = {
  id?: string;
  [key: string]: unknown;
};

type ProfileForm = {
  properties?: FormProperty[];
  body?: { properties?: FormProperty[] };
  [key: string]: unknown;
};

/**
 * The profile edit form, fetched from the real backend and patched on the way
 * through.
 *
 * The form is the customer's, not ours: it carries their avatar picker, their
 * field validation and their save action, and none of that is worth
 * reproducing. So the mock proxies it and adds the one control the real
 * backend does not have yet — resetting the profile's PIN.
 *
 * The proxy has to be transparent about credentials. The upstream authorises
 * per account and per viewer, so the request goes out with the same
 * Authorization and X-VIEWER-ID the client sent us; forging either is not
 * possible and inventing a service token would test the wrong thing.
 */
@Injectable()
export class ProfilesFormService {
  private readonly logger = new Logger(ProfilesFormService.name);

  constructor(
    private readonly upstream: UpstreamService,
    private readonly configService: ConfigService,
    private readonly pinService: PinService,
    private readonly profiles: ProfilesRepository,
  ) {}

  async getForm(
    profile: string,
    req: Request | undefined,
  ): Promise<ProfileForm> {
    if (!profile) {
      this.logger.warn(
        `Profile form carries no profile — the PIN button will have no target`,
      );
    }

    const form = await this.upstream.get<ProfileForm>(
      `Profile form profile="${profile || '-'}"`,
      this.upstreamUrl(),
      req,
    );

    return profile ? this.withManagePinButton(form, profile) : form;
  }

  /**
   * Splices the reset control in before the form's own buttons, so Save and
   * Cancel stay together as the pair the user expects at the bottom.
   *
   * A form the upstream shaped differently is passed through untouched rather
   * than guessed at: a button appended to a structure we did not recognise
   * would land somewhere unpredictable, and losing the button is a smaller
   * failure than corrupting the form.
   */
  private withManagePinButton(form: ProfileForm, profile: string): ProfileForm {
    // The upstream has been seen both ways — `properties` at the top level and
    // wrapped in `body` — so the patch finds the array wherever it is and puts
    // the form back together the same shape it arrived in.
    const nestedProperties = form?.body?.properties;
    const nested = Array.isArray(nestedProperties);
    const properties = nested ? nestedProperties : form?.properties;

    if (!Array.isArray(properties)) {
      this.logger.warn(
        `Profile form has no properties array — serving it unpatched`,
      );

      return form;
    }

    const owner = this.profiles.ownerId();

    if (!owner) {
      this.logger.warn(
        `No profile carries master — the form gets no PIN button, since nobody could authorise it`,
      );

      return form;
    }

    const button = this.managePinButton(profile, owner);
    const section = this.parentalControls(profile, owner);
    const firstButton = properties.findIndex(
      (property) => property.type === 'button',
    );
    const at = firstButton === -1 ? properties.length : firstButton;
    const patched = [
      ...properties.slice(0, at),
      ...section,
      button,
      ...properties.slice(at),
    ];

    this.logger.log(
      `Profile form patched for profile="${profile || '-'}" at index ${at}: "${
        button.options.title
      }" and ${section.length} parental-control field(s)`,
    );

    return nested
      ? { ...form, body: { ...form.body, properties: patched } }
      : { ...form, properties: patched };
  }

  /**
   * The section the customer's form does not have yet.
   *
   * On the owner's own profile it is a nudge instead: restrictions belong to a
   * child's profile, and an owner restricting themselves protects nobody.
   * Everywhere else it is the five permissions, ticked from what the profile
   * list says the profile is denied.
   */
  private parentalControls(
    profile: string,
    owner: string,
  ): Record<string, unknown>[] {
    if (profile === owner) {
      return buildOwnerNudge(
        this.copy('ownerParentalControlsNote') || undefined,
      );
    }

    return buildParentalControls(this.profiles.entryOf(profile));
  }

  /** Placeholder copy is ours to guess; a configured string wins. */
  private copy(key: string): string {
    const configured = this.configService?.get(`${configModule}.config.${key}`);

    return typeof configured === 'string' ? configured : '';
  }

  private managePinButton(profile: string, owner: string) {
    const actions = buildManagePinActions({
      target: profile,
      targetName: this.profiles.nameOf(profile),
      owner,
      ownerName: this.profiles.nameOf(owner),
      ownerHasPin: this.pinService.hasPin(owner),
      // A feed re-reads itself after a PIN changes; this form shows nothing
      // that depends on one, so there is nothing to refresh.
      refresh: false,
    });

    return {
      id: 'buttonManagePin',
      // Presets are presentation only — the form's own Cancel carries its
      // behaviour in tap_actions, not in its preset — so borrowing this one
      // styles the control without inheriting anything from Save.
      preset: 'FormButtonSave',
      type: 'button',
      options: {
        title: this.pinService.hasPin(profile) ? 'Change PIN' : 'Set PIN',
        extensions: { tap_actions: { actions } },
      },
    };
  }

  private upstreamUrl(): string {
    const configured = this.configService?.get(
      `${configModule}.config.profilesFormUrl`,
    );

    return typeof configured === 'string' && configured
      ? configured
      : DEFAULT_PROFILES_FORM_URL;
  }
}

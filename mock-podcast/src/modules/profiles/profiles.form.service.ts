import { HttpException, Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';
import { buildResetActions } from '../pin/pin.actions';
import { PinService } from '../pin/pin.service';
import { ProfilesRepository } from './profiles.repository';

const configModule = '@lib/mock-podcast';

/** Where the real form lives when nothing is configured. */
export const DEFAULT_PROFILES_FORM_URL =
  'https://api-qa.aio.focusonthefamily.com/CMS/profiles/form';

/**
 * Headers the upstream needs, named exactly as the Zapp endpoint config
 * produces them: `quick-brick-login-flow.access_token` as a bearer header and
 * `user_account.profile` mapped to `X-VIEWER-ID`. They are forwarded verbatim
 * rather than rebuilt — the mock has no account and could not mint either.
 */
const FORWARDED_HEADERS = ['authorization', 'x-viewer-id', 'accept'] as const;

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
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    private readonly pinService: PinService,
    private readonly profiles: ProfilesRepository,
  ) {}

  async getForm(
    profile: string,
    req: Request | undefined,
    cloudEventsUrl: string,
  ): Promise<ProfileForm> {
    const url = this.upstreamUrl();
    const headers = this.forwardedHeaders(req);

    this.logger.log(
      `Profile form requested profile="${
        profile || '-'
      }" upstream="${url}" headers=[${Object.keys(headers).join(', ')}]`,
    );

    if (!profile) {
      this.logger.warn(
        `Profile form carries no profile — the reset button will have no target`,
      );
    }

    const form = await this.fetch(url, headers);

    return this.withResetButton(form, profile, cloudEventsUrl);
  }

  private async fetch(
    url: string,
    headers: Record<string, string>,
  ): Promise<ProfileForm> {
    try {
      const response = await firstValueFrom(
        this.http.get<ProfileForm>(url, { headers }),
      );

      this.logger.log(
        `Profile form upstream answered status=${response.status}`,
      );

      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status ?? 502;

      // Answering with the upstream's own status matters: a 401 here means
      // the token the client sent was refused, and turning that into a 500
      // would send whoever is debugging looking in the wrong place.
      this.logger.warn(
        `Profile form upstream failed status=${status} message="${axiosError.message}"`,
      );

      throw new HttpException(
        axiosError.response?.data || 'Profile form upstream failed',
        status,
      );
    }
  }

  /**
   * Only these headers travel. Copying the whole set would forward the
   * client's Host and content negotiation for a different server, and the
   * upstream reads nothing else from us.
   */
  private forwardedHeaders(req?: Request): Record<string, string> {
    const headers: Record<string, string> = {};

    for (const name of FORWARDED_HEADERS) {
      const value = req?.headers?.[name];

      if (typeof value === 'string' && value) {
        headers[name] = value;
      }
    }

    return headers;
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
  private withResetButton(
    form: ProfileForm,
    profile: string,
    cloudEventsUrl: string,
  ): ProfileForm {
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
        `No profile carries master — the form gets no reset button, since nobody could authorise it`,
      );

      return form;
    }

    const button = this.resetButton(profile, owner, cloudEventsUrl);
    const firstButton = properties.findIndex(
      (property) => property.type === 'button',
    );
    const at = firstButton === -1 ? properties.length : firstButton;
    const patched = [
      ...properties.slice(0, at),
      button,
      ...properties.slice(at),
    ];

    this.logger.log(
      `Profile form patched: "${button.options.title}" for profile="${
        profile || '-'
      }" at index ${at}`,
    );

    return nested
      ? { ...form, body: { ...form.body, properties: patched } }
      : { ...form, properties: patched };
  }

  private resetButton(profile: string, owner: string, cloudEventsUrl: string) {
    const actions = buildResetActions({
      target: profile,
      owner,
      ownerHasPin: this.pinService.hasPin(owner),
      cloudEventsUrl,
      // A feed re-reads itself after a PIN changes; this form shows nothing
      // that depends on one, so there is nothing to refresh.
      refresh: false,
    });

    return {
      id: 'buttonResetPin',
      // Presets are presentation only — the form's own Cancel carries its
      // behaviour in tap_actions, not in its preset — so borrowing this one
      // styles the control without inheriting anything from Save.
      preset: 'FormButtonSave',
      type: 'button',
      options: {
        title: this.pinService.hasPin(profile) ? 'Reset PIN' : 'Set PIN',
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

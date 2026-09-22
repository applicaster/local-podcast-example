import {
  HttpException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PinService } from '../pin/pin.service';
import {
  ProfileEntry,
  ProfilesFeed,
  ProfilesRepository,
} from './profiles.repository';
import { UpstreamService } from './upstream.service';
import { getProfileFromRequest } from '../../utils';
import { buildForgotActions } from '../pin/pin.actions';
import { buildFormData } from '../../builders/ParentalControlsBuilder';

const configModule = '@lib/mock-podcast';

/** Placeholder until the customer's own wording arrives (BR-P3). */
export const FORGOT_PIN_TEXT = 'Forgot your PIN?';

/** Placeholder until the customer's own wording arrives (§4). */
export const DEFAULT_PROFILE_PIN_PROMPT = 'Enter the PIN for {profile}';

/** What a child is told for tapping somebody else's tile (BR-4). */
export const MANAGE_DENIED_TITLE = 'Not your profile';
export const MANAGE_DENIED_MESSAGE =
  'Only the account owner can manage other profiles.';

/** Where the real profile list lives when nothing is configured. */
export const DEFAULT_PROFILES_FEED_URL =
  'https://api-qa.aio.focusonthefamily.com/CMS/profiles/select';

/**
 * The viewer profiles feed: the customer's own list, rewritten on the way
 * through.
 *
 * It is proxied rather than reproduced. A profile renamed through their form
 * is renamed in their backend, and a fixture would keep showing the old name;
 * proxying keeps the two feeds telling the same story. Their avatars and
 * denied actions are theirs and travel untouched.
 *
 * Five things are rewritten, and only these:
 *
 * - `has_pin`, answered from this mock's PIN store rather than from upstream,
 *   which knows nothing about it;
 * - `tap_actions`, gated behind that profile's own PIN when it has one;
 * - the entry's own `sessionStorageSet` inside those actions, which gains the
 *   profile's name and avatar;
 * - `finishHook` inside those actions, replaced by `goHome` — every other
 *   action in the chain is left alone;
 * - `type.value`, `profile` to `action` — see below.
 *
 * When the upstream cannot be reached the fixture stands in, so the stand
 * keeps working without network. That is a fallback, not the source.
 */
@Injectable()
export class ProfilesService implements OnModuleInit {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly pinService: PinService,
    private readonly repository: ProfilesRepository,
    private readonly upstream: UpstreamService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Nothing is seeded. A profile starts unprotected, which is what a fresh
   * account looks like and what lets the whole flow be exercised from the
   * beginning: set a PIN, verify it, change it, turn it off, forget it.
   *
   * Handing out default codes made the first two steps unreachable.
   */
  onModuleInit(): void {
    this.logger.log(
      `Serving ${
        this.repository.profileIds().length
      } profile(s); PINs start unset`,
    );
  }

  /** The feed as the client should see it right now. */
  async getProfilesFeed(req?: Request, mode?: string): Promise<ProfilesFeed> {
    const feed = await this.load(req);
    const viewer = getProfileFromRequest(req);
    // The same list answering a different question: not "who is watching" but
    // "whose settings am I about to change" (BR-4).
    const managing = mode === 'manage';
    const owner = managing ? this.repository.ownerId() : '';

    // Said out loud because the difference is invisible otherwise: with no
    // viewer the list is served as it always was, and a tile that should have
    // skipped its PIN asks for one. That is an endpoint missing the
    // `user_account.profile` header, not this rewrite.
    this.logger.log(
      viewer
        ? `Serving the profile list to viewer "${viewer}"`
        : `Serving the profile list to an unnamed viewer — no profile header on this request; it carried [${Object.keys(
            req?.headers || {},
          ).join(', ')}]`,
    );

    return {
      ...feed,
      entry: feed.entry.map((entry) => {
        const profile = String(entry.id);
        const hasPin = this.pinService.hasPin(profile);
        // Re-selecting the profile you are already in is not entering
        // anything, so it asks for nothing (§4 of the requirements). The tile
        // still says it has a PIN — the lock icon is about the profile, not
        // about this tap.
        const gated = !managing && hasPin && profile !== viewer;

        return {
          ...entry,
          // A profile cell runs its tap actions; it must not also navigate by
          // its own type. `profile` is mapped to a screen, so the client both
          // ran the chain — which ends at the home screen — and pushed the
          // mapped screen on top of it, landing the user on home twice.
          //
          // `action` is what the client's own feed decorators set for exactly
          // this: an entry that acts rather than leads somewhere. The upstream
          // sends `profile`, which is the thing this rewrite is asking them to
          // change.
          type: { value: 'action' },
          extensions: {
            ...(entry.extensions || {}),
            has_pin: hasPin,
            // What a lock badge reads. The cell style shows its locked badge
            // on a falsy value and its unlocked one on a truthy value, so a
            // protected profile has to say `false` here — `has_pin` alone
            // would put an open padlock on exactly the profiles that are shut.
            unlocked: !hasPin,
            // The profile form declares its fields and carries none of their
            // values: the screen fills itself from the entry that navigated to
            // it. So the permission checkboxes are ticked from here, by the
            // tile the parent tapped, and not by the form they land on.
            form_data: {
              ...((entry.extensions?.form_data as object) || {}),
              ...buildFormData(entry),
            },
            tap_actions: {
              actions: managing
                ? this.manageTapActions(entry, profile, viewer, owner)
                : this.tapActions(entry, profile, gated),
            },
          },
        };
      }),
    };
  }

  /**
   * The customer's list, or what we already had when their backend is down.
   *
   * Only an unreachable backend falls back — a timeout, a refused connection,
   * a 5xx. The mock exists to keep the client testable, and refusing to serve
   * profiles because a QA environment is down would stop the work it supports.
   *
   * A refusal is passed through instead. A 401 means the token the client sent
   * was rejected, and answering it with a profile list would hide that from
   * whoever is debugging and hand profiles to a caller who just failed to
   * authenticate.
   */
  private async load(req?: Request): Promise<ProfilesFeed> {
    try {
      const feed = await this.upstream.get<ProfilesFeed>(
        'Viewer profiles',
        this.upstreamUrl(),
        req,
      );

      this.repository.cache(feed);

      return this.repository.getFeed();
    } catch (error) {
      const status =
        error instanceof HttpException ? error.getStatus() : undefined;

      if (status && status < 500) {
        throw error;
      }

      this.logger.warn(
        `Upstream unreachable (${
          status ?? 'no status'
        }), serving the cached or fixture profile list`,
      );

      return this.repository.getFeed();
    }
  }

  private upstreamUrl(): string {
    const configured = this.configService?.get(
      `${configModule}.config.profilesFeedUrl`,
    );

    return typeof configured === 'string' && configured
      ? configured
      : DEFAULT_PROFILES_FEED_URL;
  }

  /**
   * A protected profile is entered by verifying THAT profile's own PIN, so
   * the check goes in front of the session actions: the chain ends when the
   * code is wrong or the user backs out, and the session is never written.
   *
   * Gating belongs here, in the feed, rather than in a client-side decorator
   * — the server is the only side that knows whether a PIN exists, and it
   * knows it per profile rather than for the first cell in the list.
   *
   * No `purpose` on this one: entering a profile is not parental authority,
   * and marking it as such would open the management window on every unlock.
   */
  /**
   * The same tile, for changing a profile rather than entering one (BR-4).
   *
   * No `pinCode` in front of it: the code was asked for at the manage button
   * and asking again is what NR-3 forbids. No `goHome` at the end either —
   * that ends the chain for someone who has just chosen a profile to watch as,
   * and would close the screen a parent has only just opened.
   *
   * The profile's own `sessionStorageSet` is kept, and it is the load-bearing
   * part: it makes the tapped profile the active one, which is what the form
   * opening next reads as its subject (§6, Addition 1). Drop it and the parent
   * stays active while the child's name is on the screen.
   */
  private manageTapActions(
    entry: ProfileEntry,
    profile: string,
    viewer: string,
    owner: string,
  ): unknown[] {
    if (viewer && viewer !== profile && viewer !== owner) {
      return [
        {
          type: 'showAlert',
          options: {
            title: MANAGE_DENIED_TITLE,
            message: MANAGE_DENIED_MESSAGE,
            okButtonText: 'OK',
          },
        },
      ];
    }

    const becomeActive = this.withProfileDetails(entry).filter(
      (action) => (action as { type?: string })?.type !== 'goHome',
    );

    return [
      ...becomeActive,
      {
        type: 'navigateToScreen',
        options: {
          typeMapping: 'profile-edit',
          navigationAction: 'push',
          entry,
        },
      },
    ];
  }

  private tapActions(
    entry: ProfileEntry,
    profile: string,
    gated: boolean,
  ): unknown[] {
    const existing = this.withProfileDetails(entry);

    if (!gated) {
      return existing;
    }

    return [
      {
        type: 'pinCode',
        options: {
          typeMapping: 'parent-lock',
          flow: 'verify-pin',
          cloudEventPayload: { profile },
          // §4 asks the prompt to name the profile. The configured string is
          // one for the whole app, so only the feed can say whose code this
          // is; a client without the option ignores it and shows the
          // configured text.
          promptText: this.promptFor(entry),
          ...this.forgotOptions(profile),
        },
      },
      ...existing,
    ];
  }

  /**
   * The way off the PIN screen for someone who does not have the code
   * (BR-P3). Nothing here proves who the person is, which is the point: not
   * knowing the code is the premise, and the reminder goes to the account's
   * own address.
   *
   * Offered only when events have somewhere to go — without a cloud events
   * url there is no recovery to offer, and a button that does nothing is
   * worse than no button.
   */
  private forgotOptions(profile: string): Record<string, unknown> {
    const cloudEventsUrl = this.configService?.get(
      `${configModule}.config.cloudEventsUrl`,
    );

    if (typeof cloudEventsUrl !== 'string' || !cloudEventsUrl) {
      return {};
    }

    return {
      forgotText: FORGOT_PIN_TEXT,
      forgotActions: buildForgotActions({ profile, cloudEventsUrl }),
    };
  }

  /** "Enter the PIN for Jamie", or the plain wording for a nameless profile. */
  private promptFor(entry: ProfileEntry): string {
    const name = typeof entry.title === 'string' ? entry.title.trim() : '';
    const configured = this.configService?.get(
      `${configModule}.config.profilePinPrompt`,
    );
    const template =
      typeof configured === 'string' && configured
        ? configured
        : DEFAULT_PROFILE_PIN_PROMPT;

    return name
      ? template.replace('{profile}', name)
      : template.replace(' for {profile}', '');
  }

  /**
   * Adds the profile's name and avatar to what selecting it persists.
   *
   * The write carries only the id today, and an id renders as nothing: the
   * navigation's profile button shows the active profile's avatar, and other
   * screens show its name, on every screen and after a restart. Resolving them
   * by re-fetching the list would put a network round trip on screens that
   * need none, and would fail exactly when it matters — offline, or before the
   * list has been fetched in this session.
   *
   * The values come from the entry itself, so what is stored is exactly what
   * the list displayed. Anything already in `user_account` is kept.
   */
  private withProfileDetails(entry: ProfileEntry): unknown[] {
    const existing =
      (entry.extensions?.tap_actions as { actions?: unknown[] })?.actions || [];

    return existing.map((action) => {
      const step = action as {
        type?: string;
        options?: { content?: Record<string, unknown> };
      };
      const options = step?.options;
      const content = options?.content;
      const account = content?.user_account as
        Record<string, unknown> | undefined;

      // The list is not always presented as a hook, and finishHook on a screen
      // that is not one has nothing to finish. goHome ends the chain either way.
      if (step?.type === 'finishHook') {
        return { type: 'goHome' };
      }

      // The action is recognised by what it already writes, not merely by its
      // type. A chain may hold more than one `sessionStorageSet`, and one that
      // writes a different namespace must come through untouched — adding a
      // `user_account` it never had would be inventing state, not carrying it.
      if (
        step?.type !== 'sessionStorageSet' ||
        !options ||
        !content ||
        !account
      ) {
        return action;
      }

      return {
        ...step,
        options: {
          ...options,
          content: {
            ...content,
            user_account: {
              ...account,
              profile_name: entry.title,
              profile_avatar: this.avatarUrl(entry),
            },
          },
        },
      };
    });
  }

  /** The entry's own `image_base`, or an empty string when it has none. */
  private avatarUrl(entry: ProfileEntry): string {
    const groups = (entry.media_group || []) as Array<{
      media_item?: Array<{ key?: string; src?: string }>;
    }>;

    for (const group of groups) {
      const item = (group.media_item || []).find(
        (media) => media?.key === 'image_base',
      );

      if (item?.src) {
        return item.src;
      }
    }

    return '';
  }

  profileIds(): string[] {
    return this.repository.profileIds();
  }
}

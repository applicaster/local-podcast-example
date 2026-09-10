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

const configModule = '@lib/mock-podcast';

/** Where the real profile list lives when nothing is configured. */
export const DEFAULT_PROFILES_FEED_URL =
  'https://api-qa.aio.focusonthefamily.com/CMS/profiles/select';

/**
 * The viewer profiles feed: the customer's own list, rewritten on the way
 * through.
 *
 * It is proxied rather than reproduced. A profile renamed through their form
 * is renamed in their backend, and a fixture would keep showing the old name;
 * proxying keeps the two feeds telling the same story. Their avatars, denied
 * actions and session actions are theirs and travel untouched.
 *
 * Three things are rewritten, and only these:
 *
 * - `has_pin`, answered from this mock's PIN store rather than from upstream,
 *   which knows nothing about it;
 * - `tap_actions`, gated behind that profile's own PIN when it has one;
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
  async getProfilesFeed(req?: Request): Promise<ProfilesFeed> {
    const feed = await this.load(req);

    return {
      ...feed,
      entry: feed.entry.map((entry) => {
        const profile = String(entry.id);
        const hasPin = this.pinService.hasPin(profile);

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
            tap_actions: {
              actions: this.tapActions(entry, profile, hasPin),
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
   * the check goes in front of the session actions: ActionExecutor stops the
   * chain when pinCode resolves Cancel, and the session is never written.
   *
   * Gating belongs here, in the feed, rather than in a client-side decorator
   * — the server is the only side that knows whether a PIN exists, and it
   * knows it per profile rather than for the first cell in the list.
   *
   * No `purpose` on this one: entering a profile is not parental authority,
   * and marking it as such would open the management window on every unlock.
   */
  private tapActions(
    entry: ProfileEntry,
    profile: string,
    hasPin: boolean,
  ): unknown[] {
    const existing =
      (entry.extensions?.tap_actions as { actions?: unknown[] })?.actions || [];

    if (!hasPin) {
      return existing;
    }

    return [
      {
        type: 'pinCode',
        options: {
          typeMapping: 'parent-lock',
          flow: 'verify-pin',
          cloudEventPayload: { profile },
        },
      },
      ...existing,
    ];
  }

  profileIds(): string[] {
    return this.repository.profileIds();
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PinService } from '../pin/pin.service';
import { PinSeed } from '../pin/pin.types';
import {
  ProfileEntry,
  ProfilesFeed,
  ProfilesRepository,
} from './profiles.repository';

/**
 * The viewer profiles feed, standing in for the customer's own.
 *
 * Everything about a profile is fixture data — avatars, denied actions, the
 * session tap actions — except `has_pin`, which is answered from the PIN
 * store on every request. That is the whole point of the mock: turn a PIN off
 * and this feed says so, without touching the fixture.
 */
@Injectable()
export class ProfilesService implements OnModuleInit {
  private readonly logger = new Logger(ProfilesService.name);

  constructor(
    private readonly pinService: PinService,
    private readonly repository: ProfilesRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    const seeded = await this.pinService.seedIfEmpty(this.seeds());

    if (seeded) {
      this.logger.log(`Seeded default PINs for the loaded profiles`);
    }
  }

  /** The feed as the client should see it right now. */
  getProfilesFeed(): ProfilesFeed {
    const feed = this.repository.getFeed();

    return {
      ...feed,
      entry: feed.entry.map((entry) => {
        const profile = String(entry.id);
        const hasPin = this.pinService.hasPin(profile);

        return {
          ...entry,
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

  /** The starting PIN for each profile: kids get their own default. */
  private seeds(): PinSeed[] {
    return this.repository.profileIds().map((profile) => ({
      profile,
      pinCode: this.repository.defaultPinFor(profile),
    }));
  }
}

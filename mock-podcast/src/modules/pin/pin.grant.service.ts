import { Injectable, Logger } from '@nestjs/common';

/** How long proving the owner PIN keeps authorising management. */
export const GRANT_TTL_MS = 5 * 60 * 1000;

/**
 * Short-lived proof that the account owner is the one asking.
 *
 * The requirements authorise parental actions once, on entering Manage
 * Profiles, and keep that authorisation until the user leaves (§13). This is
 * that window: verifying the owner PIN opens it, and anything carrying
 * parental authority asks whether it is still open.
 *
 * Grants live in memory only. A restart is leaving manage mode, not data
 * loss — persisting them would let a window survive the thing that opened it.
 */
@Injectable()
export class PinGrantService {
  private readonly logger = new Logger(PinGrantService.name);
  private readonly grants = new Map<string, number>();

  /** Opens (or extends) the window for a profile. */
  issue(profile: string): void {
    const expiresAt = Date.now() + GRANT_TTL_MS;
    this.grants.set(profile, expiresAt);

    this.logger.log(
      `Management grant issued to profile="${profile}" for ${
        GRANT_TTL_MS / 1000
      }s`,
    );
  }

  /** Whether the profile's window is open right now. */
  has(profile: string): boolean {
    if (!profile) {
      return false;
    }

    const expiresAt = this.grants.get(profile);

    if (expiresAt === undefined) {
      return false;
    }

    // Expiry is checked on read rather than on a timer: nothing here runs
    // between requests, and a stale entry that is never read costs nothing.
    if (expiresAt <= Date.now()) {
      this.grants.delete(profile);
      this.logger.log(`Management grant for profile="${profile}" has expired`);

      return false;
    }

    return true;
  }
}

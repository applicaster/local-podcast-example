import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';

export type ProfileEntry = {
  id: string;
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ProfilesFeed = {
  id: string;
  title: string;
  type: { value: string };
  entry: ProfileEntry[];
  [key: string]: unknown;
};

export const EMPTY_FEED: ProfilesFeed = {
  id: 'viewer-profiles',
  title: 'Viewer Profiles',
  type: { value: 'feed' },
  entry: [],
};

/** Everyone starts here, except the account owner (see below). */
export const DEFAULT_PIN = '1111';

/**
 * The account owner starts on its own code, purely so a local run can tell
 * whether a prompt is asking for parental authority or just for a profile.
 */
export const OWNER_PIN = '0000';

/**
 * Whether a profile carries account-owner authority.
 *
 * The flag's type has already changed under us once — boolean in the old
 * `CRM/v3/viewer-profiles` shape, `1`/`0` in the current `CMS/profiles/select`
 * one — so this accepts both and treats everything else as "no". A bare
 * `Boolean()` would not do: the string `"0"` is truthy in JS, and a backend
 * that starts sending strings would silently hand ownership to every profile.
 */
export const isMaster = (value: unknown): boolean =>
  value === true || value === 1 || value === '1';

/**
 * The viewer profiles fixture, read once and shared.
 *
 * It is a repository rather than part of `ProfilesService` because two
 * modules need it and they cannot both depend on each other: `ProfilesService`
 * already depends on `PinService` to answer `has_pin`, and `PinService` needs
 * to know which profile is the account owner. Loading lives here, at the
 * bottom, where both can reach it.
 */
@Injectable()
export class ProfilesRepository implements OnModuleInit {
  private readonly logger = new Logger(ProfilesRepository.name);
  private readonly filePath = path.join(
    process.cwd(),
    'data',
    'viewer-profiles.json',
  );
  private feed: ProfilesFeed = EMPTY_FEED;

  async onModuleInit(): Promise<void> {
    this.feed = this.normalize(await this.loadFeed());
    this.logger.log(`Loaded ${this.feed.entry.length} viewer profile(s)`);

    const owner = this.ownerId();
    this.logger.log(
      owner
        ? `Account owner profile is "${owner}"`
        : `No profile carries master — nobody can manage another profile PIN`,
    );
  }

  /** The fixture as loaded, without the per-request decoration. */
  getFeed(): ProfilesFeed {
    return this.feed;
  }

  profileIds(): string[] {
    return this.feed.entry.map((entry) => String(entry.id));
  }

  /**
   * The account owner: the profile whose `master` flag is set.
   *
   * Returns an empty string when there is none, which every caller reads as
   * "no parental authority exists", never as "the app-wide profile".
   */
  ownerId(): string {
    const owners = this.feed.entry.filter((entry) =>
      isMaster(entry.extensions?.master),
    );

    if (owners.length > 1) {
      this.logger.warn(
        `Expected one master profile, found ${owners.length} — using "${owners[0].id}"`,
      );
    }

    return owners.length > 0 ? String(owners[0].id) : '';
  }

  /**
   * The code a profile starts on, used only to seed an empty store.
   *
   * A profile the fixture does not know is not the owner, so it falls back to
   * the ordinary default rather than refusing and leaving nothing to set.
   */
  defaultPinFor(profile: string): string {
    return profile && profile === this.ownerId() ? OWNER_PIN : DEFAULT_PIN;
  }

  /**
   * Guards the shape wherever the feed came from.
   *
   * Deliberately at the point of assignment rather than inside `loadFeed`:
   * everything downstream maps over `entry`, so the check belongs where the
   * field is set, not on one path that happens to reach it.
   */
  private normalize(feed: ProfilesFeed): ProfilesFeed {
    if (!Array.isArray(feed?.entry)) {
      this.logger.warn(
        `Viewer profiles payload has no entry array, serving an empty feed`,
      );

      return EMPTY_FEED;
    }

    return feed;
  }

  private async loadFeed(): Promise<ProfilesFeed> {
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');

      return JSON.parse(raw) as ProfilesFeed;
    } catch (error) {
      this.logger.warn(
        `Failed to load viewer profiles from ${this.filePath}: ${
          (error as Error).message
        }`,
      );

      return EMPTY_FEED;
    }
  }
}

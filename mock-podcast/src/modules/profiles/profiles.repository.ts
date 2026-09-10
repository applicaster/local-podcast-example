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
 * What the mock currently believes the account's profiles to be.
 *
 * Two sources, in that order of preference:
 *
 * 1. the last profile list the customer's backend answered with, cached here
 *    by `ProfilesService` on every successful fetch;
 * 2. `data/viewer-profiles.json`, read once at start-up, used until the first
 *    fetch succeeds and whenever one fails.
 *
 * The cache exists because `PinService` asks `ownerId()` while handling a
 * cloud event, where there is no request to borrow credentials from — it
 * cannot go upstream itself, and the answer has to already be here.
 *
 * It is a repository rather than part of `ProfilesService` because two modules
 * need it and they cannot both depend on each other: `ProfilesService` already
 * depends on `PinService` to answer `has_pin`, and `PinService` needs to know
 * which profile is the account owner. It lives at the bottom, where both can
 * reach it.
 */
@Injectable()
export class ProfilesRepository implements OnModuleInit {
  private readonly logger = new Logger(ProfilesRepository.name);
  private readonly filePath = path.join(
    process.cwd(),
    'data',
    'viewer-profiles.json',
  );
  private fixture: ProfilesFeed = EMPTY_FEED;
  private live?: ProfilesFeed;

  async onModuleInit(): Promise<void> {
    this.fixture = this.normalize(await this.loadFeed());
    this.logger.log(
      `Loaded ${this.fixture.entry.length} viewer profile(s) from the fixture`,
    );

    const owner = this.ownerId();
    this.logger.log(
      owner
        ? `Account owner profile is "${owner}"`
        : `No profile carries master — nobody can manage another profile PIN`,
    );
  }

  /** The freshest list known, without the per-request decoration. */
  getFeed(): ProfilesFeed {
    return this.live || this.fixture;
  }

  /**
   * Remembers a list the backend just answered with.
   *
   * A malformed one is refused rather than stored: everything downstream maps
   * over `entry`, and a bad cache would outlive the request that produced it.
   */
  cache(feed: ProfilesFeed): void {
    if (!Array.isArray(feed?.entry)) {
      this.logger.warn(`Upstream profiles have no entry array — not cached`);

      return;
    }

    const owner = this.ownerIdOf(feed);
    const changed =
      !this.live ||
      this.live.entry.length !== feed.entry.length ||
      owner !== this.ownerId();

    this.live = feed;

    if (changed) {
      this.logger.log(
        `Cached ${feed.entry.length} profile(s) from upstream; owner is "${
          owner || 'none'
        }"`,
      );
    }
  }

  profileIds(): string[] {
    return this.getFeed().entry.map((entry) => String(entry.id));
  }

  /**
   * The account owner: the profile whose `master` flag is set.
   *
   * Returns an empty string when there is none, which every caller reads as
   * "no parental authority exists", never as "the app-wide profile".
   */
  ownerId(): string {
    return this.ownerIdOf(this.getFeed());
  }

  private ownerIdOf(feed: ProfilesFeed): string {
    const owners = feed.entry.filter((entry) =>
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

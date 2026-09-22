import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PinService } from '../pin/pin.service';
import { ProfilesRepository } from '../profiles/profiles.repository';
import { UpstreamService } from '../profiles/upstream.service';
import { getProfileFromRequest } from '../../utils';
import { GroupingEntryBuilder } from '../../builders/GroupingEntryBuilder';
import { buildForgotActions } from '../pin/pin.actions';

const configModule = '@lib/mock-podcast';

/** Where the customer's groupings live when nothing is configured. */
export const DEFAULT_GROUPINGS_BASE_URL =
  'https://api-qa.aio.focusonthefamily.com/CMS/groupings';

/** Placeholder until the customer's own wording arrives (BR-P3). */
export const DEFAULT_FORGOT_TEXT = 'Forgot your PIN?';

/** Placeholder until the customer's own wording arrives (BR-P1). */
export const DEFAULT_GATE_PROMPT =
  "Enter the account owner's PIN to unlock this";

/** Placeholder until the customer's own wording arrives (BR-P1). */
export const DEFAULT_LOCKED_MESSAGE =
  'This is restricted for this profile. Ask the account owner to set up a PIN to unlock it.';

/**
 * What mature content does for the viewer: open it, ask for the owner's PIN
 * (the account owner's id), or say why it cannot be opened at all.
 */
type Mode = 'open' | 'locked' | { gate: string };

type Entry = {
  id?: unknown;
  type?: { value?: string };
  link?: unknown;
  entry?: Entry[];
  extensions?: Record<string, unknown>;
  [key: string]: unknown;
};

/**
 * The customer's groupings feeds, proxied with mature content gated behind the
 * account owner's PIN for every other profile.
 *
 * The gate has to live in the feed: the server is the only side that knows who
 * owns the account and whether they hold a PIN.
 *
 * A gated entry becomes an `action` cell whose chain does the navigating
 * itself. The client runs tap actions and then pushes a non-action entry
 * without looking at how the chain ended, so a cancelled `pinCode` in front of
 * a plain entry would still open it.
 */
@Injectable()
export class GroupingsService {
  private readonly logger = new Logger(GroupingsService.name);

  constructor(
    private readonly pinService: PinService,
    private readonly profiles: ProfilesRepository,
    private readonly upstream: UpstreamService,
    private readonly configService: ConfigService,
  ) {}

  async getFeed(path: string, req: Request): Promise<Entry> {
    const feed = await this.upstream.get<Entry>(
      'Groupings',
      `${this.baseUrl()}/${path}${this.queryOf(req)}`,
      req,
    );

    const mode = this.modeFor(getProfileFromRequest(req));

    return mode === 'open' && !this.marksUnlocked()
      ? feed
      : this.gateTree(feed, mode);
  }

  /**
   * Whether an entry the viewer may open says so, rather than saying nothing.
   *
   * Off by default: the cell style shows its `unlocked_badge` on a truthy
   * value, so marking every open entry puts an open padlock on the whole
   * catalogue. Turn it on when the style is configured with one on purpose.
   */
  private marksUnlocked(): boolean {
    return (
      this.configService?.get(`${configModule}.config.markUnlockedEntries`) ===
      true
    );
  }

  /**
   * What mature content does for this viewer.
   *
   * - `open` — the viewer is the account owner, or nobody owns the account;
   * - the owner's id — ask for that PIN;
   * - `locked` — the owner has no PIN, so there is no code to ask for. A gate
   *   would be a dead end: a keypad nobody present can satisfy, since the
   *   verify fails for everyone. (On an app older than 15 it was worse than a
   *   dead end — the chain ran on past the failure and opened the episode.)
   *   The entry says why it cannot be opened instead.
   */
  private modeFor(profile: string): Mode {
    const owner = this.profiles.ownerId();

    if (!owner || profile === owner) {
      return 'open';
    }

    if (!this.pinService.hasPin(owner)) {
      this.logger.warn(
        `Mature content locked for profile="${
          profile || '-'
        }": the account owner ("${owner}") has no PIN`,
      );

      return 'locked';
    }

    return { gate: owner };
  }

  private gateTree(node: Entry, mode: Mode): Entry {
    const gated =
      !isMature(node) || mode === 'open'
        ? this.openEntry(node)
        : mode === 'locked'
          ? this.lock(node)
          : this.gate(node, (mode as { gate: string }).gate);

    return Array.isArray(gated.entry)
      ? {
          ...gated,
          entry: gated.entry.map((child) => this.gateTree(child, mode)),
        }
      : gated;
  }

  /**
   * An entry the viewer may open. Marked only when the style asks for it, and
   * only on a leaf: a row or a shelf is not something you open.
   */
  private openEntry(entry: Entry): Entry {
    if (!this.marksUnlocked() || Array.isArray(entry.entry)) {
      return entry;
    }

    return new GroupingEntryBuilder(entry).markOpen().build();
  }

  /**
   * An entry nobody can open. Everything that could still act on it goes: the
   * link, its own tap actions, and the `entry_action` buttons behind the "…"
   * menu — a locked episode must not stay addable to a queue or a playlist.
   */
  private lock(entry: Entry): Entry {
    return new GroupingEntryBuilder(entry)
      .lockWithExplanation({
        title: this.copy('lockedTitle', 'Locked'),
        message: this.copy('lockedMessage', DEFAULT_LOCKED_MESSAGE),
        okButtonText: this.copy('lockedOkButton', 'OK'),
      })
      .build();
  }

  /** Placeholder copy until the customer's own wording arrives. */
  private copy(key: string, fallback: string): string {
    const configured = this.configService?.get(`${configModule}.config.${key}`);

    return typeof configured === 'string' && configured ? configured : fallback;
  }

  private gate(entry: Entry, owner: string): Entry {
    return new GroupingEntryBuilder(entry)
      .gateBehindPin(owner, {
        promptText: this.copy('gatePrompt', DEFAULT_GATE_PROMPT),
        // The code wanted here is the owner's, so the reminder is theirs too
        // — the viewer sitting in front of the screen cannot recover it.
        ...this.forgotOptions(owner),
      })
      .build();
  }

  /** Offered only when events have somewhere to go. */
  private forgotOptions(owner: string): Record<string, unknown> {
    const cloudEventsUrl = this.configService?.get(
      `${configModule}.config.cloudEventsUrl`,
    );

    if (typeof cloudEventsUrl !== 'string' || !cloudEventsUrl) {
      return {};
    }

    return {
      forgotText: this.copy('gateForgotText', DEFAULT_FORGOT_TEXT),
      forgotActions: buildForgotActions({ profile: owner, cloudEventsUrl }),
    };
  }

  private baseUrl(): string {
    const configured = this.configService?.get(
      `${configModule}.config.groupingsBaseUrl`,
    );

    return typeof configured === 'string' && configured
      ? configured.replace(/\/+$/, '')
      : DEFAULT_GROUPINGS_BASE_URL;
  }

  private queryOf(req: Request): string {
    const url = req?.originalUrl || '';
    const index = url.indexOf('?');

    return index === -1 ? '' : url.slice(index);
  }
}

const isMature = (entry: Entry): boolean =>
  String(entry?.extensions?.sensitive_content || '').toLowerCase() === 'mature';

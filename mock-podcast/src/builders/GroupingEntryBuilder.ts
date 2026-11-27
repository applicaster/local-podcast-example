import { ActionsBuilder, EntryBuilder } from '@lib/feed-decorators';

/** What the parent lock screen says, and offers, for this gate. */
export type GateCopy = {
  promptText?: string;
  forgotText?: string;
  forgotActions?: any[];
};

export type LockedCopy = {
  title: string;
  message: string;
  okButtonText: string;
};

/**
 * An entry of a groupings feed, as the viewer's profile is allowed to see it.
 *
 * Three states, one builder: open, gated behind the account owner's PIN, or
 * locked because there is no owner PIN to ask for. What is generic — the
 * action cell, the lock badge, the actions themselves — comes from
 * `EntryBuilder` and `ActionsBuilder`; what is AIOC's own is here.
 */
export class GroupingEntryBuilder extends EntryBuilder {
  constructor(baseEntry: any) {
    // `EntryBuilder` copies the entry one level deep, so its extensions would
    // still be the upstream's own object — and every mark would be written
    // into the customer's payload rather than into our copy of it.
    super(new ActionsBuilder(), {
      ...baseEntry,
      extensions: { ...(baseEntry?.extensions || {}) },
    });
  }

  /** Says the viewer may open this, so a configured unlock badge can show. */
  markOpen(): this {
    return this.setLockBadge(true);
  }

  /**
   * Asks for the account owner's PIN, then opens the entry itself.
   *
   * The chain navigates rather than letting the cell do it, because a cell
   * navigates whatever the chain returned. An entry that is already an action
   * navigates on its own, so it only gains the PIN step.
   */
  gateBehindPin(owner: string, gate: GateCopy = {}): this {
    // The entry as it arrived, so the screen it opens is handed the original
    // rather than the action cell we are about to make of it.
    const original = {
      ...this.entry,
      extensions: { ...(this.entry.extensions || {}) },
    };
    const type = this.entry.type?.value;

    // The "…" menu runs its own actions straight from the cell, so leaving it
    // on a gated entry hands out a way around the PIN: queue it, download it,
    // never asked for a code. The copy handed to the screen keeps it, because
    // by then the code has been entered.
    delete this.entry.extensions?.entry_action;

    this.actionBuilder.pinCode({
      typeMapping: 'parent-lock',
      flow: 'verify-pin',
      cloudEventPayload: { profile: owner },
      // The screen otherwise shows one string for the whole app, which cannot
      // say that the code wanted here is the account owner's — nor offer the
      // owner a way out when they have forgotten it.
      ...gate,
    });

    this.existingTapActions().forEach((action) =>
      this.actionBuilder.addAction(action),
    );

    if (type !== 'action') {
      this.actionBuilder.navigateToScreen({
        typeMapping: type,
        navigationAction: 'push',
        entry: original,
      });

      this.asActionCell();
    }

    return this.setLockBadge(false);
  }

  /**
   * Explains why the entry cannot be opened, and leaves nothing that could
   * still act on it: the link, the tap actions and the "…" menu all go, or a
   * locked episode stays addable to a queue.
   */
  lockWithExplanation(copy: LockedCopy): this {
    delete this.entry.extensions?.entry_action;

    // A notice, not a question: `showAlert` is the one dialog with a single
    // button, and it needs QuickBrick #8807.
    this.actionBuilder.showAlert({
      title: copy.title,
      message: copy.message,
      okButtonText: copy.okButtonText,
    });

    return this.asActionCell().addExtension('locked', true).setLockBadge(false);
  }

  /**
   * The entry as the proxied feed carries it. `ZappEntry` describes what we
   * author; what travels through here is the customer's own payload, which has
   * fields of its own and must come out unchanged.
   */
  build(): Record<string, any> {
    return super.build() as Record<string, any>;
  }

  private existingTapActions(): any[] {
    return this.entry.extensions?.tap_actions?.actions || [];
  }
}

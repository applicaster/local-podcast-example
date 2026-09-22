import { Action, ActionsBuilder } from '@lib/feed-decorators';
import { CLOUD_EVENT_TYPES } from '../../constants/cloud-event-types.constants';

/**
 * Said wherever recovery is requested — the actions feed, the recover screen,
 * and the Forgot button on the PIN screen itself. Nothing else promises mail:
 * an owner setting a code types it on the spot.
 */
export const RESET_EMAIL_MESSAGE =
  'An email to set a new PIN was sent to the account.';

/**
 * What the parent lock screen offers someone who does not have the code.
 *
 * The same chain the actions feed's "Forgot PIN" entry runs, minus its
 * refresh: the screen is closing, so there is nothing left to re-read. It
 * lives here because two gates now offer it — the profile list and the gate
 * on restricted content — and the event must name the right profile in both.
 */
export function buildForgotActions({
  profile,
  cloudEventsUrl,
}: {
  profile: string;
  cloudEventsUrl: string;
}): Action[] {
  return new ActionsBuilder()
    .sendCloudEvent({
      url: cloudEventsUrl,
      type: CLOUD_EVENT_TYPES.PIN_CODE_RECOVERY_REQUESTED,
      subject: 'recover_pin_code',
      data: { profile },
    })
    .showToast(RESET_EMAIL_MESSAGE, {
      id: 'pin_reset_email_sent',
      timeout: 3000,
    })
    .build();
}

/** Placeholders until the customer's own wording arrives (BR-12). */
export const OWNER_PROMPT = "Enter the account owner's PIN";
export const SET_PROMPT = 'Set a new PIN';

export type ManagePinChainOptions = {
  /** Whose PIN is being set. */
  target: string;
  /** What to call them, so the second screen says whose code is being set. */
  targetName?: string;
  /** What to call the owner, so the first screen says whose code it wants. */
  ownerName?: string;
  /** The account owner, whose PIN authorises doing it. */
  owner: string;
  /** Whether that owner actually holds a PIN to be asked for. */
  ownerHasPin: boolean;
  /** Feeds refresh themselves; a form has nothing to re-read. */
  refresh?: boolean;
};

/**
 * What the account owner does to another profile's PIN: prove their own, then
 * type the new code.
 *
 * The requirement is that the owner *chooses* the code — "pressing it collects
 * a new 4-digit PIN and saves it" — so this is the plugin's `set-pin` flow
 * aimed at the target, not a reset to something the server picked. The old
 * chain mailed the account and left `3333` behind, which is recovery: right
 * for someone who has forgotten a code, wrong for a parent handing one out.
 *
 * Shared rather than duplicated because the same chain is offered from three
 * places, and a copy would drift — the verify step's `purpose` marker in
 * particular is easy to leave out, and without it the set that follows is an
 * unauthorised request the server refuses.
 *
 * The verify is skipped when the owner has no PIN of their own: there is no
 * code to ask for, and a step that fails for everybody would end the chain
 * before the owner reached the one they came for.
 */
export function buildManagePinActions({
  target,
  targetName,
  owner,
  ownerName,
  ownerHasPin,
  refresh = true,
}: ManagePinChainOptions): Action[] {
  const builder = new ActionsBuilder();

  if (ownerHasPin) {
    builder.addAction({
      type: 'pinCode',
      options: {
        typeMapping: 'parent-lock',
        flow: 'verify-pin',
        cloudEventPayload: { profile: owner, purpose: 'manage' },
        // Two PIN screens in a row, asking for two different codes. Without
        // this they are the same screen twice and the person types the wrong
        // one first.
        promptText: ownerName ? `${OWNER_PROMPT} (${ownerName})` : OWNER_PROMPT,
      },
    });
  }

  // The plugin collects the code twice and sends `pin.set.v1` itself, naming
  // the target — which is what makes the new PIN the child's rather than the
  // owner's.
  builder.addAction({
    type: 'pinCode',
    options: {
      typeMapping: 'parent-lock',
      flow: 'set-pin',
      cloudEventPayload: { profile: target },
      promptText: targetName ? `${SET_PROMPT} for ${targetName}` : SET_PROMPT,
    },
  });

  if (refresh) {
    builder.refreshComponent();
  }

  return builder.build();
}

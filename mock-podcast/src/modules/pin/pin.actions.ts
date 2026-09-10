import { Action, ActionsBuilder } from '@lib/feed-decorators';
import { CLOUD_EVENT_TYPES } from '../../constants/cloud-event-types.constants';

/**
 * Said wherever a PIN is reset — the actions feed and the profile form alike.
 * From the user's side both end the same way, with an email inviting them to
 * pick a new code.
 */
export const RESET_EMAIL_MESSAGE =
  'An email to set a new PIN was sent to the account.';

export type ResetChainOptions = {
  /** Whose PIN is being reset. */
  target: string;
  /** The account owner, whose PIN authorises the reset. */
  owner: string;
  /** Whether that owner actually holds a PIN to be asked for. */
  ownerHasPin: boolean;
  cloudEventsUrl: string;
  /** Feeds refresh themselves; a form has nothing to re-read. */
  refresh?: boolean;
};

/**
 * The reset chain: prove the owner's PIN, then have the server put the target
 * back to a known code.
 *
 * Shared rather than duplicated because the same chain is offered from three
 * places, and a copy would drift — the verify step's `purpose` marker in
 * particular is easy to leave out, and leaving it out silently turns the
 * whole thing into an unauthorised request.
 *
 * The verify is skipped when the owner has no PIN of their own: asking for a
 * code that does not exist protects nothing and breaks the chain, since the
 * client carries on past an `Error` and only stops on `Cancel`.
 */
export function buildResetActions({
  target,
  owner,
  ownerHasPin,
  cloudEventsUrl,
  refresh = true,
}: ResetChainOptions): Action[] {
  const builder = new ActionsBuilder();

  if (ownerHasPin) {
    builder.addAction({
      type: 'pinCode',
      options: {
        typeMapping: 'parent-lock',
        flow: 'verify-pin',
        cloudEventPayload: { profile: owner, purpose: 'manage' },
      },
    });
  }

  builder
    .sendCloudEvent({
      url: cloudEventsUrl,
      type: CLOUD_EVENT_TYPES.PIN_CODE_RESET,
      subject: 'profile_reset',
      data: { profile: target },
    })
    .showToast(RESET_EMAIL_MESSAGE, {
      id: 'pin_reset_email_sent',
      timeout: 3000,
    });

  if (refresh) {
    builder.refreshComponent();
  }

  return builder.build();
}

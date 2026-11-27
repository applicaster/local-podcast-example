# BR-P2 — Restricted content download

**Status:** Not planned for this iteration

> [!NOTE]
> **Agreed out of scope.** Downloads are not gated: an item can be downloaded without a
> PIN, and one already on the device plays without asking, since nothing on the server
> sees that moment. Playing restricted content online still asks for the account owner's
> code (BR-P1). Revisit if the product decides otherwise.

## The requirement

> When the active profile is allowed to download and the content is restricted for that
> profile, the download action prompts for the account owner's PIN. […] A successful unlock
> via play does not bypass this prompt.
> **Decision:** confirm whether an owner-PIN download unlock should also count as a play
> unlock for that item, or stay independent.

## How it works today

Nothing. Download is an app-side action from the offline plugin; the feed does not gate it.

## Backend — what the API must return

If the download control is an `entry_action` on the item (it is today — `add_to_playlist`,
`add_to_queue` are shaped that way), then the same server logic that builds the play gate
can wrap the download action in a `pinCode` step for a restricted item.

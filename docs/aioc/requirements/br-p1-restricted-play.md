# BR-P1 — Restricted content play and unlock

**Status:** Done — gated behind the owner's PIN, locked with an explanation when there is none

## The requirement

> Playing or unlocking content that is restricted for the active profile prompts for the
> account owner's PIN. If the owner has no PIN, the button reads "Locked" and explains that
> the owner PIN must be set up. Otherwise it reads "Unlock".

## How it works today

`…/groupings/*` rewrites a restricted entry into an `action` cell whose chain is
`pinCode` (owner's PIN) → `navigateToScreen` with the original entry, and drops the cell's
`link`. Cancelling leaves the user in the list; the right code opens the episode. The owner
is never gated.

With **no owner PIN** the entry is **locked** rather than open: an `action` cell with no
`link`, no tap actions of its own, `extensions.locked: true`, and a single `showAlert`
explaining that the owner must set a PIN. A `pinCode` gate would be a dead end there —
it would ask for a code nobody present can produce, and the verify fails for everyone.
The dialog copy is a **placeholder** until the customer sends their wording; it comes from
the `lockedTitle`, `lockedMessage` and `lockedOkButton` config keys.

Where it was built:

| What | PR |
|---|---|
| The gate itself — proxy `CMS/groupings/*` and rewrite a *Mature* entry into an `action` cell behind the owner's PIN | [#1489](https://github.com/applicaster/gold-customers/pull/1489) |
| The locked state when the owner has no PIN | [#1702](https://github.com/applicaster/gold-customers/pull/1702) |
| Dropping `entry_action`, so the "…" menu cannot queue a gated episode without the code | [#1705](https://github.com/applicaster/gold-customers/pull/1705) |
| `showAlert`, the one-button dialog the locked state needs | [QuickBrick #8807](https://github.com/applicaster/QuickBrick/pull/8807) |

Two differences from the requirement remain:

1. **We gate the list entry, not the play button.** The episode screen loads from
   `CMS/audio-video/<id>`, which we do not serve, so any other route to the episode — deep
   link, Continue Watching, the queue, search, Up Next — reaches it ungated.
2. **The button never renames itself.** The requirement ends *"the button reads 'Locked'…
   otherwise it reads 'Unlock'"*, and that button is on the episode screen too — so the
   same feed we do not serve is what would carry the label. A restricted episode keeps its
   usual play button. This was missed until an audit against the customer's document on
   22 Sep 2026; it is the same gap as the row above, and one decision closes both: drop
   the labels with the list-level gate, or extend the gate to the episode feed.

## Backend — what the API must return

Per entry, for the active profile, three states:

| State | When | Entry |
|---|---|---|
| open | not restricted, or the viewer is the owner | untouched |
| unlock | restricted, owner has a PIN | `type: action`, no `link`, chain `pinCode` (owner) → `navigateToScreen` |
| locked | restricted, owner has **no** PIN | `type: action`, no `link`, no other tap actions, chain is a single `showAlert` explaining that the owner must set a PIN |

The padlock on the cell is drawn by the cell style itself, from one key: **truthy means
unlocked, falsy means locked, missing means no badge**. So a restricted entry carries
`extensions.unlocked: false` and an ordinary one carries nothing. A gated cell and a locked
cell look the same — the style has one image for both — and the tap tells them apart.

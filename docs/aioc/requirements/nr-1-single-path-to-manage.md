# NR-1 — Single path to the Manage Profile screen

**Status:** **Done** — moved in Zapp on 22 Sep 2026

## The requirement

> The only way to reach the Manage Profile screen is: profile selection screen, then
> "Manage Profiles", then tap a profile tile. No menu item, deep link, or shortcut opens
> the Manage Profile screen directly.

## How it works today

Both controls sit on the profile selection screen, in the order the customer asked for:
the tiles, then **Manage Profiles**, then the PIN actions. Neither is on My Stuff any
more, so there is one way in.

## Backend — what the API must return

Nothing new.

## What the customer asked for

> Please move the Manage Profiles button from the My Stuff screen to Profile Selection
> Screen. It should be placed below all of the Profiles to select from.
>
> Please move Pin Actions from the My Stuff screen to the Profile Selection Screen. It
> should be placed below the "Manage Profiles" button.

Which settles the question this page used to ask: nothing profile-related stays on My
Stuff. The order on the selection screen is profiles, then the manage button, then the PIN
actions.

Both components move as they are, on both selection screens:

| Component | Type | Data source |
|---|---|---|
| Manage Profiles | `grid-qb` | the static feed it already uses, until §4.4 replaces it (NR-2) |
| Pin Management | `group-qb` | `…/pin/actions`, with its `group-info-qb` and `grid-qb` children |

`pipes_endpoints` needs nothing: the urls do not change, so the `user_account.profile`
context key travels with them. On the hook screen at cold start that key has no value, the
request is therefore never made, and `hide_component_if_data_is_empty` keeps the block off
the screen until a profile has been chosen — which is the behaviour the requirement wants
anyway.

# BR-3 — Manage button under the tiles

**Status:** Specified — the two labels and both chains are in the contract

## The requirement

> Active profile is the owner: the button reads "Manage Profiles". After the owner enters
> their PIN, the page switches into manage mode and any profile can be opened.
> Active profile is a child: the button reads "Manage Profile". After the child enters its
> own PIN, its own Manage Profile screen opens. A child with no PIN opens the screen
> without a prompt.

## How it works today

The button lives in My Stuff, has one label, no PIN gate, and no manage mode.

## Backend — what the API must return

The label and the chain both depend on the active profile, so both belong in the feed that
draws the button (see NR-2 for the chain):

| Active profile | Label | Chain |
|---|---|---|
| owner, has PIN | `Manage Profiles` | `pinCode` (owner, `purpose: "manage"`) → manage mode |
| owner, no PIN | `Manage Profiles` | straight to manage mode |
| child, has PIN | `Manage Profile` | `pinCode` (that child) → its own manage screen |
| child, no PIN | `Manage Profile` | straight to its own manage screen |

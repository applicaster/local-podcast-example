# BR-P5 — Offline

**Status:** Not started — nothing here is server work, and nothing was verified offline

## The requirement

> Profiles are not available offline, so the new app never prompts for a PIN while offline.
> Profile selection, profile management, and restricted-content unlocks all require a
> connection.

## How it works today

Every part of this feature is server-driven: the profile list, the PIN action feeds, the
form and the content gates are all feeds, and every PIN check is a cloud event. With no
connection there is nothing to render and nothing to verify, which is the behaviour the
requirement asks for.

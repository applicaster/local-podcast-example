# BR-1 — Profile selection

**Status:** Done — tiles carry `extensions.unlocked`, and the cell style draws the padlock from it

## The requirement

> All profiles show as tiles. A tile shows a lock icon when that profile has a PIN. The
> user always picks a profile, even when the account has only one.

## How it works today

- **Profiles – Select** renders `…/viewer-profiles`, one tile per profile, and the screen
  is shown on every launch, single profile or not. ✅
- Each entry carries `extensions.has_pin`, live at the moment of the request. ✅
- Each entry also carries `extensions.unlocked`, the inverse of it, which is the key a
  cell style's lock badge reads — truthy means open, falsy means locked. ✅
- **The padlock is drawn** on the tiles of profiles that have a PIN. ✅

## Backend — what the API must return

`extensions.has_pin` per entry in `CMS/profiles/select`, recomputed per request. A stale
value is worse than none: a profile whose PIN was just removed keeps asking for one.

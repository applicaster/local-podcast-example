# NR-2 — The gate is at the manage button

**Status:** Specified — the contract is written; the gate is theirs to serve, the layout ours

## The requirement

> Pressing the manage button requires the active profile's own PIN when that profile has
> one. When the owner is active, the owner's PIN is the gate for managing every profile,
> including the owner's own. When a child is active, the child's own PIN is the gate for
> managing its own profile. Passing this gate is the PIN check for everything that follows.

## How it works today

Nothing gates the manage button. PIN is asked per action instead: the reset button in the
profile form asks for the owner's PIN, disable asks for the profile's own, change asks for
the current code.

## Backend — what the API must return

If the manage button is a feed entry, its `tap_actions` are built server-side and need to
know the **active** profile, which arrives as `X-VIEWER-ID` (or `?profile=`):

```json
{
  "actions": [
    { "type": "pinCode",
      "options": { "typeMapping": "parent-lock", "flow": "verify-pin",
                   "cloudEventPayload": { "profile": "<ACTIVE profile id>", "purpose": "manage" } } },
    { "type": "navigateToScreen",
      "options": { "typeMapping": "profiles-manage", "navigationAction": "push" } }
  ]
}
```

Omit the `pinCode` step when the active profile has no PIN — the gate is then skipped by
design (BR-3).

## Where the contract is

[Spec §4.4](../contract/aioc-pin-feeds-spec.md#44-the-manage-button) — the entry, its two labels and the chain per active
profile — and [§7](../contract/aioc-pin-feeds-spec.md#the-window-has-a-shape-not-just-a-length), where the code it collects
becomes a window with a scope: the owner's reaches every profile, anyone else's reaches
only itself. A child passes a gate too, and must not come out of it able to rewrite the
owner's code.

Five minutes is the reference server's number, not a requirement. If the product wants the
window to end on leaving the screen or on backgrounding instead, that is a shorter TTL and
nothing else changes.

# NR-3 — No PIN prompts on the Manage Profile screen

**Status:** Specified — no longer a conflict; we follow the requirement and the authority moves to the window

## The requirement

> Once on the Manage Profile screen, no field, checkbox, or button asks for a PIN. This
> covers enabling a PIN, changing a PIN, disabling a PIN, adding a content restriction,
> removing a content restriction, changing permissions, and deleting the profile. Plain
> confirmation dialogs without a PIN […] are still allowed.

## How it works today

The opposite, in three places:

| Action | What we ask for today |
|---|---|
| Change PIN | the current PIN (`change-pin` flow, two steps) |
| Disable PIN | a confirmation **and** the current PIN (`verify-pin`) |
| Set or change another profile's PIN | the owner's PIN (`verify-pin`, `purpose: "manage"`), then the new code |

## Backend — what the API must return

If the requirement stands, the feeds drop the `pinCode` steps and keep only the events:

```json
{ "actions": [
  { "type": "confirmDialog", "options": { "title": "Delete PIN?", "okButtonText": "Delete" } },
  { "type": "sendCloudEvent", "options": { "url": "<events>", "type": "com.applicaster.pin.change.v1",
    "subject": "disable_pin", "data": { "step": "disable", "profile": "<target>" } } },
  { "type": "refreshComponent" }
] }
```

The server then has nothing in the request that proves the user passed the gate at the
manage button, so it must carry that itself — the grant from NR-2.

## Reference

[local-podcast-example #3](https://github.com/applicaster/local-podcast-example/pull/3) —
the PIN management feed on a surface of its own, which is what makes this requirement
buildable: the buttons refresh themselves after a code is set, so nothing behind the gate
needs to ask again.

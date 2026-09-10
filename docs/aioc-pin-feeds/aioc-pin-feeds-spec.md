# AIOC — Profiles, PIN and Profile Form: backend contract

Status: draft for review
Audience: FOTF backend
Reference implementation: a mock server that already serves every feed and event
below. The app is being tested against it today, which is how the details here
were established rather than guessed.

This document specifies what the backend must return, not how it stores anything.
Where a rule looks arbitrary, a short **Why** note says which client behaviour
depends on it.

> **One blocking problem needs your answer before any of this can be built.**
> `CMS/events` requires a profile id, and a PIN is what decides whether a
> profile may be entered — so at the moment the first PIN is set or verified,
> there is no profile in session to send. To prove you may enter a profile, you
> would have to already be in one. See §2, "Which profile a request is about";
> the way out may be a new endpoint on your side.

---

## 1. Scope

Two of your feeds need additions, and everything else here is new. A mock
currently makes those additions by proxying the two feeds and rewriting the
response on the way through. **The point of this document is to make the proxy
unnecessary**: once the two feeds carry what §3 and §6 describe, it is removed
and the app talks to you directly.

### The two feeds that change

| Feed | What to add |
|---|---|
| `GET /CMS/profiles/select` | `extensions.has_pin` per entry; a `pinCode` action in front of `tap_actions` when it is true; `type.value` of `action` instead of `profile`; the avatar url and profile name added to what selecting a profile persists |
| `GET /CMS/profiles/form` | accept `?profile=<id>`; add one button that resets that profile's PIN |

Nothing else in either response changes. Avatars, `denied_actions`, the form's
fields, its Save and Cancel all stay exactly as they are. The one exception is
inside the profile entry's own `sessionStorageSet`, which gains two values —
Addition 4 in §3; every other action in the chain is untouched.

### What is new

Three feeds that do not exist yet (§4.1, §4.2, §4.3), and the cloud events
behind them (§5): setting, verifying, changing, disabling, resetting and
recovering a PIN.

Out of scope: content restrictions, Manage Profiles as a screen, profile
creation and deletion.

## 2. Conventions

### Transport

| | |
|---|---|
| Format | Pipes2 feed JSON |
| Request header | `Accept: application/vnd+applicaster.pipes+json` |
| Success status | **200** for reads and for event writes |

**Why 200 on writes:** the client treats 200 and 201 differently on the event
endpoint; 201 is read as unhandled. Answer 200.

### Authentication

Two context keys are attached by the app to every request against these endpoints:

```json
[
  { "key": "quick-brick-login-flow.access_token", "type": "bearerHeader", "required": false },
  { "key": "user_account.profile", "mapper": "X-VIEWER-ID", "type": "header", "required": false }
]
```

- `Authorization: Bearer <access_token>` — identifies the **account**.
- `X-VIEWER-ID: <profile id>` — identifies the **profile currently in session**.

### Which profile a request is about — and the deadlock in `CMS/events`

**This is the one blocking problem in this document. Nothing else here can be
built until it is resolved, and resolving it may mean a new endpoint on your
side.**

`X-VIEWER-ID` carries `user_account.profile`: the profile the viewer **has
already entered**. `CMS/events` requires it, together with the access token.

Almost every request in this document is made **before that profile exists**, or
**about a different one**:

| When | The profile in session |
|---|---|
| The profile list is fetched | none — nobody has chosen a profile yet |
| A PIN is verified to enter a profile | none — this *is* the request that chooses one |
| A profile's first PIN is set | none, for the same reason |
| A parent edits a child's profile | the **parent's**, not the child's |
| A parent resets a child's PIN | the **parent's**, not the child's |

The first three rows are a deadlock: `CMS/events` will not accept a request
without a profile id, and the PIN exists precisely to decide whether a profile
may be entered. **To prove you may enter a profile, you would have to already be
in one.**

This is not a theory. The app logs it against your endpoints:

```
Missing context values for url: https://api-qa.aio.focusonthefamily.com/CMS/profiles/select
  contextKeys:     [{ key: "user_account.profile", mapper: "X-VIEWER-ID", type: "header", required: false }]
  missingOptional: ["user_account.profile"]
```

The same line appears for `CMS/profiles/editable`.

The last two rows are a second, quieter problem: even once a profile **is** in
session, it is the wrong one. A parent managing a child sends the parent's id,
so a backend that reads the subject from the header would apply the change to
the parent.

### Ways out

In order of preference:

1. **Accept the PIN event types on `CMS/events` with the account token alone,
   and read the subject from `data.profile`.** The header keeps its current
   meaning for every other event type. This is what the mock does and what §5
   assumes throughout.

2. **A dedicated endpoint** — say `POST /CMS/pin/events` — authorised by the
   account token only, with the subject in the payload. It costs an endpoint and
   one line of app configuration, and leaves `CMS/events` untouched. Choose this
   if the profile requirement on `CMS/events` cannot be relaxed per event type.

3. **Making the context key `required: true` does not work.** The value does not
   exist yet at that point in the flow, so the request would fail on the client
   rather than arrive without the header. The deadlock stays.

Whichever is chosen, the subject of a PIN request is named **explicitly** — in
the query string for a feed, in `data.profile` for an event — and never inferred
from `X-VIEWER-ID`. The rest of this document is written that way.

### Feed envelope

```json
{
  "id": "<feed id>",
  "title": "<human readable>",
  "type": { "value": "feed" },
  "entry": [ ... ]
}
```

### Errors

| Status | Meaning | Body |
|---|---|---|
| 400 | The request is understood but rejected — wrong PIN, missing field, unknown step | `{ "statusCode": 400, "message": "<reason>" }` |
| 401 | No usable bearer token | `{ "statusCode": 401, "message": "..." }` |
| 403 | Understood and well-formed, but the caller lacks parental authority | `{ "statusCode": 403, "message": "..." }` |

`message` is surfaced to the user by the parent lock screen on a failed PIN, so it
should read as an explanation, not as an error code.

---

## 3. Profiles feed — four additions

```
GET /CMS/profiles/select
```

An entry as it should look. The marked fields are the additions; the rest is
what you already send. A fourth addition, to what the entry persists when it is
tapped, is described after them.

```json
{
  "id": "a3JVE000007CgIn2AK",
  "title": "Fit Whit",
  "type": { "value": "action" },              // ← 1. was "profile"
  "media_group": [
    { "type": "image", "media_item": [ { "key": "image_base", "src": "<avatar url>" } ] }
  ],
  "extensions": {
    "master": 1,
    "kids": false,
    "has_pin": true,                          // ← 2. new
    "username": "Whit",
    "avatar_id": "char:1562",
    "denied_actions": { "playlist": false, "offline_download": false, "comment": false,
                        "change_picture": false, "change_name": true, "bookmark": false },
    "tap_actions": {
      "actions": [
        { "type": "pinCode",                  // ← 3. new, only when has_pin is true
          "options": {
            "typeMapping": "parent-lock",
            "flow": "verify-pin",
            "cloudEventPayload": { "profile": "a3JVE000007CgIn2AK" }
          } },
        { "type": "sessionStorageSet", "options": { ... } },
        { "type": "finishHook", "options": { "success": true } }
      ]
    }
  }
}
```

### Addition 1 — `type.value` becomes `action`

Today each entry says `"type": { "value": "profile" }`. It must say `"action"`.

`type.value` does two jobs at once. It labels the entry, and it tells the client
**which screen to open when the cell is tapped** — the screen that type is mapped
to in the app's configuration. That navigation happens *in addition to* running
the entry's `tap_actions`.

A profile cell has no screen to open. Its `tap_actions` already write the session
and finish the hook, which lands the user on the home screen. With `profile`, the
client did that **and then pushed the mapped screen on top**, so selecting a
profile put the user on the home screen twice — a visible double transition, and
a back stack with a duplicate in it.

`action` is the value for an entry that runs a chain rather than leading
somewhere. It is what the client's own feed decorators set when they attach
actions to a cell, and it makes the second navigation not happen.

Nothing else about the entry changes — the id, the title and the image are still
used to draw the profile.

### Addition 2 — `extensions.has_pin`

A boolean per entry: does this profile currently have a PIN.

**You already produce this field** — `CMS/profiles/editable` returns
`"has_pin": true` alongside `master` today. The request is to return the same
field from `CMS/profiles/select`.

It must reflect the PIN store **at the moment of the request**. The app derives
every branch from it: which buttons the PIN settings screen shows, and whether
entering the profile is gated at all. The client cannot know whether a PIN
exists — if `has_pin` lags, a profile whose PIN was just removed keeps asking for
one, and a profile that just gained a PIN opens without asking.

### Addition 3 — the PIN gate in `tap_actions`

When `has_pin` is `true`, insert this action **in front of** the entry's existing
`tap_actions`, before whatever writes the session:

```json
{
  "type": "pinCode",
  "options": {
    "typeMapping": "parent-lock",
    "flow": "verify-pin",
    "cloudEventPayload": { "profile": "<this entry's id>" }
  }
}
```

Leave the existing actions in place behind it — Addition 4 is the only change
to any of them. When `has_pin` is `false`, add nothing here.

**Why the feed and not the app:** the action chain stops when `pinCode` resolves
`Cancel`, so the session is never written on a cancelled entry. The server is
also the only side that knows whether a PIN exists, and it knows it per profile
rather than for the list as a whole.

**Why the payload names the profile:** entering a profile verifies **that
profile's own** PIN. Without `cloudEventPayload.profile` the event carries no
subject, and the code is checked against the account-wide PIN instead.

### Addition 4 — persist the avatar url and the profile name

Selecting a profile writes the session. This is what is actually in storage
afterwards today:

```
user_account
  kids               false
  profile            a3JVE000007CxBZ2A0
  profile_selected   true
```

Only the id identifies the profile. `profile_selected` is written and **read by
nothing** — it does not appear anywhere in the app outside a feed example.
Leave it or drop it; either way it is not what makes anything work.

Add the two values the app has to display:

```json
"user_account": {
  "profile": "a3JVE000007CgIn2AK",
  "profile_name": "Fit Whit",                                   // ← new
  "profile_avatar": "https://api-qa.aio.focusonthefamily.com/CMS/images/square/<…>.webp",  // ← new
  "kids": false,
  "profile_selected": true
}
```

Take them from the entry itself — `title`, and the `image_base` item of
`media_group` — so what is stored is exactly what the list displayed.

**Why they must be persisted rather than looked up:** the profile button in the
navigation shows the active profile's avatar, and other screens show its name,
on every screen and after a restart. Only the id is stored today, and an id
renders as nothing. Resolving a name by re-fetching the profile list would put a
network round trip on screens that need none, and would fail exactly when it
matters — offline, or before the list has been fetched in this session.

The key names above are a proposal; what matters is that both values land in the
same persisted namespace as the id, so the app can read them back as context
keys.

### Fields the PIN work depends on

| Field | Type | Why it matters |
|---|---|---|
| `id` | string | Profile id. The subject of every PIN event. |
| `type.value` | `"action"` | Addition 1 — stops the second navigation. |
| `extensions.master` | `1` \| `0` | The account owner. **Exactly one per account**; the only profile with parental authority. |
| `extensions.kids` | boolean | Child profile. Affects experience, never authority — a profile that is not a child is not thereby a parent. |
| `extensions.has_pin` | boolean | Addition 2 — live, per request. |

`master` is currently a number; it was a boolean in the previous endpoint. Either
is accepted, but pick one and keep it.

## 4. PIN action feeds

Two feeds, because they answer two different questions. Keep them separate: a single
feed switched by a parameter puts the wrong buttons in front of the wrong person the
first time the parameter is forgotten.

### 4.1 A profile's own settings

```
GET /pin/actions?profile=<profile id>
```

| State of `<profile id>` | Entries |
|---|---|
| no PIN | `set-pin` |
| has a PIN | `change-pin`, `disable-pin`, `forgot-pin` |

Each entry:

```json
{
  "id": "change-pin",
  "title": "Change PIN",
  "type": { "value": "action" },
  "extensions": { "tap_actions": { "actions": [ ... ] } }
}
```

**Every chain in this feed ends with `{ "type": "refreshComponent" }`**, because every
one of them can change whether a PIN exists, and the feed's own contents depend on that.

#### `set-pin` / `change-pin`

A single `pinCode` action; the app drives the whole exchange and sends the events itself.

```json
[
  { "type": "pinCode",
    "options": { "typeMapping": "parent-lock", "flow": "set-pin",
                 "cloudEventPayload": { "profile": "<profile id>" } } },
  { "type": "refreshComponent" }
]
```

`flow` is `"set-pin"` or `"change-pin"`.

#### `disable-pin`

```json
[
  { "type": "confirmDialog",
    "options": { "title": "Disable PIN?",
                 "message": "Content will no longer be protected.",
                 "okButtonText": "Disable", "cancelButtonText": "Cancel" } },
  { "type": "pinCode",
    "options": { "typeMapping": "parent-lock", "flow": "verify-pin",
                 "cloudEventPayload": { "profile": "<profile id>" } } },
  { "type": "sendCloudEvent",
    "options": { "url": "<events endpoint>",
                 "type": "com.applicaster.pin.change.v1",
                 "subject": "disable_pin",
                 "data": { "step": "disable", "profile": "<profile id>" } } },
  { "type": "refreshComponent" }
]
```

**Why no dedicated flow:** `verify-pin` already collects and checks the current code,
and a cancelled `pinCode` stops the chain — so the event after it is only reached once
the right PIN was entered.

#### `forgot-pin`

No confirmation and no PIN entry — not knowing the code is the premise.

```json
[
  { "type": "sendCloudEvent",
    "options": { "url": "<events endpoint>",
                 "type": "com.applicaster.pin.recovery.requested.v1",
                 "subject": "recover_pin_code",
                 "data": { "profile": "<profile id>" } } },
  { "type": "showToast",
    "options": { "id": "pin_reset_email_sent",
                 "message": "An email to set a new PIN was sent to the account.",
                 "timeout": 3000 } },
  { "type": "refreshComponent" }
]
```

### 4.2 What the account owner may do to another profile

```
GET /pin/actions/manage?profile=<target profile id>
```

One entry, `reset-pin`, titled `Reset PIN` when the target has a PIN and `Set PIN`
when it does not — the requirements treat giving a first PIN and replacing one as a
single parental right.

```json
[
  { "type": "pinCode",
    "options": { "typeMapping": "parent-lock", "flow": "verify-pin",
                 "cloudEventPayload": { "profile": "<OWNER profile id>",
                                        "purpose": "manage" } } },
  { "type": "sendCloudEvent",
    "options": { "url": "<events endpoint>",
                 "type": "com.applicaster.pin.reset.v1",
                 "subject": "profile_reset",
                 "data": { "profile": "<TARGET profile id>" } } },
  { "type": "showToast",
    "options": { "id": "pin_reset_email_sent",
                 "message": "An email to set a new PIN was sent to the account.",
                 "timeout": 3000 } },
  { "type": "refreshComponent" }
]
```

Note the two different profiles: the verification names the **owner**, the reset names
the **target**.

The feed is empty when the account has no profile carrying `master`.

**When the owner has no PIN of their own,** the first action is omitted and the chain
starts at `sendCloudEvent`. The owner PIN is optional while theirs is the only profile,
and asking for a PIN that does not exist fails the verification without protecting
anything — the app continues past a failed action and only stops on an explicit cancel.

---

### 4.3 The forgot-PIN screen

```
GET /pin/recover
```

One entry, whose tap action asks for the PIN to be recovered. It exists so a
"Forgot PIN" screen has a feed of its own, separate from the settings list in
§4.1.

```json
{
  "id": "recover-pin-code-feed",
  "title": "Recover Pin Code",
  "type": { "value": "recover-pin-code-feed" },
  "entry": [
    {
      "id": "recover-pin-code",
      "title": "Recover Pin Code",
      "type": { "value": "action" },
      "extensions": {
        "tap_actions": {
          "actions": [
            { "type": "sendCloudEvent",
              "options": {
                "url": "<events endpoint>",
                "type": "com.applicaster.pin.recovery.requested.v1",
                "subject": "recover_pin_code",
                "data": { "profile": "<profile id>" } } }
          ]
        }
      }
    }
  ]
}
```

This route takes no profile of its own — it is reached from a screen, not from a
row — so the profile comes off the request the way §2 describes. Without it the
event names no profile and asks about the account-wide PIN instead of the one on
screen.

---

## 5. Cloud events

```
POST /CMS/events
```

Every event below names its subject in `data.profile`, never in `X-VIEWER-ID` —
see §2, "Which profile a request is about". If that endpoint cannot read the
subject from the payload, this is the section that would move to an endpoint of
its own.

CloudEvents 1.0 envelope; the fields below are `data`.

### 5.1 Verify — `com.applicaster.pin.v1`

```json
{ "profile": "<profile id>", "pin_code": "1234", "purpose": "manage" }
```

| Field | Required | Notes |
|---|---|---|
| `profile` | yes | Whose PIN is being checked |
| `pin_code` | yes | |
| `purpose` | no | `"manage"` marks a verification made to obtain parental authority |

| Outcome | Status | `subject` |
|---|---|---|
| correct | 200 | `Valid Pin Code` |
| profile has no PIN | 400 | message `PIN is not set` |
| wrong code | 400 | message `Invalid pin code` |

### 5.2 Set — `com.applicaster.pin.set.v1`

```json
{ "profile": "<profile id>", "pin_code": "1234" }
```

| Case | Result |
|---|---|
| profile has no PIN | 200, `subject: "PIN was successfully set"` |
| profile already has one | **403** unless the caller holds parental authority (§7) |

**Why the second row:** replacing a PIN is the same act as resetting it. Without this
rule the endpoint silently overwrites any profile's PIN for anyone who can reach it,
and the PIN protects nothing.

### 5.3 Change — `com.applicaster.pin.change.v1`

Distinguished by `data.step`.

| `step` | Payload | Result |
|---|---|---|
| `verify_current` | `profile`, `current_pin_code` | 200 on match, 400 otherwise. Changes nothing. |
| `confirm_change` (default) | `profile`, `current_pin_code`, `pin_code` | verifies, then stores the new code. `subject: "PIN was successfully changed"` |
| `disable` | `profile`, `current_pin_code` optional | removes the PIN. `subject: "PIN was successfully disabled"` |

`current_pin_code` is optional on `disable` because the client gates it behind a
`verify-pin` action. When it is sent anyway it must still be checked, so that the lax
path is never the only path.

### 5.4 Reset — `com.applicaster.pin.reset.v1`

```json
{ "profile": "<target profile id>", "step": "set_new_pin", "pin_code": "1234" }
```

The old code is never asked for — a reset exists precisely because nobody knows it.

- Requires parental authority (§7); **403** without it — **unless the account
  owner has no PIN**, see below.
- `pin_code` optional. Omitted, the backend decides what the profile lands on: in
  production, the code the user picks from the recovery email; in the mock, a fixed
  known code.
- `subject: "PIN was successfully reset"`

#### When the account owner has no PIN

Accept the reset on the account token alone, and log it.

The owner PIN is optional while theirs is the only profile, so this is a state
the product allows. In it there is nothing to prove: no code exists to ask for,
and the feed correspondingly omits the verification step (§4.2, §6). Requiring
authority anyway would not protect anything — it would make reset impossible for
everyone, including the owner.

This is the **only** case in which a reset is accepted without a verification.
Once the owner has a PIN, the rule in §7 applies without exception.

### 5.5 Forgot — `com.applicaster.pin.recovery.requested.v1`

```json
{ "profile": "<profile id>" }
```

Requires no authority: not knowing the code is the premise. Safe because the email
reaches the account owner and nobody else.

`subject: "Pin Code Recovery Requested"`

### 5.6 Acknowledgement shape

Every success answers with a CloudEvents-shaped acknowledgement:

```json
{
  "specversion": "1.0",
  "type": "com.applicaster.event.received.v1",
  "source": "<your service>",
  "subject": "Valid Pin Code",
  "id": "<echo or correlation id>",
  "time": "2026-09-10T17:03:04.000Z"
}
```

**`subject` is load-bearing** — the app branches on it to decide whether a flow
completed. Use the strings given above verbatim.

---

## 6. Profile form — two additions

```
GET /CMS/profiles/form?profile=<profile id>
```

### Addition 1 — accept a profile

The endpoint currently takes no parameter and serves the same form for every
profile. It must accept `?profile=<id>` and use it for the button below.

The client cannot supply it any other way — see §2. While a parent edits a
child, `X-VIEWER-ID` holds the parent's id, not the child's.

### Addition 2 — a button that resets that profile's PIN

Insert one property, before the form's own buttons so that Save and Cancel stay
the pair at the bottom:

```json
{
  "id": "buttonResetPin",
  "type": "button",
  "preset": "FormButtonSave",
  "options": {
    "title": "Reset PIN",
    "extensions": {
      "tap_actions": {
        "actions": [
          { "type": "pinCode",
            "options": {
              "typeMapping": "parent-lock",
              "flow": "verify-pin",
              "cloudEventPayload": { "profile": "<ACCOUNT OWNER's id>", "purpose": "manage" }
            } },
          { "type": "sendCloudEvent",
            "options": {
              "url": "<events endpoint>",
              "type": "com.applicaster.pin.reset.v1",
              "subject": "profile_reset",
              "data": { "profile": "<the ?profile= id>" }
            } },
          { "type": "showToast",
            "options": { "id": "pin_reset_email_sent",
                         "message": "An email to set a new PIN was sent to the account.",
                         "timeout": 3000 } }
        ]
      }
    }
  }
}
```

Three details decide whether it behaves:

- **Two different profiles.** The `pinCode` verifies the **owner**; the cloud
  event names the **target**. Getting these the same way round is the whole
  point of the control.
- **Title.** `Reset PIN` when the target has a PIN, `Set PIN` when it does not —
  the requirements treat giving a first PIN and replacing one as a single
  parental right.
- **When the owner has no PIN of their own**, drop the first action and start at
  `sendCloudEvent`. Asking for a code that does not exist fails the verification
  without protecting anything, and the client carries on past a failed action
  anyway — it stops only on an explicit cancel.

Omit the whole property when the account has no profile carrying `master`:
with nobody holding parental authority there is nothing to offer.

### The rest of the response is unchanged

The shape stays as it is — a flat `properties` array at the top level:

```json
{
  "properties": [
    { "id": "profileImage", "type": "singleSelect", "preset": "FormAvatarPicker", "options": { ... } },
    { "id": "displayName",  "type": "textInput",    "preset": "FormTextInput",    "options": { ... } },
    { "id": "buttonResetPin", ... },
    { "id": "buttonSave",   "type": "button", "preset": "FormButtonSave",   "options": { ... } },
    { "id": "buttonCancel", "type": "button", "preset": "FormButtonCancel", "options": { ... } }
  ]
}
```

The array must stay at the top level: the client validates
`Array.isArray(response.properties)` and rejects anything else as an invalid
form config. Presets are presentation only — behaviour comes from each button's
`tap_actions`, which is why the new button can borrow `FormButtonSave` without
inheriting anything from Save.

## 7. Authority model

Two different things are proved by two different codes:

| Act | Whose PIN |
|---|---|
| Enter a profile | that profile's own |
| Change your own PIN | your own current |
| Turn off your own PIN | your own current, plus a confirmation |
| Set or reset **another** profile's PIN | the **account owner's** |
| Turn off **another** profile's PIN | the **account owner's** |

Only the profile carrying `master` grants parental authority. A profile that is not a
child is not thereby a parent: `kids: false` and `master: 0` together mean an adult
with no authority over anyone.

### How authority is proved across two requests

The reset chain is two separate HTTP requests — a verification, then the reset. The
backend must therefore carry the authority between them. Either is acceptable:

- **A short-lived grant.** A successful `pin.v1` carrying `purpose: "manage"` from the
  owner opens a window (the mock uses five minutes); a reset within that window is
  allowed, outside it is 403. This matches the product requirement that the owner PIN
  is entered once on entering Manage Profiles and covers everything until they leave.
- **The session.** The same conclusion drawn from the account behind the bearer token,
  if the backend already tracks that the owner authenticated.

What must not happen: accepting a reset because the request *says* it is authorised.
The event carries no proof, and anything derived from it is forgeable.

**The one exception** is an account whose owner has no PIN — see §5.4. There is
no authority to prove, the feed sends no verification, and the reset is accepted
on the account token. Everywhere else, no verification means 403.

**One trap.** If any successful verification opened the window, the owner unlocking
their **own profile** at sign-in would gain the right to rewrite every other PIN for
the next five minutes. That is why the marker `purpose: "manage"` exists: only a
verification that declares itself as an authority check counts.

---

## 8. Client-side constraints

Facts about the app that the feeds have to work around.

| Constraint | Consequence |
|---|---|
| The `reset-pin` PIN flow is not implemented in the app | Reset must be composed from `verify-pin` plus a cloud event, as in §4.2 |
| An action chain stops only on an explicit **cancel**, not on an error | A failed verification does **not** stop the chain; the backend must still refuse the event that follows |
| The form screen cannot request a url containing `{{…}}` unless its data source carries a mapping | Either keep the form url static, or configure the mapping in Zapp |
| `X-VIEWER-ID` is absent until a profile is selected | See §2 — the subject of every request is named explicitly instead |

---

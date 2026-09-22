# AIOC — Profiles, PIN and Profile Form: backend contract

Status: draft for review
Audience: FOTF backend
Reference implementation: a mock server that already serves every feed and event
below. The app is being tested against it today, which is how the details here
were established rather than guessed.

This document specifies what the backend must return, not how it stores anything.
Where a rule looks arbitrary, a short **Why** note says which client behaviour
depends on it.

> **One blocking problem has to be settled before any of this can be built.**
> `CMS/events` requires a profile id, and a PIN is what decides whether a
> profile may be entered — so at the moment the first PIN is set or verified,
> there is no profile in session to send. To prove you may enter a profile, you
> would have to already be in one. See §2, "Which profile a request is about";
> the way out may be a new endpoint.

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
| `GET /CMS/profiles/select` | `extensions.has_pin` per entry; a `pinCode` action in front of `tap_actions` when it is true; `type.value` of `action` instead of `profile`; the avatar url and profile name added to what selecting a profile persists; `?mode=manage`, which answers the same list with tap actions that edit rather than enter |
| `GET /CMS/profiles/form` | accept `?profile=<id>`; add one button that sets that profile's PIN |

Nothing else in either response changes. Avatars, `denied_actions`, the form's
fields, its Save and Cancel all stay exactly as they are. The one exception is
inside the profile entry's own `sessionStorageSet`, which gains two values —
Addition 4 in §3; every other action in the chain is untouched.

### What is new

Four feeds that do not exist yet (§4.1, §4.2, §4.3, §4.4), and the cloud events
behind them (§5): setting, verifying, changing, disabling, resetting and
recovering a PIN.

Out of scope: profile creation and deletion. The *Mature* content gate on `CMS/groupings` is
specified in [`../guide/README.md`](../guide/README.md) §6.

## 2. Conventions

### Transport

| | |
|---|---|
| Format | Pipes2 feed JSON |
| Request header | `Accept: application/vnd+applicaster.pipes+json` |
| Success status | **200** for reads; **200 or 201** for event writes |

**On writes,** the parent lock screen accepts both 200 and 201
(`SUCCESSFUL_PIN_HTTP_CODES`), and the generic `sendCloudEvent` action accepts
any 2xx. Answer 200 unless you have a reason to say something more specific:
it is what every example here shows, and it is the one both paths have always
read the same way.

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
| A parent sets or changes a child's PIN | the **parent's**, not the child's |

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

## 3. Profiles feed — five additions

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
        { "type": "goHome" }                   // see ../guide/README.md §6
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

When `has_pin` is `true` **and the entry is not the profile the request comes
from**, insert this action **in front of** the entry's existing `tap_actions`,
before whatever writes the session:

```json
{
  "type": "pinCode",
  "options": {
    "typeMapping": "parent-lock",
    "flow": "verify-pin",
    "cloudEventPayload": { "profile": "<this entry's id>" },
    "promptText": "Enter the PIN for <this entry's title>"
  }
}
```

Leave the existing actions in place behind it — Addition 4 is the only change
to any of them. When `has_pin` is `false`, add nothing here.

**Skip the gate on the viewer's own tile.** Re-selecting the profile you are
already in is not entering anything, so it asks for nothing. `has_pin` still
says `true` on that entry: the lock icon describes the profile, not the tap.

**`promptText` names the subject.** The screen's own instructions are one
string for the whole app, so only the feed can say whose code is wanted. It is
optional, and an app too old to know it shows the configured text.

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

### Addition 5 — the same list again, in manage mode

The gate at the manage button (§4.4) opens onto a screen that shows the same
profiles for a different purpose: not "who is watching" but "whose settings am I
about to change". Same list, same tiles, different tap actions — so it is the
same endpoint with a flag rather than a second feed:

```
GET /CMS/profiles/select?mode=manage
```

Each tile's chain is decided by the viewer and the tile, exactly as in §4.1:

| Viewer → tile | `tap_actions` |
|---|---|
| The owner → any profile | make that profile active, then `navigateToScreen` to `profile-edit` |
| A child → itself | the same |
| A child → anyone else | `showAlert`: only the account owner can manage other profiles |

```json
{
  "actions": [
    { "type": "sessionStorageSet",
      "options": { "namespace": "user_account", "key": "profile", "value": "<TILE profile id>" } },
    { "type": "navigateToScreen",
      "options": { "typeMapping": "profile-edit", "navigationAction": "push",
                   "entry": { "…": "this tile's entry, form_data included" } } }
  ]
}
```

Three things this mode must **not** do, each of them the natural thing to copy
from selection mode:

- **No `pinCode` in front of a tile.** The code was asked for at the button and
  asking again is the thing NR-3 forbids. A tile that re-prompts here means the
  gate is decorative.
- **No `goHome` at the end.** Selection mode ends at Home because choosing a
  profile starts a session; managing one does not, and going Home would close
  the screen the parent just opened.
- **Do not skip `sessionStorageSet`.** It is what makes the tapped profile the
  subject of the form that opens next — see §6, Addition 1. Without it the
  parent's own profile is still active and the form edits the parent while
  showing the child's name.

The alert for a child tapping someone else's tile is a `showAlert`, which draws
one button; `confirmDialog` always draws two and the second one is blank when no
cancel label is given.

Serving the flag is optional in one narrow sense: if the manage screen is only
ever reachable by the owner, every tile takes the first row. It is not optional
for a child, who reaches this screen through its own gate (§4.4) and must not
find everyone else's settings behind it.

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

Four new feeds. The two in §3 and §6 are additions to endpoints that already
exist; these are not.

> [!IMPORTANT]
> **The paths below are the reference server's, not yours.** They read
> `/pin/actions` and so on because that is where they answer today, on the stand
> we run at `https://zapp-ran-demo.web.app`. Serve them wherever they belong in
> your API — every feed's url is Zapp configuration, and we point the app at
> whatever you choose. The same goes for the events url inside the actions: the
> examples post to the stand's `/cloud-events`, yours is whatever §2 settles on.
>
> The stand keeps answering them until you do, proxying your CMS for everything
> else. Ending that is the point of this document.

The first two are separate feeds rather than one with a flag, because they answer
two different questions. Keep them separate: a single feed switched by a parameter
puts the wrong buttons in front of the wrong person the first time the parameter is
forgotten.

### 4.1 A profile's own settings

```
GET /pin/actions?profile=<profile id>
```

| State of `<profile id>` | Entries |
|---|---|
| no PIN | `set-pin` |
| has a PIN | `change-pin`, `disable-pin`, `manage-pin`, `forgot-pin` |

`manage-pin` is the account owner's control over this profile (§4.2). It is
offered here as well, while the app has no Manage Profiles screen of its own,
and only when the account has an owner to authorise it.

**The feed is about the profile in the url, not the one asking.** `?profile=`
names the target; the viewer comes off the request the way §2 describes. The two
are the same person on a profile's own settings and different people the moment
a parent manages a child, so a feed that reads only the viewer answers about the
wrong profile — quietly, and with buttons that work.

Who may see what follows from that pair, and it is the whole of BR-12:

| Viewer → target | Entries |
|---|---|
| A profile → itself | as the table above |
| The owner → a child | as the table above |
| The owner → themselves | as the table above, **minus `disable-pin`** once the account has two or more profiles |
| A child → anyone else | none — an empty `entry` array, not an error |

**Why the owner cannot turn their own PIN off.** It is not their own protection
it guards: it is the code that authorises every parental act on the account
(§7). Remove it while other profiles exist and there is nothing left to prove
authority with, so a child's PIN could never be set or reset again. One profile
on the account and the rule lifts, because then there is nobody to be a parent
to.

The mirror of it: **`set-pin` is always offered on an owner who has none.** An
account can reach that state — the owner joined before any children existed —
and the only way out is a control that is never hidden and never disabled.

Both rules are arithmetic on the list you already serve: `extensions.master`
says which profile is the owner, `has_pin` says whether it has a code, and the
number of entries says whether there is anyone to be a parent to. Nothing new
has to be stored.

**Title it differently here.** On this feed it sits beside the profile's own
`change-pin`, and the two would read identically while asking for different
codes — the profile's own, and the owner's. The reference server appends the
owner: `Set PIN (account owner)` / `Change PIN (account owner)`. On the manage
feed (§4.2) and in the form there is nothing to confuse it with, so the plain
wording stays.

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

> [!NOTE]
> **The failure case is not expressible here.** A feed chain has no branch. On a
> `400` the chain ends at the failed step, and the toast that would have said so
> never runs — so the user is told nothing either way. Saying that recovery
> failed, with the support number the requirements ask for, has to come from the
> parent lock flow itself, the way a failed verification already shows what the
> server answered (§2, "Errors"). Answer `400` with a `message` regardless: it is
> recorded, and it is what that screen would show.

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

One entry, `manage-pin`, titled `Change PIN` when the target has a PIN and `Set PIN`
when it does not — the requirements treat giving a first PIN and replacing one as a
single parental right.

The owner proves their own code, then types the new one. Nothing here resets a PIN to
a value the server chose: the requirement is that the parent *picks* the code.

```json
[
  { "type": "pinCode",
    "options": { "typeMapping": "parent-lock", "flow": "verify-pin",
                 "cloudEventPayload": { "profile": "<OWNER profile id>",
                                        "purpose": "manage" },
                 "promptText": "Enter the account owner's PIN (<owner's name>)" } },
  { "type": "pinCode",
    "options": { "typeMapping": "parent-lock", "flow": "set-pin",
                 "cloudEventPayload": { "profile": "<TARGET profile id>" },
                 "promptText": "Set a new PIN for <target's name>" } },
  { "type": "refreshComponent" }
]
```

Note the two different profiles: the verification names the **owner**, the code being
set names the **target**. Say so on the screens as well — two keypads appear in a row
asking for different codes, and unlabelled they are the same screen twice. The second step sends `com.applicaster.pin.set.v1` itself,
from the parent lock screen — see §5.2 — so this chain posts nothing of its own.

**The endpoint must accept a set that replaces an existing PIN,** which is what makes
this different from a profile setting its own: authorise it by the window the first
step opened, never by the event alone.

The feed is empty when the account has no profile carrying `master`.

**When the owner has no PIN of their own,** the first action is omitted and the chain
starts at the set. The owner PIN is optional while theirs is the only profile, and
asking for a PIN that does not exist protects nothing: the verification fails, and
the chain stops there without reaching the step the owner came
for.

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

### 4.4 The manage button

```
GET /profiles/manage-entry
```

One entry, and it is where the PIN is asked for. The requirements put a single
gate at the entrance to Manage Profiles and nothing behind it (NR-2, NR-3), so
this entry carries the whole check — both the label and the chain vary with the
**active** profile, which is why a static button cannot do the job:

| Active profile | Title | Chain |
|---|---|---|
| The owner, with a PIN | `Manage Profiles` | `pinCode` verify, then `navigateToScreen` |
| The owner, with no PIN | `Manage Profiles` | `navigateToScreen` alone |
| A child, with a PIN | `Manage Profile` | `pinCode` verify against its own code, then `navigateToScreen` |
| A child, with no PIN | `Manage Profile` | `navigateToScreen` alone |

Singular for a child, plural for the owner: one manages only itself, the other
manages everybody.

```json
{
  "id": "manage-profiles-entry-feed",
  "title": "Manage Profiles",
  "type": { "value": "feed" },
  "entry": [
    {
      "id": "manage-profiles",
      "title": "Manage Profiles",
      "type": { "value": "action" },
      "extensions": {
        "tap_actions": {
          "actions": [
            { "type": "pinCode",
              "options": { "typeMapping": "parent-lock", "flow": "verify-pin",
                           "cloudEventPayload": { "profile": "<ACTIVE profile id>",
                                                  "purpose": "manage" } } },
            { "type": "navigateToScreen",
              "options": { "typeMapping": "profiles-manage",
                           "navigationAction": "push" } }
          ]
        }
      }
    }
  ]
}
```

`purpose: "manage"` is the load-bearing part. The same event verifies a PIN for
two different reasons — entering a profile, and proving authority over one — and
without the marker the owner unlocking their own tile would quietly gain the
right to rewrite everybody's PIN. What it opens, and for how long, is §7.

Omit the `pinCode` step when the active profile has no PIN. There is no code to
ask for, and a gate nobody can pass is not security, it is a locked door with no
key (BR-3).

**The button belongs on the profile selection screen,** below the tiles, and
nowhere else — no menu item, no deep link (NR-1). Two entrances mean the second
one is the one without the gate.

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

> [!NOTE]
> **No feed sends this any more.** The owner giving a profile a code is a
> `set-pin` flow (§4.2, §5.2) — the parent chooses it rather than the server.
> The event stays specified because the endpoint still accepts it, and because
> a backend may want it for a recovery mail that lands the profile on a code
> of the backend's choosing.

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

## 6. Profile form — what it has to become

```
GET /CMS/profiles/form?profile=<profile id>
```

### Addition 1 — accept a profile in the url

The endpoint currently takes no parameter and serves the same form for every
profile. **It must accept `?profile=<id>`** and use it both for the form it
returns and for the button below.

**How it arrives: from the entry that opened the screen.** The form feed's url
carries a locator and its data source says where to fill it from:

```json
{
  "form_feed": {
    "source": "https://…/CMS/profiles/form?profile={{profile}}",
    "mapping": {
      "profile": { "property": "extensions.form_data.profileId", "source": "entry" }
    }
  }
}
```

`source: "entry"` is the entry that navigated here — the tile that was tapped —
and `property` is where on it the value sits, so the tile carries the id it
wants the form to be about:

```json
"extensions": { "form_data": { "profileId": "a3JVE000005wXaD2AU" } }
```

The subject is then **the profile that was tapped**, which is the whole
difference between a parent editing a child and a parent editing themselves.
There is a working example of this configuration in Zapp, on the sandbox form
screen.

> [!WARNING]
> **The locator does nothing without the mapping.** `?profile={{profile}}` on
> its own leaves the braces in the url and the screen comes up blank: the form
> loader builds its request with an empty screen context, so there is nothing
> for a bare locator to resolve against. The mapping is what supplies the value.

**And not as a header.** `X-VIEWER-ID` answers "who is looking", and while a
parent edits a child the two are different people. A form that takes its
subject from the header silently edits the wrong person: the button then sets
the parent's PIN, not the child's, and both look like a success.

**The alternative, if the entry cannot carry it:** configure
`user_account.profile` as a context key on the endpoint, and the client appends
it as a base64 `ctx` parameter — the way `/pin/actions` receives it. The
reference server accepts that, or a plain `?profile=<id>`. The catch is that
this value is the **active** profile, so opening the form from a tile means
making that profile active first; the mapping above avoids the problem by not
using the session at all.

### Addition 2 — a button that gives that profile a PIN

> [!NOTE]
> **Interim, and the form is not where this ends up.** The buttons a profile
> gets depend on whether it has a PIN — *Set* before, *Change* and *Delete*
> after — so the set changes the moment one is set, and a form cannot fetch
> itself again to show the new one. A feed component can, and the PIN actions
> already do (`refreshComponent`), which is why they work on the profile
> selection screen.
>
> So the PIN belongs on a surface of its own: a tab, or a block above the fields
> on whatever screen the profile page becomes. Until that screen exists this
> button is how a parent reaches a child's PIN at all, and it stays specified
> for that reason — but nothing new should be built around it.

Insert one property, before the form's own buttons so that Save and Cancel stay
the pair at the bottom:

```json
{
  "id": "buttonManagePin",
  "type": "button",
  "preset": "FormButtonSave",
  "options": {
    "title": "Change PIN",
    "extensions": {
      "tap_actions": {
        "actions": [
          { "type": "pinCode",
            "options": {
              "typeMapping": "parent-lock",
              "flow": "verify-pin",
              "cloudEventPayload": { "profile": "<ACCOUNT OWNER's id>", "purpose": "manage" }
            } },
          { "type": "pinCode",
            "options": {
              "typeMapping": "parent-lock",
              "flow": "set-pin",
              "cloudEventPayload": { "profile": "<the ?profile= id>" }
            } }
        ]
      }
    }
  }
}
```

Three details decide whether it behaves:

- **Two different profiles.** The first `pinCode` verifies the **owner**; the
  second collects a code for the **target**. Getting these the same way round is
  the whole point of the control.
- **Title.** `Change PIN` when the target has a PIN, `Set PIN` when it does not —
  the requirements treat giving a first PIN and replacing one as a single
  parental right.
- **When the owner has no PIN of their own**, drop the first action and start at
  the set. Asking for a code that does not exist protects nothing: the
  verification fails, and the chain stops there, so the code
  would never be collected.

Omit the whole property when the account has no profile carrying `master`:
with nobody holding parental authority there is nothing to offer.

### The rest of the response is unchanged

The shape stays as it is — a flat `properties` array at the top level:

```json
{
  "properties": [
    { "id": "profileImage", "type": "singleSelect", "preset": "FormAvatarPicker", "options": { ... } },
    { "id": "displayName",  "type": "textInput",    "preset": "FormTextInput",    "options": { ... } },
    { "id": "buttonManagePin", ... },
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

### Addition 3 — the form differs by who is looking

One form for everybody is the thing the requirements are least able to live
with: the screen is where a parent manages a child, and today it shows the same
fields to both. Three cases, and the request already carries what decides them
— the profile in the url (§6, Addition 1) and the viewer in `X-VIEWER-ID`.

| Viewer → subject | What the form contains |
|---|---|
| A child, on its own profile | Change Profile Image only if that profile may change pictures, Unique Profile Display Name only if it may change names. Denied both: a single line, "You do not have permission to make changes to this profile." Never Profile Name, Date of Birth, Gender or Parental Controls. |
| The account owner → a child | Everything: Change Profile Image, Profile Name, Unique Display Name, Date of Birth, Gender, then the Parental Controls section below them. Date of Birth and Gender are required. |
| The account owner → themselves | The same fields, no Parental Controls. In their place, one line inviting them to make a profile per child — see Addition 5. |

What decides "may": `denied_actions`, which your list already carries, and
`change_picture` and `change_name` are the two entries this rule reads.

**The PIN controls are not on this list**, in any of the three rows. The set of
buttons a profile gets changes the moment a code is set, and a form cannot fetch
itself again to show the new one — so they come from a feed of their own (§4.1)
and belong on a surface of their own. Addition 2 puts one PIN button in the form
as a stopgap, and says so.

> [!NOTE]
> **Nothing text-only renders in this form yet,** which is what the "no
> permission" line would be. The `label` type exists in the form screen plugin
> and has a data source of its own, but a property whose preset is not in the
> app's presets mapping is dropped — logged as an error, absent from the screen,
> silent from the user's side — and that mapping has no label in it. A component
> that shows a title, a subtitle and a comment is being added to close this; it
> is ours, not yours.

**Whose `denied_actions`, though — the viewer's, never the subject's.** The
requirements say it plainly, and the distinction is invisible in the first row
because there the two are the same profile. It shows in the second: a child
denied `change_name` still has that field on its form when the **owner** opens
it, because the owner is the one being permitted, and the owner is denied
nothing. A permission is a statement about who is holding the phone.

The Parental Controls section below reads the same flags the other way round,
and the two are easy to cross. There they are not a permission being enforced
but a value being edited: the checkboxes show the **subject's** flags, because
those are what the parent is about to change.

### Addition 4 — the Parental Controls section

Five checkboxes, phrased as **allow**, in the order the requirements list them:

```json
{ "id": "allowComment",         "type": "checkBox", "preset": "FormMultiSelectGroup", "options": { "title": "Allow commenting" } },
{ "id": "allowChangePicture",   "type": "checkBox", "preset": "FormMultiSelectGroup", "options": { "title": "Allow changing profile picture" } },
{ "id": "allowChangeName",      "type": "checkBox", "preset": "FormMultiSelectGroup", "options": { "title": "Allow changing profile display name" } },
{ "id": "allowOfflineDownload", "type": "checkBox", "preset": "FormMultiSelectGroup", "options": { "title": "Allow offline downloads" } },
{ "id": "allowFavorites",       "type": "checkBox", "preset": "FormMultiSelectGroup", "options": { "title": "Allow favorites" } }
```

Notice there is no value here. **A form property declares the field; it never
carries what is in it.** The screen takes every starting value from the entry
that opened it — see "Where the values come from" below — and a `value` written
into `options` is read by nobody.

**The values are inverted.** `denied_actions` records what a profile may not
do; the screen offers what it may. `"change_name": true` in the list is an
unticked box here. Getting this backwards grants what was meant to be denied,
and looks right on the screen.

The mapping, left to right:

| Checkbox | `denied_actions` key |
|---|---|
| Allow commenting | `comment` |
| Allow changing profile picture | `change_picture` |
| Allow changing profile display name | `change_name` |
| Allow offline downloads | `offline_download` |
| Allow favorites | `bookmark`. The list also carries `playlist`, which stays where it is — a playlist is not a favourite |

Below them belongs the content-restrictions list: the topics this profile is
kept away from. One `multiSelect`, whose options are the whole vocabulary and
whose value is what this profile already excludes:

```json
{
  "id": "contentRestrictions",
  "type": "multiSelect",
  "preset": "FormMultiSelectGroup",
  "options": {
    "title": "Restricted topics",
    "description": "Content tagged with a selected topic is locked for this profile.",
    "items": [
      { "const": "violence", "title": "Violence" },
      { "const": "occult",   "title": "The occult" },
      { "const": "romance",  "title": "Romance" }
    ]
  }
}
```

The vocabulary travels **inside the property** as `items`, so no second request
and no new endpoint: the form already knows which account it is answering for,
and it is the only screen that needs it. `const` is the id — yours to choose,
and once chosen it cannot change, because it is what content is tagged with.
`title` is display text and may change freely. (`options.itemsFeedURL` is the
alternative if the list ever outgrows the response.)

This section is shown on a child and omitted on the owner, exactly like the
checkboxes above it. Adding or removing a topic asks for no PIN: the gate was
the manage button. It saves with the form's own Save, like everything else here.

What the ids are matched against, and what has to carry them, is in [the client
guide](../guide/README.md#content-restrictions-by-topic) beside the
gate that reads them.

### Where the values come from

This is the part that is easy to get wrong, because the natural guess does not
work: **the form config carries no values at all.** The screen fills itself from
the entry that navigated to it, reading `extensions.form_data` and keying it by
the property ids above:

```json
{
  "id": "a3JVE000005wXaD2AU",
  "title": "Abigail",
  "extensions": {
    "form_data": {
      "allowComment": true,
      "allowChangePicture": true,
      "allowChangeName": false,
      "allowOfflineDownload": true,
      "allowFavorites": true,
      "contentRestrictions": ["occult"],
      "birthdate": "2014-05-02T00:00:00Z"
    }
  }
}
```

Types go in as themselves — booleans as booleans, a multi-select as an array of
`const` values, a date as an ISO 8601 string. The screen encodes them on the way
in. A key with no matching property is ignored; a property with no key starts
empty, which for a checkbox reads as *not allowed*, so a permission you mean to
grant has to say `true` and not be left out.

That entry is the profile tile the parent tapped, so this is an addition to
`CMS/profiles/select` rather than to the form — the same list, the same
`extensions`, one more key beside `denied_actions`. It is also the reason the
form itself stays cacheable: it describes a screen, not a person.

**Saving.** Everything here saves with the form's own Save — there is no
separate save for restrictions, and no PIN is asked, because the gate was the
manage button. The fields post back under the same ids: `allow*` as booleans,
`contentRestrictions` as an array. Translating those into `denied_actions`
(inverting the five) is the endpoint's job, and keeps the deny vocabulary in one
place — the profile list — instead of teaching the app two spellings of the same
fact.

> [!NOTE]
> The reference server already renders this section, with the checkboxes built
> from `denied_actions` in your profile list, so the shape above can be seen
> running before any of it is built. Two things it cannot do: fill the boxes in,
> because the values ride on your profile entry and not on the form, and save,
> because the form posts to your backend.

### Addition 5 — the owner's own profile says why it has no controls

Restrictions belong to a child's profile: an owner restricting themselves
protects nobody. Where the section would be, the owner gets one line
encouraging a profile per child. The copy is the product team's; until it
arrives the reference server says:

> Parental controls are set on each child's profile. Create a profile for every
> child so their restrictions can be set separately.

### Addition 6 — Date of Birth

```json
{ "id": "birthdate", "type": "datePicker", "preset": "FormTextInput",
  "options": { "title": "Date of birth", "required": true } }
```

Required for a child, optional for the account owner — `options.required` says
which. The value is ISO 8601 and arrives the same way as everything else, through
the entry's `form_data`. The list already carries `birthdate` per profile;
nothing reads it today.

Until QuickBrick ships a dedicated picker the field renders through the text
input component with a date input type. The `datePicker` type is the contract
either way, so nothing here changes when that component lands.

A value entered on the owner must not make them younger than 18 on the day of
saving, read in the account's own timezone; Save stays blocked until it is
corrected or cleared.

**Enforce it on save and return the error against the field.** The form shows a
field-level error when one comes back, so the message lands under Date of Birth
and Save stays blocked until the value is corrected or cleared. The form config
has no minimum or maximum date, so the check does not run as the value is typed
— which costs nothing here, since a form config is not enforcement either way.

The response shape for a field-level error is documented in [Forms API —
returning server validation errors](https://docs.applicaster.com/integrations/forms-api#returning-server-validation-errors), and it is the same mechanism for every
field on this form, not only this one.

### Addition 7 — the owner's page says so

**Only if the label goes on the form.** There is no profile page today — a tile
opens the form — so BR-5 is a choice between putting the label in `properties`
and building a page for the tile to open instead, which is closer to the tabs in
BR-6. What follows is the first.

When the subject is the account owner, the form opens with a label reading
**Account Owner**, above the avatar:

```json
{ "id": "accountOwnerLabel", "type": "label", "preset": "",
  "options": { "title": "Account Owner" } }
```

It is a property like any other — the `properties` array is the whole screen, so
a heading above the avatar picker is the first entry in it rather than something
the screen draws by itself. Omit it on every other profile.

> [!NOTE]
> **Nothing text-only renders in this form yet.** A property whose preset is
> missing from the app's presets mapping is dropped before it reaches the
> screen, and no label preset is mapped. A component that shows a title, a
> subtitle and a comment is being added for exactly this; until it ships, a
> text-only property returns nothing on screen.

### Not the form's job

One requirement sits on the screen around this payload rather than in it, and no
change here will produce it: the **Comments / Settings / Account Info** tabs
(BR-6).

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

### Who guards a PIN write

The requirements put the gate on the screen: one code at the manage button (NR-2), and
nothing asked for again on the screen behind it (NR-3). A write therefore reaches the
endpoint with nothing of its own proving a parent made it — the proof was the journey,
not the request.

**The reference server accepts that,** because it is the product being described. A
`pin.set.v1` naming any profile is honoured on the account token, and the log says so
rather than passing quietly.

It is worth knowing what that leaves open, because the requirement does not say it:

| | **The screen is the gate** (default) | **The endpoint checks too** |
|---|---|---|
| Replacing an existing PIN | accepted on the account token | needs the window a verified owner opened |
| A child in their own profile | can replace the owner's code, and with it every lock on the account | cannot touch it |
| An endpoint reachable by anything but this app | unprotected | protected |
| Matches NR-3 as written | yes | no — a code is asked for once, at the manage button |

Setting a **first** PIN needs no authority either way: there is nothing to replace.

### If you choose to check

`requireOwnerGrantForPinWrites` turns it on in the reference server. The owner's chain
is two separate HTTP requests — a verification, then the set — so the backend has to
carry the authority between them. Either works:

- **A short-lived grant.** A successful `pin.v1` carrying `purpose: "manage"` from the
  owner opens a window (the mock uses five minutes); a `pin.set.v1` that replaces an
  existing code within that window is allowed, outside it is 403. This matches the
  product requirement that the owner PIN is entered once on entering Manage Profiles
  and covers everything until they leave.
- **The session.** The same conclusion drawn from the account behind the bearer token,
  if the backend already tracks that the owner authenticated.

What must not happen either way: accepting a write because the request *says* it is
authorised. The event carries no proof, and anything derived from it is forgeable.

**The one exception** is an account whose owner has no PIN. There is no authority to
prove and the feed sends no verification, so the set is accepted on the account token.

**One trap.** If any successful verification opened the window, the owner unlocking
their **own profile** at sign-in would gain the right to rewrite every other PIN for
the next five minutes. That is why the marker `purpose: "manage"` exists: only a
verification that declares itself as an authority check counts.

### The window has a shape, not just a length

A child passes a gate too (§4.4): its own code, on its own manage screen. So the
window cannot simply mean *authorised*, or a child would come out of it able to
rewrite the owner's PIN. It carries who opened it, and that decides its reach:

| Opened by | Reaches |
|---|---|
| The account owner | every profile on the account |
| Any other profile | that profile alone |

Read it as the answer to "whose PIN may this window change", and both rows are
the same rule: you manage what you have authority over, and a child's authority
ends at itself.

### Behind the gate, nothing asks again

This is the half of the requirement that is easy to leave undone, because the
old behaviour keeps working. Once the gate is at the button, every chain behind
it drops its own verification (NR-3, BR-12):

| Action | Before | Behind the gate |
|---|---|---|
| Change PIN | verify the current code, then set a new one | set a new one |
| Turn a PIN off | confirm, then verify the current code | confirm |
| Give another profile a PIN | verify the owner's code, then set | set |

Which means the endpoint stops being able to point at a verification inside the
request and call it proof — there is none left. **The window is the only
authority behind the gate**, and a write that arrives without one is refused,
whatever it claims about itself. Removing the prompts without moving the
authority to the window does not make the feature lighter; it removes the
feature.

The reference server ships both halves. `requireOwnerGrantForPinWrites` is the
switch, off by default because the gate does not exist yet in the app; on the
day it does, it goes on, and the chains lose their prompts in the same change.

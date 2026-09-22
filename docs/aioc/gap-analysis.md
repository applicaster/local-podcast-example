# AIOC profiles & PIN — gap analysis

Internal. Not written for the customer.

Source: **Profile Feature: Business Requirements for the New App** (customer,
`profileFeatureAudit.md`), read against what exists today: the mock server
(`libs/mock-podcast`), the feeds it serves, the Zapp configuration of the QA
app, and [`aioc-pin-feeds-spec.md`](./contract/aioc-pin-feeds-spec.md).

The requirement-by-requirement breakdown lives in
[`requirements/`](./requirements/README.md), one file each. This page is the
short version: what is settled, what is theirs, what is ours.

Audited against the running stand on 22 Sep 2026.

## 1. Settled since the first reading

Conflicts that are no longer conflicts, and things found to be already built:

| Was | Now |
|---|---|
| Manage Profiles and the PIN actions lived on My Stuff | Both moved to the profile selection screen on 22 Sep 2026, in the order the customer asked for — NR-1 is done |
| Adding a profile was listed as out of scope | It is built, on their side: the tile comes with the profile list and creates through their form — BR-2 is done |
| Deleting a profile was listed the same way | Also built on their side, as a button in the form. Which makes BR-13a urgent rather than theoretical: the owner's own profile can be deleted today |
| Re-selecting the active profile asked for its PIN again | Only a profile that is not the viewer's own is gated (`profiles.service.ts`) |
| The PIN screen always said "Please enter the Pin" | The prompt names the profile, on both gates |
| No owner PIN meant nothing was gated | The entry is locked and says the owner must set a code |
| Forgot PIN was a row in a feed | A button on the PIN screen itself, on every prompt |
| `accountOwner` vs `extensions.master` | `master`; a second key was not worth carrying |
| A form url had to be static, so the profile travelled beside it | It does not. The url carries `{{profile}}` and the data source fills it from the entry that opened the screen — the tapped tile. The session never enters into it |
| The 18-year rule looked like a gap on our side | It is not. The form shows field-level errors; the backend rejects on save and returns the error against the field |

The authority rule moved too. The requirements put the gate on the screen — one
code at the manage button, nothing asked behind it — so the server takes a PIN
write at its word by default and logs that it did. `requireOwnerGrantForPinWrites`
turns the stricter check back on for anyone who wants it.

## 2. Theirs — written down, and we have made every choice it needed

The serving side of all of this is the customer's. The contract is in [spec
§6](./contract/aioc-pin-feeds-spec.md#6-profile-form--what-it-has-to-become) and the
reference server demonstrates every part of it that a server can.

Three rows say "see row 1": their payload is ready to be described, and it has
nowhere to be shown until there is a screen other than the form.

| # | What | Where it is specified |
|---|---|---|
| BR-7 | The form differs by who is looking. Nothing limits this on our side — the screen renders whatever `properties` it is handed | §6, Addition 3 |
| BR-8 | Parental Controls: five allow checkboxes, inverted from `denied_actions` | §6, Additions 1 and 4 |
| BR-9 | The owner's own profile gets a note instead of controls | §6, Addition 5 |
| BR-10 | Date of birth, optional for the owner, 18+ when set | §6, Addition 6 |
| BR-5 | The "Account Owner" label — a form property returned only on the owner, **if** the label goes on the form at all; the alternative is a profile page, see row 1 below | §6, Addition 7 |
| NR-2, NR-3, BR-3 | The manage gate: one code at the button, none behind it, and the window that replaces them | §4.4 and §7 |
| BR-6 | Comments, Settings and Account Info — theirs to fill, ours to arrange. Tabs are not available for this screen, so they become sections of a profile page; see row 1 below | — |
| BR-11 | Restrictions by topic: the vocabulary, the list per profile, the topics per item | [Client guide §6](./guide/README.md#content-restrictions-by-topic) |
| BR-13 | Delete Profile — the button is built; it appears on profiles that may not be deleted, the owner's included | — |
| BR-13a | **The API accepts a delete it must refuse**, the owner's own profile included, and checks nobody. Deletion works from the app, so this is the only thing in front of it | A Salesforce change owned by Digital Solutions |
| BR-14 | Account Info — membership and billing are theirs; it has nowhere to sit until the profile page exists, see row 1 below | — |

Nothing here waits on an answer from them. Where the requirements left a choice
we made it and wrote it down — Favorites is `bookmark`, the endpoint inverts the
checkboxes back into `denied_actions`, the topic vocabulary is theirs to pick and
travels inside the form property — so the contract reads as instructions and they
correct us only if we guessed wrong.

## 3. Ours — still open

Three groups, and the order matters. The first two rows are preconditions —
four requirements wait on them, and none of the four moves before they land.
The rest is smaller: configuration, a check nobody has run, two decisions, and
reference-server work that is optional by definition, since every rule it
implements is already written down for the backend that will own it.

**Unavoidably ours — nobody else can do these**

| # | What |
|---|---|
| 1 | **Somewhere other than the form.** Four requirements ask for the same thing and none of them can be met inside the form: the Account Owner header (BR-5), the tabs (BR-6), the PIN controls (BR-12) and the Account Info tab (BR-14). The PIN is the one that makes it unavoidable — the set of buttons changes the instant a code is set, and a form cannot fetch itself again, while a feed component refreshes itself and already does. The way through is the profile page the tile opens, with a way into the form for the fields — tabs would serve as well and are not available for this screen. Worked example: [local-podcast-example #3](https://github.com/applicaster/local-podcast-example/pull/3) |
| 2 | **A form component that shows text.** Title, subtitle, comment, and nothing else. Nothing text-only renders in the form today: a property whose preset is not in the app's mapping is dropped before it reaches the screen, and no label preset is mapped. One component closes three lines that cannot be shown — the encouragement message (BR-9), the Account Owner label (BR-5) and the "no permission" line (BR-7) |
| 3 | **Two lines of Zapp.** Point the Manage Profiles component at `…/profiles/manage-entry` instead of its static JSON, registering the url the way `…/pin/actions` is — `user_account.profile` as a required `ctx` key. And give `Profile Manage Screen` (`7d6bf6e2…`, `screen_feed.source` is null) a source: `…/viewer-profiles?mode=manage`, which needs no registration at all since that url is already there. The content type `profiles-manage` is mapped, so `navigateToScreen` resolves as it stands. The first is not requested yet; the second is what stops the gate opening onto an empty screen |
| 4 | **The app lists one profile, the one in session (BR-4).** No other profile is on screen, so none can be edited and the alert has no moment to appear — both halves of the requirement are absent rather than wrong. The feeds answer the mode on both sides; nothing asks them for it. Giving `Profile Manage Screen` its source is the first half, the screen showing the whole list is the second |
| 5 | **Verify offline (BR-P5).** Nothing to build — everything here is server-driven, so with no connection there is nothing to render and nothing to verify, which is the behaviour asked for. It has still never been checked on a device |

**Decisions, before any code**

| # | What |
|---|---|
| 6 | **The `CMS/events` deadlock** ([§2](./contract/aioc-pin-feeds-spec.md#which-profile-a-request-is-about--and-the-deadlock-in-cmsevents)). Three ways out are written down; one has to be chosen. Nothing runs against their backend until it is |
| 7 | **How far the play gate travels (BR-P1).** We gate the list entry; a deep link, Continue Watching, search or Up Next reaches the episode screen without passing it. Either that is accepted and recorded, or the gate moves |

**Reference-server work — optional, and specified either way**

| # | What | Where it is written |
|---|---|---|
| 8 | The grant has to remember who opened it, or a child that passes its own gate has every write refused | [§7](./contract/aioc-pin-feeds-spec.md#the-window-has-a-shape-not-just-a-length) |
| 9 | Change and Disable stop collecting a code, and the window becomes the authority — one change, not two | [§7](./contract/aioc-pin-feeds-spec.md#behind-the-gate-nothing-asks-again) |
| 10 | Matching by topic instead of the fixed `sensitive_content` flag — the check in `GroupingsService` becomes an intersection with the profile's list, read from the cached profile feed. Worth doing with BR-P1, since both change the same gate | [client guide §6](./guide/README.md#content-restrictions-by-topic) |

Rows 8 and 9 are one piece of work and have an order: the scope first, then the
prompts come off. Reversed, a child passing its own gate is refused everything
it tries.

## 4. Not planned for this iteration

- **PIN on downloads (BR-P2).** Downloading a restricted item is not gated, and
  an item already on the device plays without asking.
- **The 1-800-A-FAMILY failure state (BR-P3) — deferred, not dropped.** An action
  chain does not branch, so the error and the number cannot come from a feed.
  The parent lock screen will send the recovery itself and render its own error;
  until then Forgot always sends and always confirms.

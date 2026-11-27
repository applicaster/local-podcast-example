# AIOC — Profile feature: requirement by requirement

One document per requirement of the customer's **Profile Feature: Business Requirements for
the New App**. Each one says what the requirement is, what the app does today, what the
backend must return, and where the contract describes it. Zapp configuration is not here
— it lives in [the guide's checklist](../guide/README.md#zapp-checklist), in one copy.

The status column is the short answer; what is still outstanding on our side is
gathered in [the gap analysis](../gap-analysis.md) rather than spread a line at a
time across these pages.

| Status | Meaning |
|---|---|
| **Done** | implemented and verified |
| **Partial** | works, but not to the letter of the requirement |
| **Not started** | nothing built, nothing blocking either |
| **Conflict** | what we built contradicts the requirement; needs a decision |
| **Blocked** | cannot start until the backend or a decision lands |
| **Specified** | the contract is written and handed over; the build is the customer's, and nothing waits on us |
| **Served** | specified, and the reference server implements it, so the behaviour can be read off a running response |
| **Agreed** | the customer has asked for it in as many words; it is ours to do |
| **Not reachable** | the feeds answer it, but the app never puts the user in the situation the requirement describes |

## How to read the status

Two different things are easy to confuse, so each row says both:

- **In the stand** — what the app actually does today, which includes screens
  that are the customer's own (the profile edit form, the profile tiles) and
  reach the app without any work from us.
- **Ours** — what this mock server implements, which is the part we control.

Audited against the running stand and the mock's source on 21 Sep 2026, after
three of these statuses turned out to be written from the requirements rather
than from the product.

## Contract

| Doc | Status | In the stand / ours |
|---|---|---|
| [00 — Terms and contract](./00-terms-and-contract.md) | **Done** | The owner flag is `extensions.master`, `kids` grants no authority, and PIN verification carries its subject in the event. Only the events transport is still open, and it belongs to §2 of the contract. |

## Navigation and the PIN gate

| Doc | Status | In the stand / ours |
|---|---|---|
| [NR-1 — Single path to the Manage Profile screen](./nr-1-single-path-to-manage.md) | **Done** | Moved in Zapp on 22 Sep 2026, in the order the customer asked for: tiles, Manage Profiles, PIN actions. Nothing profile-related is left on My Stuff. |
| [NR-2 — The gate is at the manage button](./nr-2-manage-gate.md) | Served, not requested | Nothing gates the manage button. The entry that does, and the window its code opens, are in [spec §4.4](../contract/aioc-pin-feeds-spec.md#44-the-manage-button) and §7; switching the component off the static feed is ours. |
| [NR-3 — No PIN prompts on the Manage Profile screen](./nr-3-no-pin-prompts-on-manage.md) | Specified | Disable and Change still ask for a code, because the gate that would replace them does not exist yet. Both halves — the prompts going, the window becoming the only authority — are in [spec §7](../contract/aioc-pin-feeds-spec.md#behind-the-gate-nothing-asks-again). |

## What displays: owner vs. non-owner

| Doc | Status | In the stand / ours |
|---|---|---|
| [BR-1 — Profile selection](./br-01-profile-selection.md) | **Done** | Tiles for every profile; a padlock shows on the ones that have a PIN (`extensions.unlocked`, inverted from `has_pin`, drawn by the cell style). Only the customer's own icon asset is outstanding. |
| [BR-2 — Add Profile tile](./br-02-add-profile-tile.md) | **Done** | Built on the customer's backend: the tile comes with the profile list and creates through their form. |
| [BR-3 — Manage button under the tiles](./br-03-manage-button.md) | Served, not requested | One button, one label, no PIN, no manage mode. Both labels and both chains are in [spec §4.4](../contract/aioc-pin-feeds-spec.md#44-the-manage-button); a static feed can carry neither. |
| [BR-4 — Manage mode tile taps](./br-04-manage-mode-tile-taps.md) | Not reachable | The app lists one profile, the one in session. No other profile is on screen, so none can be edited and the alert has no moment to appear. The feeds answer the mode; nothing asks for it. |
| [BR-5 — Profile page header](./br-05-profile-page-header.md) | Not built | No profile page exists to put a header on. Two routes in the file; the platform side leans to an intermediate page, because the PIN controls cannot live in the form. |
| [BR-6 — Profile page tabs](./br-06-profile-page-tabs.md) | Not started | Tabs are not available for this screen, so Comments, Settings and Account Info become sections of a profile page. The PIN controls go on it too, never in the form. |
| [BR-7 — Manage screen, child active](./br-07-manage-screen-child.md) | Specified | The form returns the same fields to everyone today, though nothing stops it varying — that is the backend's decision throughout. The three viewer/target cases are in [contract §6, Addition 3](../contract/aioc-pin-feeds-spec.md#addition-3--the-form-differs-by-who-is-looking), and the file shows how the form learns which profile was tapped. |
| [BR-8 — Manage screen, owner → child](./br-08-manage-screen-owner-child.md) | Specified | The reference server renders the Parental Controls section from `denied_actions`, inverted, and takes its subject from the url. Their form does neither — [contract §6, Additions 1 and 4](../contract/aioc-pin-feeds-spec.md#addition-4--the-parental-controls-section). |
| [BR-9 — Manage screen, owner → owner](./br-09-manage-screen-owner-owner.md) | Done, except the message | The fields and the missing Parental Controls are the form's to decide. The encouragement line needs a text component the form does not have; one showing title, subtitle and comment is being added. |
| [BR-10 — Owner date of birth](./br-10-owner-date-of-birth.md) | Ready on our side | The date field and field-level errors both work. The backend adds the property and rejects on save with the error against the field. |
| [BR-11 — Content restrictions](./br-11-content-restrictions.md) | Specified | One flag, `extensions.sensitive_content == "Mature"`, matched on `CMS/groupings/*`. The vocabulary, the per-profile list and the per-item topics are written up in [the client guide](../guide/README.md#content-restrictions-by-topic); swapping the flag for an intersection is ours, and small. |
| [BR-12 — PIN controls](./br-12-pin-controls.md) | Served | Set, Change, Disable, Forgot and the owner's control over another profile all exist, on the profile selection screen. They cannot live in the form, which is where the requirement puts them — see the file for why, and for the two arrangements that work. The reference server follows both visibility rules. |
| [BR-13 — Delete Profile](./br-13-delete-profile.md) | Partly built | The button works. It is shown on every profile, the owner's included, and deleting the owner goes through — the form has to return it only when the active profile is the owner and the target is not. |
| [BR-13a — Backend validation for deletion](./br-13a-delete-validation.md) | **Not implemented** | The API accepts what it must refuse: the owner's own profile can be deleted, and nothing checks who is asking. Now that deletion works, this is the only thing in front of it. |
| [BR-14 — Account Info tab](./br-14-account-info-tab.md) | Not started | Nothing shows membership or billing, and there is no profile page for it to sit on. Same recommendation as BR-5, BR-6 and BR-12. |

## Where a PIN is required

| Doc | Status | In the stand / ours |
|---|---|---|
| [§4 — PIN matrix](./pin-matrix.md) | Partial | Three rows hold: selecting a protected profile, re-selecting the active one, and restricted play. Two work but are unguarded (add, delete). The rest wait on the manage gate or on screens nobody has built. |
| [BR-P1 — Restricted play and unlock](./br-p1-restricted-play.md) | **Done** | Gated behind the owner's PIN; `Locked` with a one-button notice when the owner has none. Copy and padlock asset still come from the customer. |
| [BR-P2 — Restricted download](./br-p2-restricted-download.md) | **Not planned** | Downloads are not gated in this iteration, and downloaded content plays without asking. |
| [BR-P3 — Forgot PIN on every prompt](./br-p3-forgot-pin.md) | Partial | The button is on the PIN screen and both gates supply it. The failure state with the phone number is **deferred** — the client has to branch on failure first. |
| [BR-P5 — Offline](./br-p5-offline.md) | Not started | Nothing to build — everything here is server-driven, so with no connection there is nothing to render or verify. Never checked on a device. |

## What the app does not do yet

Written plainly, for reading alongside the requirements rather than the code.

**Not planned for this iteration**

- **No PIN on downloads.** Restricted content asks for the account owner's PIN before it
  plays, and that is the whole of the protection. Downloading such an item is not gated,
  and an item already downloaded plays without asking — it is on the device, and nothing
  on our side sees that moment.
- **No support phone number when recovery fails — deferred.** Pressing "Forgot PIN" always
  sends the request and always shows the confirmation, because an action chain cannot
  branch on failure. The functionality will be added; until then whether a reminder
  arrived is answered by the mailbox.

**Built for one profile at a time, not yet for a parent managing others**

- Profiles are protected, PINs can be set, changed, turned off and recovered, and
  restricted content asks for the account owner's code. All of that works today.
- What is missing is everything that happens *about another profile*: opening a child's
  settings shows the child's form, but every control on it acts on whoever is holding the
  phone, because the request that loads the form does not say whose profile it is. That is
  one change on the customer's side — the form accepting a profile in its address — and the
  rest follows from it. It is written up and demonstrated: the reference server takes the
  subject from the url and answers about that profile, so the change can be copied rather
  than designed.

**Waiting on that same change, on the customer's side**

- Per-profile permissions — commenting, changing the picture or the display name,
  downloads, favourites. The reference server draws them as five checkboxes and fills them
  from `denied_actions`; their form has no such section, and nothing anywhere saves them
  yet.
- Content restrictions by topic. Today one flag marks an item as restricted for everyone
  who is not the owner; a parent cannot choose what their own child is kept away from. What
  the backend has to carry for that is written down, and the old flag keeps working beside
  it, so nothing has to change on one day.
- Adding a profile under the documented conditions (owner only, fewer than eight), and
  deleting one at all.
- The account owner label, Account Info, and the age check on the owner's date of birth —
  all three specified, none of them ours to build.
- The "Manage Profiles" journey as described. The reference server serves all of it now —
  the button with its two labels and the PIN in front of it, the tiles in manage mode, the
  message a child sees on someone else's tile — but the app still opens the old static
  button, and the screen behind it has no feed, so none of it is reachable yet.

**Agreed differently from the document**

- The PIN controls ask for a code before setting or changing one. The requirements ask
  for the opposite: one code at the manage button and none behind it. The reference
  server already accepts the writes without asking, so what is left is the gate in front
  of them, not the backend's permission.

## What is left on our side

Gathered in [the gap analysis](../gap-analysis.md) rather than listed here, so there is
one copy to keep current. The short version: two lines of Zapp configuration, a manage
screen that lists more than the profile in session, one decision about how far the
restricted-content gate travels, and the `CMS/events` transport, which blocks everything
that talks to a live backend.

> [!NOTE]
> The profile page and account info do not exist on our side at all, so the requirements
> about them (BR-6, BR-14) are work nobody has started rather than work half-done.

## Related

- [Client-facing guide](../guide/README.md) — what exists today, how to set it up
  and test it. Written for the customer.
- [Backend contract](../contract/aioc-pin-feeds-spec.md) — field-level spec of the
  feeds and events we serve.
- [Gap analysis](../gap-analysis.md) — what is settled, what belongs to the customer,
  and what is left with us. Internal.
- [`_template.md`](./_template.md) — shape for a new document.

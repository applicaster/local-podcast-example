# BR-12 — PIN controls on the Manage Profile screen

**Status:** Specified — the two rules are in the contract; what is left is the gate they sit behind

## The requirement

> PIN management uses buttons, not a checkbox. The account owner sees the buttons on every
> profile, including their own. A child sees the buttons only on its own profile.
> - **Set or Change PIN** […] collects a new 4-digit PIN and saves it. No verification of
>   the old PIN.
> - **Delete PIN** […] asks for a plain confirmation, then clears the PIN. No PIN
>   verification. Hidden on the owner's own profile when the account has 2 or more profiles.
> - The owner profile can always set a PIN when it has none.
> - The owner's PIN is therefore mandatory whenever the account has more than one profile.

## How it works today

The buttons live in a feed (`…/pin/actions`), rendered in **My Stuff**, not on the manage
screen, and they belong to the profile in session:

| Button | Today | Requirement |
|---|---|---|
| Set PIN | shown when the profile has none | same |
| Change PIN | asks for the **current** code first | no verification |
| Disable PIN | confirmation **and** the current code | confirmation only |
| Delete PIN on the owner with 2+ profiles | shown | must be **hidden** |
| Buttons on another profile | Set/Change, from the form and the manage feed; no Delete | owner sees Set/Change and Delete on every profile |

## Backend — what the API must return

Per target profile, given the active profile:

- `Set PIN` / `Change PIN` — one `pinCode` action with `flow: "set-pin"`, plus
  `cloudEventPayload.profile` = **target**.
- `Delete PIN` — `confirmDialog` then `com.applicaster.pin.change.v1` with
  `data.step: "disable"` and the target profile.
- Omit `Delete PIN` when the target is the owner and the account has 2+ profiles.
- Always include `Set PIN` when the owner has none.

Because no code is asked, the server must authorise these writes from the manage grant
(NR-2), not from the request body.

## This cannot be done in the form

The requirement puts these buttons on the Manage Profile screen, which today is the form.
They cannot go there.

The set of buttons a profile gets depends on whether it has a PIN — *Set* before, *Change*
and *Delete* after — so the set is wrong the instant a code is set. Correcting it means
fetching the screen again, and a form cannot fetch itself. A feed component can, and the
PIN actions already do it with `refreshComponent`, which is why they work where they sit
today.

**What we propose instead**, both from [BR-6](./br-06-profile-page-tabs.md):

- **A tab.** If the form works inside `quick-brick-tabs` — untried, and cheap to find out
  — the profile page is a tabs screen, and the PIN gets a tab of its own beside Settings.
- **Or an intermediate profile page**, the tile opening a page rather than the form: the
  header, the PIN feed, a way through to the form for the fields, and room for a better
  avatar picker.

Either way the PIN is a feed component on a surface of its own, above the fields rather
than among them — never a property of the form.

**Worked example:** [local-podcast-example
#3](https://github.com/applicaster/local-podcast-example/pull/3) builds it on our own
server, so the arrangement can be seen running rather than argued about.

## Where the contract is

[Spec §4.1](../contract/aioc-pin-feeds-spec.md#41-a-profiles-own-settings) carries both rules and the reason for them:
the feed answers about the profile in the url rather than the one asking, and the owner
loses Delete PIN once the account has two or more profiles, because that code is what
authorises every parental act and removing it leaves the other profiles unsettable.

Neither needs anything new stored. `extensions.master`, `has_pin` and the number of
entries in the list are the whole input.

The reference server follows both: the feed answers about the profile in the url and
serves nothing to a viewer who is neither that profile nor the owner, and Delete PIN is
gone from the owner once the account has a second profile.

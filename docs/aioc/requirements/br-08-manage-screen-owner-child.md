# BR-8 — Manage Profile screen, owner active, target is a child

**Status:** Specified — the contract is written, the build is the customer's

## The requirement

> All fields show: Change Profile Image, Profile Name, Unique Display Name, Date of Birth,
> Gender, and the PIN controls described in BR-12. Below these, one Parental Controls
> section shows the five allow checkboxes (Commenting, Changing Profile Picture, Changing
> Profile Display Name, Offline Downloads, Favorites) and the content restrictions list for
> the target. Date of Birth and Gender are required.

## How it works today

The proxied form has an avatar picker, a display name field, Save and Cancel, plus the PIN
button we splice in. No Parental Controls section, no restrictions, no DOB or gender.

## Backend — what the API must return

In `properties`, for an owner-active request on a child target:

| Property | Notes |
|---|---|
| avatar picker, profile name, display name | as today |
| date of birth, gender | **required** — validation server-side, message shown by the form |
| five permission checkboxes | map onto the existing `denied_actions` flags, inverted (the requirement phrases them as *allow*) |
| content restrictions | BR-11 |

Everything saves with the screen's own Save.

The PIN buttons are **not** in this list, though the requirement groups them here: they
come from a feed of their own, because the set changes the moment a code is set and a form
cannot fetch itself again (BR-12,
[BR-6](./br-06-profile-page-tabs.md#where-the-pin-controls-go--not-in-the-form)).

## The form has to know whose it is

`GET /CMS/profiles/form` takes no parameter and serves the same form for every profile,
so nothing in the request names the subject. While the owner edits a child, a form that
falls back to the header edits the owner instead: the PIN button sets the owner's code
and looks like it worked. That is what happened on the stand.

How the subject travels is explained once, in
[BR-7](./br-07-manage-screen-child.md#how-the-form-learns-which-profile-was-tapped) —
the url carries a locator and the data source fills it from the tapped tile. The same
mechanism serves this requirement; nothing here differs.

## Where the contract is

[Section 6, Addition 4](../contract/aioc-pin-feeds-spec.md#addition-4--the-parental-controls-section) of the feed contract
carries the section property by property, with the allow/deny inversion spelled out.
[Addition 1](../contract/aioc-pin-feeds-spec.md#addition-1--accept-a-profile-in-the-url)
carries the `?profile=` change and how the value reaches it.

The reference server renders the section from `denied_actions` today, so the shape is
visible on the stand. What it cannot do is save: the form posts to their backend, which does
not know these fields yet.

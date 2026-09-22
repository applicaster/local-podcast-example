# BR-9 — Manage Profile screen, owner active, target is the owner

**Status:** Done, except the message — the form has no way to show text yet, and we are adding one

## The requirement

> The owner sees Change Profile Image, Profile Name, Unique Display Name, Date of Birth,
> Gender, and the PIN controls described in BR-12. The Parental Controls section and
> content restrictions are not shown. In their place, the screen shows a message
> encouraging the owner to create a separate profile for each child […]. The message copy
> is owned by the product team.

## How it works today

Everything in this requirement works, with one exception: the message.

The fields, and leaving Parental Controls and restrictions off the owner's own profile,
are the form's to decide and it decides them — same `properties` array as
[BR-8](./br-08-manage-screen-owner-child.md), minus those two sections.

## The message needs a component that does not exist

The form has no way to show a line of text. There is a `label` type in the form screen
plugin, but a property whose preset is not mapped in the app is dropped before it reaches
the screen, and no label preset is mapped — so nothing text-only renders today.

**We are adding one:** a form component that displays a **title, a subtitle and a
comment**, and nothing else. The encouragement message is then a property like any other:

```json
{ "id": "ownerParentalControlsNote", "type": "label",
  "options": { "title": "Parental Controls",
               "description": "<the message>",
               "comment": "<optional smaller line>" } }
```

The copy is the product team's; the reference server shows a placeholder until it arrives.

The same component closes two other lines that cannot be shown for the same reason: the
**Account Owner** label ([BR-5](./br-05-profile-page-header.md)) and the "You do not have
permission to make changes to this profile" line
([BR-7](./br-07-manage-screen-child.md)).

## Where the contract is

[Section 6, Addition 5](../contract/aioc-pin-feeds-spec.md#addition-5--the-owners-own-profile-says-why-it-has-no-controls)
of the feed contract.

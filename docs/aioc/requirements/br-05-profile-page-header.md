# BR-5 — Profile page header

**Status:** Not built — there is no profile page to put a header on; two ways to get one

## The requirement

> The label "Account Owner" appears above the tile when the target profile is the owner.

## We do not have this

There is no screen today that shows a profile with a header above it. A tile opens the
form, and the form is a list of fields. So the question is not where the label goes but
which screen it goes on, and there are two answers.

### Option 1 — the form carries it

The tile opens the form, as it does now, and the label becomes a property of the form:
a text field returned first in `properties`, only when the subject is the owner.

```json
{ "id": "accountOwnerLabel", "type": "label", "preset": "",
  "options": { "title": "Account Owner", "description": "<optional subtitle>" } }
```

What it costs us: nothing text-only renders in the form today — a property whose preset is
not mapped in the app is dropped before it reaches the screen, and no label preset is
mapped. A form component that shows a title, subtitle and comment is being added for
[BR-9](./br-09-manage-screen-owner-owner.md#the-message-needs-a-component-that-does-not-exist),
and it carries this label too.

Cheapest route, and it keeps one screen per profile.

### Option 2 — an intermediate profile page

The tile opens a page about the profile rather than the form itself: the header with the
**Account Owner** label, the avatar, the PIN controls, and a way through to the form for
the fields. The form stays what it is; the page is what the tile now leads to.

More work — a screen that does not exist yet — but it is the shape the rest of the
requirements need anyway: the PIN buttons get somewhere of their own to live
([BR-12](./br-12-pin-controls.md)) instead of riding in the form, and the sections the
customer describes as tabs ([BR-6](./br-06-profile-page-tabs.md)) become sections of this
page.

Worked example of the page and where the PIN sits on it:
[local-podcast-example #3](https://github.com/applicaster/local-podcast-example/pull/3).

### Which

Option 2 — see
[BR-6](./br-06-profile-page-tabs.md#where-the-pin-controls-go--not-in-the-form). The PIN
controls cannot live in the form at all: the buttons a profile gets depend on whether it
has a PIN, and a form cannot fetch itself again after one is set. A page around the form
is needed regardless, and once it exists the label is a line on it rather than a field
bolted to a form that would be moved later.

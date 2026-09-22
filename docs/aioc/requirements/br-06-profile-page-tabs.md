# BR-6 — Profile page tabs

**Status:** Not started — tabs are not available for this screen; the sections become a profile page instead

## The requirement

> Every profile page shows Comments and Settings. The Account Info tab appears only when
> the target profile is the owner. There is no separate Restrictions tab.

## Tabs are not available here

The app has a tabbed screen — `quick-brick-tabs`, used three times — but not one that can
hold this. Every tab in use holds a content screen; a form has never been put in one, and
it is not something we can offer today.

So the requirement is read for what it asks rather than how it names it: Comments,
Settings and Account Info are **sections of a profile page**, not tabs of one. Whether
they later become tabs is a presentation change on a page that already exists.

## Where the PIN controls go — not in the form

Settled on the platform side, and it decides the shape of this screen:

> Manage profiles is part of the specific profile screen — part of the form, basically.
> We can't add it to the form: it would require a form screen reload after a PIN is set,
> to show a new set of buttons. Probably better to keep it separately.

The reload is the reason, and it is not a matter of taste. The buttons a profile gets
depend on whether it has a PIN — *Set* before, *Change* and *Delete* after — so the moment
one is set the form is showing the wrong set, and a form has no way to fetch itself again.
A feed does: the PIN actions already refresh their own component (`refreshComponent`),
which is why they work on the profile selection screen today.

So the PIN lives on its own surface: **a block on the profile page, above the fields —
anywhere but inside the form.** There is a worked example of the arrangement on our own
server: [local-podcast-example #3](https://github.com/applicaster/local-podcast-example/pull/3).

## The profile page

The tile opens a **profile overview** rather than the form: the header from
[BR-5](./br-05-profile-page-header.md), the PIN management feed, a way through to the form
for the fields, and possibly the avatar picker. Account Info
([BR-14](./br-14-account-info-tab.md)) is a section of the same page, shown only when the
target is the owner.

The avatar is the other reason for it. On the form it is a horizontal rail, which is a
poor way to choose from many; the form cannot be broken into steps and has no separate
picker yet, so a page around it is the only place a better picker could go.

This and BR-5 are one piece of work, and the PIN buttons
([BR-12](./br-12-pin-controls.md)) get somewhere of their own to live instead of riding
inside the form.

## What the backend supplies

Whether the target is the owner, which the profile list already carries as
`extensions.master`, and which the form can also state (BR-5). The **content** for Account
Info is membership and billing — [BR-14](./br-14-account-info-tab.md).

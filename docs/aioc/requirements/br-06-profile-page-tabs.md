# BR-6 — Profile page tabs

**Status:** Not started — the app has a tabs screen, untried with a form inside it

## The requirement

> Every profile page shows Comments and Settings. The Account Info tab appears only when
> the target profile is the owner. There is no separate Restrictions tab.

## What exists

A tabbed screen is not new to this app: `quick-brick-tabs` is already used three times —
*Tab Hub*, *Life Themes Tabs*, and one unused screen. So the container the requirement
asks for exists and is configured in Zapp like any other screen.

**What has never been tried is a form inside one.** Every tab in use today holds a
content screen; nobody has put `quick-brick-form-screen` in a tab, and whether it behaves
there — its own scrolling, its Save, the way it takes a subject — is unknown until it is
tried. That is the first thing to find out, and it is cheap: point one tab at the profile
form and open it.

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

So the PIN lives on its own surface: **its own tab, or a block at the top of the profile
page — anywhere but inside the form.** There is a worked example of the arrangement on our
own server: [local-podcast-example #3](https://github.com/applicaster/local-podcast-example/pull/3).

## Two ways to the same place

**Try the tabs screen.** If the form works inside a tab, the profile page is a tabs screen
whose Settings tab is the form as it is today, and the header from
[BR-5](./br-05-profile-page-header.md) sits above the tab bar. Nothing new is built; the
pieces are arranged differently.

**Or the intermediate page** from [BR-5](./br-05-profile-page-header.md), option 2, which
is where the platform side leans: the tile opens a **profile overview** — the header, the
PIN management feed, a way through to the form for the fields, and possibly the avatar
picker. Tabs can be added to that page later, or it can stay one screen with sections.

The avatar is the other reason for it. On the form it is a horizontal rail, which is a
poor way to choose from many; the form cannot be broken into steps and has no separate
picker yet, so a page around it is the only place a better picker could go.

Either way this and BR-5 are one piece of work, and the PIN buttons
([BR-12](./br-12-pin-controls.md)) get somewhere of their own to live instead of riding
inside the form.

## What the backend supplies

Whether the target is the owner, which the profile list already carries as
`extensions.master`, and which the form can also state (BR-5). Tab **content** for Account
Info is membership and billing — [BR-14](./br-14-account-info-tab.md).

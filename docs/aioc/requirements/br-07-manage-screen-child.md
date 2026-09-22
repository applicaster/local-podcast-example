# BR-7 — Manage Profile screen, active profile is a child

**Status:** Specified — the contract is written, the build is the customer's

## The requirement

> A child can only ever open its own Manage Profile screen.
> - If the active profile is denied both change-picture and change-display-name, the screen
>   shows only "You do not have permission to make changes to this profile."
> - Otherwise it shows Change Profile Image only if the active profile may change pictures,
>   and Unique Profile Display Name only if it may change names.
> - The Set or Change PIN button is always shown, and the Delete PIN button when the child
>   has a PIN.
> - Profile Name, Date of Birth, Gender, Parental Controls, and content restrictions are
>   hidden.

## How it works today

`CMS/profiles/form` returns the same form for everyone, but nothing stops it from
returning a different one: **the form can be whatever the backend decides.** Which fields
appear per role is a server decision end to end — the screen renders the `properties` it
is given, so there is no limit on our side to work around.

The one part that cannot go in it is the PIN. Set, Change and Delete are a set that
changes the moment a code is set, so they have to come from a feed that can refresh
itself; mixing that into the form would mean reloading the form, which is not something a
form screen can do. See
[BR-6](./br-06-profile-page-tabs.md#where-the-pin-controls-go--not-in-the-form).

## How the form learns which profile was tapped

There is a working example in Zapp — the *Sandbox form screen*:

```
https://zapp.applicaster.com/accounts/69c2e983e7f828288d1e4777/app_families/6420/rivers_configurations/94919468-85a6-471e-a06d-c1251df377ce/rivers?component=f72ef2e0-fb83-4a13-b97e-8b5c20cdbbf3
```

Its **form feed** is configured like this:

```json
{
  "form_feed": {
    "source": "https://zapp-ran-demo.web.app/profiles/form?profile={{profile}}",
    "mapping": {
      "profile": { "property": "extensions.form_data.profileId", "source": "entry" }
    }
  }
}
```

Two halves, and both are needed:

- **`{{profile}}` in the url**, which on its own resolves to nothing;
- **a mapping that fills it from the entry** — `source: "entry"` means the entry that
  navigated to this screen, and `property` is where on it the value sits.

So the tile carries the id it wants the form to be about:

```json
{
  "id": "a3JVE000005wXaD2AU",
  "title": "Abigail",
  "extensions": { "form_data": { "profileId": "a3JVE000005wXaD2AU" } }
}
```

and the tap action passes that entry along:

```json
{ "type": "navigateToScreen",
  "options": { "typeMapping": "profile-edit", "navigationAction": "push",
               "entry": { "…": "this tile's entry" } } }
```

The form then requests `…/profiles/form?profile=a3JVE000005wXaD2AU`, and the subject is
the profile that was tapped rather than the profile in session — which is the whole
difference between a parent editing a child and a parent editing themselves.

## Backend — what the API must return

The form is a flat `properties` array, so this is entirely a server decision: return only
the properties the active profile may use. Inputs the endpoint needs:

- the **active** profile (who is asking) — see `00-terms-and-contract.md`;
- the **target** profile (`?profile=`);
- that profile's `denied_actions` (`change_picture`, `change_name`).

The PIN buttons are the exception: they are not properties of this form (BR-12).

## Where the contract is

[Section 6, Addition 3](../contract/aioc-pin-feeds-spec.md#addition-3--the-form-differs-by-who-is-looking) of the feed
contract carries the rule as a table of the three viewer/target cases, including which
`denied_actions` keys decide what a child may see. The reference server serves that shape
already, so it can be read off a running response rather than off this page.

It also settles what this page used to leave open: the form takes its subject from the
url, not from the header, so the deadlock in §2 never reaches it. The copy for the
"no permission" line is quoted in the requirement itself.

One thing on our side: nothing text-only renders in the form today, so that line cannot be
shown yet. The component that will show it — title, subtitle, comment — is being added for
[BR-9](./br-09-manage-screen-owner-owner.md#the-message-needs-a-component-that-does-not-exist).

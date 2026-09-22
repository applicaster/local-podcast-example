# BR-14 — Account Info tab

**Status:** Not started — and there is nowhere to put a tab yet; see the same recommendation as BR-5, BR-6 and BR-12

## The requirement

> Shows membership status, Sign Up/Renew, billing and payment forms, and the account-level
> Danger Zone with Delete My Account. Only the account-level Danger Zone re-checks that the
> active profile is the owner.

## We do not see this today

Nothing in the app shows membership or billing on a profile, and there is no tabbed
profile page for a tab to sit in.

Which is the same recommendation as three requirements before it:

- **a tab** on a tabbed profile page, if the form works inside `quick-brick-tabs` —
  untried, and cheap to find out ([BR-6](./br-06-profile-page-tabs.md));
- **or an intermediate profile page** the tile opens instead of the form, with the header,
  the PIN feed and a way through to the form ([BR-5](./br-05-profile-page-header.md)).

BR-5, BR-6, BR-12 and this one all ask for the same thing: somewhere other than the form.
Built once, the Account Info tab is another tab on it rather than a screen of its own —
shown only when the target is the owner.

Worked example of the arrangement, on our own server:
[local-podcast-example #3](https://github.com/applicaster/local-podcast-example/pull/3).

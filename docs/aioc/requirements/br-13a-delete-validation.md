# BR-13a — Backend validation for profile deletion

**Status:** Not implemented — and deletion now works, so this is the only thing standing in front of it

## The requirement

> The API rejects a delete request unless the requesting viewer is the account owner and
> the profile being deleted is not the owner profile. The app must not be the only
> enforcement point. This is a Salesforce change and belongs to Digital Solutions.

## How it works today

The API accepts what it is supposed to refuse: the account owner's own profile can be
deleted today, and nothing checks who is asking.

This stopped being theoretical when the delete button shipped ([BR-13](./br-13-delete-profile.md)).
Hiding the button is worth doing, but it is presentation: the endpoint is reachable
without it.

## Backend — what the API must return

Refuse with **403** and a message when the caller is not the owner, or when the target is
the owner profile. The same reasoning applies to every write behind the manage gate: the
client chain is a convenience, never proof — see NR-2 and NR-3.

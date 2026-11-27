# BR-13 — Delete Profile

**Status:** Partly built — the button works; the rule that decides where it appears does not

## The requirement

> Only the account owner can delete a profile, and the owner cannot delete their own
> profile. The Danger Zone with Delete Profile appears only when the active profile is the
> owner and the target is not the owner. A confirmation dialog is required. No PIN.

## How it works today

The button is a property of the form and deleting works.

**What is missing is where it appears.** The button is shown on every profile, including
the account owner's, and deleting the owner goes through. The requirement wants the
opposite: the form returns the button only when the active profile is the owner and the
target is not, so a profile that may not be deleted simply has no button.

That is the whole of it on this side — the form already decides what it returns, and this
is one more condition on one property.

And it is only half the fix: a button that is not returned is not a rule. The server has
to refuse the delete as well — [BR-13a](./br-13a-delete-validation.md), which today lets
through exactly what it is supposed to stop.

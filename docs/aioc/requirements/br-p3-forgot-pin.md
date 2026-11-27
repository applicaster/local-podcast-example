# BR-P3 — Forgot PIN on every PIN prompt

**Status:** Partial — the button works; the failure state with the phone number is **deferred**

## The requirement

> Every screen that asks for a PIN shows a "Forgot PIN" button. Pressing it sends the PIN to
> the account email and shows a confirmation with the email address used. If the request
> fails, the screen shows an error and the 1-800-A-FAMILY number.

## How it works today

- The event exists: `com.applicaster.pin.recovery.requested.v1`, accepted with no
  authority, which is right — not knowing the code is the premise.
- It is reachable as a **row in the PIN actions list**, as the `/pin/recover` feed, and —
  since the plugin change — as a button on the PIN screen itself, offered by both gates:
  the profile list recovers the profile being entered, the gate on restricted content
  recovers the **account owner**, whose code it asks for.
- The reference server does **not** mail anything. It sets the code to a known value and
  logs the mail it would have sent, which is why it is a test rig.
- No email address in the confirmation, no failure copy, no phone number yet.

## The failure state is deferred

> If the request fails, the screen shows an error and the 1-800-A-FAMILY number.

**Deferred, not dropped — we will do it, but not in this iteration.** It needs something the client does not
have yet: an action chain runs one step after another and does not branch, so "on success
show the confirmation, on failure show the number" cannot be expressed in a feed at all. A
refused event ends the chain and the user is told nothing.

The functionality will be added — the parent lock screen sending the recovery itself and
rendering its own error, the way it already renders the error from a failed verification.
Until then, pressing Forgot always sends the request and always shows the confirmation,
and whether the reminder arrived is answered by the mailbox.

## What the mail contains is entirely yours

The app sends one event, `com.applicaster.pin.recovery.requested.v1`, naming the profile.
Everything after that is on your side, and the app neither knows nor cares which way you
go:

- **mail the existing code** — "Your PIN is 1234". Only possible if PINs are stored
  readably: a hash cannot be read back. For a four-digit parental code, protecting a
  child's content rather than an account, that is a defensible way to store it — but it is
  a decision for your security review, not something to inherit from the wording of a
  requirement.
- **mail a way to set a new one** — a link to a form, or a one-time code. Works with
  hashed storage, and the link can be single-use and short-lived.

Either way the PIN keeps working until the person changes it, and neither needs a separate
"reset" feature in the app: Forgot **is** the reset, and its whole client side is the one
event.

The confirmation the app shows afterwards is a `showToast` in the feed, so its wording is
theirs as well: whoever writes the feed writes the sentence that matches what the mail
actually says. Nothing in the client needs to know.

## Backend — what the API must return

- Accept `com.applicaster.pin.recovery.requested.v1` with the account token and
  `data.profile`, and answer 200. The reference server only records the request; sending
  the mail, deciding what it contains and which address it goes to are all yours.
- Answer 400 with a `message` if the request cannot be honoured. The message reaches the
  user only on the parent lock screen's own verification, not here — see the gap below.

## Which profile is recovered

The recovery names the profile whose **code was asked for**, not the person holding the
phone. Entering a protected profile recovers that profile; a gate on restricted content
asks for the account owner's code, so it recovers the owner. Anything else would mail a
reminder to someone who was not being asked for anything.

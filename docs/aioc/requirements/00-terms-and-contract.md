# 00 — Terms and contract

**Status:** **Done** — the vocabulary is settled; only the events transport is open, and that is §2 of the contract

## The requirement

> **Account owner**: a profile the API returns with the `accountOwner` flag set. […]
> **Child profile**: any profile that is not the account owner. […]
> **PIN**: a 4-digit numeric code stored per profile. The API only reports whether a PIN
> exists. Verification is a server call that sends the PIN and viewer id as headers.

## How it works today

- The owner is the profile whose `extensions.master` is set in `CMS/profiles/select`.
  Exactly one per account; everything parental keys off it.
- `extensions.kids` exists as well. It affects the experience, never authority: a profile
  that is not a kids profile is still not a parent.
- Whether a PIN exists is reported per profile as `extensions.has_pin`.
- A PIN is verified by a CloudEvent (`com.applicaster.pin.v1`) whose `data` carries the
  profile id, not by headers — see the deadlock below.

## Backend — what the API must return

| Field | Where | Meaning |
|---|---|---|
| owner flag | profile entry in `CMS/profiles/select` | exactly one profile per account |
| `extensions.has_pin` | same | live at the moment of the request |
| `extensions.kids` | same | experience only |

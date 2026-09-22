# BR-11 — Content restrictions live in Parental Controls

**Status:** Specified — the contract is written; the matching change is ours and waits only on their fields

## The requirement

> Content restrictions are edited inside the Parental Controls section on the Manage
> Profile screen, for non-owner targets only. Adding or removing a topic requires no PIN.
> Restrictions save with the screen's main Save button. There is no separate Save.

Related: **content restrictions (exclusions)** are a per-profile list of sensitive topics;
content tagged with an excluded topic is locked for that profile.

## Where the contract is

The vocabulary, the list per profile, the topics per item and the matching rule are in
[the client guide](../guide/README.md#content-restrictions-by-topic), with the form
property in [spec §6, Addition
4](../contract/aioc-pin-feeds-spec.md#addition-4--the-parental-controls-section).

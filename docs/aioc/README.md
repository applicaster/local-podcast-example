# Adventures in Odyssey — profiles and PIN

Everything written for Focus on the Family about the profile feature and the
PIN that guards it. Three documents, and which one you want depends on the
question.

| Start here if you want to… | Document |
|---|---|
| set it up, or walk through it on a device | [**The guide**](./guide/README.md) |
| build it on your own backend | [**The contract**](./contract/aioc-pin-feeds-spec.md) |
| see a whole payload rather than a fragment | [**The captures**](./contract/README.md) |

## What each one is

**[The guide](./guide/README.md)** — the walkthrough. What the feature does,
who the roles are, what to configure in Zapp, and eight numbered scenarios with
screenshots for checking it on a device. Section 6 is the short version of what
the backend has to do. Read this first; it is the only document that assumes
nothing.

**[The contract](./contract/aioc-pin-feeds-spec.md)** — what the feeds have to
carry, field by field, so the reference server can be switched off and the app
can talk to Focus on the Family directly. Two existing endpoints gain additions
(§3 and §6); four feeds are new (§4); the cloud events behind them are §5; §7 is
who may authorise what. **§2 holds the one unresolved question** — `CMS/events`
requires a profile in a request made before any profile exists — and nothing
runs against a real backend until that is settled.

**[The captures](./contract/README.md)** — live responses from the reference
server, saved verbatim, one file per feed. For reading the contract against
something real.

## Kept here, not written for the customer

Two pages track the work rather than describe it, and they read like it —
ownership, open questions, what is still unbuilt.

**[Requirement by requirement](./requirements/README.md)** — one page per
requirement, with its status and whatever is still outstanding on it.

**[Gap analysis](./gap-analysis.md)** — what is settled, what belongs to the
customer, and what is left with us.

## How they fit together

**The contract** says what the feeds have to carry, field by field. **The guide**
is how to configure and walk through what exists, and **the captures** are it
answering.

A question usually travels one way: *what does the requirement ask* → *what does
the payload look like* → *what does it look like running*.

## The one thing to read first

Whatever else you take from here: a PIN request has to name its subject
**explicitly**, in the url for a feed and in `data.profile` for an event, and
never by way of the profile already in session. Every document here assumes
that, and the reason it has to be so is [§2 of the
contract](./contract/aioc-pin-feeds-spec.md#which-profile-a-request-is-about--and-the-deadlock-in-cmsevents).

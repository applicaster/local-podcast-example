# Captured feeds

Live responses from the mock server, saved verbatim. They are what §3, §4 and §6 of
[`aioc-pin-feeds-spec.md`](./aioc-pin-feeds-spec.md) describe, and exist so a
reader can see a whole payload rather than the fragments the spec quotes.

Captured with a bearer token and `Accept: application/vnd+applicaster.pipes+json`;
the mock answers 401 without one.

`viewer-profiles.json` and `viewer-profiles-manage.json` are captured on the
**fallback** path: the mock proxies `CMS/profiles/select`, and these captures had
no live account token to offer. What they show is the fixture with the live
rewrites applied — the same shape and the same rewrites the customer's own list
gets, differing only in where the list came from.

| File | Request | Shows |
|---|---|---|
| `viewer-profiles.json` | `GET /viewer-profiles` | Six profiles, two of them protected — so both branches are visible in one payload: `has_pin: true` with the `pinCode` gate in front of the session actions, and `has_pin: false` without it. `extensions.unlocked` is the inverse of `has_pin` and is what draws the padlock; the gate carries `promptText` naming the profile. `master: 1` on the first. Note `type: "action"` throughout; upstream sends `profile`. Captured without a viewer, so every protected tile is gated — a real request names one, and that tile's gate is dropped. |
| `pin-actions-protected.json` | `GET /pin/actions?profile=a3JVE000007CgIn2AK` | A profile that has a PIN: change, disable, the owner's control, forgot. |
| `pin-actions-unprotected.json` | `GET /pin/actions?profile=profile-without-a-pin` | A profile with no PIN: a single `set-pin`. The id is deliberately one the fixture does not know — the branch depends on the PIN store, not on the profile existing. |
| `pin-actions-manage.json` | `GET /pin/actions/manage?profile=a3JVE000007CgIn2AK` | What the owner may do to another profile. Note the two different ids: the first `pinCode` verifies the **owner** and carries `purpose: "manage"`, the second collects a code for the **target**. The feed posts no event of its own — the parent lock screen sends `pin.set.v1` once the code is typed. |
| `pin-recover.json` | `GET /pin/recover` | The forgot-PIN screen's feed. |
| `profiles-manage-entry.json` | `GET /profiles/manage-entry` as the owner | The way into Manage Profiles (§4.4). Captured on an owner who has a PIN, so both halves show: the title is the plural **Manage Profiles**, and the chain is the `pinCode` gate carrying `purpose: "manage"` — the marker that separates proving authority from unlocking a profile to watch as — followed by `navigateToScreen`. A child sees `Manage Profile`, singular; a profile with no code gets the `navigateToScreen` alone. |
| `viewer-profiles-manage.json` | `GET /viewer-profiles?mode=manage` as a child | The same list with the tiles editing rather than entering (§3, Addition 5). Captured as *Fit Whit*, so both branches are in one payload: its own tile makes itself active and pushes `profile-edit`, every other tile answers with `showAlert`. Note what is **not** there — no `pinCode` in front of a tile, because the code was taken at the button, and no `goHome`, which would close the screen a parent has just opened. The `sessionStorageSet` that stays is what makes the tapped profile the subject of the form opening next. |
| `profiles-form.json` | `GET /profiles/form?profile=a3JVE000007CgIn2AK` | The customer's own form, fetched live from `CMS/profiles/form` and patched: `buttonManagePin` and the Parental Controls section are spliced in before `buttonSave`. Everything else is theirs. The checkboxes carry no values — those ride on the profile entry as `extensions.form_data`, which is where the form screen reads them (§6, "Where the values come from"). |

## Two things to read carefully

**The cloud events url is the public one** (`https://zapp-ran-demo.web.app/cloud-events`),
not the mock's own address. The client looks that url up in `pipes_endpoints` to
attach the bearer token and the profile header; a localhost url matches no endpoint,
so the request would go out bare and come back 401. Pointing it at a local server is a
dev override's job, one layer below the feed.

**The owner's control in `pin-actions-protected.json` asks for the owner's PIN**, not
the profile's own. It belongs to Manage Profiles; it is repeated in the profile's own
feed only because the app has no Manage Profiles screen yet, and it opens no hole —
the person the PIN locks out cannot get through the first action.

## Regenerating

With the mock running on port 3000:

```bash
curl -s 'http://localhost:3000/viewer-profiles' \
  -H 'Authorization: Bearer local' \
  -H 'Accept: application/vnd+applicaster.pipes+json' | python3 -m json.tool
```

The two feeds that vary by viewer need the profile named, which is the `profile`
header the endpoint config attaches:

```bash
curl -s 'http://localhost:3000/profiles/manage-entry' \
  -H 'Authorization: Bearer local' \
  -H 'profile: <owner profile id>' | python3 -m json.tool
```

To reach the fallback path on purpose, point `profilesFeedUrl` in the provision at
something unreachable; a refused connection is what makes the service serve its
fixture instead of passing a refusal through.

`profiles-form.json` also needs the upstream to be reachable — the mock proxies it
rather than inventing it.

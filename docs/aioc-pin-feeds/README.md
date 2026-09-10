# Captured feeds

Live responses from the mock server, saved verbatim. They are what §3, §4 and §6 of
[`aioc-pin-feeds-spec.md`](./aioc-pin-feeds-spec.md) describe, and exist so a
reader can see a whole payload rather than the fragments the spec quotes.

Captured with a bearer token and `Accept: application/vnd+applicaster.pipes+json`;
the mock answers 401 without one.

`viewer-profiles.json` is captured on the **fallback** path: the mock proxies
`CMS/profiles/select` and passes a refusal through, and this capture had no live
account token to offer. What the file shows is therefore the fixture with the
live rewrites applied — the same shape and the same rewrites the customer's own
list gets, differing only in where the list came from.

| File | Request | Shows |
|---|---|---|
| `viewer-profiles.json` | `GET /viewer-profiles` | Six profiles, two of them protected — so both branches are visible in one payload: `has_pin: true` with the `pinCode` gate in front of the session actions, and `has_pin: false` without it. `master: 1` on the first. Note `type: "action"` throughout; upstream sends `profile`. |
| `pin-actions-protected.json` | `GET /pin/actions?profile=a3JVE000007CgIn2AK` | A profile that has a PIN: change, disable, reset, forgot. |
| `pin-actions-unprotected.json` | `GET /pin/actions?profile=profile-without-a-pin` | A profile with no PIN: a single `set-pin`. The id is deliberately one the fixture does not know — the branch depends on the PIN store, not on the profile existing. |
| `pin-actions-manage.json` | `GET /pin/actions/manage?profile=a3JVE000007CgIn2AK` | What the owner may do to another profile. Note the two different ids: the `pinCode` verifies the **owner** and carries `purpose: "manage"`, the cloud event names the **target**. |
| `pin-recover.json` | `GET /pin/recover` | The forgot-PIN screen's feed. |
| `profiles-form.json` | `GET /profiles/form?profile=a3JVE000007CgIn2AK` | The customer's own form, fetched live from `CMS/profiles/form` and patched: `buttonResetPin` is spliced in before `buttonSave`. Everything else is theirs. |

## Two things to read carefully

**The cloud events url is the public one** (`https://zapp-ran-demo.web.app/cloud-events`),
not the mock's own address. The client looks that url up in `pipes_endpoints` to
attach the bearer token and the profile header; a localhost url matches no endpoint,
so the request would go out bare and come back 401. Pointing it at a local server is a
dev override's job, one layer below the feed.

**The reset chain in `pin-actions-protected.json` asks for the owner's PIN**, not the
profile's own. Reset belongs to Manage Profiles; it is repeated in the profile's own
feed only because the app has no Manage Profiles screen yet, and it opens no hole —
the person the PIN locks out cannot get through the first action.

## Regenerating

With the mock running on port 3000:

```bash
curl -s 'http://localhost:3000/viewer-profiles' \
  -H 'Authorization: Bearer local' \
  -H 'Accept: application/vnd+applicaster.pipes+json' | python3 -m json.tool
```

`profiles-form.json` also needs the upstream to be reachable — the mock proxies it
rather than inventing it.

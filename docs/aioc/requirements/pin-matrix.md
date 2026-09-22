# §4 — Where a PIN is required, and whose

**Status:** Partial

## The requirement

The customer's table, with our state against each row.

| Action | Whose PIN | Today |
|---|---|---|
| Select or switch to a profile that has a PIN | that profile's own | ✅ implemented |
| Re-select the already active profile | none | ✅ the gate is skipped on the viewer's own tile |
| Press the manage button | owner active: the owner's, covering every profile; child active: its own | ❌ no gate (NR-2) |
| Add a profile | none, but the owner must already have a PIN | ⚠️ the tile and creation work on their side; the PIN precondition is not enforced (BR-2) |
| Set or change a PIN on the manage screen | none | ❌ we ask (NR-3, BR-12) |
| Delete a PIN on the manage screen | none | ❌ we ask (NR-3, BR-12) |
| Add or remove a content restriction | none | n/a — there are no topics to add yet (BR-11) |
| Play or unlock restricted content | the account owner's | ✅ implemented (BR-P1) |
| Download restricted content | the account owner's, only the owner's | ❌ not this iteration (BR-P2) |
| Delete a profile | none beyond a confirmation | ⚠️ works, and unguarded: the button shows on the owner too, and the API refuses nothing (BR-13, BR-13a) |
| Delete the account, change payment or membership | none beyond being on the owner's tab | ❌ no such tab exists (BR-14) |

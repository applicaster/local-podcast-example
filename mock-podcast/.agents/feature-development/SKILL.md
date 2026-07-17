---
name: feature-development
description: "Use when implementing or modifying mock-podcast features. Follow a strict workflow: make code changes, run relevant unit tests, then verify behavior with HTTP requests against localhost endpoints."
---

# Feature Development Workflow (mock-podcast)

Use this workflow for all feature work in `libs/mock-podcast`.

## Goal

Ship changes safely by validating in two stages:
1. unit tests
2. runtime HTTP behavior

## Mandatory Sequence

1. Understand scope and find touched modules.
2. Implement the minimal code changes.
3. Run relevant unit tests.
4. Verify behavior with HTTP requests.
5. Report results with concrete evidence.

Do not skip steps 3 or 4.

## Step 1: Scope and Impact

- Identify modules and files impacted by the feature.
- Check constants, services, controllers, and related specs.
- Prefer existing shared constants over inline strings/URLs.

## Step 2: Implement Changes

- Keep changes focused and minimal.
- Reuse existing patterns in this library:
  - action payload shape in `extensions.entry_action` / `extensions.tap_actions`
  - cloud event routing in `cloud-events.service.ts`
  - shared constants under `src/constants/`
- Preserve queue/system protections and existing behavior unless explicitly changed.

## Step 3: Unit Tests (Required)

Run only impacted suites first, then expand if needed.

Example commands:

```bash
npx --prefix . jest \
  libs/mock-podcast/src/modules/collections/collections.service.spec.ts \
  libs/mock-podcast/src/modules/cloud-events/cloud-events.service.spec.ts \
  --runInBand --watch=false
```

```bash
npx --prefix . jest \
  libs/mock-podcast/src/modules/media/media.service.spec.ts \
  --runInBand --watch=false
```

If tests fail:
- fix code or tests
- rerun until green

## Step 4: HTTP Verification (Required)

Use `curl` + `jq` against localhost to validate real endpoint behavior.

Base URL:

```bash
BASE='http://localhost:3000'
```

Examples:

Check feed shape:

```bash
curl -s "$BASE/user/collections" | jq '{title, total_entries: (.entry|length)}'
```

Verify action payload fields:

```bash
curl -s "$BASE/user/collections/queue" | jq '.entry[] | {id, entry_action: .extensions.entry_action}'
```

Trigger cloud event:

```bash
curl -s -X POST "$BASE/cloud-events" \
  -H 'Content-Type: application/json' \
  -d '{"type":"com.applicaster.collection.remove.v1","data":{"collectionId":"queue","itemId":"slay"}}' \
  | jq '{type, subject, has_id: (.id != null)}'
```

Confirm state changed after refresh/fetch:

```bash
curl -s "$BASE/user/collections/queue" | jq '{audio_ids: [.entry[] | select(.type.value=="audio") | .id]}'
```

## Step 5: Report Format

Always report:

1. What changed (files + behavior)
2. Test command(s) executed and pass/fail summary
3. HTTP command(s) executed and observed result
4. Any caveats or non-blocking issues

## Quality Rules

- Prefer constants for repeated strings, event types, and icon URLs.
- Keep user-facing labels centralized.
- Keep API compatibility unless feature requires contract change.
- Keep tests aligned with intended runtime behavior, not legacy behavior.

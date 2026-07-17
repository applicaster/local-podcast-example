# Copilot Instructions for feed-decorators

## Project Overview
- This is a TypeScript library for building, validating, and processing role-based feeds and actions for Zapp/Applicaster-style apps.
- The core concept is a strongly-typed DSL for generating feeds and entries with specific roles, behaviors, and actions, supporting both client and server-side use.
- Major domain concepts: **Action**, **Behavior**, **Role**, **Feed**, **Entry**, **Resolver**, **Value Provider** (see docs/TopLevelOverview.md).

## Key Components & Files
- `src/feed-builder.ts`: Main API for building preference feeds. Use `buildPreferenceFeed()` with `PreferenceFeedOptions`.
- `src/actions-builder.ts`: Chainable builder for entry actions. Use `ActionsBuilder` to add actions and call `.build()`.
- `src/action-validators.ts`: Zod-based validators for all supported actions. Use `validateActionPayload()` for runtime validation.
- `src/zod-definitions.ts`: Zod schemas for feeds, entries, behaviors, and options. Use `validateZappFeed()` and related functions.
- `docs/Actions.md`: Full reference for supported actions, behaviors, and feed roles.
- `docs/TopLevelOverview.md`: Domain model and architectural context.

## Patterns & Conventions
- **Feed Construction**: Always use `buildPreferenceFeed()` for preference feeds. Pass an `actionBuilder` callback to pre-inflate actions server-side; omit for client-side inflation.
- **Behavior Block**: Only add `behavior` in feeds if pre-inflating actions (no `role`). If `role: "preference_editor"` is present, omit `behavior` (client will add it).
- **Action Building**: Use `ActionsBuilder` for all entry actions. Each method matches an action in docs/Actions.md. Always call `.build()` to finalize the entry.
- **Validation**: Use Zod validators (`validateZappFeed`, `validateActionPayload`) in tests and runtime checks. Schemas enforce correct structure for feeds and actions.
- **Testing**: All tests are in `src/__test__`. Use `npm run test` to run the suite. Tests validate both builder output and Zod schema compliance.
- **TypeScript Strictness**: Project uses strict type checking. Always check for possible undefined/null values in feeds and entries.

## Developer Workflows
- **Build**: `npm run build` (TypeScript compilation)
- **Test**: `npm run test` (Jest, with ts-jest)
- **Validation**: Use Zod validators for runtime and test validation.
- **Package**: `npm pack` to create a distributable tarball.

## Integration Points
- No external APIs or services are called directly; all integration is via feed/action/behavior conventions.
- Zod is used for all schema validation.

## Examples
```ts
// Build a multi-select preference feed with pre-inflated actions
const feed = buildPreferenceFeed({}, {
  key: "genres",
  type: "multi",
  entries: [ { id: "horror" }, { id: "comedy" } ],
  actionBuilder: entry => new ActionsBuilder(entry).toggleStorageFlag({ key: "genres" }).build()
});

// Validate feed and actions
validateZappFeed(feed); // true
feed.entry?.forEach(e => e.extensions?.tap_actions?.actions.forEach(a => validateActionPayload(a.type, a.options)));
```

## References
- See `docs/Actions.md` for all supported actions and feed roles.
- See `docs/TopLevelOverview.md` for domain definitions and architecture.
- See `src/__test__` for builder and validation test patterns.

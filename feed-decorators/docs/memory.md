# Feed Decorators Library Overview

## Purpose

Feed Decorators is a TypeScript library for building, validating, and managing preference feeds and action payloads in a structured, schema-driven way. It is designed to support declarative UI and backend systems that require robust, validated configuration for user preferences and actions.

## Structure

- **src/zod-definitions.ts**: Contains all Zod schemas and validators for feed, entry, and preference editor options. These schemas ensure that all data structures conform to expected formats and can be validated at runtime.
- **src/feed-builder.ts**: Implements the `buildPreferenceFeed` function and related types. This builder constructs feed objects with the correct structure and extensions, enforcing required fields and supporting custom entries.
- **src/actions-builder.ts**: Provides the `ActionsBuilder` class for constructing action payloads for feed entries. Supports various action types (toggle flag, set storage, send cloud event, etc.) and ensures correct payload structure.
- **src/action-validators.ts**: Contains Zod schemas and a validator function for all supported action types. Used to validate action payloads both programmatically and in tests.
- **src/index.ts**: Central export file, re-exporting all builders, validators, and schemas for easy consumption.

## Key Details

- **Validation**: All feed and action payloads are validated using Zod schemas. This ensures runtime safety and makes the library suitable for AI-driven or dynamic configuration.
- **Extensibility**: New feed types, entry extensions, or action types can be added by extending the relevant schemas and builder classes.
- **Testing**: The test suite validates both builder output and manual payloads against schemas, ensuring correctness and catching regressions.
- **AI Readiness**: The codebase is modular, with clear separation between schema definitions, builders, and validators. This makes it easy for an AI or developer to pick up work, extend functionality, or refactor as needed.

## Further Reading

- [Actions.md](Actions.md) — Details on supported action types, payload formats, and validation logic.
- [TopLevelOverview.md](TopLevelOverview.md) — High-level architecture, usage patterns, and integration notes.

---

This document is intended as a persistent memory and onboarding guide for future contributors, including AI agents. All core logic is schema-driven and modular for maximum maintainability.

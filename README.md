# Applicaster Podcast Playback & Radio System — Example Monorepo Project

Welcome to the **Applicaster Podcast Playback & Radio System** example project. This repository provides a reference implementation and reusable TypeScript library for building dynamic, role-driven audio applications and playlist management systems in Applicaster/Zapp apps.

---

## 1. Project Architecture

The repository is structured as a two-package workspace:

*   **[`@lib/feed-decorators`](./feed-decorators/README.md)** (`/feed-decorators`):
    *   A TypeScript DSL and utility library for building Zapp/Applicaster feeds, entries, behaviors, and entry actions (`EntryBuilder`, `ActionsBuilder`).
    *   Provides type-safe Zod validators and utilities for role-driven UI rendering (`collection_selector`, `preference_editor`, `dynamic_collection`).
*   **[`@lib/mock-podcast`](./mock-podcast/README.md)** (`/mock-podcast`):
    *   A local NestJS server and reference backend service that uses `@lib/feed-decorators` to generate real-world audio feeds, user playlists, system collections, and live radio feeds.
    *   Implements an event-driven **Cloud Events router** (`POST /cloud-events`) that handles playlist mutations, multi-playlist membership, and local active queue progression.

```
local_radio/
├── feed-decorators/            # TypeScript DSL library (@lib/feed-decorators)
│   ├── docs/                   # Domain definitions & schema specifications
│   ├── src/                    # EntryBuilder, ActionsBuilder & Zod schemas
│   └── README.md               # Library documentation & examples
│
└── mock-podcast/               # Reference NestJS backend server (@lib/mock-podcast)
    ├── .agents/                # Detailed functional specifications & UX guides
    ├── src/                    # API Controllers, Cloud Events Router, and Services
    └── README.md               # Server API table & setup documentation
```

---

## 2. Executive Architectural Highlights

### A. Role & Behavior-Driven UI
UI affordances, cell layouts, and actions are driven entirely by **backend-declared semantics** on feeds rather than hardcoded client variants:
*   **`role: "collection_selector"`**: Ingested by multi-select UI widgets when selecting playlists for a song (`GET /user/collections?item_id=<id>`).
*   **`role: "dynamic_collection"`**: Ingested by editable lists and bottom sheets (`GET /user/collections?editable=true`), providing item removal and reordering capabilities via `dynamic_collection_options`.
*   **Orthogonality of Selection & Editing**: Selection state (`behavior.current_selection`) and mutation capabilities (`operations: "remove,reorder"`) are separated cleanly into distinct feed extensions.

### B. Standardized Cloud Events
Client-to-server and client-to-state mutations use standardized JSON Cloud Events via `POST /cloud-events` (or handled locally for Queue progression):
*   **Playlist Mutations**: Add item (`com.applicaster.collection.add.v1`), bulk copy collection (`com.applicaster.collection.add.collection.v1`), remove item (`com.applicaster.collection.remove.v1`), create collection (`com.applicaster.collection.create.v1`), rename collection (`com.applicaster.collection.rename.v1`), delete collection (`com.applicaster.collection.delete.v1`), and reorder tracks (`com.applicaster.collection.reorder.v1`).
*   **Queue & Playback Tracking**: Playback started (`com.applicaster.video.started.v1`) and stopped (`com.applicaster.video.stopped.v1`) events update the active Queue locally on the client without backend database overhead.

### C. Completely Local Client-Side Queue Architecture
> [!IMPORTANT]
> **No Server Implementation Required for Queue:** In production Zapp applications, the active playback **Queue is completely local** and managed entirely by the client app in local state/storage. **There does not need to be any server-side implementation for the Queue.** While this example `mock-podcast` server includes a mock `/system/collections` Queue and logs playback events (`started` / `stopped`) for testing and demonstration purposes, production servers do not need to build, store, or manage the Queue.

---

## 3. Core Documentation Sitemap

For complete technical specifications, UX guidelines, and API references, consult the following documentation:

| Document | Location | Description |
| :--- | :--- | :--- |
| **Client Integration & Consumer Guide** | [`feed-decorators/docs/ConsumerGuide.md`](./feed-decorators/docs/ConsumerGuide.md) | Guide for API consumers and frontend developers on feed decoration, selection modes, and dynamic UI affordances. |
| **Actions DSL Reference** | [`feed-decorators/docs/Actions.md`](./feed-decorators/docs/Actions.md) | Complete schema reference for Zapp actions (`openBottomSheet`, `showTextInput`, `sendCloudEvent`) and behaviors. |
| **Feed Decorators Package** | [`feed-decorators/README.md`](./feed-decorators/README.md) | Library installation, builder code examples, and TypeScript APIs. |
| **Mock Podcast Server** | [`mock-podcast/README.md`](./mock-podcast/README.md) | Demo server setup, architecture summary, and Cloud Events reference. |

---

## 4. Quick Start Guide

### Installation
From the root workspace or individual packages:
```bash
npm install
```

### Running Tests
Both projects come with unit test suites (using Jest):
```bash
# Test feed-decorators
cd feed-decorators && npm test

# Test mock-podcast server
cd ../mock-podcast && npx jest
```

### Starting the Mock Server
```bash
cd mock-podcast
npm run start:dev
```
The server will listen by default on port `3000`, exposing `/user/collections`, `/system/collections`, `/media/collections/radio`, and `/cloud-events`.

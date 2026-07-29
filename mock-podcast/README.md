# @lib/mock-podcast — Local Podcast & Playlist Server

`mock-podcast` is a NestJS backend service and reference implementation that demonstrates how to build Applicaster/Zapp-compatible audio and playlist feeds using `@lib/feed-decorators`.

It provides a local server that simulates real-world radio and podcast workflows, including role-driven UI rendering, dynamic collections, multi-playlist selection, and Cloud Event ingestion for playlist management and queue progression.

---

## 1. Key Capabilities

*   **Role-Driven Rendering:**
    *   Demonstrates backend-driven UI semantics using `role`, `behavior`, and `dynamic_collection_options` extensions.
    *   Feeds use explicit roles (`collection_selector`, `dynamic_collection`) so client renderers adapt visually without relying on hardcoded cell styles or client-side variants.
*   **System & User Collections:**
    *   **System Collections:** Read-only protected collections (`/system/collections`) such as predefined system playlists. System collections cannot be renamed or deleted.
    *   **User Custom Collections:** Users can create, delete, rename, and manage custom playlists (`/user/collections`).
    *   **Automatic Naming & Non-Recycling Indices:** When creating a playlist without a title, it is automatically named `Playlist #N` (strictly sequential index that is never recycled even after deletions).
*   **Item Membership & Multi-Select Integration:**
    *   Supports **Selector Mode** (`GET /user/collections?item_id=<song_id>`), returning collections with `role: "collection_selector"` and multi-select behavior.
    *   Each collection entry includes dynamic tap actions to explicitly add (`com.applicaster.collection.add.v1`) or remove (`com.applicaster.collection.remove.v1`) a track.
*   **Dynamic Collections (Editable Mode):**
    *   Calling `/user/collections?editable=true` or `/user/collections/:id?editable=true` marks feeds with `role: "dynamic_collection"` and `dynamic_collection_options: { postUrl: ".../cloud-events", operations: "remove,reorder" }`.
    *   To support item-scoped operations, every entry in an editable feed includes corresponding item-scoped actions in `extensions.entry_action`: `alias: "remove_item"` (dispatches `com.applicaster.collection.remove.v1` / `delete.v1`) and `alias: "reorder_item"` (dispatches `com.applicaster.collection.reorder.v1`).
*   **Cloud Events Router (`POST /cloud-events`):**
    *   Ingests standardized Applicaster Cloud Events for track additions, deletions, creations, reorders, renames, and playback status updates.
*   **Completely Local Queue Architecture (No Server Implementation Required):**
    > [!IMPORTANT]
    > **Queue is Local to Client App:** In production Zapp applications, the playback Queue is **completely local** and managed entirely in client memory/storage by the app renderer. **There does not need to be any server-side implementation for the Queue.** While this mock server includes a `/system/collections` Queue and logs playback events (`started` / `stopped`) for testing purposes, production backends do not need to build, store, or manage the Queue.

---

## 2. API Endpoints Table

| Endpoint | Method | Authentication | Description |
| :--- | :--- | :--- | :--- |
| `/user/collections` | `GET` | Optional | Returns the user's collections feed. When unauthenticated, action buttons requiring login are automatically filtered out. Supports query parameters:<br>• `item_id=<id>`: Enables selector mode for track membership.<br>• `collection_id=<id>`: Enables collection copy selector mode.<br>• `editable=true`: Enables dynamic editable mode. |
| `/user/collections/:id` | `GET` | Optional | Returns items belonging to collection `:id`. Supports `editable=true` and action parameter filters. |
| `/user/collections/:collectionId/play_next/:itemId` | `GET` | Optional | Returns remaining tracks in collection `:collectionId` starting after `:itemId` for chaining continuous playback. |
| `/user/collections` | `POST` | Bearer Token Required | Creates a new custom playlist. Body payload: `{ "name": "My Playlist" }`. |
| `/user/collections/:id` | `DELETE` | Bearer Token Required | Deletes custom collection `:id` (fails with error for system collections or Queue). |
| `/system/collections` | `GET` | Optional | Returns pre-configured system collections. |
| `/media/collections/radio` | `GET` | Optional | Returns static live radio audio stream feeds. |
| `/cloud-events` | `POST` | Bearer Token Required | Ingests Applicaster Cloud Events for playlist mutations and playback tracking. |

---

## 3. Supported Cloud Event Types

The service handles standard Applicaster Cloud Events sent to `POST /cloud-events`. For comprehensive schema and behavior specifications, refer to [Playlists.md](.agents/Playlists.md).

*   `com.applicaster.collection.add.v1` / `com.applicaster.collection.add.item.v1`: Add item to collection.
*   `com.applicaster.collection.add.collection.v1`: Bulk-copy all items from `sourceCollectionId` into target `collectionId`.
*   `com.applicaster.collection.remove.v1`: Remove item from collection.
*   `com.applicaster.collection.create.v1`: Create collection (optionally accepts `name`, `itemId` initialization, or `sourceCollectionId` collection copy).
*   `com.applicaster.collection.rename.v1`: Rename custom collection (`collectionId`, `name`).
*   `com.applicaster.collection.delete.v1`: Delete custom collection (`collectionId`).
*   `com.applicaster.collection.reorder.v1`: Reorder collection items (by array of `itemIds` or index pair `fromIndex`/`toIndex`).
*   `com.applicaster.video.started.v1`: Playback started event (triggers Queue lifecycle progression locally on client).
*   `com.applicaster.video.stopped.v1`: Playback stopped event (`status: "COMPLETED"` removes track from Queue locally on client).

---

## 4. Documentation References

For full domain definitions, UX specifications, and business guardrails, consult the documentation:
*   **Playlists & Collections Specification:** [Playlists.md](.agents/Playlists.md)
*   **Architecture & Backend Specification:** [TopLevelOverview.md](.agents/TopLevelOverview.md)
*   **Entry Actions & ActionsBuilder:** [Actions.md](.agents/Actions.md)
*   **Collections DAO Architecture:** [collections-dao-architecture.md](.agents/collections-dao-architecture.md)

---

## 5. Development & Testing

### Installation
Ensure dependencies are installed from the root workspace:
```bash
yarn install
# or
npm install
```

### Running the Server
```bash
# Start server in development mode with hot reload (default port: 3000)
npm run start:dev

# Build TypeScript production bundle
npm run build
```

### Running Tests
Run the comprehensive unit and integration test suite (using Jest):
```bash
npx jest
```

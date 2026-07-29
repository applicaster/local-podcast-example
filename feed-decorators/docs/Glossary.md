# Shared Vocabulary & Glossary

This document defines the common vocabulary and shared terminology used between engineering teams, backend service developers, and frontend Zapp application renderers.

---

## Core Domain Terms

### 1. Feed (DSP Feed)
The standardized JSON payload returned by backend endpoints to populate screens in Zapp client applications. A Feed contains top-level feed metadata, layout configuration, and an `entry` array of media items.

### 2. Entry (Item / Cell)
A single data item inside a Feed's `entry` array (e.g., an audio track, podcast episode, station stream, or playlist row).

### 3. Feed Decorator
A backend helper utility or pattern that enriches standard Zapp Feeds and Entries with semantic metadata (`extensions`) without mutating core media attributes or breaking standard schemas.

---

## Backend-Driven UI Semantics

### 4. Role (`role`)
A semantic string extension on a Feed (`extensions.role`) that dictates the high-level UI component mode rendered by the client app.
*   **`collection_selector`**: Renders a multi-select or single-select choice list (e.g., "Add to Playlist" sheet).
*   **`dynamic_collection`**: Renders an interactive editable list (e.g., reorderable playlist or queue view).

### 5. Behavior (`behavior`)
A Feed extension object (`extensions.behavior`) declaring interactive client state constraints.
*   **`select_mode`**: Specifies selection behavior (`"single"` or `"multi"`).
*   **`current_selection`**: An array of item IDs representing currently selected items (e.g., playlists containing a specific track).

### 6. Dynamic Collection Options (`dynamic_collection_options`)
Configuration object (`extensions.dynamic_collection_options`) declaring feed-level editing capabilities.
*   **`postUrl`**: Endpoint URL where the client dispatches Cloud Events upon user mutation.
*   **`operations`**: Comma-separated string (`"remove"`, `"reorder"`, `"add"`) instructing the UI renderer which editing affordances to display.

---

## Action & Event Semantics

### 7. Entry Action (`entry_action`)
Item-scoped action arrays defined on individual entries (`entry.extensions.entry_action`). Defines the exact Zapp actions executed when a user interacts with a specific row item.

### 8. Action Alias (`alias`)
An abstract, string key (e.g., `alias: "remove_item"`, `alias: "reorder_item"`, `alias: "add_to_playlist"`) attached to an entry action. The client renderer uses aliases to bind entry actions to specific UI buttons or gestures.
*   `remove_item`: Executed when a user taps row delete or swipes to remove.
*   `reorder_item`: Executed when a user drags a row using the reorder handle.

### 9. Cloud Event
A standardized JSON event structure (following the CloudEvents 1.0 standard) dispatched by client renderers via HTTP `POST` (`postUrl`) when user mutations require backend persistence (e.g., `com.applicaster.collection.remove.v1`, `com.applicaster.collection.reorder.v1`, `com.applicaster.collection.create.v1`).

---

## Client State Architecture

### 10. Local Queue (Playback Queue)
The active audio playback queue, managed **completely client-side** in local app state/storage. Progression updates dynamically based on playback events (`com.applicaster.video.started.v1`, `com.applicaster.video.stopped.v1`) without requiring backend database mutations.

### 11. Selector Mode
An interactive sheet or screen state triggered by `role: "collection_selector"`, where row entries display selection widgets (checkboxes/switches) automatically bound to `behavior.current_selection`.

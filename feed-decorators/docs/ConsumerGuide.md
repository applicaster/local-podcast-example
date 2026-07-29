# Client Integration & Consumer Guide

This guide explains how frontend applications, QuickBrick renderers, and API consumers ingest and render feeds decorated with the `feed-decorators` library.

---

## 1. Overview of Backend-Driven Feed Decoration

`feed-decorators` provides standard TypeScript builders and decorators to attach semantic metadata to standard Zapp DSP feeds. Instead of hardcoding layout rules, button handlers, or selection logic on the client, the backend declares explicit semantics using feed and entry extensions.

```
+--------------------------+       Standard Zapp Feed JSON       +--------------------------+
|      Backend Feed        | ----------------------------------> |   QuickBrick / Client    |
|   (with feed-decorators) |   (role, behavior, entry_action)    |   UI Renderer Engine     |
+--------------------------+                                     +--------------------------+
                                                                             |
                                                                             v
                                                                 Injects UI Affordances &
                                                                 Dispatches Cloud Events
```

---

## 2. Key Consumer Patterns

### Pattern A: Multi-Select Playlist Choice Lists (`role: "collection_selector"`)
When a user opens an "Add to Playlist" sheet or track selector modal:
- **Feed Extension:** The backend decorates the feed with `"role": "collection_selector"`.
- **Selection Behavior:** Includes a `behavior` block defining `select_mode` (`"single"` | `"multi"`) and `current_selection` (array of collection IDs that currently contain the track).
- **Client Rendering:** QuickBrick multi-select list components inspect `current_selection` to render pre-selected checkboxes/switches without client-side state mapping.
- **Entry Actions:** Tapping a collection item executes the entry action (`com.applicaster.collection.add.v1` or `com.applicaster.collection.remove.v1`) to toggle membership.

### Pattern B: Interactive Editable Lists (`role: "dynamic_collection"`)
When a user opens an editable playlist or queue screen:
- **Feed Extension:** The backend decorates the feed with `"role": "dynamic_collection"` and `dynamic_collection_options` (specifying `postUrl` and enabled `operations` like `"remove,reorder"` or `"add,remove,reorder"`).
- **Client UI Affordance Injection:**
  - `operations: "remove"` -> Automatically injects row delete affordances (trash icons, swipe-to-delete).
  - `operations: "reorder"` -> Automatically renders drag-and-drop handles on rows.
  - `operations: "add"` -> Automatically renders a primary create/add button in the header or toolbar.
- **Item-Scoped Entry Actions:** Every entry in an editable feed includes item-level actions in `extensions.entry_action`:
  - `alias: "remove_item"` -> Dispatches `com.applicaster.collection.remove.v1` or `com.applicaster.collection.delete.v1`.
  - `alias: "reorder_item"` -> Dispatches `com.applicaster.collection.reorder.v1`.

### Pattern C: Local Active Playback Queue
- **Client-Side Storage:** The active playback Queue is managed **completely locally on the client** in app state/storage.
- **Automatic Event Progression:**
  - On `com.applicaster.video.started.v1`: Updates local queue head or replaces queue with source collection items.
  - On `com.applicaster.video.stopped.v1` (`status: "COMPLETED"`): Automatically removes completed track from local queue.
- **No Backend Requirement:** Production backends are not required to persist or manage the queue.

---

## 3. Quick Reference for Developers

| Feature / UI Mode | Feed Extension | Required Entry Actions | Client Behavior |
| :--- | :--- | :--- | :--- |
| **Playlist Selection Sheet** | `"role": "collection_selector"` | `add_to_playlist`, `remove_from_playlist` | Renders multi-select checkboxes based on `behavior.current_selection`. |
| **Editable Track List** | `"role": "dynamic_collection"` (`operations: "remove,reorder"`) | `alias: "remove_item"`, `alias: "reorder_item"` | Injects swipe-to-delete & drag handles. Executes entry actions on user interaction. |
| **Editable Playlists Screen** | `"role": "dynamic_collection"` (`operations: "add,remove,reorder"`) | `alias: "remove_item"`, `events.add` | Renders "+ Create Playlist" button in header & trash icons on playlist rows. |

---

## 4. Documentation & Schema References

- **Actions DSL & Schema Reference:** [`Actions.md`](./Actions.md)
- **Library API & Builder Usage:** [`../README.md`](../README.md)

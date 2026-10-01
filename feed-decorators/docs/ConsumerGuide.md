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
- **No Backend Requirement:** Production backends are not required to persist or manage the queue state machine.

### Pattern D: "Play All" Collection Playback (`addAllToQueue` / `play_all`)
When a playlist, album, or series provides a "Play All" button:
- **Feed / Entry Action:** The backend attaches an entry action (alias `"play_all"`) using action type `"addAllToQueue"`.
- **Options Contract:**
  - `url`: Feed URL containing the tracks to play (or falls back to `context.entry.content.src`).
  - `position: "top"`: Inserts all collection items at the head of upcoming playback (after the current track).
  - `startPlayback: true`: Instructs the client engine to set the first track as active and immediately navigate to the audio player screen (`navigateToScreen`).
- **Example Payload:**
  ```json
  {
    "type": "addAllToQueue",
    "options": {
      "url": "https://api.example.com/collections/123.json",
      "position": "top",
      "startPlayback": true
    }
  }
  ```

### Pattern E: Dynamic Queue Continuation (`extensions.upNextFeed`)
When an audio track plays and reaches the tail of the active queue:
- **Entry Extension:** The backend decorates the playable entry with `extensions.upNextFeed` (or `extensions.up_next_feed`) pointing to a feed URL.
- **Dynamic Resolution:** When the player reaches the last queued track, QuickBrick's `QueueManager` fetches this feed URL and automatically resolves and appends the returned entries to the upcoming queue without interrupting playback.
- **Contextual Adaptation:** Backends can return remaining playlist tracks, algorithmic recommendations, or show next-episodes dynamically based on playback context.
- **Example Payload:**
  ```json
  {
    "id": "episode_42",
    "title": "Episode 42: The Deep Dive",
    "type": { "value": "audio" },
    "content": { "src": "https://cdn.example.com/audio/ep42.mp3" },
    "extensions": {
      "upNextFeed": "https://api.example.com/shows/podcast-1/up-next?current_id=episode_42"
    }
  }
  ```

---

## 3. Quick Reference for Developers

| Feature / UI Mode | Feed / Entry Extension | Required Action(s) | Client Behavior |
| :--- | :--- | :--- | :--- |
| **Playlist Selection Sheet** | `"role": "collection_selector"` | `add_to_playlist`, `remove_from_playlist` | Renders multi-select checkboxes based on `behavior.current_selection`. |
| **Editable Track List** | `"role": "dynamic_collection"` (`operations: "remove,reorder"`) | `alias: "remove_item"`, `alias: "reorder_item"` | Injects swipe-to-delete & drag handles. Executes entry actions on user interaction. |
| **Editable Playlists Screen** | `"role": "dynamic_collection"` (`operations: "add,remove,reorder"`) | `alias: "remove_item"`, `events.add` | Renders "+ Create Playlist" button in header & trash icons on playlist rows. |
| **Play All (Collection)** | N/A (Standard Collection / Feed) | `alias: "play_all"` (`type: "addAllToQueue"`, `startPlayback: true`) | Enqueues all items at top of queue and begins immediate playback of first track. |
| **Queue Autoplay / UpNext** | `extensions.upNextFeed` (on audio entry) | N/A (Automatic tail-of-queue fetch) | Resolves feed dynamically at queue end and seamlessly appends upcoming tracks. |


---

## 4. Documentation & Schema References

- **Shared Vocabulary & Glossary:** [`Glossary.md`](./Glossary.md)
- **Actions DSL & Schema Reference:** [`Actions.md`](./Actions.md)
- **Library API & Builder Usage:** [`../README.md`](../README.md)

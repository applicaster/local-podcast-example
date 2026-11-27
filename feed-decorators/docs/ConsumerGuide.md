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
- **Selection Behavior:** Includes a `behavior` block defining `select_mode` (`"single"` | `"multi"` | `"none"`) and `current_selection`.
- **Client Rendering:** QuickBrick multi-select list components inspect `current_selection` to render pre-selected checkboxes/switches without client-side state mapping.
- **Entry Actions:**
  - Track add/remove (`GET /user/collections?item_id=<id>`): `select_mode: "multi"`. Tapping a collection executes `com.applicaster.collection.add.v1` or `com.applicaster.collection.remove.v1`.
  - Add all to playlist (`GET /user/collections?collection_id=<id>`): `select_mode: "none"`. Tapping a target collection runs `com.applicaster.collection.add.collection.v1`, then `showToast` (`"Added to playlist"`), then `refreshComponent`, then `dismissBottomSheet`.

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

### Pattern E: Continuous Playback & Dynamic Queue Continuation (`upNextFeed` & `collection_up_next_feed`)
To populate **Next Up** when starting a track from a collection and avoid abrupt playback stoppage when an album or playlist finishes:
- **Collection Continuation (`collection_up_next_feed`):** Decorate items inside a collection with `extensions.collection_up_next_feed` pointing to the remaining tracks after that item (e.g. `GET /user/collections/:id/up-next?afterItemId=<id>`). When the listener taps a track directly, `queue-action` resolves this feed to populate the **Next Up** (`auto`) section without overwriting their manually queued **Next in Queue** items:
  ```json
  {
    "id": "track_1",
    "title": "Episode 1",
    "extensions": {
      "collection_up_next_feed": "https://api.example.com/user/collections/col_1/up-next?afterItemId=track_1",
      "upNextFeed": "https://api.example.com/media/up-next?seedItemId=track_1"
    }
  }
  ```
- **Recommendation Fallback (`upNextFeed`):** Decorate playlist items (or the terminal entry) with `extensions.upNextFeed` (or snake_case `up_next_feed`). Decorating all items ensures queue chaining remains resilient even if the user dynamically reorders tracks or deletes items from the queue.
- **Object-Driven DataSource:** Both `upNextFeed` and `collection_up_next_feed` can also be Pipes DataSource objects supporting custom mapping, headers, query parameters, or POST body:
  ```json
  {
    "extensions": {
      "upNextFeed": {
        "source": "https://api.example.com/recommendations",
        "mapping": "custom_pipes_mapping",
        "headers": { "Authorization": "Bearer <token>" }
      }
    }
  }
  ```
- **Client Queue Integration (`queue-action`):**
  1. On direct track start, if `extensions.collection_up_next_feed` is present, `QueueManager` resolves it and sets **Next Up** (`autoItems`), preserving any existing **Next in Queue** (`manualItems`).
  2. When the user starts playing the last entry in the active queue (or a standalone track without `collection_up_next_feed`), `QueueManager` resolves `extensions.upNextFeed` and appends the returned recommendation tracks into **Next Up** without interrupting playback.
  3. Deduplication ensures each slot only triggers resolution once.

---

## 3. Quick Reference for Developers

| Feature / UI Mode | Feed / Entry Extension | Required Action(s) | Client Behavior |
| :--- | :--- | :--- | :--- |
| **Playlist Selection Sheet** | `"role": "collection_selector"` | `add_to_playlist`, `remove_from_playlist` | Renders multi-select checkboxes based on `behavior.current_selection`. |
| **Editable Track List** | `"role": "dynamic_collection"` (`operations: "remove,reorder"`) | `alias: "remove_item"`, `alias: "reorder_item"` | Injects swipe-to-delete & drag handles. Executes entry actions on user interaction. |
| **Editable Playlists Screen** | `"role": "dynamic_collection"` (`operations: "add,remove,reorder"`) | `alias: "remove_item"`, `events.add` | Renders "+ Create Playlist" button in header & trash icons on playlist rows. |
| **Play All (Collection)** | N/A (Standard Collection / Feed) | `alias: "play_all"` (`type: "addAllToQueue"`, `startPlayback: true`) | Enqueues all items at top of queue and begins immediate playback of first track. |
| **Collection Direct-Play Continuation** | `entry.extensions.collection_up_next_feed` | N/A (automatic queue population) | Resolves Pipes feed on track start and populates **Next Up** (`auto`) while keeping **Next in Queue** (`manual`). |
| **Queue Autoplay / UpNext** | `entry.extensions.upNextFeed` | N/A (Automatic tail-of-queue fetch) | Resolves feed dynamically at queue end and appends recommendation tracks to **Next Up**. |

---

## 4. Documentation & Schema References

- **Shared Vocabulary & Glossary:** [`Glossary.md`](./Glossary.md)
- **Actions DSL & Schema Reference:** [`Actions.md`](./Actions.md)
- **Library API & Builder Usage:** [`../README.md`](../README.md)

# Podcast Playback Application: Playlists and Collections

This document outlines the user-facing capabilities, business rules, Cloud Events specifications, and high-level functional behaviors of the playlist and playback queue management system for the Podcast Playback Application.

---

## 1. Domain Definitions

To understand how playlists and media groups work in our application, we define the following core concepts:

*   **Collection (or Playlist):** A grouped list of audio tracks or media items. Playlists can be system-provided (read-only and protected) or user-created (customizable).
*   **System Collection:** A predefined collection managed by the system. These collections are marked as `isSystem` and cannot be deleted or renamed by the user.
*   **Queue:** A special, persistent system collection representing the user's active playback queue. Queue lifecycle and updates are managed locally on the client. The Queue cannot be deleted.
*   **Live Radio Feed:** A static, read-only collection of live audio stations preloaded by the application (e.g., from our live radio registry).

---

## 2. Functional Specifications & User Experience

This section defines the business rules, capabilities, and behaviors of the playlist and collection system as experienced in the app.

### A. Playlist & Collection Management

*   **Multiple Playlists:** Users can create and maintain multiple custom playlists to organize their favorite tracks.
*   **Creation & Automatic Naming:**
    *   Users can create new empty playlists.
    *   If the user does not provide a custom name during creation, the system automatically names it `Playlist #N` (e.g., `Playlist #1`, `Playlist #2`).
    *   The index `N` is sequential (strictly increasing) and calculated by scanning existing custom playlists. Even if older playlists are deleted, their names and indices are not recycled (ensuring strict continuity).
*   **Deletion Rules & Constraints:**
    *   Users can delete their custom collections.
    *   **Constraint:** System collections (such as Pokémon GSC) and the Queue cannot be deleted. The option to delete system collections or Queue is blocked.
*   **Contextual Selection Highlight:**
    *   When viewing lists of collections to add a track, the system dynamically highlights which collections already contain that specific track (selector mode).
*   **Playlist Actions & Options:**
    *   Viewing a list of custom playlists exposes entry action options to **Edit Playlist**, **Edit Name**, or **Delete** the playlist.
    *   **Edit Playlist:** Entry action (`alias: "edit"`) triggers an `openBottomSheet` action with header `"Edit Playlist"` and `itemsUrl` set to `${baseUrl}/user/collections/${id}?editable=true`. This returns a feed declared with `role: "dynamic_collection"` and `dynamic_collection_options: { postUrl, operations: "remove,reorder" }`, allowing the client bottom sheet renderer to manage items dynamically.
    *   **Edit Name:** Entry action (`alias: "edit_name"`) triggers `showTextInput` with UI labels (`headerTitle`, `inputLabel`, `defaultValue`, `buttonLabel`) and a `sendCloudEvent` action to launch the client rename workflow (`com.applicaster.collection.rename.v1`).
    *   **Delete Playlist:** Tapping this deletes the custom playlist entirely (emits `com.applicaster.collection.delete.v1` Cloud Event).
    *   **Add all to Queue:** Non-queue playlists (both system and custom user playlists) expose an action to bulk-add all their tracks to the back of the active playback queue.
    *   **Play All:** Non-queue playlists with tracks expose an action (`alias: "play_all"`) to start playing the first track of the playlist and chain subsequent tracks via `play_next_feed_url`.
    *   **Add to Playlist (Add all to Playlist):** Non-queue playlists expose an action (`alias: "add_to_playlist"`) to open the playlist selector sheet (`itemsUrl: ${baseUrl}/user/collections?collection_id=${id}`), enabling users to bulk-add all tracks from this collection into another target playlist.

### B. Item Membership (Adding & Removing Tracks)

*   **Explicit Add and Remove Events:**
    *   Adding or removing a track from a collection is handled via explicit add and remove events rather than a single toggle event.
    *   **Selector Mode (`GET /user/collections?item_id=<song_id>`):** When selecting collections for a track, the backend emits a feed with `role: "collection_selector"` and `behavior: { select_mode: "multi", current_selection: [...] }`. The backend dynamically generates tap actions for each collection. If the track is already in the collection, the tap action triggers a remove event (`com.applicaster.collection.remove.v1`). If the track is not in the collection, it triggers an add event (`com.applicaster.collection.add.v1`).
    *   **Removal from Contents / Edit Mode (`GET /user/collections/:id?editable=true`):** When viewing a collection's contents or in edit mode, the track entry action menu exposes a "Remove item" option which triggers a remove event (`com.applicaster.collection.remove.v1`).
*   **One-Tap Toggle:** Within the selection sheet, tapping a playlist that doesn't contain the track will add it. Tapping a playlist that already contains the track will instantly remove it, reloading selection states immediately via Cloud Events.
*   **Collection Reordering:** Collection item reordering allows custom order modifications via `com.applicaster.collection.reorder.v1`.

### C. Active Queue Lifecycle & Playback Progression (Local Client Logic)

> [!NOTE]
> Queue updates and progression logic are executed **locally on the client** (in app local state) based on playback events, keeping playback responsive without backend mutation overhead.

The Queue updates dynamically based on playback events (`started`, `stopped`) and handles playback progression:

*   **Playback Started Event (`started` / `com.applicaster.video.started.v1`):**
    *   The event conveys the source collection from which playback was initiated (`sourceCollectionId`).
    *   **Case A (Playback from Queue):** If playback is initiated from the Queue itself, the local client removes the "head" of the queue (all items preceding the first occurrence of the started item).
    *   **Case B (Playback from non-Queue Collection):** If playback is initiated from another collection (e.g., a user playlist or live radio collection), the local client replaces the Queue's current contents with the items from that source collection, starting from the selected item and including all subsequent items.
*   **Playback Stopped Event (`stopped` / `com.applicaster.video.stopped.v1`):**
    *   If the playback status is `"COMPLETED"`, the completed track is automatically removed from the local Queue. This ensures that the item is cleared, particularly when it is the last remaining item.
*   **Queue Synonyms:**
    *   The identifier `queue` is supported globally as a synonym for the Queue collection's GUID. It can be used in place of a collection ID in any endpoint request or cloud event payload.

---

## 3. Cloud Events Specifications

Cloud Events are sent via HTTP `POST /cloud-events` (or handled locally for queue events). Below are the defined event schemas and behaviors:

### 1. Add Item to Collection
*   **Type:** `com.applicaster.collection.add.v1` (or `com.applicaster.collection.add.item.v1`)
*   **Payload:**
    ```json
    {
      "collectionId": "string",
      "itemId": "string"
    }
    ```
*   **Behavior:** Adds the specified item to the target collection if it is not already present.

### 2. Remove Item from Collection
*   **Type:** `com.applicaster.collection.remove.v1`
*   **Payload:**
    ```json
    {
      "collectionId": "string",
      "itemId": "string"
    }
    ```
*   **Behavior:** Removes the specified item from the target collection.

### 3. Toggle Item in Collection (Fallback)
*   **Type:** `com.applicaster.collection.toggle.v1` (or any event where both `collectionId` and `itemId` are present without an explicit add/remove type)
*   **Payload:**
    ```json
    {
      "collectionId": "string",
      "itemId": "string"
    }
    ```
*   **Behavior:** Toggles membership of the item in the specified collection (adds if absent, removes if present).

### 4. Create Collection
*   **Type:** `com.applicaster.collection.create.v1`
*   **Payload:**
    ```json
    {
      "name": "string"
    }
    ```
*   **Behavior:** Creates a new custom playlist. If `name` is omitted or empty, auto-names to `Playlist #N`.

### 5. Delete Collection
*   **Type:** `com.applicaster.collection.delete.v1`
*   **Payload:**
    ```json
    {
      "collectionId": "string"
    }
    ```
*   **Behavior:** Deletes the specified custom collection. Blocked for system collections and the Queue.

### 6. Rename Collection
*   **Type:** `com.applicaster.collection.rename.v1`
*   **Payload:**
    ```json
    {
      "collectionId": "string",
      "name": "string"
    }
    ```
*   **Behavior:** Renames the specified custom collection.

### 7. Reorder Collection Items
*   **Type:** `com.applicaster.collection.reorder.v1`
*   **Payload:**
    ```json
    {
      "collectionId": "string",
      "itemIds": ["string"]
    }
    ```
*   **Behavior:** Updates the ordered track list of the specified collection to match `itemIds`.

### 8. Playback Started (Queue Update)
*   **Type:** `com.applicaster.video.started.v1`
*   **Payload:**
    ```json
    {
      "videoId": "string",
      "sourceCollectionId": "string"
    }
    ```
*   **Behavior:** Handled locally to update the Queue. If `sourceCollectionId` is provided and is not `queue`, replaces Queue content with items from `sourceCollectionId` starting from `videoId`. If `sourceCollectionId` is `queue` (or omitted), removes the head of the Queue up to `videoId`.
*   **Source Collection Resolution Locations:**
    1. `data.sourceCollectionId`
    2. `data['continue-watching'].sourceCollectionId`
    3. `data.continueWatching.sourceCollectionId`
    4. `data.entry.extensions['continue-watching'].sourceCollectionId`
    5. `data.entry.extensions.continueWatching.sourceCollectionId`

### 9. Playback Stopped / Completed
*   **Type:** `com.applicaster.video.stopped.v1`
*   **Payload:**
    ```json
    {
      "videoId": "string",
      "status": "COMPLETED"
    }
    ```
*   **Behavior:** If `status` is `"COMPLETED"`, automatically removes `videoId` from the local Queue.

---

## 4. High-Level Technical Architecture

For technical teams, this section summarizes how these behaviors map to the application codebase:

### Abstract Asset and Label Resolution (Client-Side)
The backend does not hardcode image URLs or button titles for collection actions. Instead, the backend emits abstract event/action **aliases** (such as `add_to_playlist`, `add_to_queue`, `remove_item`, `delete_collection`, `edit`, `edit_name`, `play_all`, or `collection_list`). 

On the client side, a feed decorator intercepts the feeds and merges these aliases with current localized assets and strings, keeping design resources decoupled from backend service code:
*   Old hardcoded images/labels are supported side-by-side to prevent legacy clients from breaking.
*   The system uses event-driven communication (Cloud Events) to register track additions, deletions, playlist creations, reorders, and playback status updates.

### API Summary

| Endpoint | Method | Purpose | Default Mode Payload/Behavior |
| :--- | :--- | :--- | :--- |
| `/user/collections` | `GET` | Retrieve playlist feeds | Returns list of playlists. Appends a synthetic "Create collection" option in default view. |
| `/user/collections?editable=true` | `GET` | Editable Collections List | Returns list of playlists with `role: "dynamic_collection"` and `dynamic_collection_options: { postUrl, operations: "remove,reorder" }`. |
| `/user/collections?item_id=<id>` | `GET` | Selector Mode | Returns playlists with `role: "collection_selector"` and `behavior: { select_mode: "multi", current_selection: [...] }`. |
| `/user/collections/:id` | `GET` | Playlist Tracks | Returns the list of tracks belonging to collection `:id`. |
| `/user/collections/:id?editable=true` | `GET` | Editable Collection Tracks | Returns tracks belonging to collection `:id` with `role: "dynamic_collection"` and `dynamic_collection_options: { postUrl, operations: "remove,reorder" }`. |
| `/user/collections` | `POST` | Create Playlist | Creates a new playlist (optionally accepts custom name). |
| `/user/collections/:id` | `DELETE` | Delete Playlist | Deletes playlist `:id` (fails for system collections / Queue). |
| `/cloud-events` | `POST` | Event Router | Ingests playback events (`started`, `stopped`) and collection mutations (`add`, `remove`, `toggle`, `delete`, `rename`, `reorder`). |

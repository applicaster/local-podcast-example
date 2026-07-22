# Podcast Playback Application: Playlists and Collections

This document outlines the user-facing capabilities, business rules, and high-level functional behaviors of the playlist and playback queue management system for the Podcast Playback Application.

---

## 1. Domain Definitions

To understand how playlists and media groups work in our application, we define the following core concepts:

*   **Collection (or Playlist):** A grouped list of audio tracks or media items. Playlists can be system-provided (read-only and protected) or user-created (customizable).
*   **System Collection:** A predefined collection managed by the system. These collections are marked as `isSystem` and cannot be deleted or re-named by the user.
*   **Queue:** A special, persistent system collection representing the user's active playback queue. The Queue cannot be deleted.
*   **Live Radio Feed:** A static, read-only collection of live audio stations preloaded by the application (e.g., from our live radio registry).

---

## 2. Functional Specifications & User Experience

This section describes the system's business rules and user-facing behaviors as experienced in the app.

### A. Playlist & Collection Management

*   **Multiple Playlists:** Users can create and maintain multiple custom playlists to organize their favorite tracks.
*   **Creation & Automatic Naming:**
    *   Users can create new empty playlists.
    *   If the user does not provide a custom name during creation, the system automatically names it `Playlist #N` (e.g., `Playlist #1`, `Playlist #2`).
    *   The index `N` is sequential (strictly increasing) and calculated by scanning existing custom playlists. Even if older playlists are deleted, their names and indices are not recycled (ensuring strict continuity).
*   **System Playlists:**
    *   **Pokémon GSC**: A system playlist preloaded with 10 legendary Pokémon Gold, Silver, and Crystal game soundtrack tracks.
    *   System playlists do not show "Delete collection" options.
*   **Playlist Actions & Options**:
    *   Viewing a list of custom playlists exposes entry action options to **Edit Playlist**, **Edit Name**, or **Delete** the playlist.
    *   **Edit Playlist**: Entry action (`alias: "edit"`) triggers an `openBottomSheet` action with header `"Edit Playlist"` and `itemsUrl` set to `${baseUrl}/user/collections/${id}?editable=true`. This returns a feed declared with `role: "dynamic_collection"` and `dynamic_collection_options: { postUrl, operations: "remove,reorder" }`, allowing the client bottom sheet renderer to manage items dynamically.
    *   **Edit Name**: Entry action (`alias: "edit_name"`) triggers `editCollectionName` with `{ collectionId, name }` to launch the client rename workflow.
    *   **Delete Playlist**: Tapping this deletes the custom playlist entirely (emits `com.applicaster.collection.delete.v1` Cloud Event).
    *   **Add all to Queue**: Non-queue playlists expose an action to bulk-add all their tracks to the back of the active playback queue.

### B. Adding & Removing Tracks (Membership)

*   **Explicit Actions**: Adding or removing tracks from any playlist is handled via deliberate, context-aware operations:
    *   **Add to Playlist (Selector Mode)**: When selecting "Add to Playlist" on a track, the client opens a bottom sheet with `itemsUrl: ${baseUrl}/user/collections?item_id=${trackId}`. This feed is emitted with `role: "collection_selector"` and `behavior: { select_mode: "multi", current_selection: [...] }`.
    *   **One-Tap Toggle**: Within this selection sheet, tapping a playlist that doesn't contain the track will add it. Tapping a playlist that already contains the track will instantly remove it, reloading the selection states immediately via Cloud Events.
    *   **Remove from Within a Playlist**: When viewing the tracks inside a playlist, a track's individual action menu (`...`) exposes a "Remove item" option which discards the track from that collection.

### C. Active Queue Lifecycle & Playback Progression

The playback queue updates automatically based on user engagement and playback state transitions:

*   **Initiating Playback from a Playlist**:
    *   When a user taps a track inside a playlist (either custom or system), the application clears the existing active Queue and replaces it with a new queue containing that selected track, followed by all subsequent tracks in that playlist.
*   **Initiating Playback from the Queue**:
    *   If the user triggers playback directly from within the Queue itself, the queue removes its "head" — discarding all tracks preceding the clicked track so playback advances forward cleanly.
*   **Track Completion**:
    *   As soon as a track completes playback (`COMPLETED` status), it is automatically removed from the Queue. This keeps the queue tidy, especially when playing the final remaining track.
*   **Queue Synonyms**:
    *   To simplify lookups across the system, the identifier `queue` is recognized globally as a direct link to the user's active playback queue.

---

## 3. High-Level Technical Architecture

For technical teams, this section summarizes how these behaviors map to the application codebase:

### Abstract Asset and Label Resolution (Client-Side)
The backend does not hardcode image URLs or button titles for collection actions. Instead, the backend emits abstract event/action **aliases** (such as `add_to_playlist`, `add_to_queue`, `remove_item`, `delete_collection`, `edit`, `edit_name`, or `collection_list`). 

On the client side, a feed decorator intercepts the feeds and merges these aliases with current localized assets and strings, keeping design resources decoupled from backend service code:
*   Old hardcoded images/labels are supported side-by-side to prevent legacy clients from breaking.
*   The system uses event-driven communication (Cloud Events) to register track additions, deletions, playlist creations, and playback status updates.

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
| `/cloud-events` | `POST` | Event Router | Ingests playback events (`started`, `stopped`) and collection mutations (`add`, `remove`, `toggle`, `delete`). |


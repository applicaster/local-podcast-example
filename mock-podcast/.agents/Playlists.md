# Podcast Playback Application: Playlists and Collections

This document outlines the domain specifications, functional behavior, and backend technical details for the media collections and playlist management system.

---

## 1. Domain Definitions

The following terms define the core domain concepts used across the application:

*   **Collection (or Playlist):** A generic term for a grouped list of media/audio items. In the system, playlists and collections are synonymous and refer to user-managed or system-managed groups of audio tracks.
*   **System Collection:** A collection managed by the system rather than directly by the user. System collections are marked with the property `isSystem = true`, which protects them from deletion.
*   **Queue:** A special system collection representing the current playback queue. The Queue is protected server-side and cannot be deleted.
*   **Media Items Collection (Radio Feed):** A static, read-only collection of audio tracks preloaded by the backend (e.g., from `radio.csv` to represent live streams or default tracks).

---

## 2. Functional Specifications

This section defines the business rules, capabilities, and behaviors of the playlist and collection system.

### Playlist & Collection Management
*   **Multiple Playlists:** Users can create and maintain multiple playlists (collections).
*   **Creation & Auto-Naming:**
    *   Users can create new collections.
    *   By default, if no name is provided, a collection is named `Playlist #N` (e.g., `Playlist #1`, `Playlist #2`).
    *   The index `N` is sequential and strictly increasing. It is calculated by scanning existing playlists with default names to determine the largest index and adding `1`.
    *   Old indices of deleted playlists are not reused.
*   **Deletion Rules:**
    *   Users can delete their own custom collections.
    *   **Constraint:** System collections (specifically the Queue) cannot be deleted. The option to delete is blocked.
*   **Contextual Selection Highlight:**
    *   When viewing lists of collections to add a song, the system highlights which collections already contain that specific song (selector mode).

### Item Membership (Adding & Removing)
*   **Explicit Add and Remove:**
    *   Adding or removing a song from a collection is handled via explicit add and remove events rather than a single toggle event.
    *   *Selector Mode:* When selecting collections for a song (`GET /user/collections?item_id=<song_id>`), the backend dynamically generates a tap action for each collection. If the song is already in the collection, the tap action triggers a remove event (`com.applicaster.collection.remove.v1`). If the song is not in the collection, it triggers an add event (`com.applicaster.collection.add.v1`).
    *   *Removal from Contents/Edit Mode:* When viewing a collection's contents or in edit mode, the item entry menu triggers a remove event (`com.applicaster.collection.remove.v1`).
*   **Collection Reordering:**
    *   *Note:* Collection item reordering is not currently implemented in the codebase.

### Playback Queue Lifecycle & Updates
The Queue updates dynamically based on playback events (Continue Watching triggers) and handles playback progression:
*   **Playback Started Event (`started`):**
    *   The event must convey the source collection from which playback was initiated.
    *   *Case A (Playback from Queue):* If the playback is initiated from the Queue itself, the system removes the "head" of the queue (all items preceding the first occurrence of the started item).
    *   *Case B (Playback from non-Queue Collection):* If the playback is initiated from another collection (e.g., a user playlist or the radio collection), the system replaces the Queue's current contents with the items from that source collection, starting from the selected item and including all items following it.
*   **Playback Stopped Event (`stopped`):**
    *   If the playback status is `"COMPLETED"`, the completed item is automatically removed from the Queue. This ensures that the item is cleared, particularly when it is the last remaining item.
*   **Queue Synonyms:**
    *   The identifier `queue` is supported globally as a synonym for the Queue collection's GUID. It can be used in place of a collection ID in any endpoint request or cloud event payload.

---

## 3. Technical Implementation Details

This section details the backend architecture, API endpoints, data models, and event flows.

### Tech Stack & Architecture
*   **Framework:** NestJS + TypeScript.
*   **Storage & Persistence:** In-memory store with persistence capability.
*   **Location:** `/podcast-server` (adjacent to the `feed-decorators` library).
*   **Execution Command:** `npm run start:dev` (executed inside the `/podcast-server` directory).
*   **Default Port:** 3000.

### Feed & Action Patterns
The backend formats responses as feed structures using the `feed-decorators` library, utilizing two primary interaction mechanisms:
*   `tap_actions`: Executed on one-tap row interactions (e.g., toggling collection membership in selector mode).
*   `entry_action`: Renders action menus (e.g., `...` menu actions like adding/removing/deleting).
*   **Dynamic Resolvers:** Highlights and actions use behavior blocks with `@{...}` resolvers (e.g., `@{entry/}`) for dynamic value injection.

### REST API Endpoints

#### 1. Media Collections
*   `GET /media/collections/radio`
    *   Loads static data from `radio.csv` on startup, converts it to a Feed+Entry structure, and caches the result.
    *   **CSV Mapping:** Maps columns: `id` → `entry.id`, `stream` → `content.src`, `image` → `media_group`, `homepage` → `extensions`.
    *   **Actions:** Each entry contains `extensions.entry_action` with an "Add to Playlist" action that triggers `openBottomSheet` (with `itemsUrl` pointing to `/user/collections?item_id=<itemId>`).

#### 2. User Collections (Playlists)
*   `GET /user/collections`
    *   Returns a feed-like list of the user's collections.
    *   **Synthetic Item:** In default mode (no `item_id`), a synthetic entry `id = "create_collection"` (type: `action`, title: `Create collection`) is appended to trigger collection creation.
    *   **Edit Action:** Non-system entries include an `extensions.entry_action` "Edit" item that triggers the `editCollection` action (payload `{ collectionId }`). The client opens a bottom sheet modal to remove/re-order items (client-side implementation added later). This intentionally replaces navigating to an edit screen by type.
    *   **Delete Action:** Non-system entries include `extensions.entry_action` for "Delete collection", triggering `com.applicaster.collection.delete.v1` and `refreshComponent`.
*   `GET /user/collections?item_id=<song_id>` (Selector Mode)
    *   Used to target collection membership for a specific song.
    *   Does not include the synthetic `create_collection` item.
    *   Includes behavior tags:
        *   `extensions.behavior.select_mode = "multi"`
        *   `extensions.behavior.current_selection = [<collection_ids_containing_song>]`
    *   Each collection entry has `extensions.tap_actions` that execute `sendCloudEvent` (sends either `com.applicaster.collection.add.v1` or `com.applicaster.collection.remove.v1` dynamically based on current membership) followed by `refreshComponent` to reload selection states.
*   `GET /user/collections/:id`
    *   Returns the contents of a specific collection as a feed.
    *   Passes the currently playing song ID in `behavior.current_selection` if requested as read-only.
    *   Each item contains `extensions["continue-watching"].sourceCollectionId = <collection_id>` so that playback events can identify the origin collection.
    *   Each item contains `extensions.entry_action` to "Remove item" (triggers `com.applicaster.collection.remove.v1`).
*   `GET /user/collections/:id?action=remove_item` (Edit Mode)
    *   Allows direct item removal on cell tap.
*   `POST /user/collections`
    *   Creates a new collection.
*   `DELETE /user/collections/:id`
    *   Deletes a collection. (Blocked server-side for the Queue collection).

### Cloud Events Handling
Cloud events are sent to `POST /cloud-events`. The URL is dynamically constructed using the current request host (obtained via the NestJS `@CurrentRoute()` decorator or Request context fallback).

#### 1. Add Item to Collection
*   **Type:** `com.applicaster.collection.add.v1`
*   **Payload:**
    ```json
    {
      "collectionId": "string",
      "itemId": "string"
    }
    ```
*   **Behavior:** Adds the specified item to the collection if it is not already present.

#### 2. Remove Item from Collection
*   **Type:** `com.applicaster.collection.remove.v1`
*   **Payload:**
    ```json
    {
      "collectionId": "string",
      "itemId": "string"
    }
    ```
*   **Behavior:** Removes the specified item from the collection.

#### 3. Toggle Item in Collection (Fallback)
*   **Type:** Any event type where both `collectionId` and `itemId` are present in the payload (excluding explicit add/remove types).
*   **Payload:**
    ```json
    {
      "collectionId": "string",
      "itemId": "string"
    }
    ```
*   **Behavior:** Toggles the song's membership in the specified collection in memory (adds it if absent; removes it if present).

#### 4. Create Collection
*   **Type:** `com.applicaster.collection.create.v1`
*   **Payload:**
    ```json
    {
      "name": "string" // Optional name. If omitted or empty, auto-names to "Playlist #N"
    }
    ```
*   **Behavior:** Triggers new collection creation, generating the next sequential default name if no name is provided.

#### 5. Delete Collection
*   **Type:** `com.applicaster.collection.delete.v1`
*   **Payload:**
    ```json
    {
      "collectionId": "string"
    }
    ```
*   **Behavior:** Deletes the specified collection. (Blocked server-side for the system Queue collection).

#### 6. Playback Started (Continue Watching)
*   **Type:** `com.applicaster.video.started.v1`
*   **Payload:**
    ```json
    {
      "videoId": "string",
      "sourceCollectionId": "string" // Optional. See resolved paths below.
    }
    ```
*   **Behavior:** Updates the Queue collection. If `sourceCollectionId` is provided and is not the Queue, replaces the Queue content with the source collection items starting from the started video below. Otherwise, removes the "head" of the Queue up to the first occurrence of the started video.
*   **Source Collection Resolution:** The `sourceCollectionId` can be passed in any of the following payload locations:
    1. `data.sourceCollectionId`
    2. `data['continue-watching'].sourceCollectionId`
    3. `data.continueWatching.sourceCollectionId`
    4. `data.entry.extensions['continue-watching'].sourceCollectionId`
    5. `data.entry.extensions.continueWatching.sourceCollectionId`

#### 7. Playback Stopped/Completed
*   **Type:** `com.applicaster.video.stopped.v1`
*   **Payload:**
    ```json
    {
      "videoId": "string",
      "status": "string" // "COMPLETED" is required to trigger action
    }
    ```
*   **Behavior:** If status is `"COMPLETED"`, removes the specified video from the Queue.

---

## 4. UI (Frontend) Specifications

> [!NOTE]
> *Placeholder Section*
>
> This section will cover the user interface implementation, detailing how each functional flow and API interaction is represented on the screen (such as cell layouts, action sheet menus, playlist creation modals, and reordering controls) and how user gestures trigger these flows.

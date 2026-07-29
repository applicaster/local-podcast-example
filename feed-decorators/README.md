# @lib/feed-decorators — TypeScript DSL for Applicaster Feeds & Actions

`@lib/feed-decorators` is a TypeScript library that provides a fluent, type-safe DSL for building Applicaster/Zapp feeds, entries, actions, and behaviors.

It allows backend services (such as `@lib/mock-podcast`) to construct dynamic, role-driven JSON responses that adhere to Zapp rendering schemas without hand-crafting complex JSON structures.

---

## 1. Key Features

*   **`EntryBuilder`**: Fluent chainable API for generating standard Zapp entry objects with title, summary, media group, and extensions.
*   **`ActionsBuilder`**: Fluent chainable API for generating entry actions (`openBottomSheet`, `showTextInput`, `sendCloudEvent`, `playAll`, `addToPlaylist`) and cell tap actions.
*   **`buildPreferenceFeed`**: Utility for generating preference editor and collection selector feeds with appropriate `role` and `behavior` tags.
*   **Zod Runtime Validation**: Schemas (`validateZappFeed`, `validateActionPayload`) for validating feed and action payloads at runtime.

---

## 2. Core API Usage & Examples

### Using `EntryBuilder` and `ActionsBuilder`

```typescript
import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';

// Build interactive entry actions
const actions = new ActionsBuilder()
  .addOpenBottomSheetAction({
    id: 'edit_playlist',
    alias: 'edit',
    headerTitle: 'Edit Playlist',
    itemsUrl: 'https://api.example.com/user/collections/123?editable=true',
  })
  .addShowTextInputAction({
    id: 'rename_playlist',
    alias: 'edit_name',
    headerTitle: 'Rename Playlist',
    inputLabel: 'Playlist Name',
    defaultValue: 'My Playlist',
    buttonLabel: 'Save',
    postUrl: 'https://api.example.com/cloud-events',
    cloudEventType: 'com.applicaster.collection.rename.v1',
    collectionId: '123',
  })
  .build();

// Build a Zapp entry
const entry = new EntryBuilder('collection-123', 'My Playlist')
  .setType('link')
  .setSummary('10 tracks')
  .setMediaGroup([
    {
      type: 'image',
      media_item: [{ src: 'https://example.com/cover.jpg', key: 'thumbnail' }],
    },
  ])
  .setExtensions({
    role: 'dynamic_collection',
    dynamic_collection_options: {
      postUrl: 'https://api.example.com/cloud-events',
      operations: 'remove,reorder',
    },
  })
  .setActions(actions)
  .build();
```

---

## 3. Documentation References

For full architectural concepts, case studies, and action payload schemas:
*   **Domain Definitions & Phase 3 Contract:** [docs/TopLevelOverview.md](docs/TopLevelOverview.md)
*   **Actions & Behavior Schemas:** [docs/Actions.md](docs/Actions.md)
*   **Storage & Memory Management:** [docs/memory.md](docs/memory.md)

---

## 4. Development & Testing

### Installation & Build
```bash
npm install
npm run build
```

### Running Tests
Run the unit test suite:
```bash
npm test
```

# @lib/feed-decorators — TypeScript DSL for Applicaster Feeds & Actions

`@lib/feed-decorators` is a TypeScript library that provides a fluent, type-safe DSL for building Applicaster/Zapp feeds, entries, actions, and behaviors.

It allows backend services (such as `@lib/mock-podcast`) to construct dynamic, role-driven JSON responses that adhere to Zapp rendering schemas without hand-crafting complex JSON structures.

---

## 1. Key Features

*   **`EntryBuilder`**: Fluent chainable API for generating standard Zapp entry objects with title, cover images, extensions, and actions.
*   **`ActionsBuilder`**: Fluent chainable API for generating entry actions (`openBottomSheet`, `showTextInput`, `sendCloudEvent`, `addToQueue`, `addAllToQueue`, `showToast`) and cell tap actions.
*   **Feed Construction Helpers**: Utilities (`buildPreferenceFeed`, `buildDynamicCollectionFeed`, `buildCollectionSelectorFeed`) for generating feeds with appropriate `role`, `behavior`, and `dynamic_collection_options` tags.
*   **Zod Runtime Validation**: Schemas (`validateZappFeed`, `validateActionPayload`) for validating feed and action payloads at runtime.

---

## 2. Core API Usage & Examples

### Using `EntryBuilder` and `ActionsBuilder`

```typescript
import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';

// Build interactive entry actions
const actions = new ActionsBuilder();
actions
  .openBottomSheet({
    header: {
      title: 'Edit Playlist',
    },
    content: {
      title: 'Your Collections',
      itemsUrl: 'https://api.example.com/user/collections/123?editable=true',
      items: [],
    },
  })
  .showToast('Updated');

// Build a Zapp entry
const entry = new EntryBuilder(actions, {
  id: 'collection-123',
  type: { value: 'link' },
})
  .setTitle('My Playlist')
  .addCoverImage({ url: 'https://example.com/cover.jpg' })
  .addExtension('role', 'dynamic_collection')
  .setUpNextFeed('https://api.example.com/media/up-next') // Auto-chaining recommendation feed
  .build();
```

### Chaining with `setUpNextFeed` & `setCollectionUpNextFeed`
```typescript
// Attach an upNextFeed URL or DataSource object for end-of-queue recommendations
entryBuilder.setUpNextFeed('https://api.example.com/media/up-next?seedItemId=track_1');

// Attach a collection continuation feed so direct play populates remaining collection tracks into Next Up
entryBuilder.setCollectionUpNextFeed(
  'https://api.example.com/user/collections/col_1/up-next?afterItemId=track_1'
);

// Or with full Pipes DataSource configuration
entryBuilder.setUpNextFeed({
  source: 'https://api.example.com/recommendations',
  mapping: 'custom_mapping',
  headers: { Authorization: 'Bearer <token>' },
});
```

### Queue Actions (`addToQueue` & `addAllToQueue`)
```typescript
const queueActions = new ActionsBuilder()
  .addToQueue({ position: 'bottom' })
  .addAllToQueue({
    url: 'https://api.example.com/user/collections/col_1',
    target: 'auto', // 'manual' | 'auto'
    position: 'bottom', // 'top' | 'bottom'
    startPlayback: false,
  });
```

---

## 3. Documentation References

For full architectural concepts, client integration, and action payload schemas:
*   **Client Integration & Consumer Guide:** [docs/ConsumerGuide.md](docs/ConsumerGuide.md)
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

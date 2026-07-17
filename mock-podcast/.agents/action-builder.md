# Entry and Action Builder Architecture

## Overview
The goal is to provide a strongly-typed, semantic API for building Feed Entries in the `mock-podcast` library. Instead of manipulating raw JSON or generic `ActionsBuilder` calls, we want to construct entries using specific semantic actions based on the entry type (e.g., Audio On Demand - AOD, Video On Demand - VOD, Live Audio).

## Design Concept
We will introduce a generic `EntryBuilder` that takes a specific `ActionBuilder` type as a parameter. This allows the builder to expose custom semantic actions (like `addToQueue` or `addToPlaylist`) which internally translate to the actual generic commands (`navigateToScreen`, `sendCloudEvent`, `refreshComponent`, etc.) defined in the `feed-decorators` library.

### 1. The Generic `EntryBuilder`
A base generic builder responsible for common entry properties (like title, images, streams) while delegating to a generic parameter for actions.

```typescript
import { ZappEntry } from 'feed-decorators'; // or appropriate import

export class EntryBuilder<TActionBuilder extends ActionsBuilder> {
    private entry: Partial<ZappEntry>;
    private actionBuilder: TActionBuilder;

    constructor(actionBuilder: TActionBuilder, baseEntry: Partial<ZappEntry> = {}) {
        this.entry = baseEntry;
        this.actionBuilder = actionBuilder;
    }

    addCoverImage(opts: { url: string, aspect: string }) {
        // Logic to add cover image to entry.media_group
        return this;
    }

    addThumbnail(opts: { url: string, aspect: string }) {
        // Logic to add thumbnail to entry.media_group
        return this;
    }

    setStream(opts: { url: string, type: string }) {
        // Logic to set stream in entry.content
        return this;
    }

    addActions(): TActionBuilder {
        return this.actionBuilder;
    }

    build(): ZappEntry {
        // Merge entry properties with actions built from the actionBuilder
        const actionsEntry = this.actionBuilder.build();
        return {
            ...this.entry,
            ...actionsEntry, // Merges extensions.tap_actions etc
        };
    }
}
```

### 2. Specific Action Builders
We will extend `ActionsBuilder` (from `feed-decorators`) to create specific action sets for different item types.

```typescript
import { ActionsBuilder } from 'feed-decorators';

export class UserCollectionAODItemBuilder extends ActionsBuilder {
    
    addToPlaylist(opts: { itemId: string }) {
        // Hides complex logic behind semantic name
        this.navigateToScreen({
            typeMapping: 'toggle_song_in_collections'
        });
        return this;
    }
    
    addToQueue(opts: { itemId: string }) {
        this.sendCloudEvent({
           url: '@{ctx/cloud_events_url}', // or injected URL
           type: 'com.applicaster.collection.add.v1',
           data: {
               collectionId: 'queue',
               itemId: opts.itemId
           }
        });
        this.refreshComponent();
        return this;
    }
}
```

### 3. Usage Example
```typescript
const builder = new UserCollectionAODItemBuilder({ id: 'item1' });

const entry = new EntryBuilder<UserCollectionAODItemBuilder>(builder)
  .addCoverImage({ url: 'image.jpg', aspect: '16x9' })
  .setStream({ url: 'stream.mp4', type: 'video/mp4' })
  .addActions()
     .addToPlaylist({ itemId: 'item1' })
     .addToQueue({ itemId: 'item1' })
  .build(); // Builds final ZappEntry
```

## Benefits
- **Type Safety**: IDEs will only suggest actions that are appropriate for the specific entry type.
- **Encapsulation**: Details like `typeMapping`, cloud event types, and required screen refresh behaviors are encapsulated inside semantic method names.
- **Maintainability**: If the underlying protocol for adding to a playlist changes, it only needs to be updated in `UserCollectionAODItemBuilder`.

# Collections DAO Architecture

## Overview

This document outlines the desired architecture for the Collections persistence layer, replacing the current array-based load/save approach with a collection-level CRUD API.

## Goals

1. **Collection-level API**: Expose granular operations (`getCollectionById`, `updateCollection`, etc.) instead of bulk load/save
2. **DAO-specific caching**: Each DAO implementation manages its own caching strategy
3. **Environment-based backend selection**: Automatic backend selection based on runtime environment
4. **Reusable DAO instances**: Module holds a single DAO instance determined at initialization

## DAO Interface

```typescript
export interface CollectionsDao {
  /**
   * Initialize the DAO with default collections.
   * Called once on module startup.
   */
  initialize(defaultCollections: CollectionEntity[]): Promise<void>;

  /**
   * Get all collections.
   * Each DAO decides its own caching strategy.
   */
  getCollections(): Promise<CollectionEntity[]>;

  /**
   * Get a single collection by ID.
   * Should be more efficient than loading all collections.
   */
  getCollectionById(collectionId: string): Promise<CollectionEntity | undefined>;

  /**
   * Create a new collection.
   * Returns the created collection.
   */
  createCollection(collection: CollectionEntity): Promise<CollectionEntity>;

  /**
   * Update an existing collection.
   * Returns the updated collection.
   */
  updateCollection(collection: CollectionEntity): Promise<CollectionEntity>;

  /**
   * Delete a collection by ID.
   * Returns true if deleted, false if not found.
   */
  deleteCollection(collectionId: string): Promise<boolean>;
}
```

## DAO Implementations

### 1. MemoryCollectionsDao

**Purpose**: In-process memory storage for tests

**Caching Strategy**:
- Stores collections in `this.collections: CollectionEntity[]`
- All operations work directly on this in-memory array
- No file I/O
- No external dependencies

**Lifecycle**:
- `initialize()`: Loads default collections into memory
- All CRUD operations: Direct array manipulation
- Data lost when process terminates

**Usage**: Jest tests (detected via `JEST_WORKER_ID` or `NODE_ENV=test`)

### 2. FileCollectionsDao

**Purpose**: Local file-backed persistence with in-memory cache

**Caching Strategy**:
- **Read cache**: Loads from `data/collections.json` once at `initialize()`, stores in `this.collections`
- **Write-through**: Every mutation (create/update/delete) updates in-memory array AND writes to file immediately
- Single source of truth: file on disk
- In-memory cache provides fast reads

**Lifecycle**:
- `initialize()`: Read file → load into `this.collections`
- `getCollections()`: Return `this.collections` (cached)
- `getCollectionById()`: Find in `this.collections` (cached)
- `createCollection()`: Push to `this.collections` + `writeToFile()`
- `updateCollection()`: Update `this.collections` + `writeToFile()`
- `deleteCollection()`: Remove from `this.collections` + `writeToFile()`

**Usage**: Local development (default when not in test or cloud environment)

### 3. FirestoreCollectionsDao

**Purpose**: Cloud Firestore persistence with no in-process cache

**Caching Strategy**:
- **No in-process cache**: Every operation reads fresh from Firestore
- Relies on Firestore's own caching and indexing
- Suitable for multi-instance deployments (Cloud Run/Firebase Functions)

**Lifecycle**:
- `initialize()`: Check if document exists, create with defaults if empty
- Every operation: Call `loadFromFirestore()` → perform operation → call `saveToFirestore()`
- Timeout protection: Wrap Firestore calls in `withTimeout(5000ms)` to fail fast when credentials are missing

**Usage**: Firebase Cloud (detected via `FUNCTION_TARGET` or `K_SERVICE` environment variables)

## Persistence Service

```typescript
@Injectable()
export class CollectionsPersistenceService {
  private dao: CollectionsDao;
  private initialized = false;

  async initialize(defaultCollections: CollectionEntity[]): Promise<void> {
    if (this.initialized) {
      return;
    }

    const backend = this.getPersistenceBackend();
    this.logger.log(`Initializing collections with backend="${backend}"`);

    // Create DAO instance based on environment
    if (backend === 'memory') {
      this.dao = new MemoryCollectionsDao(this.cloneCollections.bind(this));
    } else if (backend === 'firestore') {
      this.dao = new FirestoreCollectionsDao(
        this.firestoreCollection,
        this.firestoreDoc,
        this.logger,
        this.cloneCollections.bind(this),
      );
    } else {
      this.dao = new FileCollectionsDao(
        this.filePath,
        this.logger,
        this.cloneCollections.bind(this),
      );
    }

    await this.dao.initialize(defaultCollections);
    this.initialized = true;
  }

  // All operations delegate to this.dao
  async getCollections(): Promise<CollectionEntity[]> {
    return this.dao.getCollections();
  }

  async getCollectionById(collectionId: string): Promise<CollectionEntity | undefined> {
    return this.dao.getCollectionById(collectionId);
  }

  async createCollection(collection: CollectionEntity): Promise<CollectionEntity> {
    return this.dao.createCollection(collection);
  }

  async updateCollection(collection: CollectionEntity): Promise<CollectionEntity> {
    return this.dao.updateCollection(collection);
  }

  async deleteCollection(collectionId: string): Promise<boolean> {
    return this.dao.deleteCollection(collectionId);
  }

  private getPersistenceBackend(): PersistenceBackend {
    // Test environment: use in-memory DAO
    if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
      return 'memory';
    }

    // Cloud environment: use Firestore DAO
    // FUNCTION_TARGET = Firebase Functions
    // K_SERVICE = Cloud Run
    if (process.env.FUNCTION_TARGET || process.env.K_SERVICE) {
      return 'firestore';
    }

    // Default: local file-based DAO
    return 'file';
  }
}
```

## Collections Service Changes

The `CollectionsService` should:

1. **Remove in-memory `this.collections` array**: Don't cache collections at service level
2. **Call DAO for each operation**: Use `persistenceService.getCollectionById()` instead of loading all collections
3. **Use granular queries**: Avoid loading all collections unless actually needed (e.g., for feed display)

**Before** (inefficient):
```typescript
async deleteCollection(id: string) {
  const collections = await this.getCollections(); // Load all
  const collection = collections.find(c => c.id === id); // Find one
  // ...
}
```

**After** (efficient):
```typescript
async deleteCollection(id: string) {
  const collection = await this.persistenceService.getCollectionById(id); // Load only one
  // ...
}
```

**When to load all collections**:
- `getCollectionsFeed()`: Building feed requires all collections
- `createCollection()`: Generating default name requires checking existing names
- `getQueueCollection()`: Finding queue by name requires search

**When to load single collection**:
- `getCollectionFeedById()`: Use `getCollectionById(id)`
- `deleteCollection()`: Use `getCollectionById(id)`
- `addItemToCollection()`: Use `getCollectionById(id)`
- `toggleItemInCollection()`: Use `getCollectionById(id)`
- `removeItemFromCollection()`: Use `getCollectionById(id)`

## Backend Selection Logic

| Environment | Detection | Backend | DAO Implementation |
|-------------|-----------|---------|-------------------|
| **Jest Tests** | `JEST_WORKER_ID` or `NODE_ENV=test` | `memory` | MemoryCollectionsDao |
| **Firebase Functions** | `FUNCTION_TARGET` | `firestore` | FirestoreCollectionsDao |
| **Cloud Run** | `K_SERVICE` | `firestore` | FirestoreCollectionsDao |
| **Local Development** | Default (none of above) | `file` | FileCollectionsDao |

## Migration Notes

### Key Changes

1. **DAO interface**: Replace `loadCollections()`/`saveCollections()` with collection-level CRUD
2. **No ConfigService**: Remove all config-driven backend selection
3. **Single DAO instance**: Determined at initialization, reused throughout lifecycle
4. **Caching delegation**: Each DAO owns its caching strategy
5. **Timeout protection**: Firestore operations wrapped with 5-second timeout

### Potential Issues to Watch

1. **Stale webpack cache**: After interface changes, restart dev server to clear compiled JS
2. **Firestore hanging locally**: Without `withTimeout()`, missing credentials cause indefinite await
3. **Multi-instance consistency**: Firestore DAO has no in-process cache, so multiple Cloud Run instances see fresh data
4. **File locking**: FileDAO write-through strategy assumes single process (fine for local dev)

### Testing Strategy

1. **Unit tests**: Mock DAO interface, test service logic
2. **Integration tests**: Test each DAO implementation separately
3. **Environment tests**: Verify correct DAO selected in each environment

## Benefits

1. **Efficiency**: Load only what you need (especially important for Firestore)
2. **Clarity**: Each DAO owns its caching strategy explicitly
3. **Simplicity**: No config-driven magic, just environment detection
4. **Flexibility**: Easy to add new backends (e.g., Redis, PostgreSQL)
5. **Testability**: Mock single DAO interface instead of entire persistence layer

## Implementation Checklist

- [ ] Update `CollectionsDao` interface (add collection-level methods)
- [ ] Rewrite `MemoryCollectionsDao` with in-memory array
- [ ] Rewrite `FileCollectionsDao` with read cache + write-through
- [ ] Rewrite `FirestoreCollectionsDao` with fresh reads + timeout protection
- [ ] Update `CollectionsPersistenceService` to hold single DAO instance
- [ ] Remove `ConfigService` dependency from persistence layer
- [ ] Refactor `CollectionsService` to use `getCollectionById()` where appropriate
- [ ] Update test mocks to implement new DAO interface
- [ ] Run full test suite
- [ ] Test locally with file backend
- [ ] Test in cloud with Firestore backend
- [ ] Format all changed files with Prettier

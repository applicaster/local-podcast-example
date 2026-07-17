import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { CollectionEntity } from './collections.types';

const configModule = '@lib/mock-podcast';
const DEFAULT_PERSISTENCE_BACKEND = 'auto';

@Injectable()
export class CollectionsPersistenceService {
  private readonly logger = new Logger(CollectionsPersistenceService.name);
  private readonly filePath = path.join(
    process.cwd(),
    'data',
    'collections.json',
  );
  private readonly firestoreCollection = 'mock-podcast';
  private readonly firestoreDoc = 'collections';

  constructor(private readonly configService: ConfigService) {}

  async loadCollections(
    defaultCollections: CollectionEntity[],
  ): Promise<CollectionEntity[]> {
    if (!this.isPersistenceEnabled()) {
      this.logger.debug(
        `Persistence is disabled (${configModule}.config.skipPersistence=true)`,
      );
      return defaultCollections;
    }

    const firestoreCollections = await this.loadCollectionsFromFirestore();
    if (firestoreCollections) {
      if (firestoreCollections.length === 0) {
        await this.saveCollections(defaultCollections);
        return defaultCollections;
      }

      this.logger.log(
        `Loaded ${firestoreCollections.length} collections from Firestore`,
      );
      return firestoreCollections;
    }

    const fileCollections = await this.loadCollectionsFromFile();
    if (fileCollections) {
      this.logger.log(
        `Loaded ${fileCollections.length} collections from ${this.filePath}`,
      );
      return fileCollections;
    }

    return defaultCollections;
  }

  async saveCollections(collections: CollectionEntity[]): Promise<void> {
    if (!this.isPersistenceEnabled()) {
      return;
    }

    const firestoreSaved = await this.saveCollectionsToFirestore(collections);
    if (firestoreSaved) {
      return;
    }

    await this.saveCollectionsToFile(collections);
  }

  private getFirestore() {
    const backend = this.getPersistenceBackend();
    if (backend === 'file') {
      return null;
    }

    try {
      const app = admin.apps.length > 0 ? admin.app() : admin.initializeApp();
      return app.firestore();
    } catch (error) {
      const message = (error as Error).message;
      if (backend === 'firestore') {
        this.logger.error(
          `Firestore persistence is required but unavailable: ${message}`,
        );
      } else {
        this.logger.debug(
          `Firestore unavailable, falling back to file persistence: ${message}`,
        );
      }
      return null;
    }
  }

  private async loadCollectionsFromFirestore(): Promise<
    CollectionEntity[] | null
  > {
    const db = this.getFirestore();
    const backend = this.getPersistenceBackend();
    if (!db) {
      return null;
    }

    try {
      const snapshot = await db
        .collection(this.firestoreCollection)
        .doc(this.firestoreDoc)
        .get();

      if (!snapshot.exists) {
        return [];
      }

      const data = snapshot.data();
      const collections = data?.collections;

      if (!Array.isArray(collections)) {
        this.logger.warn(
          'Firestore mock-podcast.collections payload is invalid, using empty state',
        );
        return [];
      }

      return collections as CollectionEntity[];
    } catch (error) {
      const message = (error as Error).message;
      if (backend === 'firestore') {
        this.logger.error(
          `Failed to load collections from Firestore: ${message}`,
        );
      } else {
        this.logger.debug(
          `Failed to load collections from Firestore, falling back to file: ${message}`,
        );
      }
      return null;
    }
  }

  private async saveCollectionsToFirestore(
    collections: CollectionEntity[],
  ): Promise<boolean> {
    const db = this.getFirestore();
    const backend = this.getPersistenceBackend();
    if (!db) {
      return false;
    }

    try {
      await db.collection(this.firestoreCollection).doc(this.firestoreDoc).set({
        collections,
        updatedAt: new Date().toISOString(),
      });
      this.logger.debug(`Saved ${collections.length} collections to Firestore`);
      return true;
    } catch (error) {
      const message = (error as Error).message;
      if (backend === 'firestore') {
        this.logger.error(
          `Failed to save collections to Firestore: ${message}`,
        );
      } else {
        this.logger.debug(
          `Failed to save collections to Firestore, falling back to file: ${message}`,
        );
      }
      return false;
    }
  }

  private async loadCollectionsFromFile(): Promise<CollectionEntity[] | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      return JSON.parse(data) as CollectionEntity[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.debug(
          `Collections file not found at ${this.filePath}, using defaults`,
        );
      } else {
        this.logger.warn(
          `Failed to load collections from file: ${(error as Error).message}`,
        );
      }
      return null;
    }
  }

  private async saveCollectionsToFile(
    collections: CollectionEntity[],
  ): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        this.filePath,
        JSON.stringify(collections, null, 2),
        'utf-8',
      );
      this.logger.debug(
        `Saved ${collections.length} collections to ${this.filePath}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to save collections to file: ${(error as Error).message}`,
      );
    }
  }

  private getPersistenceBackend(): 'auto' | 'file' | 'firestore' {
    const backend = this.configService.get(
      `${configModule}.config.persistenceBackend`,
    );

    if (backend === 'file' || backend === 'firestore' || backend === 'auto') {
      return backend;
    }

    return DEFAULT_PERSISTENCE_BACKEND;
  }

  private isPersistenceEnabled(): boolean {
    const skipPersistence = this.configService.get(
      `${configModule}.config.skipPersistence`,
    );

    if (typeof skipPersistence === 'boolean') {
      return !skipPersistence;
    }

    if (typeof skipPersistence === 'string') {
      return skipPersistence.toLowerCase() !== 'true';
    }

    return true;
  }
}

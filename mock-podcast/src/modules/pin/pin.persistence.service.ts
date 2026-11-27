import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as admin from 'firebase-admin';
import { PinRecord } from './pin.types';

const configModule = '@lib/mock-podcast';
const DEFAULT_PERSISTENCE_BACKEND = 'auto';

@Injectable()
export class PinPersistenceService {
  private readonly logger = new Logger(PinPersistenceService.name);
  private readonly filePath = path.join(process.cwd(), 'data', 'pins.json');
  private readonly firestoreCollection = 'mock-podcast';
  private readonly firestoreDoc = 'pins';

  constructor(private readonly configService: ConfigService) {}

  async loadPins(): Promise<PinRecord[]> {
    if (!this.isPersistenceEnabled()) {
      this.logger.debug(
        `Persistence is disabled (${configModule}.config.skipPersistence=true)`,
      );
      return [];
    }

    const fromFirestore = await this.loadPinsFromFirestore();
    if (fromFirestore) {
      return fromFirestore;
    }

    const fromFile = await this.loadPinsFromFile();
    if (fromFile) {
      return fromFile;
    }

    return [];
  }

  async savePins(pins: PinRecord[]): Promise<void> {
    if (!this.isPersistenceEnabled()) {
      return;
    }

    const saved = await this.savePinsToFirestore(pins);
    if (saved) {
      return;
    }

    await this.savePinsToFile(pins);
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
      this.logger.debug(
        `Firestore unavailable for pins: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async loadPinsFromFirestore(): Promise<PinRecord[] | null> {
    const db = this.getFirestore();
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

      const pins = snapshot.data()?.pins;
      if (!Array.isArray(pins)) {
        this.logger.warn(
          'Firestore mock-podcast.pins payload is invalid, using empty state',
        );
        return [];
      }

      return pins as PinRecord[];
    } catch (error) {
      this.logger.debug(
        `Failed to load pins from Firestore: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async savePinsToFirestore(pins: PinRecord[]): Promise<boolean> {
    const db = this.getFirestore();
    if (!db) {
      return false;
    }

    try {
      await db.collection(this.firestoreCollection).doc(this.firestoreDoc).set({
        pins,
        updatedAt: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      this.logger.debug(
        `Failed to save pins to Firestore: ${(error as Error).message}`,
      );
      return false;
    }
  }

  private async loadPinsFromFile(): Promise<PinRecord[] | null> {
    try {
      const data = await fs.readFile(this.filePath, 'utf-8');
      const pins = JSON.parse(data);

      if (!Array.isArray(pins)) {
        this.logger.warn(
          `Pins file at ${this.filePath} is not an array, using empty state`,
        );
        return [];
      }

      return pins as PinRecord[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.logger.debug(`Pins file not found at ${this.filePath}`);
      } else {
        this.logger.warn(
          `Failed to load pins from file: ${(error as Error).message}`,
        );
      }
      return null;
    }
  }

  private async savePinsToFile(pins: PinRecord[]): Promise<void> {
    try {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, JSON.stringify(pins, null, 2), 'utf-8');
    } catch (error) {
      this.logger.error(
        `Failed to save pins to file: ${(error as Error).message}`,
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

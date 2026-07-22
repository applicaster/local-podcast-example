import { Injectable, Logger } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  Feed,
  Entry,
  RadioItem,
} from '../../types/feed';
import { UI_LABELS } from '../../constants/ui-labels.constants';
import { LiveAudioEntryBuilder } from '../../builders/LiveAudioEntryBuilder';

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  private radioData: RadioItem[] = [];
  private playlistItems: RadioItem[] = [];
  private defaultFeedCaches = new Map<string, Feed>();

  constructor() {
    this.loadRadioCollection();
  }

  /**
   * Generate a simple UUID v4 string
   */
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
        /[xy]/g,
        function (c) {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        },
    );
  }

  /**
   * Load radio.csv and parse it into RadioItem array
   */
  private loadRadioCollection() {
    try {
      const csvPath = join(process.cwd(), 'data', 'radio.csv');
      const csvContent = readFileSync(csvPath, 'utf-8');

      const lines = csvContent.trim().split('\n');
      // Skip header
      this.radioData = lines.slice(1).map((line) => {
        const [id, stream, image, homepage] = line.split(';');
        return {
          id: id.trim(),
          stream: stream.trim(),
          image: image?.trim() || undefined,
          homepage: homepage?.trim() || undefined,
          title: this.getTitleForId(id.trim()),
        };
      });

      this.logger.log(
          `Loaded ${this.radioData.length} radio stations from CSV`,
      );
    } catch (error) {
      this.logger.error('Failed to load radio.csv', error);
      this.radioData = [];
    }

    try {
      const songsPath = join(process.cwd(), 'data', 'scraped_songs.json');
      const songsContent = readFileSync(songsPath, 'utf-8');
      this.playlistItems = JSON.parse(songsContent);
      this.logger.log(
          `Loaded ${this.playlistItems.length} playlist songs from JSON`,
      );
    } catch (error) {
      this.logger.error('Failed to load scraped_songs.json', error);
      this.playlistItems = [];
    }
  }

  /**
   * Convert radio ID to display title
   */
  private getTitleForId(id: string): string {
    const titleMap = UI_LABELS.RADIO_STATION_TITLES;
    return titleMap[id] || id.charAt(0).toUpperCase() + id.slice(1);
  }

  /**
   * Get audio entries for a list of item IDs (preserves order)
   */
  getEntriesForIds(ids: string[], isLoggedIn = true): Entry[] {
    return ids
        .map((id) => this.radioData.find((r) => r.id === id) || this.playlistItems.find((r) => r.id === id))
        .filter((r): r is RadioItem => r !== undefined)
        .map((r) => this.radioItemToEntry(r, 'audio', undefined, isLoggedIn));
  }

  /**
   * Get radio collection feed
   */
  getRadioFeed(baseUrl?: string, isLoggedIn = true): Feed {
    const cacheKey = `${baseUrl || 'http://localhost:3000'}:${isLoggedIn}`;
    if (this.defaultFeedCaches.has(cacheKey)) {
      return this.defaultFeedCaches.get(cacheKey) as Feed;
    }

    const entries: Entry[] = this.radioData.map((radio) =>
        this.radioItemToEntry(radio, 'audio', baseUrl, isLoggedIn),
    );

    const feed: Feed = {
      id: this.generateUUID(),
      type: { value: 'feed' },
      title: UI_LABELS.FEED_TITLES.LIVE_RADIO,
      entry: entries,
      extensions: {},
    };

    this.defaultFeedCaches.set(cacheKey, feed);
    return feed;
  }

  /**
   * Convert RadioItem to Feed Entry
   */
  private radioItemToEntry(
      radio: RadioItem,
      entryType = 'audio',
      baseUrl?: string,
      isLoggedIn = true,
  ): Entry {
    const entry = new LiveAudioEntryBuilder(
        {
          id: radio.id,
          type: { value: entryType },
        },
        baseUrl,
    )
        .setTitle(radio.title || radio.id)
        .setStream({ url: radio.stream, type: 'application/octet' })
        .addCoverImage({ url: radio.image || null, key: 'image_base' });

    if (isLoggedIn) {
      entry.addToPlaylist();
    }

    entry.addToQueue();

    if (radio.homepage) {
      entry.addExtension('homepage', radio.homepage);
    }

    return entry.build() as Entry;
  }
}

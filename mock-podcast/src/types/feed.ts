/**
 * Feed Entry Types - Based on Pipes2 JSON Feed protocol
 */

export interface ContentItem {
  src: string;
  type: string;
}

export interface MediaItem {
  key: string;
  src: string | null;
}

export interface MediaGroup {
  type: 'image' | 'video';
  media_item: MediaItem[];
}

export interface EntryType {
  value: string;
}

export interface Entry {
  id: string;
  type: EntryType;
  title: string;
  summary?: string | null;
  content?: ContentItem;
  media_group: MediaGroup[];
  extensions: Record<string, any>;
  link?: {
    rel: string;
    href: string;
  };
}

export interface Feed {
  id: string;
  type: EntryType;
  title: string;
  entry: Entry[];
  extensions: Record<string, any>;
}

export interface RadioItem {
  id: string;
  stream: string;
  image?: string;
  homepage?: string;
  title?: string;
}

export interface CollectionEntity {
  id: string;
  name: string;
  itemIds: string[];
  createdAt: string;
  updatedAt: string;
  isSystem: boolean;
}

export interface CollectionEntry {
  id: string;
  title: string;
  type: { value: string };
  media_group?: Array<{
    type: 'image' | 'video';
    media_item: Array<{ key: string; src: string | null }>;
  }>;
  extensions: {
    item_count: number;
    is_system: boolean;
    entry_action?: Array<{
      button: {
        title: string;
        iconURL: string;
      };
      dismiss_on_action: boolean;
      actions: Array<{
        type: string;
        options: Record<string, unknown>;
      }>;
    }>;
    tap_actions?: {
      actions: Array<{
        type: string;
        options: Record<string, unknown>;
      }>;
    };
  };
}

export interface CollectionsFeed {
  id: string;
  type: { value: string };
  title: string;
  entry: CollectionEntry[];
  extensions: Record<string, unknown>;
}

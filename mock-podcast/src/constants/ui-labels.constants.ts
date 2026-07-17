export const UI_LABELS = {
  FEED_TITLES: {
    LIVE_RADIO: 'Live Radio',
    SELECT_SONG: 'Select Song',
    YOUR_COLLECTIONS: 'Your Collections',
  },
  ENTRY_TITLES: {
    EDIT: 'Edit',
    CREATE_COLLECTION: 'Create collection',
  },
  ACTION_BUTTON_TITLES: {
    ADD_TO_PLAYLIST: 'Add to Playlist',
    ADD_TO_QUEUE: 'Add to Queue',
    ADD_ALL_TO_QUEUE: 'Add all to Queue',
    REMOVE_ITEM: 'Remove item',
    DELETE_COLLECTION: 'Delete collection',
  },
  COLLECTION: {
    QUEUE_NAME: 'Queue',
    DEFAULT_PLAYLIST_PREFIX: 'Playlist #',
  },
  RADIO_STATION_TITLES: {
    slay: 'Slay Radio',
    retro: 'Retro Radio',
    plaza: 'Plaza.one',
    provodach: 'provoda.ch',
  } as Record<string, string>,
} as const;

import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';

export class LiveAudioEntryBuilder extends EntryBuilder {
  private readonly baseUrl: string;

  constructor(baseEntry: any, baseUrl?: string) {
    super(new ActionsBuilder(baseEntry), baseEntry);
    this.baseUrl = baseUrl || 'http://localhost:3000';
  }

  addToPlaylist(baseUrl?: string) {
    const activeBaseUrl = baseUrl || this.baseUrl;
    const actionBuilder = new ActionsBuilder({});
    actionBuilder.addAction({
      type: 'openBottomSheet',
      options: {
        modal_presentation: {
          type: 'bottom_sheet',
          style_variant: 'modal_bottom_sheet',
        },
        header: {
          title: 'Select Playlist',
          subtitle: 'Add item to playlist',
        },
        content: {
          title: 'Your Collections',
          itemsUrl: `${activeBaseUrl}/user/collections?item_id=${this.entry.id}`,
          items: [],
        },
      },
    });

    this.addEntryActionByAlias('add_to_playlist', actionBuilder, false);
    return this;
  }

  addToQueue() {
    const actionBuilder = new ActionsBuilder({});
    actionBuilder.addAction({
      type: "addToQueue",
      options: {},
    });

    this.addEntryActionByAlias('add_to_queue', actionBuilder, true);
    return this;
  }
}

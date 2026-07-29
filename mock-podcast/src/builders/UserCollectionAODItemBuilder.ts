import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';

export class UserCollectionAODItemBuilder extends EntryBuilder {
  private readonly baseUrl: string;

  constructor(baseEntry: any, baseUrl?: string) {
    super(new ActionsBuilder(), baseEntry);
    this.baseUrl = baseUrl || 'http://localhost:3000';
  }

  addToPlaylist(opts?: { itemId?: string; baseUrl?: string }) {
    const activeBaseUrl = opts?.baseUrl || this.baseUrl;
    const actionBuilder = new ActionsBuilder();
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
          itemsUrl: `${activeBaseUrl}/user/collections?item_id=${opts?.itemId || this.entry.id}`,
          items: [],
        },
      },
    });

    this.addEntryActionByAlias('add_to_playlist', actionBuilder, false);
    return this;
  }

  addToQueue(opts?: { itemId?: string; baseUrl?: string }) {
    const activeBaseUrl = opts?.baseUrl || this.baseUrl;
    this.actionBuilder.sendCloudEvent({
      url: `${activeBaseUrl}/cloud-events`,
      type: 'com.applicaster.collection.add.item.v1',
      data: {
        collectionId: 'queue',
        itemId: opts?.itemId || '@{entry/id}',
      },
      inflateData: true,
    });
    this.actionBuilder.refreshComponent();
    return this;
  }
}

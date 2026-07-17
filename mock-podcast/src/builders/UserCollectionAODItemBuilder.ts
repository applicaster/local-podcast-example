import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';

export class UserCollectionAODItemBuilder extends EntryBuilder {
  constructor(baseEntry: any) {
    super(new ActionsBuilder(baseEntry), baseEntry);
  }

  addToPlaylist(opts?: { itemId?: string }) {
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
          itemsUrl: `http://localhost:3000/user/collections?item_id=${opts?.itemId || this.entry.id}`,
          items: [],
        },
      },
    });

    this.addEntryActionByAlias('add_to_playlist', actionBuilder, false);
    return this;
  }

  addToQueue(opts?: { itemId?: string }) {
    this.actionBuilder.sendCloudEvent({
      url: 'http://localhost:3000/cloud-events',
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

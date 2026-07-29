import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';

export class SystemCollectionEntryBuilder extends EntryBuilder {
  constructor(baseEntry: any) {
    super(new ActionsBuilder(), baseEntry);
  }

  addAllToQueue(baseUrl: string, collectionId: string) {
    const actionBuilder = new ActionsBuilder();
    actionBuilder.addAction({
      type: 'addAllToQueue',
      options: {
        url: `${baseUrl}/user/collections/${collectionId}`,
      },
    });

    this.addEntryActionByAlias('add_all_to_queue', actionBuilder, true);
    return this;
  }

  playAll(firstEntry: any) {
    const actionBuilder = new ActionsBuilder();
    actionBuilder.addAction({
      type: 'navigateToScreen',
      options: {
        typeMapping: firstEntry.type.value,
        navigationAction: 'push',
        entry: firstEntry,
      },
    });

    this.addEntryActionByAlias('play_all', actionBuilder, true);
    return this;
  }

  addAllToPlaylist(baseUrl: string, collectionId: string) {
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
          subtitle: 'Add items to playlist',
        },
        content: {
          title: 'Your Collections',
          itemsUrl: `${baseUrl}/user/collections?collection_id=${collectionId}`,
          items: [],
        },
      },
    });

    this.addEntryActionByAlias('add_to_playlist', actionBuilder, false);
    return this;
  }
}

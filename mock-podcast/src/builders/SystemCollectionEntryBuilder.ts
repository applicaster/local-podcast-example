import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';
import { UI_LABELS } from '../constants/ui-labels.constants';
import { ACTION_ICON_URLS } from '../constants/action-icons.constants';

export class SystemCollectionEntryBuilder extends EntryBuilder {
  constructor(
    baseEntry: any,
    private labels: typeof UI_LABELS = UI_LABELS,
    private icons: typeof ACTION_ICON_URLS = ACTION_ICON_URLS,
  ) {
    super(new ActionsBuilder(baseEntry), baseEntry);
  }

  addAllToQueue(baseUrl: string, collectionId: string) {
    const actionBuilder = new ActionsBuilder({});
    actionBuilder.addAction({
      type: 'addAllToQueue',
      options: {
        url: `${baseUrl}/user/collections/${collectionId}`,
      },
    });

    this.addEntryAction(
      this.labels.ACTION_BUTTON_TITLES.ADD_ALL_TO_QUEUE,
      this.icons.ADD_TO_QUEUE,
      actionBuilder,
      true,
    );
    return this;
  }

  playAll(firstEntry: any) {
    const actionBuilder = new ActionsBuilder({});
    actionBuilder.addAction({
      type: 'navigateToScreen',
      options: {
        typeMapping: firstEntry.type.value,
        navigationAction: 'push',
        entry: firstEntry,
      },
    });

    this.addEntryAction(
      'Play All',
      this.icons.ADD_TO_QUEUE,
      actionBuilder,
      true,
    );
    return this;
  }

  addAllToPlaylist(baseUrl: string, collectionId: string) {
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
          subtitle: 'Add items to playlist',
        },
        content: {
          title: 'Your Collections',
          itemsUrl: `${baseUrl}/user/collections?collection_id=${collectionId}`,
          items: [],
        },
      },
    });

    this.addEntryAction(
      this.labels.ACTION_BUTTON_TITLES.ADD_TO_PLAYLIST,
      this.icons.ADD_TO_PLAYLIST,
      actionBuilder,
      false,
    );
    return this;
  }
}

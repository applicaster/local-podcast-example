import { EntryBuilder, ActionsBuilder } from '@lib/feed-decorators';
import { UI_LABELS } from '../constants/ui-labels.constants';
import { ACTION_ICON_URLS } from '../constants/action-icons.constants';

export class LiveAudioEntryBuilder extends EntryBuilder {
  constructor(
    baseEntry: any,
    private labels: typeof UI_LABELS = UI_LABELS,
    private icons: typeof ACTION_ICON_URLS = ACTION_ICON_URLS,
  ) {
    super(new ActionsBuilder(baseEntry), baseEntry);
  }

  addToPlaylist() {
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
          itemsUrl: `http://localhost:3000/user/collections?item_id=${this.entry.id}`,
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

  addToQueue() {
    const actionBuilder = new ActionsBuilder({});
    actionBuilder.addAction({
      type: "addToQueue",
      options: {},
    });

    this.addEntryAction(
      this.labels.ACTION_BUTTON_TITLES.ADD_TO_QUEUE,
      this.icons.ADD_TO_QUEUE,
      actionBuilder,
      true,
    );
    return this;
  }
}

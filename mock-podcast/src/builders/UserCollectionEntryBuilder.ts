import { SystemCollectionEntryBuilder } from './SystemCollectionEntryBuilder';
import { ActionsBuilder } from '@lib/feed-decorators';
import { CLOUD_EVENT_TYPES } from '../constants/cloud-event-types.constants';

export class UserCollectionEntryBuilder extends SystemCollectionEntryBuilder {
  constructor(baseEntry: any) {
    super(baseEntry);
  }

  editCollection(
    baseUrl: string | undefined,
    collectionId: string,
    collectionName: string,
  ) {
    const activeBaseUrl = baseUrl || 'http://localhost:3000';
    const actionBuilder = new ActionsBuilder();
    actionBuilder.addAction({
      type: 'openBottomSheet',
      options: {
        modal_presentation: {
          type: 'bottom_sheet',
          style_variant: 'modal_bottom_sheet',
        },
        header: {
          title: 'Edit Playlist',
          subtitle: collectionName,
        },
        content: {
          title: collectionName,
          itemsUrl: `${activeBaseUrl}/user/collections/${collectionId}?editable=true`,
          items: [],
        },
      },
    });

    this.addEntryActionByAlias('edit', actionBuilder, false);
    return this;
  }

  editName(
    cloudEventsUrl: string,
    collectionId: string,
    collectionName: string,
  ) {
    const actionBuilder = new ActionsBuilder();
    actionBuilder.showTextInput({
      headerTitle: 'Edit Name & Details',
      inputLabel: 'Name your playlist',
      defaultValue: collectionName,
      buttonLabel: 'Update',
      action: {
        type: 'sendCloudEvent',
        options: {
          url: cloudEventsUrl,
          type: CLOUD_EVENT_TYPES.COLLECTION_RENAME,
          subject: 'edit_collection',
          data: { collectionId },
        },
      },
    });

    this.addEntryActionByAlias('edit_name', actionBuilder, false);
    return this;
  }

  deleteCollection(cloudEventsUrl: string, collectionId: string) {
    const actionBuilder = new ActionsBuilder()
      .sendCloudEvent({
        url: cloudEventsUrl,
        type: CLOUD_EVENT_TYPES.COLLECTION_DELETE,
        subject: 'delete_collection',
        data: { collectionId },
      })
      .refreshComponent();

    this.addEntryActionByAlias('delete_collection', actionBuilder, true);
    return this;
  }
}

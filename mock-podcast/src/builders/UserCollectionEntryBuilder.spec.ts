import { UserCollectionEntryBuilder } from './UserCollectionEntryBuilder';
import { CLOUD_EVENT_TYPES } from '../constants/cloud-event-types.constants';

describe('UserCollectionEntryBuilder.deleteCollection', () => {
  const cloudEventsUrl = 'http://localhost:3000/cloud-events';
  const collectionId = 'playlist-1';
  const collectionName = 'Morning Mix';

  const deleteAction = () => {
    const entry = new UserCollectionEntryBuilder({
      id: collectionId,
      type: { value: 'collection' },
    })
      .deleteCollection(cloudEventsUrl, collectionId, collectionName)
      .build();

    return entry.extensions?.entry_action?.find(
      (action: { button?: { alias?: string } }) =>
        action.button?.alias === 'delete_collection',
    );
  };

  it('requires confirmation before deleting and keeps the actions sheet open', () => {
    const action = deleteAction();

    expect(action).toBeDefined();
    expect(action.dismiss_on_action).toBe(false);
    expect(action.actions.map((item: { type: string }) => item.type)).toEqual([
      'confirmDialog',
      'dismissBottomSheet',
      'sendCloudEvent',
      'refreshComponent',
    ]);
  });

  it('uses playlist-experience default copy with the playlist name', () => {
    const action = deleteAction();

    expect(action.actions[0]).toEqual({
      type: 'confirmDialog',
      options: {
        title: 'Delete Playlist?',
        message: `Are you sure you want to delete ${collectionName}? This action can't be undone.`,
        okButtonText: 'Delete',
        cancelButtonText: 'Cancel',
      },
    });
  });

  it('sends the collection delete cloud event after confirm', () => {
    const action = deleteAction();

    expect(action.actions[2]).toEqual({
      type: 'sendCloudEvent',
      options: {
        url: cloudEventsUrl,
        type: CLOUD_EVENT_TYPES.COLLECTION_DELETE,
        subject: 'delete_collection',
        data: { collectionId },
      },
    });
  });
});

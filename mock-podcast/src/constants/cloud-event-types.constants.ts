export const CLOUD_EVENT_TYPES = {
  VIDEO_STARTED: 'com.applicaster.video.started.v1',
  VIDEO_STOPPED: 'com.applicaster.video.stopped.v1',
  COLLECTION_CREATE: 'com.applicaster.collection.create.v1',
  COLLECTION_ADD: 'com.applicaster.collection.add.item.v1',
  COLLECTION_ADD_ITEM: 'com.applicaster.collection.add.item.v1',
  COLLECTION_ADD_COLLECTION: 'com.applicaster.collection.add.collection.v1',
  COLLECTION_REMOVE: 'com.applicaster.collection.remove.v1',
  COLLECTION_REORDER: 'com.applicaster.collection.reorder.v1',
  COLLECTION_DELETE: 'com.applicaster.collection.delete.v1',
  COLLECTION_RENAME: 'com.applicaster.collection.rename.v1',
  EVENT_RECEIVED: 'com.applicaster.event.received.v1',
} as const;

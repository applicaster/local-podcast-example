import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MediaModule } from './modules/media/media.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { CloudEventsModule } from './modules/cloud-events/cloud-events.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        () => ({
          '@lib/mock-podcast': {
            config: {
              persistenceBackend: 'file',
              skipPersistence: false,
            },
          },
        }),
      ],
    }),
    MediaModule,
    CollectionsModule,
    CloudEventsModule,
  ],
})
export class MockPodcastModule {}


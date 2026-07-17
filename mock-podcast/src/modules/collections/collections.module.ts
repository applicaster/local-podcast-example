import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { CollectionsService } from './collections.service';
import { CollectionsController, SystemCollectionsController } from './collections.controller';
import { CollectionsPersistenceService } from './persistence.service';

@Module({
  imports: [MediaModule],
  providers: [CollectionsService, CollectionsPersistenceService],
  controllers: [CollectionsController, SystemCollectionsController],
  exports: [CollectionsService],
})
export class CollectionsModule {}

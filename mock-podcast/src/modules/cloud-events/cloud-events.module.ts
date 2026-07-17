import { Module } from '@nestjs/common';
import { CollectionsModule } from '../collections/collections.module';
import { CloudEventsController } from './cloud-events.controller';
import { CloudEventsService } from './cloud-events.service';

@Module({
  imports: [CollectionsModule],
  providers: [CloudEventsService],
  controllers: [CloudEventsController],
})
export class CloudEventsModule {}

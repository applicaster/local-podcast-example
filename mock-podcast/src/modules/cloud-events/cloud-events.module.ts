import { Module } from '@nestjs/common';
import { CollectionsModule } from '../collections/collections.module';
import { PinModule } from '../pin/pin.module';
import { CloudEventsController } from './cloud-events.controller';
import { CloudEventsService } from './cloud-events.service';

@Module({
  imports: [CollectionsModule, PinModule],
  providers: [CloudEventsService],
  controllers: [CloudEventsController],
})
export class CloudEventsModule {}

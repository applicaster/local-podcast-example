import { Module } from '@nestjs/common';
import { PinModule } from '../pin/pin.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { ProfilesRepositoryModule } from '../profiles/profiles.repository.module';
import { GroupingsController } from './groupings.controller';
import { GroupingsService } from './groupings.service';

@Module({
  imports: [PinModule, ProfilesModule, ProfilesRepositoryModule],
  providers: [GroupingsService],
  controllers: [GroupingsController],
})
export class GroupingsModule {}

import { Module } from '@nestjs/common';
import { PinService } from './pin.service';
import { PinPersistenceService } from './pin.persistence.service';
import { PinGrantService } from './pin.grant.service';
import { PinController } from './pin.controller';
import { ProfilesRepositoryModule } from '../profiles/profiles.repository.module';

@Module({
  imports: [ProfilesRepositoryModule],
  controllers: [PinController],
  providers: [PinService, PinPersistenceService, PinGrantService],
  exports: [PinService],
})
export class PinModule {}

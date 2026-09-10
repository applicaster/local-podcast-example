import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PinModule } from '../pin/pin.module';
import { ProfilesRepositoryModule } from './profiles.repository.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { ProfilesFormService } from './profiles.form.service';

@Module({
  imports: [PinModule, ProfilesRepositoryModule, HttpModule],
  providers: [ProfilesService, ProfilesFormService],
  controllers: [ProfilesController],
  exports: [ProfilesService],
})
export class ProfilesModule {}

import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PinModule } from '../pin/pin.module';
import { ProfilesRepositoryModule } from './profiles.repository.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesFormController } from './profiles.form.controller';
import { ProfilesService } from './profiles.service';
import { ProfilesFormService } from './profiles.form.service';
import { UpstreamService } from './upstream.service';

@Module({
  imports: [PinModule, ProfilesRepositoryModule, HttpModule],
  providers: [ProfilesService, ProfilesFormService, UpstreamService],
  controllers: [ProfilesController, ProfilesFormController],
  exports: [ProfilesService],
})
export class ProfilesModule {}

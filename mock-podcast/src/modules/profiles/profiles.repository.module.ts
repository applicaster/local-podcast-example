import { Module } from '@nestjs/common';
import { ProfilesRepository } from './profiles.repository';

/**
 * The fixture on its own, so both `ProfilesModule` and `PinModule` can import
 * it without importing each other.
 */
@Module({
  providers: [ProfilesRepository],
  exports: [ProfilesRepository],
})
export class ProfilesRepositoryModule {}

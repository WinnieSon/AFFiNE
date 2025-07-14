import { Module } from '@nestjs/common';

import { PermissionModule } from '../permission';
import { UserIdentificationResolver } from './resolver';

@Module({
  imports: [PermissionModule],
  providers: [UserIdentificationResolver],
  exports: [UserIdentificationResolver],
})
export class UserIdentificationModule {}
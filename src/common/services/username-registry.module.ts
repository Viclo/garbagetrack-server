import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Admin } from '../../modules/admins/entities/admin.entity';
import { Driver } from '../../modules/drivers/entities/driver.entity';
import { UsernameRegistryService } from './username-registry.service';

/**
 * Global, same pattern as TenantsModule: both AdminsService and DriversService
 * need this at creation time, and making either module import the other just
 * to reach one lookup would be a real circular dependency for no benefit.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Admin, Driver])],
  providers: [UsernameRegistryService],
  exports: [UsernameRegistryService],
})
export class UsernameRegistryModule {}

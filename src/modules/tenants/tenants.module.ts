import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './services/tenants.service';
import { TenantsController } from './controllers/tenants.controller';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { AdminsModule } from '../admins/admins.module';

/**
 * Global: nearly every module needs the tenant context and tenant lookups —
 * avoids importing this in each module.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), AdminsModule],
  controllers: [TenantsController],
  providers: [TenantsService, TenantContextService],
  exports: [TenantsService, TenantContextService],
})
export class TenantsModule {}

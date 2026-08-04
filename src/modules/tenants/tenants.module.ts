import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './services/tenants.service';
import { TenantsController } from './controllers/tenants.controller';
import { PublicTenantsController } from './controllers/public-tenants.controller';
import { PublicTenantService } from './services/public-tenant.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { AdminsModule } from '../admins/admins.module';
import { SystemConfigModule } from '../system-config/system-config.module';

/**
 * Global: nearly every module needs the tenant context and tenant lookups —
 * avoids importing this in each module.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), AdminsModule, SystemConfigModule],
  controllers: [TenantsController, PublicTenantsController],
  providers: [TenantsService, TenantContextService, PublicTenantService],
  exports: [TenantsService, TenantContextService],
})
export class TenantsModule {}

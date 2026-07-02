import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './services/tenants.service';
import { TenantContextService } from '../../common/context/tenant-context.service';

/**
 * Global: nearly every module needs the tenant context, and the webhook and
 * WhatsApp API need tenant lookups — avoids importing this in each module.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Tenant])],
  providers: [TenantsService, TenantContextService],
  exports: [TenantsService, TenantContextService],
})
export class TenantsModule {}

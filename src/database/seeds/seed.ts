import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { AdminsService } from '../../modules/admins/services/admins.service';
import { DriversService } from '../../modules/drivers/services/drivers.service';
import { TenantsService } from '../../modules/tenants/services/tenants.service';
import { TenantContextService } from '../../common/context/tenant-context.service';
import { UserRole } from '../../common/enums/user-role.enum';

const SEED_TENANT_NAME = process.env.SEED_TENANT_NAME ?? 'GarbageTrack';

const SEED_SUPER_ADMINS = [
  { username: 'superadmin', password: 'SuperAdmin123!', name: 'Platform Operator' },
];

const SEED_ADMINS = [{ username: 'admin', password: 'Admin123!', name: 'Administrator' }];

const SEED_DRIVERS = [
  {
    username: 'driver01',
    password: 'Driver123!',
    name: 'Juan Pérez',
    phone: '+59170000001',
    licenseNumber: 'LIC-001',
  },
];

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const tenantsService = app.get(TenantsService);
  const tenantContext = app.get(TenantContextService);
  const adminsService = app.get(AdminsService);
  const driversService = app.get(DriversService);

  console.log('\nRunning GarbageTrack seed...\n');

  const tenant = await tenantsService.ensureDefault(SEED_TENANT_NAME);
  console.log(`  [ok]   Tenant "${tenant.name}" (slug="${tenant.slug}", id=${tenant.id})`);

  await tenantContext.runWith(tenant.id, async () => {
    for (const data of SEED_SUPER_ADMINS) {
      const existing = await adminsService.findByUsername(data.username);
      if (existing) {
        console.log(`  [skip] Super admin "${data.username}" already exists`);
        continue;
      }
      await adminsService.create(data, UserRole.SUPER_ADMIN);
      console.log(
        `  [ok]   Created SUPER_ADMIN: username="${data.username}" password="${data.password}"`,
      );
    }

    for (const data of SEED_ADMINS) {
      const existing = await adminsService.findByUsername(data.username);
      if (existing) {
        console.log(`  [skip] Admin "${data.username}" already exists`);
        continue;
      }
      await adminsService.create(data);
      console.log(
        `  [ok]   Created ADMIN: username="${data.username}" password="${data.password}"`,
      );
    }

    for (const data of SEED_DRIVERS) {
      const existing = await driversService.findByUsername(data.username);
      if (existing) {
        console.log(`  [skip] Driver "${data.username}" already exists`);
        continue;
      }
      await driversService.create(data);
      console.log(
        `  [ok]   Created DRIVER: username="${data.username}" password="${data.password}"`,
      );
    }
  });

  await app.close();
  console.log('\nSeed completed.\n');
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

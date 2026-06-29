import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module';
import { AdminsService } from '../../modules/admins/services/admins.service';
import { DriversService } from '../../modules/drivers/services/drivers.service';

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

  const adminsService = app.get(AdminsService);
  const driversService = app.get(DriversService);

  console.log('\nRunning GarbageTrack seed...\n');

  for (const data of SEED_ADMINS) {
    const existing = await adminsService.findByUsername(data.username);
    if (existing) {
      console.log(`  [skip] Admin "${data.username}" already exists`);
      continue;
    }
    await adminsService.create(data);
    console.log(`  [ok]   Created ADMIN: username="${data.username}" password="${data.password}"`);
  }

  for (const data of SEED_DRIVERS) {
    const existing = await driversService.findByUsername(data.username);
    if (existing) {
      console.log(`  [skip] Driver "${data.username}" already exists`);
      continue;
    }
    await driversService.create(data);
    console.log(`  [ok]   Created DRIVER: username="${data.username}" password="${data.password}"`);
  }

  await app.close();
  console.log('\nSeed completed.\n');
}

seed().catch((err: unknown) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

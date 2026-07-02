import { MigrationInterface, QueryRunner } from 'typeorm';

const TENANT_TABLES = [
  'admins',
  'drivers',
  'trucks',
  'routes',
  'residents',
  'weekly_schedules',
  'notification_logs',
  'system_configs',
  'route_sessions',
  'truck_positions',
];

/**
 * Upgrades a pre-multi-tenant database: creates the tenants registry, attaches
 * every existing row to the "default" tenant and moves uniqueness to
 * per-tenant constraints.
 *
 * Fresh databases get the multi-tenant schema straight from InitialSchema, so
 * this migration detects that and records itself without doing anything.
 */
export class MultiTenantUpgrade1782972000000 implements MigrationInterface {
  name = 'MultiTenantUpgrade1782972000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Already multi-tenant (fresh DB via InitialSchema, or upgraded manually).
    if (await queryRunner.hasColumn('admins', 'tenant_id')) return;

    // 1. Tenant registry + the default tenant every existing row will belong to.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id                 SERIAL PRIMARY KEY,
        slug               VARCHAR NOT NULL UNIQUE,
        name               VARCHAR NOT NULL,
        is_active          BOOLEAN NOT NULL DEFAULT true,
        wa_phone_number_id VARCHAR UNIQUE,
        wa_access_token    VARCHAR,
        created_at         TIMESTAMP NOT NULL DEFAULT now(),
        updated_at         TIMESTAMP NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `INSERT INTO tenants (slug, name) VALUES ('default', 'GarbageTrack')
       ON CONFLICT (slug) DO NOTHING`,
    );
    const [{ id: defaultTenantId }] = (await queryRunner.query(
      `SELECT id FROM tenants WHERE slug = 'default'`,
    )) as Array<{ id: number }>;

    // 2. Add tenant_id to every tenant-owned table, backfilled to the default
    //    tenant. The DEFAULT keeps the previous app version working while the
    //    new one deploys (its INSERTs don't send tenant_id yet).
    for (const table of TENANT_TABLES) {
      await queryRunner.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id INT`);
      await queryRunner.query(
        `UPDATE ${table} SET tenant_id = ${defaultTenantId} WHERE tenant_id IS NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE ${table} ALTER COLUMN tenant_id SET NOT NULL,
                             ALTER COLUMN tenant_id SET DEFAULT ${defaultTenantId}`,
      );
      await queryRunner.query(
        `ALTER TABLE ${table} ADD CONSTRAINT fk_${table}_tenant
           FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE`,
      );
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table} (tenant_id)`,
      );
    }

    // 3. Uniqueness becomes per-tenant. TypeORM-generated constraint names
    //    vary per database, so drop whatever unique constraints exist on the
    //    affected tables (usernames on admins/drivers stay globally unique and
    //    are not touched).
    await queryRunner.query(`
      DO $$
      DECLARE c RECORD;
      BEGIN
        FOR c IN
          SELECT conname, conrelid::regclass::text AS tbl
          FROM pg_constraint
          WHERE contype = 'u'
            AND conrelid::regclass::text IN ('trucks', 'residents', 'system_configs')
        LOOP
          EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
        END LOOP;
      END $$`);

    await queryRunner.query(
      `ALTER TABLE trucks ADD CONSTRAINT uq_trucks_tenant_name UNIQUE (tenant_id, name)`,
    );
    await queryRunner.query(
      `ALTER TABLE trucks ADD CONSTRAINT uq_trucks_tenant_plate UNIQUE (tenant_id, license_plate)`,
    );
    await queryRunner.query(
      `ALTER TABLE routes ADD CONSTRAINT uq_routes_tenant_name UNIQUE (tenant_id, name)`,
    );
    await queryRunner.query(
      `ALTER TABLE residents ADD CONSTRAINT uq_residents_tenant_phone UNIQUE (tenant_id, phone_number)`,
    );
    await queryRunner.query(
      `ALTER TABLE system_configs ADD CONSTRAINT uq_configs_tenant_key UNIQUE (tenant_id, key)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('admins', 'tenant_id'))) return;

    await queryRunner.query(`ALTER TABLE trucks DROP CONSTRAINT IF EXISTS uq_trucks_tenant_name`);
    await queryRunner.query(`ALTER TABLE trucks DROP CONSTRAINT IF EXISTS uq_trucks_tenant_plate`);
    await queryRunner.query(`ALTER TABLE routes DROP CONSTRAINT IF EXISTS uq_routes_tenant_name`);
    await queryRunner.query(
      `ALTER TABLE residents DROP CONSTRAINT IF EXISTS uq_residents_tenant_phone`,
    );
    await queryRunner.query(
      `ALTER TABLE system_configs DROP CONSTRAINT IF EXISTS uq_configs_tenant_key`,
    );

    for (const table of TENANT_TABLES) {
      await queryRunner.query(`ALTER TABLE ${table} DROP CONSTRAINT IF EXISTS fk_${table}_tenant`);
      await queryRunner.query(`DROP INDEX IF EXISTS idx_${table}_tenant`);
      await queryRunner.query(`ALTER TABLE ${table} DROP COLUMN IF EXISTS tenant_id`);
    }

    await queryRunner.query(`ALTER TABLE trucks ADD CONSTRAINT uq_trucks_name UNIQUE (name)`);
    await queryRunner.query(
      `ALTER TABLE trucks ADD CONSTRAINT uq_trucks_plate UNIQUE (license_plate)`,
    );
    await queryRunner.query(
      `ALTER TABLE residents ADD CONSTRAINT uq_residents_phone UNIQUE (phone_number)`,
    );
    await queryRunner.query(
      `ALTER TABLE system_configs ADD CONSTRAINT uq_configs_key UNIQUE (key)`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS tenants`);
  }
}

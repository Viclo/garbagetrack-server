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

    // 2a. A legacy database only has tables for the entities its deployed code
    //     version knew (schema came from synchronize). Newer feature tables may
    //     be missing entirely — create those directly in their final
    //     multi-tenant shape.
    await this.createMissingTables(queryRunner, defaultTenantId);
    for (const table of TENANT_TABLES) {
      if (!(await queryRunner.hasTable(table))) {
        throw new Error(
          `MultiTenantUpgrade: table "${table}" is missing and has no creation DDL in this migration`,
        );
      }
    }

    // 2b. Add tenant_id to every pre-existing tenant-owned table, backfilled to
    //     the default tenant. The DEFAULT keeps the previous app version working
    //     while the new one deploys (its INSERTs don't send tenant_id yet).
    for (const table of TENANT_TABLES) {
      // Tables created by createMissingTables are already multi-tenant.
      if (await queryRunner.hasColumn(table, 'tenant_id')) continue;
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

  /**
   * Feature tables that may not exist on a legacy database (added after some
   * deployments were created). DDL matches InitialSchema plus the multi-tenant
   * columns/constraints this migration adds elsewhere.
   */
  private async createMissingTables(
    queryRunner: QueryRunner,
    defaultTenantId: number,
  ): Promise<void> {
    if (!(await queryRunner.hasTable('route_sessions'))) {
      await queryRunner.query(
        `CREATE TABLE "route_sessions" (
           "id" SERIAL NOT NULL,
           "tenant_id" integer NOT NULL DEFAULT ${defaultTenantId},
           "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
           "ended_at" TIMESTAMP WITH TIME ZONE,
           "last_activity_at" TIMESTAMP WITH TIME ZONE NOT NULL,
           "driver_id" integer,
           "truck_id" integer,
           "route_id" integer,
           CONSTRAINT "PK_route_sessions" PRIMARY KEY ("id"),
           CONSTRAINT fk_route_sessions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
           CONSTRAINT fk_route_sessions_driver FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE CASCADE,
           CONSTRAINT fk_route_sessions_truck FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE SET NULL,
           CONSTRAINT fk_route_sessions_route FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE SET NULL
         )`,
      );
      await queryRunner.query(
        `CREATE INDEX idx_route_sessions_ended_at ON route_sessions (ended_at)`,
      );
      await queryRunner.query(
        `CREATE INDEX idx_route_sessions_tenant ON route_sessions (tenant_id)`,
      );
    }

    if (!(await queryRunner.hasTable('truck_positions'))) {
      await queryRunner.query(
        `CREATE TABLE "truck_positions" (
           "id" SERIAL NOT NULL,
           "tenant_id" integer NOT NULL DEFAULT ${defaultTenantId},
           "latitude" double precision NOT NULL,
           "longitude" double precision NOT NULL,
           "current_segment_index" integer,
           "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
           "truck_id" integer,
           CONSTRAINT "PK_truck_positions" PRIMARY KEY ("id"),
           CONSTRAINT fk_truck_positions_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
           CONSTRAINT fk_truck_positions_truck FOREIGN KEY (truck_id) REFERENCES trucks(id) ON DELETE CASCADE
         )`,
      );
      await queryRunner.query(
        `CREATE INDEX idx_truck_positions_tenant ON truck_positions (tenant_id)`,
      );
    }
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
      if (!(await queryRunner.hasTable(table))) continue;
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

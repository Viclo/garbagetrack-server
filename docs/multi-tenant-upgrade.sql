-- ⚠️ SUPERSEDED — kept only as reference / manual fallback.
--
-- This upgrade now runs automatically as a TypeORM migration
-- (src/database/migrations/1782972000000-MultiTenantUpgrade.ts) when the
-- server boots (migrationsRun: true). You do NOT need to run this file:
-- pushing to main deploys the code and the schema change together.
--
-- Manual use only if you ever need to upgrade a database without deploying:
--   psql "$DATABASE_URL" -f docs/multi-tenant-upgrade.sql

BEGIN;

-- 1. Tenant registry + default tenant every existing row will belong to.
CREATE TABLE IF NOT EXISTS tenants (
  id                 SERIAL PRIMARY KEY,
  slug               VARCHAR NOT NULL UNIQUE,
  name               VARCHAR NOT NULL,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  wa_phone_number_id VARCHAR UNIQUE,
  wa_access_token    VARCHAR,
  created_at         TIMESTAMP NOT NULL DEFAULT now(),
  updated_at         TIMESTAMP NOT NULL DEFAULT now()
);

INSERT INTO tenants (slug, name)
VALUES ('default', 'GarbageTrack')
ON CONFLICT (slug) DO NOTHING;

-- 2. Add tenant_id to every tenant-owned table, backfilled to the default tenant.
DO $$
DECLARE
  default_tenant_id INT;
  t TEXT;
BEGIN
  SELECT id INTO default_tenant_id FROM tenants WHERE slug = 'default';

  FOREACH t IN ARRAY ARRAY[
    'admins', 'drivers', 'trucks', 'routes', 'residents',
    'weekly_schedules', 'notification_logs', 'system_configs',
    'route_sessions', 'truck_positions'
  ] LOOP
    EXECUTE format(
      'ALTER TABLE %I ADD COLUMN IF NOT EXISTS tenant_id INT', t
    );
    EXECUTE format(
      'UPDATE %I SET tenant_id = %s WHERE tenant_id IS NULL', t, default_tenant_id
    );
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN tenant_id SET NOT NULL', t
    );
    -- DEFAULT keeps the PREVIOUS (pre-multi-tenant) app version working while
    -- the new one deploys: its INSERTs don't send tenant_id yet. The new code
    -- always sets tenant_id explicitly. Optionally drop the defaults once the
    -- deploy is verified (see bottom of this file).
    EXECUTE format(
      'ALTER TABLE %I ALTER COLUMN tenant_id SET DEFAULT %s', t, default_tenant_id
    );
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT fk_%s_tenant FOREIGN KEY (tenant_id)
         REFERENCES tenants(id) ON DELETE CASCADE', t, t
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_tenant ON %I (tenant_id)', t, t
    );
  END LOOP;
END $$;

-- 3. Uniqueness becomes per-tenant (usernames stay globally unique for login).
ALTER TABLE trucks         DROP CONSTRAINT IF EXISTS "UQ_trucks_name";
ALTER TABLE residents      DROP CONSTRAINT IF EXISTS "UQ_residents_phone_number";
ALTER TABLE system_configs DROP CONSTRAINT IF EXISTS "UQ_system_configs_key";
-- TypeORM-generated unique constraint names vary; drop by lookup instead.
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
END $$;

ALTER TABLE trucks         ADD CONSTRAINT uq_trucks_tenant_name  UNIQUE (tenant_id, name);
ALTER TABLE trucks         ADD CONSTRAINT uq_trucks_tenant_plate UNIQUE (tenant_id, license_plate);
ALTER TABLE routes         ADD CONSTRAINT uq_routes_tenant_name  UNIQUE (tenant_id, name);
ALTER TABLE residents      ADD CONSTRAINT uq_residents_tenant_phone UNIQUE (tenant_id, phone_number);
ALTER TABLE system_configs ADD CONSTRAINT uq_configs_tenant_key  UNIQUE (tenant_id, key);

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL CLEANUP — run only AFTER the new version is deployed and verified.
-- Removes the transitional defaults so a future code path that forgets to set
-- tenant_id fails loudly instead of silently landing in the default tenant.
--
-- DO $$
-- DECLARE t TEXT;
-- BEGIN
--   FOREACH t IN ARRAY ARRAY[
--     'admins','drivers','trucks','routes','residents','weekly_schedules',
--     'notification_logs','system_configs','route_sessions','truck_positions'
--   ] LOOP
--     EXECUTE format('ALTER TABLE %I ALTER COLUMN tenant_id DROP DEFAULT', t);
--   END LOOP;
-- END $$;

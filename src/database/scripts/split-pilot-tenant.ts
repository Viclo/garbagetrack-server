import dataSource from '../data-source';

/**
 * One-time data migration (roadmap B3). Today every real row — residents,
 * routes, trucks, the municipality's own admins — lives in the bootstrap
 * "default" tenant, alongside the SUPER_ADMIN platform-operator account. This
 * splits that into two tenants:
 *
 *   - "default" keeps ONLY the SUPER_ADMIN admin(s) — it becomes the
 *     platform-operator tenant, reachable at the bare apex domain.
 *   - a new "pilot" tenant gets everything else, completely unchanged — it
 *     becomes the first real municipality subdomain.
 *
 * No tenant_id changes for the bulk of the data: the existing tenant row is
 * simply renamed default -> pilot in place. Only the SUPER_ADMIN admin rows
 * move to a freshly created "default" row. Dry run by default; pass --yes to
 * apply. Safe to re-run: refuses once a "pilot" tenant already exists.
 */

const PILOT_SLUG = 'pilot';
const PILOT_NAME = 'Pilot';
const PLATFORM_SLUG = 'default';
const PLATFORM_NAME = 'Plataforma';

interface TenantRow {
  id: number;
  slug: string;
  name: string;
}

interface AdminRow {
  id: number;
  username: string;
}

async function main(): Promise<void> {
  const confirmed = process.argv.includes('--yes');

  const options = dataSource.options as { host?: string; database?: string; username?: string };
  console.log('\nGarbageTrack — split "default" into platform + pilot tenants\n');
  console.log(`  target : ${options.username}@${options.host}/${options.database}`);

  await dataSource.initialize();
  try {
    const [currentDefault] = await dataSource.query<TenantRow[]>(
      `SELECT id, slug, name FROM tenants WHERE slug = $1`,
      [PLATFORM_SLUG],
    );
    if (!currentDefault) {
      console.log(`  Nothing to do: no tenant with slug "${PLATFORM_SLUG}" exists.\n`);
      return;
    }

    const [existingPilot] = await dataSource.query<TenantRow[]>(
      `SELECT id FROM tenants WHERE slug = $1`,
      [PILOT_SLUG],
    );
    if (existingPilot) {
      console.log(
        `  Refused: a tenant with slug "${PILOT_SLUG}" already exists (id=${existingPilot.id}). ` +
          'This has already run — nothing to do.\n',
      );
      return;
    }

    const superAdmins = await dataSource.query<AdminRow[]>(
      `SELECT id, username FROM admins WHERE tenant_id = $1 AND role = 'SUPER_ADMIN'`,
      [currentDefault.id],
    );

    console.log(
      `  tenant "${currentDefault.slug}" (id=${currentDefault.id}, "${currentDefault.name}") ` +
        `-> slug "${PILOT_SLUG}", name "${PILOT_NAME}"`,
    );
    console.log(`  new tenant created: slug "${PLATFORM_SLUG}", name "${PLATFORM_NAME}"`);
    console.log(
      `  ${superAdmins.length} SUPER_ADMIN admin(s) move to it: ` +
        (superAdmins.map((a) => a.username).join(', ') || '(none)'),
    );
    console.log(
      '  everything else (residents, routes, trucks, other admins, drivers) stays on "pilot" untouched.',
    );

    if (!confirmed) {
      console.log('\n  Dry run. Nothing was changed — add --yes to actually apply this.\n');
      return;
    }

    await dataSource.transaction(async (manager) => {
      await manager.query(`UPDATE tenants SET slug = $1, name = $2 WHERE id = $3`, [
        PILOT_SLUG,
        PILOT_NAME,
        currentDefault.id,
      ]);

      const [platformTenant] = await manager.query<TenantRow[]>(
        `INSERT INTO tenants (slug, name, is_active) VALUES ($1, $2, true) RETURNING id, slug, name`,
        [PLATFORM_SLUG, PLATFORM_NAME],
      );

      if (superAdmins.length) {
        await manager.query(
          `UPDATE admins SET tenant_id = $1 WHERE tenant_id = $2 AND role = 'SUPER_ADMIN'`,
          [platformTenant.id, currentDefault.id],
        );
      }
    });

    console.log(
      `\n  Done. "${PILOT_SLUG}" holds the municipality data; "${PLATFORM_SLUG}" holds ` +
        `${superAdmins.length} platform admin(s).\n`,
    );
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('\nsplit-pilot-tenant failed:', error);
  process.exit(1);
});

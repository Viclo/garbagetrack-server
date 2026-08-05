import dataSource from '../data-source';

/**
 * Clears the data a test run leaves behind, so the whole flow can be walked
 * again from scratch, WITHOUT touching the configuration that makes the
 * environment usable.
 *
 * Cleared: residents, their push subscriptions, notification logs, truck
 * positions and route sessions.
 * Kept: tenants, admins, drivers, trucks, routes and their segments, weekly
 * schedules, system config.
 *
 * The reason this exists is the notification dedupe: alerts fire at most once
 * per resident, per route, per stage, per day, so a second test on the same day
 * is silent until `notification_logs` is cleared. Stale truck positions and open
 * route sessions have the same effect on the maps — they make a truck look live
 * that is not.
 *
 * Targets whatever DB_* the environment points at (same precedence as the app:
 * .env.local then .env), so it can clean a local Docker database or a deployed
 * one depending on the variables you give it. It prints the target and does
 * nothing without --yes.
 */

/** Child rows first: every one of these is referenced by something below it. */
const TABLES_IN_DELETE_ORDER = [
  'notification_logs',
  'push_subscriptions',
  'residents',
  'truck_positions',
  'route_sessions',
] as const;

/** Cleared only when residents are being kept — a re-run of the same day's alerts. */
const OPERATIONAL_ONLY = ['notification_logs', 'truck_positions', 'route_sessions'] as const;

const PRESERVED = [
  'tenants',
  'admins',
  'drivers',
  'trucks',
  'routes',
  'route_segments',
  'weekly_schedules',
  'system_config',
];

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const confirmed = args.includes('--yes');
  const keepResidents = args.includes('--keep-residents');
  const force = args.includes('--force');

  const tables = keepResidents ? OPERATIONAL_ONLY : TABLES_IN_DELETE_ORDER;

  const options = dataSource.options as { host?: string; database?: string; username?: string };
  console.log('\nGarbageTrack — reset development data\n');
  console.log(`  target : ${options.username}@${options.host}/${options.database}`);
  console.log(`  mode   : ${keepResidents ? 'operational only (residents kept)' : 'full test reset'}`);

  // The variables decide the target, and a deployed database is one export away.
  // Refuse the obvious mistake rather than trust the person running it at 2am.
  if (process.env.NODE_ENV === 'production' && !force) {
    console.error('\n  REFUSED: NODE_ENV=production. Re-run with --force if that is really intended.\n');
    process.exit(1);
  }

  await dataSource.initialize();

  try {
    const counts: Record<string, number> = {};
    for (const table of tables) {
      const [row] = await dataSource.query<Array<{ count: string }>>(
        `SELECT COUNT(*)::int AS count FROM ${table}`,
      );
      counts[table] = Number(row?.count ?? 0);
    }

    console.log('\n  rows that would be deleted:');
    for (const [table, count] of Object.entries(counts)) {
      console.log(`    ${table.padEnd(20)} ${count}`);
    }
    console.log(`\n  preserved: ${PRESERVED.join(', ')}`);

    if (!confirmed) {
      console.log('\n  Dry run. Nothing was deleted — add --yes to actually clear these.\n');
      return;
    }

    // One transaction: a half-cleared database is worse than an untouched one,
    // because the dedupe rows are exactly what a partial failure would leave.
    await dataSource.transaction(async (manager) => {
      for (const table of tables) {
        await manager.query(`DELETE FROM ${table}`);
      }
    });

    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    console.log(`\n  Deleted ${total} row(s). Configuration untouched.`);
    console.log('  Residents must register again from the PWA.\n');
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error) => {
  console.error('\nreset failed:', error);
  process.exit(1);
});

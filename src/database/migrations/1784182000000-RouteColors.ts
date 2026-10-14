import { MigrationInterface, QueryRunner } from 'typeorm';
import {
  chooseRouteColor,
  DEFAULT_ROUTE_COLOR,
  IColorNeighbour,
  ROUTE_COLOR_NEIGHBOUR_RADIUS_M,
} from '../../modules/routes/utils/route-color.util';

/**
 * Gives every route its own identity colour (it used to be derived from the
 * truck id on the client, so a replacement truck repainted the route).
 *
 * Existing routes are coloured the same way new ones will be: in id order,
 * each takes the colour least used by its already-coloured neighbours. Names
 * on the constraint are not needed: plain columns with defaults.
 *
 * route_tracks.route_color snapshots the colour into history, like the route
 * name, so an archived run keeps the colour it had that day.
 */
export class RouteColors1784182000000 implements MigrationInterface {
  name = 'RouteColors1784182000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "color" character varying(7) NOT NULL DEFAULT '${DEFAULT_ROUTE_COLOR}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "color_locked" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_tracks" ADD COLUMN IF NOT EXISTS "route_color" character varying(7)`,
    );

    const routes = await queryRunner.query(
      `SELECT id, tenant_id AS "tenantId", centerline IS NOT NULL AS "hasGeometry"
         FROM routes ORDER BY tenant_id, id`,
    ) as Array<{ id: number; tenantId: number; hasGeometry: boolean }>;

    const pairs = await queryRunner.query(
      `SELECT a.id AS "a", b.id AS "b",
              ST_Distance(a.centerline::geography, b.centerline::geography) AS "distanceM",
              (SELECT count(DISTINCT x.day_of_week)::int
                 FROM weekly_schedules x
                 JOIN weekly_schedules y ON y.day_of_week = x.day_of_week AND y.route_id = b.id
                WHERE x.route_id = a.id) AS "sharedDays"
         FROM routes a
         JOIN routes b ON b.tenant_id = a.tenant_id AND b.id <> a.id
        WHERE a.centerline IS NOT NULL AND b.centerline IS NOT NULL
          AND ST_DWithin(a.centerline::geography, b.centerline::geography, $1)`,
      [ROUTE_COLOR_NEIGHBOUR_RADIUS_M],
    ) as Array<{ a: number; b: number; distanceM: number; sharedDays: number }>;

    const neighboursOf = new Map<number, Array<{ id: number; distanceM: number; sharedDays: number }>>();
    for (const p of pairs) {
      const list = neighboursOf.get(Number(p.a)) ?? [];
      list.push({ id: Number(p.b), distanceM: Number(p.distanceM), sharedDays: Number(p.sharedDays) });
      neighboursOf.set(Number(p.a), list);
    }

    const assigned = new Map<number, string>();
    const usageByTenant = new Map<number, Record<string, number>>();
    for (const route of routes) {
      const usage = usageByTenant.get(route.tenantId) ?? {};
      const neighbours: IColorNeighbour[] = (neighboursOf.get(route.id) ?? [])
        .filter((n) => assigned.has(n.id))
        .map((n) => ({ color: assigned.get(n.id) as string, distanceM: n.distanceM, sharedDays: n.sharedDays }));
      const color = chooseRouteColor(route.hasGeometry ? neighbours : [], usage);
      assigned.set(route.id, color);
      usage[color] = (usage[color] ?? 0) + 1;
      usageByTenant.set(route.tenantId, usage);
      await queryRunner.query(`UPDATE routes SET color = $1 WHERE id = $2`, [color, route.id]);
    }

    await queryRunner.query(
      `UPDATE route_tracks rt SET route_color = r.color FROM routes r WHERE r.id = rt.route_id`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "route_tracks" DROP COLUMN IF EXISTS "route_color"`);
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN IF EXISTS "color_locked"`);
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN IF EXISTS "color"`);
  }
}

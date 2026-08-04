import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gives routes real line geometry and anchors residents to a collection point
 * on it (roadmap B7).
 *
 * Until now a segment was represented by a single midpoint Point, so "how far
 * is this house from the route" was measured to an arbitrary point on a street
 * that can be kilometres long. Real geometry comes from the road path already
 * stored on each segment.
 *
 * Adds:
 *  - route_segments.line   — the segment's road as a LineString
 *  - routes.centerline     — the whole route, segments chained in order
 *  - residents.route_offset_m / distance_to_route_m — where the resident's
 *    collection point sits along that centerline, and how far they walk to it
 *
 * The old midpoint column stays: GPS tracking and the proximity engine still
 * use it until B8 replaces them.
 */
export class RouteGeometryAndCollectionPoints1784174000000 implements MigrationInterface {
  name = 'RouteGeometryAndCollectionPoints1784174000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "route_segments" ADD COLUMN IF NOT EXISTS "line" geometry(LineString,4326)`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "centerline" geometry(LineString,4326)`,
    );
    await queryRunner.query(
      `ALTER TABLE "routes" ADD COLUMN IF NOT EXISTS "centerline_length_m" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD COLUMN IF NOT EXISTS "route_offset_m" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "residents" ADD COLUMN IF NOT EXISTS "distance_to_route_m" double precision`,
    );

    // Backfill segment lines from the stored road path ([lat,lng] pairs).
    await queryRunner.query(`
      UPDATE "route_segments" rs
      SET "line" = sub.line
      FROM (
        SELECT id,
               (SELECT ST_MakeLine(
                          ST_SetSRID(ST_MakePoint((p->>1)::float8, (p->>0)::float8), 4326)
                          ORDER BY ord)
                  FROM jsonb_array_elements("path") WITH ORDINALITY AS t(p, ord)) AS line
        FROM "route_segments"
        WHERE "path" IS NOT NULL AND jsonb_array_length("path") > 1
      ) sub
      WHERE rs.id = sub.id AND sub.line IS NOT NULL
    `);

    // Segments drawn before road-snapping have no path: fall back to the
    // straight start→end line, which is still a line rather than one point.
    await queryRunner.query(`
      UPDATE "route_segments"
      SET "line" = ST_MakeLine(
            ST_SetSRID(ST_MakePoint("start_longitude", "start_latitude"), 4326),
            ST_SetSRID(ST_MakePoint("end_longitude", "end_latitude"), 4326))
      WHERE "line" IS NULL
        AND "start_latitude" IS NOT NULL AND "end_latitude" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "routes" r
      SET "centerline" = c.line,
          "centerline_length_m" = ST_Length(c.line::geography)
      FROM (
        SELECT "route_id", ST_MakeLine("line" ORDER BY "segment_index") AS line
        FROM "route_segments"
        WHERE "line" IS NOT NULL
        GROUP BY "route_id"
      ) c
      WHERE r.id = c."route_id"
    `);

    // Existing residents keep their route; only the new measurements are filled
    // in. Re-assignment against the 200 m rule happens through the service.
    await queryRunner.query(`
      UPDATE "residents" res
      SET "distance_to_route_m" = ST_Distance(
            ST_SetSRID(ST_MakePoint(res."longitude", res."latitude"), 4326)::geography,
            r."centerline"::geography),
          "route_offset_m" = ST_LineLocatePoint(
            r."centerline",
            ST_SetSRID(ST_MakePoint(res."longitude", res."latitude"), 4326)) * r."centerline_length_m"
      FROM "routes" r
      WHERE r.id = res."route_id" AND r."centerline" IS NOT NULL
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_route_segments_line" ON "route_segments" USING GIST ("line")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_routes_centerline" ON "routes" USING GIST ("centerline")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_routes_centerline"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_route_segments_line"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN IF EXISTS "distance_to_route_m"`);
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN IF EXISTS "route_offset_m"`);
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN IF EXISTS "centerline_length_m"`);
    await queryRunner.query(`ALTER TABLE "routes" DROP COLUMN IF EXISTS "centerline"`);
    await queryRunner.query(`ALTER TABLE "route_segments" DROP COLUMN IF EXISTS "line"`);
  }
}

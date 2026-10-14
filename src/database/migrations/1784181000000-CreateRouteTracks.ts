import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * History of finished runs, one row per run (route history, flow 1). See the
 * RouteTrack entity for why names are snapshots and not foreign keys.
 *
 * Constraint names are TypeORM's own generated ones, so a later
 * `migration:generate` sees the schema as already in sync with the entity.
 */
export class CreateRouteTracks1784181000000 implements MigrationInterface {
  name = 'CreateRouteTracks1784181000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "route_tracks" (
        "id" SERIAL NOT NULL,
        "tenant_id" integer NOT NULL,
        "route_session_id" integer NOT NULL,
        "local_date" date NOT NULL,
        "driver_id" integer,
        "driver_name" character varying,
        "truck_id" integer,
        "truck_name" character varying,
        "license_plate" character varying,
        "route_id" integer,
        "route_name" character varying,
        "started_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "ended_at" TIMESTAMP WITH TIME ZONE NOT NULL,
        "duration_seconds" integer NOT NULL,
        "point_count" integer NOT NULL,
        "distance_m" double precision NOT NULL,
        "coverage_pct" double precision,
        "off_route_distance_m" double precision NOT NULL,
        "off_route_stretches" jsonb NOT NULL,
        "points" jsonb NOT NULL,
        "path" geometry(LineString, 4326),
        "planned_path" geometry(LineString, 4326),
        "archived_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_a033403e007f30d3f400927b861" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_23d68c9970e3b67bf788f3181ef" UNIQUE ("route_session_id"),
        CONSTRAINT "FK_99d18691d143f9f3778f4b57733" FOREIGN KEY ("tenant_id")
          REFERENCES "tenants"("id") ON DELETE CASCADE
      )`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_route_tracks_tenant_date" ON "route_tracks" ("tenant_id", "local_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "route_tracks"`);
  }
}

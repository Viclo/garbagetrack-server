import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tags every GPS fix with the run it was sent under (route history, flow 1).
 *
 * Positions were tied to a truck only, and the run had to be guessed from the
 * session's time window. That breaks as soon as one truck has two runs in a
 * day: a route the app reopened after a signal gap, or a replacement truck
 * covering a second route. The id makes "the path of run N" an exact lookup,
 * and is what the archiver uses to move a finished run into route_tracks.
 *
 * ON DELETE SET NULL, not CASCADE: deleting a driver cascades to their
 * sessions, and that must not silently erase the fixes before they are
 * archived.
 */
export class TruckPositionSession1784180000000 implements MigrationInterface {
  name = 'TruckPositionSession1784180000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "truck_positions" ADD COLUMN IF NOT EXISTS "route_session_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "truck_positions"
         ADD CONSTRAINT "FK_fc3b3f07331f7bd2b81342e5430"
         FOREIGN KEY ("route_session_id") REFERENCES "route_sessions"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_truck_positions_route_session"
         ON "truck_positions" ("route_session_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_truck_positions_route_session"`);
    await queryRunner.query(
      `ALTER TABLE "truck_positions" DROP CONSTRAINT IF EXISTS "FK_fc3b3f07331f7bd2b81342e5430"`,
    );
    await queryRunner.query(`ALTER TABLE "truck_positions" DROP COLUMN IF EXISTS "route_session_id"`);
  }
}

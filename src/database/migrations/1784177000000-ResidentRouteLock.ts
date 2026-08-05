import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets an admin's route choice survive automatic reassignment (roadmap E5).
 *
 * reassignByRoute() re-runs assignment for every resident of a route whenever
 * its segments are replaced. Without this flag, an admin who corrected a
 * resident by hand would silently lose that correction the next time anyone
 * redrew the route — and would have no way of knowing it happened.
 */
export class ResidentRouteLock1784177000000 implements MigrationInterface {
  name = 'ResidentRouteLock1784177000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "residents" ADD COLUMN IF NOT EXISTS "route_locked" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "residents" DROP COLUMN IF EXISTS "route_locked"`);
  }
}

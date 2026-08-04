import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Separates when a GPS fix was TAKEN from when the server received it
 * (roadmap D6).
 *
 * The driver app batches: after a signal gap Expo hands it several locations at
 * once and it posts them in order. Every one of those arrived stamped with the
 * insert time, so ten-minute-old fixes looked current — and an ETA computed
 * from one would promise the resident far more warning than they actually have.
 *
 * Existing rows are backfilled from the received time: it is the best estimate
 * available for fixes taken before this column existed.
 */
export class TruckPositionRecordedAt1784175000000 implements MigrationInterface {
  name = 'TruckPositionRecordedAt1784175000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "truck_positions" ADD COLUMN IF NOT EXISTS "recorded_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `UPDATE "truck_positions" SET "recorded_at" = "timestamp" WHERE "recorded_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "truck_positions" ALTER COLUMN "recorded_at" SET DEFAULT now()`,
    );
    // Latest-fix-per-truck is now ordered by device time, so index it.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_truck_positions_truck_recorded"
         ON "truck_positions" ("truck_id", "recorded_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_truck_positions_truck_recorded"`);
    await queryRunner.query(`ALTER TABLE "truck_positions" DROP COLUMN IF EXISTS "recorded_at"`);
  }
}

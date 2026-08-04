import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Switches proximity from segment counting to time-to-arrival (roadmap B8).
 *
 * A resident now gets two alerts a day at most: one when the truck is roughly
 * notify_lead_minutes away ("prepara tu bolsa") and one on arrival ("está en tu
 * calle"). They dedup independently, so `stage` joins the daily key.
 *
 * Truck fixes gain their position along the route, computed once at ingest:
 * the engine needs it on every fix, and re-projecting the whole history to work
 * out speed and direction would be wasteful.
 *
 * `notification_blocks` is deleted. It counted segments, and segments are not
 * blocks — on a real route they ranged from 129 m to 7.6 km, which made the
 * setting meaningless. notify_lead_minutes replaces it.
 */
export class EtaProximityEngine1784176000000 implements MigrationInterface {
  name = 'EtaProximityEngine1784176000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "notification_logs" ADD COLUMN IF NOT EXISTS "stage" character varying NOT NULL DEFAULT 'prepare'`,
    );
    // Existing rows were the old single alert, which warned in advance.
    await queryRunner.query(`UPDATE "notification_logs" SET "stage" = 'prepare' WHERE "stage" IS NULL`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_notification_logs_daily_stage"
         ON "notification_logs" ("tenant_id", "resident_id", "route_id", "sent_at", "stage")`,
    );

    await queryRunner.query(
      `ALTER TABLE "truck_positions" ADD COLUMN IF NOT EXISTS "route_offset_m" double precision`,
    );
    await queryRunner.query(
      `ALTER TABLE "truck_positions" ADD COLUMN IF NOT EXISTS "off_route_m" double precision`,
    );

    await queryRunner.query(`DELETE FROM "system_configs" WHERE "key" = 'notification_blocks'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "truck_positions" DROP COLUMN IF EXISTS "off_route_m"`);
    await queryRunner.query(`ALTER TABLE "truck_positions" DROP COLUMN IF EXISTS "route_offset_m"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_notification_logs_daily_stage"`);
    await queryRunner.query(`ALTER TABLE "notification_logs" DROP COLUMN IF EXISTS "stage"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds SAT and SUN to the weekly_schedules day-of-week enum so weekend
 * collection can be scheduled. Postgres appends new enum values to the end,
 * keeping the natural Mon..Sun order for `ORDER BY day_of_week`.
 *
 * Note: enum values cannot be removed in Postgres, so `down` is a no-op.
 * ADD VALUE is idempotent via IF NOT EXISTS.
 */
export class AddWeekendDays1784173000000 implements MigrationInterface {
  name = 'AddWeekendDays1784173000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."weekly_schedules_day_of_week_enum" ADD VALUE IF NOT EXISTS 'SAT'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."weekly_schedules_day_of_week_enum" ADD VALUE IF NOT EXISTS 'SUN'`,
    );
  }

  public async down(): Promise<void> {
    // Postgres does not support removing enum values; nothing to revert.
  }
}

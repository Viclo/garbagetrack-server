import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Generalizes notification_logs for the push era (roadmap A3): renames the
 * WhatsApp-specific wa_message_id to the channel-neutral provider_message_id
 * and adds a channel column (defaults to 'push'). Guarded so it is safe on any
 * DB lineage.
 */
export class NotificationLogChannel1784172000000 implements MigrationInterface {
  name = 'NotificationLogChannel1784172000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notification_logs' AND column_name = 'wa_message_id'
        ) THEN
          ALTER TABLE notification_logs RENAME COLUMN wa_message_id TO provider_message_id;
        END IF;
      END $$;
    `);
    // Fresh DBs (no wa_message_id) still get the column.
    await queryRunner.query(
      `ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE notification_logs ADD COLUMN IF NOT EXISTS channel VARCHAR NOT NULL DEFAULT 'push'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE notification_logs DROP COLUMN IF EXISTS channel`);
    await queryRunner.query(`
      DO $$ BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'notification_logs' AND column_name = 'provider_message_id'
        ) THEN
          ALTER TABLE notification_logs RENAME COLUMN provider_message_id TO wa_message_id;
        END IF;
      END $$;
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes the per-tenant Meta WhatsApp credentials. The WhatsApp/Meta
 * integration was dropped in the mobile migration (residents will be notified
 * via Web Push instead), so these columns and their unique index are no longer
 * used. Guarded with IF EXISTS so it is a no-op on databases provisioned after
 * the columns were already gone.
 */
export class DropWhatsAppTenantColumns1784160000000 implements MigrationInterface {
  name = 'DropWhatsAppTenantColumns1784160000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS wa_access_token`);
    await queryRunner.query(`ALTER TABLE tenants DROP COLUMN IF EXISTS wa_phone_number_id`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_phone_number_id VARCHAR`,
    );
    await queryRunner.query(
      `ALTER TABLE tenants ADD CONSTRAINT tenants_wa_phone_number_id_key UNIQUE (wa_phone_number_id)`,
    );
    await queryRunner.query(`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS wa_access_token VARCHAR`);
  }
}

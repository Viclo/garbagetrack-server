import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds residents.name: the WhatsApp profile name captured when the resident
 * registers (the webhook already receives contact.profile.name but used to
 * discard it). Nullable — rows registered before this column existed have no
 * name until they re-register.
 */
export class AddResidentName1782972200000 implements MigrationInterface {
  name = 'AddResidentName1782972200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE residents ADD COLUMN IF NOT EXISTS name VARCHAR`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE residents DROP COLUMN IF EXISTS name`);
  }
}

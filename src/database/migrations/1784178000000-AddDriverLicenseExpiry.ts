import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Records when each driver's licence expires.
 *
 * The municipality is liable for a truck driven on an expired licence, and
 * until now the admin panel stored the licence number but nothing that would
 * ever tell anyone it had lapsed. A `date` column, not a timestamp: a licence
 * expires on a calendar day locally, not at a UTC instant.
 */
export class AddDriverLicenseExpiry1784178000000 implements MigrationInterface {
  name = 'AddDriverLicenseExpiry1784178000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "drivers" ADD COLUMN IF NOT EXISTS "license_expires_at" date`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "drivers" DROP COLUMN IF EXISTS "license_expires_at"`);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds the role column to admins: ADMIN (municipality staff, the previous
 * implicit role — kept as default so existing rows and inserts are unchanged)
 * or SUPER_ADMIN (platform operator, manages tenants). The seed script creates
 * the first SUPER_ADMIN account.
 */
export class AddAdminRole1782972100000 implements MigrationInterface {
  name = 'AddAdminRole1782972100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR NOT NULL DEFAULT 'ADMIN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE admins DROP COLUMN IF EXISTS role`);
  }
}

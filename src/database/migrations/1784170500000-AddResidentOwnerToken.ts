import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds residents.owner_token (roadmap B2): the SHA-256 hash of a resident's
 * owner token, the authorization key for self-service writes under Option A.
 * Nullable — existing rows and admin-created ones have none. Guarded so a
 * re-run is a no-op.
 */
export class AddResidentOwnerToken1784170500000 implements MigrationInterface {
  name = 'AddResidentOwnerToken1784170500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE residents ADD COLUMN IF NOT EXISTS owner_token VARCHAR`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE residents DROP COLUMN IF EXISTS owner_token`);
  }
}

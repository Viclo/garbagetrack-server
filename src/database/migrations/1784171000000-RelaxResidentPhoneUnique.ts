import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the per-tenant unique constraint on residents(tenant_id, phone_number)
 * (roadmap B4). Under Option A the phone is a self-declared label, not an
 * identity key — a device owns its record via the owner token, and duplicate
 * rows across devices are tolerated (de-duped later once OTP lands). Replaces
 * the constraint with a plain index for admin lookup / analytics.
 *
 * The constraint has two possible names depending on how the DB was built:
 * `uq_residents_tenant_phone` (MultiTenantUpgrade) or the InitialSchema
 * auto-name; both are dropped IF EXISTS so this is safe on either lineage.
 */
export class RelaxResidentPhoneUnique1784171000000 implements MigrationInterface {
  name = 'RelaxResidentPhoneUnique1784171000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE residents DROP CONSTRAINT IF EXISTS uq_residents_tenant_phone`,
    );
    await queryRunner.query(
      `ALTER TABLE residents DROP CONSTRAINT IF EXISTS "UQ_15309edbde533fe51be89abcceb"`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_residents_tenant_phone ON residents (tenant_id, phone_number)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_residents_tenant_phone`);
    // Best-effort restore; only succeeds if no duplicate (tenant_id, phone) rows exist.
    await queryRunner.query(
      `ALTER TABLE residents ADD CONSTRAINT uq_residents_tenant_phone UNIQUE (tenant_id, phone_number)`,
    );
  }
}

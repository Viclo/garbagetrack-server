import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Drops the global unique constraint on admins.username and drivers.username,
 * replacing each with a per-tenant one (tenant_id, username) (roadmap A2).
 * Subdomain multi-tenancy resolves the tenant from the host before checking
 * credentials, so two municipalities can each have a user named "admin".
 *
 * Constraint names are the InitialSchema auto-generated ones; dropped IF
 * EXISTS so this is safe regardless of lineage.
 */
export class RelaxAdminDriverUsernameUnique1784179000000 implements MigrationInterface {
  name = 'RelaxAdminDriverUsernameUnique1784179000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE admins DROP CONSTRAINT IF EXISTS "UQ_4ba6d0c734d53f8e1b2e24b6c56"`,
    );
    await queryRunner.query(
      `ALTER TABLE admins ADD CONSTRAINT uq_admins_tenant_username UNIQUE (tenant_id, username)`,
    );

    await queryRunner.query(
      `ALTER TABLE drivers DROP CONSTRAINT IF EXISTS "UQ_12b7ae6be889f41a28bec591848"`,
    );
    await queryRunner.query(
      `ALTER TABLE drivers ADD CONSTRAINT uq_drivers_tenant_username UNIQUE (tenant_id, username)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE drivers DROP CONSTRAINT IF EXISTS uq_drivers_tenant_username`,
    );
    // Best-effort restore; only succeeds if no duplicate usernames exist across tenants.
    await queryRunner.query(
      `ALTER TABLE drivers ADD CONSTRAINT "UQ_12b7ae6be889f41a28bec591848" UNIQUE (username)`,
    );

    await queryRunner.query(
      `ALTER TABLE admins DROP CONSTRAINT IF EXISTS uq_admins_tenant_username`,
    );
    await queryRunner.query(
      `ALTER TABLE admins ADD CONSTRAINT "UQ_4ba6d0c734d53f8e1b2e24b6c56" UNIQUE (username)`,
    );
  }
}

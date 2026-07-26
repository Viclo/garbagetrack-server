import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Web Push subscriptions owned by residents (roadmap A2). One resident may hold
 * several; alerts fan out to all active rows. Guarded with IF NOT EXISTS so a
 * re-run is a no-op.
 */
export class CreatePushSubscriptions1784170000000 implements MigrationInterface {
  name = 'CreatePushSubscriptions1784170000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        resident_id INTEGER NOT NULL REFERENCES residents(id) ON DELETE CASCADE,
        endpoint TEXT NOT NULL,
        p256dh VARCHAR NOT NULL,
        auth VARCHAR NOT NULL,
        platform VARCHAR NOT NULL DEFAULT 'web',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT uq_push_subscriptions_endpoint UNIQUE (endpoint)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_push_subscriptions_resident ON push_subscriptions (resident_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS push_subscriptions`);
  }
}

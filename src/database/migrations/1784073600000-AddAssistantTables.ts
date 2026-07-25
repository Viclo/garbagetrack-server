import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAssistantTables1784073600000 implements MigrationInterface {
  name = 'AddAssistantTables1784073600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_conversations (
        id SERIAL PRIMARY KEY,
        tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
        title VARCHAR NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        updated_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_conversations_admin ON ai_conversations (admin_id, updated_at DESC)`,
    );
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS ai_messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
        role VARCHAR NOT NULL,
        content TEXT NOT NULL,
        input_tokens INTEGER,
        output_tokens INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages (conversation_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS ai_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS ai_conversations`);
  }
}

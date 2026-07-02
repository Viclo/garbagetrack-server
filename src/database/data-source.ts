import { config } from 'dotenv';
import { DataSource } from 'typeorm';

// Same precedence as the app (ConfigModule): .env.local wins over .env.
// dotenv does not override keys that are already set.
config({ path: '.env.local' });
config({ path: '.env' });

/**
 * DataSource for the TypeORM CLI (migration:generate / run / revert) and the
 * migrations themselves. The runtime connection lives in app.module.ts and
 * must stay in sync with this configuration.
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_NAME ?? 'garbagetrack',
  ssl:
    process.env.DB_SSL === 'require' || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
});

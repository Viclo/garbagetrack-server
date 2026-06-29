import { registerAs } from '@nestjs/config';

export const databaseConfig = registerAs('database', () => ({
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  name: process.env.DB_NAME ?? 'garbagetrack',
  // Matches Postgres sslmode semantics: "require" (Neon) or "true" enables SSL;
  // unset/"disable"/"false" leaves it off (e.g. local Postgres).
  ssl: process.env.DB_SSL === 'require' || process.env.DB_SSL === 'true',
}));

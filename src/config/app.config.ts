import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required. Refusing to start.');
  }

  return {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '4000', 10),
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  };
});

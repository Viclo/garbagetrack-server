import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TenantHeaderGuard } from './common/guards/tenant-header.guard';
import { TenantContextInterceptor } from './common/context/tenant-context.interceptor';
import { TenantContextService } from './common/context/tenant-context.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Behind Railway's proxy the client IP is in X-Forwarded-For; trust the first
  // hop so per-IP rate limiting (ThrottlerGuard) sees the real caller instead
  // of lumping everyone under the proxy's IP.
  app.set('trust proxy', 1);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port') ?? 4000;
  const nodeEnv = configService.get<string>('app.nodeEnv');

  app.use(helmet());

  const corsOrigins = configService.get<string[]>('app.corsOrigins') ?? [];
  const corsWildcardDomain = configService.get<string>('app.corsWildcardDomain');
  // `<scheme>://<label>.<domain>[:port]` or the bare domain — one env var covers
  // every current and future municipality subdomain, no redeploy per onboarding.
  // http:// and an optional port are allowed (not just https://) so this same
  // pattern also covers CORS_WILDCARD_DOMAIN=localhost for local subdomain
  // testing (roadmap C3, e.g. http://pilot.localhost:3000) — harmless in
  // production since Vercel/Cloudflare never actually serve a *.yoteaviso.net
  // origin over plain http.
  const corsWildcardPattern = corsWildcardDomain
    ? new RegExp(`^https?://([a-z0-9-]+\\.)?${corsWildcardDomain.replace(/\./g, '\\.')}(:\\d+)?$`)
    : null;
  app.enableCors({
    origin(origin, callback) {
      // No Origin header means a non-browser caller (curl, the native driver app) — allow it.
      if (!origin) return callback(null, true);
      if (corsOrigins.includes(origin) || corsWildcardPattern?.test(origin)) {
        return callback(null, true);
      }
      callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['/'] });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const reflector = app.get(Reflector);
  // Order matters: JwtAuthGuard runs first and populates request.user, which
  // TenantHeaderGuard then compares against X-Tenant-Slug.
  app.useGlobalGuards(new JwtAuthGuard(reflector), new TenantHeaderGuard());
  app.useGlobalFilters(new HttpExceptionFilter());
  // Tenant context first so every downstream handler runs inside it.
  app.useGlobalInterceptors(
    new TenantContextInterceptor(app.get(TenantContextService)),
    new ResponseInterceptor(),
  );

  if (nodeEnv !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('GarbageTrack API')
      .setDescription('Real-time garbage truck notification system for Bolivian municipalities')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    console.log(`Swagger docs available at http://localhost:${port}/api/docs`);
  }

  await app.listen(port, '0.0.0.0');
  console.log(`GarbageTrack server running on port ${port} [${nodeEnv}]`);
}

bootstrap();

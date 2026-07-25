import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { geminiConfig } from './config/gemini.config';
import { webpushConfig } from './config/webpush.config';
import { TenantsModule } from './modules/tenants/tenants.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminsModule } from './modules/admins/admins.module';
import { DriversModule } from './modules/drivers/drivers.module';
import { TrucksModule } from './modules/trucks/trucks.module';
import { RoutesModule } from './modules/routes/routes.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { ResidentsModule } from './modules/residents/residents.module';
import { TrackingModule } from './modules/tracking/tracking.module';
import { ProximityModule } from './modules/proximity/proximity.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { PushModule } from './modules/push/push.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, geminiConfig, webpushConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('database.host'),
        port: config.get<number>('database.port'),
        username: config.get<string>('database.username'),
        password: config.get<string>('database.password'),
        database: config.get<string>('database.name'),
        ssl: config.get<boolean>('database.ssl') ? { rejectUnauthorized: false } : false,
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        // Schema is managed by migrations (src/database/migrations), which run
        // automatically at boot — a push to main deploys code AND schema.
        // After changing an entity run: npm run migration:generate
        synchronize: false,
        migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
        migrationsRun: true,
        logging: config.get<string>('app.nodeEnv') === 'development',
      }),
    }),
    TenantsModule,
    AuthModule,
    AdminsModule,
    DriversModule,
    TrucksModule,
    RoutesModule,
    SchedulesModule,
    ResidentsModule,
    TrackingModule,
    ProximityModule,
    NotificationsModule,
    SystemConfigModule,
    AssistantModule,
    PushModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

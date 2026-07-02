import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { appConfig } from './config/app.config';
import { databaseConfig } from './config/database.config';
import { whatsappConfig } from './config/whatsapp.config';
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
import { WhatsappWebhookModule } from './modules/whatsapp-webhook/whatsapp-webhook.module';
import { SystemConfigModule } from './modules/system-config/system-config.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, whatsappConfig],
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
        synchronize: config.get<string>('app.nodeEnv') !== 'production',
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
    WhatsappWebhookModule,
    SystemConfigModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

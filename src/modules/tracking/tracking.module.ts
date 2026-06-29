import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TruckPosition } from './entities/truck-position.entity';
import { TrackingGateway } from './gateways/tracking.gateway';
import { TrackingService } from './services/tracking.service';
import { TrackingController } from './controllers/tracking.controller';
import { TrucksModule } from '../trucks/trucks.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { ProximityModule } from '../proximity/proximity.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TruckPosition]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('app.jwtSecret') ?? 'fallback-secret',
        signOptions: { expiresIn: config.get<string>('app.jwtExpiresIn') ?? '7d' },
      }),
    }),
    TrucksModule,
    SchedulesModule,
    ProximityModule,
  ],
  controllers: [TrackingController],
  providers: [TrackingGateway, TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}

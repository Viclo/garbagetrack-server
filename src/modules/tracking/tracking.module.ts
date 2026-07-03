import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TruckPosition } from './entities/truck-position.entity';
import { RouteSession } from './entities/route-session.entity';
import { TrackingGateway } from './gateways/tracking.gateway';
import { TrackingService } from './services/tracking.service';
import { RouteSessionService } from './services/route-session.service';
import { TrackingController } from './controllers/tracking.controller';
import { TrucksModule } from '../trucks/trucks.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { ProximityModule } from '../proximity/proximity.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TruckPosition, RouteSession]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('app.jwtSecret'),
        signOptions: { expiresIn: config.get<string>('app.jwtExpiresIn') ?? '7d' },
      }),
    }),
    TrucksModule,
    SchedulesModule,
    ProximityModule,
    AuthModule,
  ],
  controllers: [TrackingController],
  providers: [TrackingGateway, TrackingService, RouteSessionService],
  exports: [TrackingService, RouteSessionService],
})
export class TrackingModule {}

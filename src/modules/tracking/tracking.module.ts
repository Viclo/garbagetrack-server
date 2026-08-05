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
import { PublicResidentLiveController } from './controllers/public-resident-live.controller';
import { ResidentLiveService } from './services/resident-live.service';
import { TrucksModule } from '../trucks/trucks.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { ProximityModule } from '../proximity/proximity.module';
import { AuthModule } from '../auth/auth.module';
import { ResidentsModule } from '../residents/residents.module';
import { RoutesModule } from '../routes/routes.module';

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
    // The resident live view (E4) needs both. The dependency only goes this
    // way: residents never import tracking, so there is no cycle.
    ResidentsModule,
    RoutesModule,
  ],
  controllers: [TrackingController, PublicResidentLiveController],
  providers: [TrackingGateway, TrackingService, RouteSessionService, ResidentLiveService],
  exports: [TrackingService, RouteSessionService],
})
export class TrackingModule {}

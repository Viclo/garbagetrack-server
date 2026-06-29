import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Route } from './entities/route.entity';
import { RouteSegment } from './entities/route-segment.entity';
import { RoutesController } from './controllers/routes.controller';
import { RoutesService } from './services/routes.service';

@Module({
  imports: [TypeOrmModule.forFeature([Route, RouteSegment])],
  controllers: [RoutesController],
  providers: [RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}

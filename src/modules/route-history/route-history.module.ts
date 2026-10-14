import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RouteTrack } from './entities/route-track.entity';
import { RouteHistoryController } from './controllers/route-history.controller';
import { RouteHistoryService } from './services/route-history.service';
import { RouteTrackBuilderService } from './services/route-track-builder.service';
import { RouteTrackArchiverService } from './services/route-track-archiver.service';

@Module({
  imports: [TypeOrmModule.forFeature([RouteTrack])],
  controllers: [RouteHistoryController],
  providers: [RouteHistoryService, RouteTrackBuilderService, RouteTrackArchiverService],
})
export class RouteHistoryModule {}

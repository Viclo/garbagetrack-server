import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeeklySchedule } from './entities/weekly-schedule.entity';
import { Truck } from '../trucks/entities/truck.entity';
import { Route } from '../routes/entities/route.entity';
import { SchedulesController } from './controllers/schedules.controller';
import { SchedulesService } from './services/schedules.service';

@Module({
  imports: [TypeOrmModule.forFeature([WeeklySchedule, Truck, Route])],
  controllers: [SchedulesController],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}

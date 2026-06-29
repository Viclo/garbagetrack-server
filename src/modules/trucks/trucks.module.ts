import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Truck } from './entities/truck.entity';
import { Driver } from '../drivers/entities/driver.entity';
import { TrucksController } from './controllers/trucks.controller';
import { TrucksService } from './services/trucks.service';

@Module({
  imports: [TypeOrmModule.forFeature([Truck, Driver])],
  controllers: [TrucksController],
  providers: [TrucksService],
  exports: [TrucksService],
})
export class TrucksModule {}

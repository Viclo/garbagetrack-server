import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Resident } from './entities/resident.entity';
import { ResidentsController } from './controllers/residents.controller';
import { PublicResidentsController } from './controllers/public-residents.controller';
import { ResidentsService } from './services/residents.service';
import { ResidentRegistrationService } from './services/resident-registration.service';
import { PushModule } from '../push/push.module';
import { SystemConfigModule } from '../system-config/system-config.module';

@Module({
  imports: [TypeOrmModule.forFeature([Resident]), PushModule, SystemConfigModule],
  controllers: [ResidentsController, PublicResidentsController],
  providers: [ResidentsService, ResidentRegistrationService],
  exports: [ResidentsService],
})
export class ResidentsModule {}

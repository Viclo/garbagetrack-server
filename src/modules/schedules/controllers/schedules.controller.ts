import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SchedulesService } from '../services/schedules.service';
import { UpsertScheduleInput } from '../dtos/inputs/upsert-schedule.input';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IWeeklySchedule } from '../interfaces/schedule.interface';

@ApiTags('schedules')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('schedules')
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) {}

  @Post()
  @ApiOperation({ summary: 'Assign a route to a truck on a given day' })
  create(@Body() input: UpsertScheduleInput): Promise<IWeeklySchedule> {
    return this.schedulesService.upsert(input);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Move an existing assignment to another day, truck or route' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpsertScheduleInput,
  ): Promise<IWeeklySchedule> {
    return this.schedulesService.upsert(input, id);
  }

  @Get()
  @ApiOperation({ summary: 'List all weekly schedules' })
  findAll(): Promise<IWeeklySchedule[]> {
    return this.schedulesService.findAll();
  }

  @Get('truck/:truckId')
  @ApiOperation({ summary: 'Get the full weekly schedule for a specific truck' })
  findByTruck(@Param('truckId', ParseIntPipe) truckId: number): Promise<IWeeklySchedule[]> {
    return this.schedulesService.findByTruck(truckId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a schedule entry' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.schedulesService.remove(id);
  }
}

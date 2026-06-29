import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TrucksService } from '../services/trucks.service';
import { CreateTruckInput } from '../dtos/inputs/create-truck.input';
import { UpdateTruckInput } from '../dtos/inputs/update-truck.input';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ITruck } from '../interfaces/truck.interface';

@ApiTags('trucks')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('trucks')
export class TrucksController {
  constructor(private readonly trucksService: TrucksService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new truck' })
  create(@Body() input: CreateTruckInput): Promise<ITruck> {
    return this.trucksService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List all trucks with their assigned drivers' })
  findAll(): Promise<ITruck[]> {
    return this.trucksService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get truck count statistics' })
  getStats(): Promise<{ total: number; active: number }> {
    return this.trucksService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a truck by ID' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<ITruck> {
    return this.trucksService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update truck data or reassign driver' })
  update(@Param('id', ParseIntPipe) id: number, @Body() input: UpdateTruckInput): Promise<ITruck> {
    return this.trucksService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a truck' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.trucksService.remove(id);
  }
}

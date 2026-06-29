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
import { DriversService } from '../services/drivers.service';
import { CreateDriverInput } from '../dtos/inputs/create-driver.input';
import { UpdateDriverInput } from '../dtos/inputs/update-driver.input';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IDriver } from '../interfaces/driver.interface';

@ApiTags('drivers')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('drivers')
export class DriversController {
  constructor(private readonly driversService: DriversService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new driver account' })
  create(@Body() input: CreateDriverInput): Promise<IDriver> {
    return this.driversService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List all drivers' })
  findAll(): Promise<IDriver[]> {
    return this.driversService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a driver by ID' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<IDriver> {
    return this.driversService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a driver' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() input: UpdateDriverInput,
  ): Promise<IDriver> {
    return this.driversService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a driver' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.driversService.remove(id);
  }
}

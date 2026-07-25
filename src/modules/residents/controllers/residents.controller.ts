import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ResidentsService } from '../services/residents.service';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IResident } from '../interfaces/resident.interface';

@ApiTags('residents')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('residents')
export class ResidentsController {
  constructor(private readonly residentsService: ResidentsService) {}

  @Get()
  @ApiOperation({
    summary: 'List all registered residents (read-only — residents self-register from the app)',
  })
  findAll(): Promise<IResident[]> {
    return this.residentsService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get resident count statistics' })
  getStats(): Promise<{ total: number }> {
    return this.residentsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a resident by ID' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<IResident> {
    return this.residentsService.findOne(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({
    summary: 'Deactivate a resident (stops notifications; they can re-register from the app)',
  })
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<IResident> {
    return this.residentsService.deactivateById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a resident record' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.residentsService.remove(id);
  }
}

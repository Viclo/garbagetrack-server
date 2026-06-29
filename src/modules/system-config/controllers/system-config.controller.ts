import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SystemConfigService } from '../services/system-config.service';
import { UpdateConfigInput } from '../dtos/inputs/update-config.input';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { ISystemConfig } from '../interfaces/system-config.interface';

@ApiTags('system-config')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('system-config')
export class SystemConfigController {
  constructor(private readonly systemConfigService: SystemConfigService) {}

  @Get()
  @ApiOperation({ summary: 'List all system configuration values' })
  findAll(): Promise<ISystemConfig[]> {
    return this.systemConfigService.findAll();
  }

  @Patch(':key')
  @ApiOperation({ summary: 'Update a config value by key (e.g. notification_blocks)' })
  set(@Param('key') key: string, @Body() input: UpdateConfigInput): Promise<ISystemConfig> {
    return this.systemConfigService.set(key, input.value);
  }
}

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TrackingService } from '../services/tracking.service';
import { RouteSessionService } from '../services/route-session.service';
import { IRouteSessionSummary } from '../interfaces/tracking.interface';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';

@ApiTags('tracking')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly routeSessionService: RouteSessionService,
  ) {}

  @Get('positions')
  @ApiOperation({ summary: 'Get the latest GPS position for each active truck' })
  getLatestPositions() {
    return this.trackingService.getLatestPositions();
  }

  @Get('sessions')
  @ApiOperation({ summary: 'Per-driver total driving time and session history' })
  @ApiQuery({ name: 'driverId', required: false, type: Number })
  getSessions(@Query('driverId') driverId?: string): Promise<IRouteSessionSummary[]> {
    const parsed = driverId ? Number(driverId) : undefined;
    return this.routeSessionService.getSummaries(
      parsed && !Number.isNaN(parsed) ? parsed : undefined,
    );
  }
}

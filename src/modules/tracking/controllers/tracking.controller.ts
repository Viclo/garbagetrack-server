import { BadRequestException, Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TrackingService } from '../services/tracking.service';
import { RouteSessionService } from '../services/route-session.service';
import {
  IDriverRouteSegment,
  ILatestTruckPosition,
  IRouteSessionSummary,
  IRouteStartedEvent,
  ITruckPositionEvent,
} from '../interfaces/tracking.interface';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { TrucksService } from '../../trucks/services/trucks.service';
import { SchedulesService } from '../../schedules/services/schedules.service';
import { TrackingGateway } from '../gateways/tracking.gateway';
import { DriverGpsPositionInput } from '../dtos/inputs/driver-gps-position.input';
import { findRouteStartProblem, NO_TRUCK_ASSIGNED } from '../utils/route-start-problem.util';

@ApiTags('tracking')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller('tracking')
export class TrackingController {
  constructor(
    private readonly trackingService: TrackingService,
    private readonly routeSessionService: RouteSessionService,
    private readonly trucksService: TrucksService,
    private readonly schedulesService: SchedulesService,
    private readonly trackingGateway: TrackingGateway,
  ) {}

  @Get('positions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Get the latest GPS position for each active truck' })
  getLatestPositions(): Promise<ILatestTruckPosition[]> {
    return this.trackingService.getLatestPositions();
  }

  @Get('sessions')
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Per-driver total driving time and session history' })
  @ApiQuery({ name: 'driverId', required: false, type: Number })
  getSessions(@Query('driverId') driverId?: string): Promise<IRouteSessionSummary[]> {
    const parsed = driverId ? Number(driverId) : undefined;
    return this.routeSessionService.getSummaries(
      parsed && !Number.isNaN(parsed) ? parsed : undefined,
    );
  }

  /**
   * Starts (or resumes) a route without relying on a long-lived socket. This
   * endpoint is used by the Android foreground service before it begins
   * delivering background GPS updates.
   */
  @Post('driver/start')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Start or resume the authenticated driver route' })
  async startDriverRoute(
    @CurrentUser() user: IJwtPayload,
  ): Promise<IRouteStartedEvent & { sessionId: number }> {
    const truck = await this.trucksService.findByDriverId(user.sub);
    const schedule = truck ? await this.schedulesService.findForToday(truck.id) : null;

    // The driver reads this on their phone, so the envelope carries a Spanish
    // explanation plus a stable `error` code the app keys its copy off —
    // matching on message text would break on the first reword.
    const problem = findRouteStartProblem(truck, schedule);
    if (problem || !truck || !schedule) {
      throw new BadRequestException({
        error: problem?.code ?? NO_TRUCK_ASSIGNED.code,
        message: problem?.message ?? NO_TRUCK_ASSIGNED.message,
      });
    }

    const session = await this.routeSessionService.startOrResume(
      user.sub,
      truck.id,
      schedule.route.id,
    );
    return {
      sessionId: session.id,
      truckId: truck.id,
      routeId: schedule.route.id,
      routeName: schedule.route.name,
      startedAt: session.startedAt.toISOString(),
      segments: this.mapSegments(schedule),
    };
  }

  /** Receives positions from the Android background task and forwards them live to admins. */
  @Post('driver/position')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Record a background GPS update for the authenticated driver' })
  async recordDriverPosition(
    @CurrentUser() user: IJwtPayload,
    @Body() position: DriverGpsPositionInput,
  ): Promise<void> {
    const session = await this.routeSessionService.findOpenForDriver(user.sub);
    if (!session || session.id !== position.sessionId || !session.truck || !session.route) {
      throw new BadRequestException('No active route session found');
    }

    await this.routeSessionService.recordActivity(session.id);
    const match = await this.trackingService.processGpsUpdate(
      session.truck.id,
      session.route.id,
      position,
    );
    const event: ITruckPositionEvent = {
      truckId: session.truck.id,
      routeId: session.route.id,
      latitude: position.latitude,
      longitude: position.longitude,
      segmentIndex: match?.segmentIndex ?? null,
      streetName: match?.streetName ?? null,
      timestamp: new Date().toISOString(),
    };
    this.trackingGateway.emitTruckPosition(user.tenantId, event);
  }

  @Post('driver/stop')
  @Roles(UserRole.DRIVER)
  @ApiOperation({ summary: 'Stop the authenticated driver route and background tracking session' })
  async stopDriverRoute(@CurrentUser() user: IJwtPayload): Promise<void> {
    const session = await this.routeSessionService.findOpenForDriver(user.sub);
    await this.routeSessionService.stop(user.sub);
    // The route id goes with it so the residents watching that route are told
    // the run is over, not just the admin map (E4).
    if (session?.truck) {
      this.trackingGateway.emitTruckOffline(
        user.tenantId,
        session.truck.id,
        session.route?.id ?? null,
      );
    }
  }

  private mapSegments(schedule: {
    route: {
      segments?: Array<{
        streetName: string;
        startLatitude: number;
        startLongitude: number;
        endLatitude: number;
        endLongitude: number;
        path: [number, number][] | null;
        segmentIndex: number;
      }>;
    };
  }): IDriverRouteSegment[] {
    return [...(schedule.route.segments ?? [])]
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .map(({ streetName, startLatitude, startLongitude, endLatitude, endLongitude, path }) => ({
        streetName,
        startLatitude,
        startLongitude,
        endLatitude,
        endLongitude,
        path,
      }));
  }
}

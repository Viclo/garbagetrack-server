import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RouteHistoryService } from '../services/route-history.service';
import { RouteHistoryQueryInput } from '../dtos/inputs/route-history-query.input';
import {
  LiveTrackOutput,
  RouteTrackDetailOutput,
  RouteTrackSummaryOutput,
} from '../dtos/outputs/route-history.output';
import {
  ILiveTrack,
  IRouteTrackDetail,
  IRouteTrackSummary,
} from '../interfaces/route-history.interface';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';

@ApiTags('route-history')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('route-history')
export class RouteHistoryController {
  constructor(private readonly routeHistoryService: RouteHistoryService) {}

  @Get()
  @ApiOperation({ summary: 'Runs that started on a given day, with distance and coverage' })
  @ApiOkResponse({ type: [RouteTrackSummaryOutput] })
  list(@Query() query: RouteHistoryQueryInput): Promise<IRouteTrackSummary[]> {
    return this.routeHistoryService.listByDate(query.date);
  }

  @Get('live')
  @ApiOperation({ summary: "Today's driven paths: runs open now and runs finished today" })
  @ApiOkResponse({ type: [LiveTrackOutput] })
  live(): Promise<ILiveTrack[]> {
    return this.routeHistoryService.getLive();
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'One run in full: driven path, planned route and off-route stretches' })
  @ApiOkResponse({ type: RouteTrackDetailOutput })
  detail(@Param('sessionId', ParseIntPipe) sessionId: number): Promise<IRouteTrackDetail> {
    return this.routeHistoryService.getDetail(sessionId);
  }
}

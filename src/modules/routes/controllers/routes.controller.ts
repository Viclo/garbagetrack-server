import {
  Controller,
  Get,
  Post,
  Put,
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
import { RoutesService } from '../services/routes.service';
import { CreateRouteInput } from '../dtos/inputs/create-route.input';
import { UpdateRouteInput } from '../dtos/inputs/update-route.input';
import { CreateSegmentInput } from '../dtos/inputs/create-segment.input';
import { UpdateSegmentInput } from '../dtos/inputs/update-segment.input';
import { ReplaceSegmentsInput } from '../dtos/inputs/replace-segments.input';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { UserRole } from '../../../common/enums/user-role.enum';
import { IRoute, IRouteSegment } from '../interfaces/route.interface';

@ApiTags('routes')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('routes')
export class RoutesController {
  constructor(private readonly routesService: RoutesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new route' })
  create(@Body() input: CreateRouteInput): Promise<IRoute> {
    return this.routesService.create(input);
  }

  @Get()
  @ApiOperation({ summary: 'List all routes with their segments' })
  findAll(): Promise<IRoute[]> {
    return this.routesService.findAll();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get route count statistics' })
  getStats(): Promise<{ total: number }> {
    return this.routesService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a route with all its segments ordered by index' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<IRoute> {
    return this.routesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update route metadata (name, description, active status)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() input: UpdateRouteInput): Promise<IRoute> {
    return this.routesService.update(id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a route and all its segments' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.routesService.remove(id);
  }

  @Post(':id/segments')
  @ApiOperation({ summary: 'Add a single segment to a route' })
  addSegment(
    @Param('id', ParseIntPipe) routeId: number,
    @Body() input: CreateSegmentInput,
  ): Promise<IRouteSegment> {
    return this.routesService.addSegment(routeId, input);
  }

  @Put(':id/segments')
  @ApiOperation({ summary: 'Replace all segments of a route (called from the map route builder)' })
  replaceSegments(
    @Param('id', ParseIntPipe) routeId: number,
    @Body() input: ReplaceSegmentsInput,
  ): Promise<IRoute> {
    return this.routesService.replaceSegments(routeId, input);
  }

  @Patch('segments/:segmentId')
  @ApiOperation({ summary: 'Update a segment street name or coordinates' })
  updateSegment(
    @Param('segmentId', ParseIntPipe) segmentId: number,
    @Body() input: UpdateSegmentInput,
  ): Promise<IRouteSegment> {
    return this.routesService.updateSegment(segmentId, input);
  }

  @Delete('segments/:segmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a segment from a route' })
  removeSegment(@Param('segmentId', ParseIntPipe) segmentId: number): Promise<void> {
    return this.routesService.removeSegment(segmentId);
  }
}

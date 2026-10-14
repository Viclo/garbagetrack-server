import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const POINT_DOC =
  'Tuplas [lat, lng, epochSegundos, metrosFueraDeRuta|null, metrosRecorridosSobreRuta|null]';

export class RouteTrackSummaryOutput {
  @ApiProperty() sessionId!: number;
  @ApiProperty({ example: '2026-10-14' }) localDate!: string;
  @ApiPropertyOptional() routeId!: number | null;
  @ApiPropertyOptional() routeName!: string | null;
  @ApiPropertyOptional({ example: '#0369a1' }) routeColor!: string | null;
  @ApiPropertyOptional() truckId!: number | null;
  @ApiPropertyOptional() truckName!: string | null;
  @ApiPropertyOptional() licensePlate!: string | null;
  @ApiPropertyOptional() driverId!: number | null;
  @ApiPropertyOptional() driverName!: string | null;
  @ApiProperty() startedAt!: string;
  @ApiPropertyOptional() endedAt!: string | null;
  @ApiProperty() durationSeconds!: number;
  @ApiProperty() active!: boolean;
  @ApiProperty() archived!: boolean;
  @ApiProperty() pointCount!: number;
  @ApiProperty() distanceM!: number;
  @ApiPropertyOptional() coveragePct!: number | null;
  @ApiProperty() offRouteDistanceM!: number;
}

export class OffRouteStretchOutput {
  @ApiProperty() startedAt!: string;
  @ApiProperty() endedAt!: string;
  @ApiProperty() distanceM!: number;
  @ApiProperty() maxOffRouteM!: number;
}

export class RouteTrackDetailOutput extends RouteTrackSummaryOutput {
  @ApiProperty({
    description: POINT_DOC,
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  points!: Array<[number, number, number, number | null, number | null]>;

  @ApiPropertyOptional({ type: 'array', items: { type: 'array', items: { type: 'number' } } })
  plannedPath!: [number, number][] | null;

  @ApiProperty({ type: [OffRouteStretchOutput] })
  offRouteStretches!: OffRouteStretchOutput[];
}

export class LiveTrackOutput {
  @ApiProperty() sessionId!: number;
  @ApiPropertyOptional() truckId!: number | null;
  @ApiPropertyOptional() routeId!: number | null;
  @ApiPropertyOptional({ example: '#0369a1' }) routeColor!: string | null;
  @ApiProperty({
    description: POINT_DOC,
    type: 'array',
    items: { type: 'array', items: { type: 'number' } },
  })
  points!: Array<[number, number, number, number | null, number | null]>;
}

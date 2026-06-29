import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SegmentOutput {
  @ApiProperty() id!: number;
  @ApiProperty() segmentIndex!: number;
  @ApiProperty() streetName!: string;
  @ApiProperty() startLatitude!: number;
  @ApiProperty() startLongitude!: number;
  @ApiProperty() endLatitude!: number;
  @ApiProperty() endLongitude!: number;
  @ApiPropertyOptional({ type: 'array', items: { type: 'array', items: { type: 'number' } } })
  path!: [number, number][] | null;
}

export class RouteOutput {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() description!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty({ type: [SegmentOutput] }) segments!: SegmentOutput[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

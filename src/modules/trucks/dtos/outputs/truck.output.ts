import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class DriverSummaryOutput {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() username!: string;
}

export class TruckOutput {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() licensePlate!: string;
  @ApiPropertyOptional({ type: DriverSummaryOutput }) driver!: DriverSummaryOutput | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

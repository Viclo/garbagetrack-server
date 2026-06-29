import { ApiProperty } from '@nestjs/swagger';
import { DayOfWeek } from '../../../../common/enums/day-of-week.enum';

class DriverSummaryOutput {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
}

class TruckSummaryOutput {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() licensePlate!: string;
  @ApiProperty({ type: DriverSummaryOutput, nullable: true })
  driver!: DriverSummaryOutput | null;
}

class RouteSummaryOutput {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
}

export class ScheduleOutput {
  @ApiProperty() id!: number;
  @ApiProperty({ type: TruckSummaryOutput }) truck!: TruckSummaryOutput;
  @ApiProperty({ type: RouteSummaryOutput }) route!: RouteSummaryOutput;
  @ApiProperty({ enum: DayOfWeek }) dayOfWeek!: DayOfWeek;
  @ApiProperty() createdAt!: Date;
}

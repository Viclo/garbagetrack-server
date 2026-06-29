import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsEnum } from 'class-validator';
import { DayOfWeek } from '../../../../common/enums/day-of-week.enum';

export class UpsertScheduleInput {
  @ApiProperty({ example: 1 })
  @IsInt()
  truckId!: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  routeId!: number;

  @ApiProperty({ enum: DayOfWeek })
  @IsEnum(DayOfWeek)
  dayOfWeek!: DayOfWeek;
}

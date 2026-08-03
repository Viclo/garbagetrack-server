import { IsInt, Min } from 'class-validator';
import { GpsPositionInput } from './gps-position.input';

export class DriverGpsPositionInput extends GpsPositionInput {
  @IsInt()
  @Min(1)
  sessionId!: number;
}

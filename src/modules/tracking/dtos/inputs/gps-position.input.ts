import { IsNumber, IsNotEmpty, Min, Max } from 'class-validator';

export class GpsPositionInput {
  @IsNumber()
  @IsNotEmpty()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @IsNotEmpty()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber()
  @IsNotEmpty()
  timestamp!: number;
}

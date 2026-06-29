import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsInt, Min } from 'class-validator';

export class CreateSegmentInput {
  @ApiProperty({ example: 0, description: 'Zero-based order index on the route' })
  @IsInt()
  @Min(0)
  segmentIndex!: number;

  @ApiProperty({ example: 'Calle Sucre' })
  @IsString()
  @IsNotEmpty()
  streetName!: string;

  @ApiProperty({ example: -17.3941 })
  @IsNumber()
  latitude!: number;

  @ApiProperty({ example: -66.1572 })
  @IsNumber()
  longitude!: number;
}

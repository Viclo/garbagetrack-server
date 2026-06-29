import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt } from 'class-validator';

export class CreateTruckInput {
  @ApiProperty({ example: 'Truck 01' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({ example: '3456-ABC' })
  @IsString()
  @IsNotEmpty()
  licensePlate!: string;

  @ApiPropertyOptional({ example: 1, description: 'Driver user ID' })
  @IsOptional()
  @IsInt()
  driverId?: number;
}

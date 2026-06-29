import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class UpdateSegmentInput {
  @ApiPropertyOptional({ example: 'Calle Bolívar' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  streetName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  startLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  startLongitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  endLatitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  endLongitude?: number;
}

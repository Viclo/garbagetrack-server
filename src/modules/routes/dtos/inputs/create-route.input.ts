import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateRouteInput {
  @ApiProperty({ example: 'Zona Centro' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Main downtown collection route' })
  @IsOptional()
  @IsString()
  description?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { ROUTE_COLOR_VALUES } from '../../utils/route-color.util';

export class CreateRouteInput {
  @ApiProperty({ example: 'Zona Centro' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({ example: 'Main downtown collection route' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '#0369a1', enum: ROUTE_COLOR_VALUES })
  @IsOptional()
  @IsIn(ROUTE_COLOR_VALUES, { message: 'El color debe ser uno de la paleta de rutas' })
  color?: string;
}

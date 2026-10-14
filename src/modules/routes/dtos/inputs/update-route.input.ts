import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsIn, ValidateIf } from 'class-validator';
import { ROUTE_COLOR_VALUES } from '../../utils/route-color.util';

export class UpdateRouteInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /**
   * A palette colour fixes it by hand; null hands it back to the automatic
   * choice (re-picked now against the route's neighbours); omit to keep it.
   */
  @ApiPropertyOptional({ example: '#7c3aed', enum: ROUTE_COLOR_VALUES, nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(ROUTE_COLOR_VALUES, { message: 'El color debe ser uno de la paleta de rutas' })
  color?: string | null;
}

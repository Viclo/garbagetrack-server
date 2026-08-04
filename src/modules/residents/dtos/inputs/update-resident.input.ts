import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, Min, Max, MaxLength, ValidateIf } from 'class-validator';

/**
 * Admin-side resident edit (roadmap B6). Residents cannot self-edit in v1, so
 * this is the only correction path for a mis-pinned or moved resident.
 * Latitude and longitude travel together: providing one without the other is
 * rejected, since half a coordinate would silently mis-place the record.
 */
export class UpdateResidentInput {
  @ApiPropertyOptional({ example: 'Juan Pérez', description: 'Null clears the name' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string | null;

  @ApiPropertyOptional({ example: -17.3936 })
  @ValidateIf((o: UpdateResidentInput) => o.latitude !== undefined || o.longitude !== undefined)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: -66.157 })
  @ValidateIf((o: UpdateResidentInput) => o.latitude !== undefined || o.longitude !== undefined)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;
}

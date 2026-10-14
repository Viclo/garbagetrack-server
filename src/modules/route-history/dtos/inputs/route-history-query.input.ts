import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

export class RouteHistoryQueryInput {
  @ApiPropertyOptional({ example: '2026-10-14', description: 'Día (YYYY-MM-DD), hora de Bolivia' })
  @IsOptional()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, {
    message: 'La fecha debe tener el formato AAAA-MM-DD',
  })
  date?: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class UpdateTenantInput {
  @ApiPropertyOptional({ example: 'Municipio de Quillacollo' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Meta WhatsApp Business phone_number_id owned by this municipality',
    example: '106540352242922',
  })
  @IsOptional()
  @IsString()
  waPhoneNumberId?: string | null;

  @ApiPropertyOptional({
    description: 'Meta permanent access token for that number. Write-only: never returned.',
  })
  @IsOptional()
  @IsString()
  waAccessToken?: string | null;
}

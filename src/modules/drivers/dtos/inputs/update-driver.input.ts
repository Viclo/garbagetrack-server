import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  IsBoolean,
  IsDateString,
  ValidateIf,
  Matches,
} from 'class-validator';
import { BOLIVIAN_MOBILE_E164, BOLIVIAN_MOBILE_MESSAGE } from '../../../../common/utils/phone.util';

export class UpdateDriverInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional({ example: '+59170012345', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @Matches(BOLIVIAN_MOBILE_E164, { message: BOLIVIAN_MOBILE_MESSAGE })
  phone?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  /** Null clears a previously recorded expiry, so `IsDateString` must skip it. */
  @ApiPropertyOptional({ example: '2027-05-31', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsDateString()
  licenseExpiresAt?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

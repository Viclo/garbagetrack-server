import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsDateString,
  Matches,
} from 'class-validator';
import { BOLIVIAN_MOBILE_E164, BOLIVIAN_MOBILE_MESSAGE } from '../../../../common/utils/phone.util';

export class CreateDriverInput {
  @ApiProperty({ example: 'driver01' })
  @IsString()
  @IsNotEmpty()
  username!: string;

  @ApiProperty({ example: 'SecurePass123', minLength: 6 })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string;

  @ApiProperty({ example: 'Juan Pérez' })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    example: '+59170012345',
    description: 'Contact mobile (E.164)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(BOLIVIAN_MOBILE_E164, { message: BOLIVIAN_MOBILE_MESSAGE })
  phone?: string | null;

  @ApiPropertyOptional({ example: 'LIC-001', description: "Driver's license number" })
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '2027-05-31', description: 'License expiry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  licenseExpiresAt?: string;
}

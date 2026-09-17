import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MinLength, ValidateIf } from 'class-validator';

/**
 * Deliberately narrower than UpdateAdminInput: self-service can never touch
 * isActive, and a password change requires the current one — there is no
 * forgot-password/OTP flow, so this doubles as the only account-recovery path
 * and must not be usable by anyone who merely has an unattended session open.
 */
export class UpdateSelfAdminInput {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ minLength: 6 })
  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: UpdateSelfAdminInput) => !!o.password)
  @IsString()
  currentPassword?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PushSubscriptionInput {
  @ApiProperty({ description: 'PushSubscription.endpoint URL from the browser' })
  @IsString()
  @IsNotEmpty()
  endpoint!: string;

  @ApiProperty({ description: 'subscription.keys.p256dh (base64url)' })
  @IsString()
  @IsNotEmpty()
  p256dh!: string;

  @ApiProperty({ description: 'subscription.keys.auth (base64url)' })
  @IsString()
  @IsNotEmpty()
  auth!: string;
}

/** Body of the public resident registration endpoint (roadmap B1). */
export class RegisterResidentInput {
  @ApiProperty({ description: 'Municipality slug encoded in the QR', example: 'cochabamba' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tenantSlug!: string;

  @ApiProperty({ example: '+59170000000' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  phoneNumber!: string;

  @ApiPropertyOptional({ example: 'Juan Pérez' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiProperty({ example: -17.3936 })
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @ApiProperty({ example: -66.157 })
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @ApiProperty({ type: PushSubscriptionInput })
  @ValidateNested()
  @Type(() => PushSubscriptionInput)
  pushSubscription!: PushSubscriptionInput;
}

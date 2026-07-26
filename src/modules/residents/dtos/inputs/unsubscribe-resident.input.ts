import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsPositive, MaxLength } from 'class-validator';

/** Body of the public resident unsubscribe endpoint (roadmap B3). */
export class UnsubscribeResidentInput {
  @ApiProperty({ example: 'cochabamba' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  tenantSlug!: string;

  @ApiProperty({ description: 'Resident id stored on the device at registration' })
  @IsInt()
  @IsPositive()
  residentId!: number;
}

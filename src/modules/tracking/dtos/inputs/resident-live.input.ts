import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsPositive, MaxLength } from 'class-validator';

/** Body of the resident live-view handshake (roadmap E4). */
export class ResidentLiveInput {
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

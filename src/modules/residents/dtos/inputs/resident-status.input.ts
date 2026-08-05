import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsInt, IsPositive, MaxLength } from 'class-validator';

/** Body of the public device status check (roadmap C7). */
export class ResidentStatusInput {
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

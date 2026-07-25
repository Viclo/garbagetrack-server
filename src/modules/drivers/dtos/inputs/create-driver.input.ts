import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, IsOptional } from 'class-validator';

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

  @ApiPropertyOptional({ example: '+59170000000', description: 'Contact phone number' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'LIC-001', description: "Driver's license number" })
  @IsOptional()
  @IsString()
  licenseNumber?: string;
}

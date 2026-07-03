import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches, MaxLength } from 'class-validator';

export class CreateTenantInput {
  @ApiProperty({
    example: 'quillacollo',
    description: 'URL-safe unique identifier (lowercase kebab-case)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug must be lowercase kebab-case (letters, numbers, hyphens)',
  })
  slug!: string;

  @ApiProperty({ example: 'Municipio de Quillacollo' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;
}

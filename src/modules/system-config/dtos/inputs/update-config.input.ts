import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class UpdateConfigInput {
  /**
   * Empty is allowed: it is how an admin clears an optional value, such as
   * hiding the municipality phone from the public registration page. Keys that
   * need a value validate it where they are read.
   */
  @ApiProperty({ example: '2' })
  @IsString()
  value!: string;
}

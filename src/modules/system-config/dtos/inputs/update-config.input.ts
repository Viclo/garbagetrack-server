import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateConfigInput {
  @ApiProperty({ example: '2' })
  @IsString()
  @IsNotEmpty()
  value!: string;
}

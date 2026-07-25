import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class SendMessageInput {
  @ApiPropertyOptional({ example: 12, description: 'Omit to start a new conversation' })
  @IsOptional()
  @IsInt()
  conversationId?: number;

  @ApiProperty({ example: '¿Cómo asigno un horario a un chofer?' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message!: string;
}

import { ApiProperty } from '@nestjs/swagger';

export class SystemConfigOutput {
  @ApiProperty() id!: number;
  @ApiProperty() key!: string;
  @ApiProperty() value!: string;
  @ApiProperty() updatedAt!: Date;
}

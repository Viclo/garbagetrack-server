import { ApiProperty } from '@nestjs/swagger';

export class AdminOutput {
  @ApiProperty() id!: number;
  @ApiProperty() username!: string;
  @ApiProperty() name!: string;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

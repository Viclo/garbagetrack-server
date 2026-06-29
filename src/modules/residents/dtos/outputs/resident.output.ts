import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResidentOutput {
  @ApiProperty() id!: number;
  @ApiProperty() phoneNumber!: string;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiPropertyOptional() routeId!: number | null;
  @ApiPropertyOptional() segmentIndex!: number | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

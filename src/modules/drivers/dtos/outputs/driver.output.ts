import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DriverOutput {
  @ApiProperty() id!: number;
  @ApiProperty() username!: string;
  @ApiProperty() name!: string;
  @ApiPropertyOptional() phone!: string | null;
  @ApiPropertyOptional() licenseNumber!: string | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

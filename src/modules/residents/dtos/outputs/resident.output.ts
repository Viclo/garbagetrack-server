import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ResidentOutput {
  @ApiProperty() id!: number;
  @ApiProperty() phoneNumber!: string;
  @ApiPropertyOptional({ description: 'Resident name captured at registration' })
  name!: string | null;
  @ApiProperty() latitude!: number;
  @ApiProperty() longitude!: number;
  @ApiPropertyOptional() routeId!: number | null;
  @ApiPropertyOptional() segmentIndex!: number | null;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

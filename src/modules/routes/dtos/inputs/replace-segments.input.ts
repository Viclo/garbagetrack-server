import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsOptional,
} from 'class-validator';

export class ReplaceSegmentItem {
  @ApiProperty({ example: 'Calle Jordán' })
  @IsString()
  @IsNotEmpty()
  streetName!: string;

  @ApiProperty({ example: -17.3941 })
  @IsNumber()
  startLatitude!: number;

  @ApiProperty({ example: -66.1572 })
  @IsNumber()
  startLongitude!: number;

  @ApiProperty({ example: -17.3955 })
  @IsNumber()
  endLatitude!: number;

  @ApiProperty({ example: -66.1588 })
  @IsNumber()
  endLongitude!: number;

  @ApiPropertyOptional({
    description: 'Real road geometry following the street as ordered [lat, lng] pairs (OSRM)',
    example: [
      [-17.3941, -66.1572],
      [-17.3948, -66.158],
      [-17.3955, -66.1588],
    ],
  })
  @IsOptional()
  @IsArray()
  path?: [number, number][];
}

export class ReplaceSegmentsInput {
  @ApiProperty({
    type: [ReplaceSegmentItem],
    description:
      'Ordered list of segments; segmentIndex is assigned server-side from the array order',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReplaceSegmentItem)
  segments!: ReplaceSegmentItem[];
}

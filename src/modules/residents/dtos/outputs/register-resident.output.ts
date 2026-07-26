import { ApiProperty } from '@nestjs/swagger';

export class RegisterResidentOutput {
  @ApiProperty({ description: 'ID of the newly created resident record' })
  residentId!: number;

  @ApiProperty({
    description:
      'Owner token — returned exactly once. The device stores it to authorize ' +
      'later self-service actions (e.g. unsubscribe). Never recoverable if lost.',
  })
  ownerToken!: string;
}

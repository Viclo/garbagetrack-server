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

  @ApiProperty({
    description:
      'False when no route passes within max_snap_distance_m of the house. The ' +
      'registration is kept either way, but the resident receives no alerts until ' +
      'a route reaches their street — so the PWA must say so instead of promising ' +
      'notifications that can never arrive.',
  })
  routeAssigned!: boolean;
}

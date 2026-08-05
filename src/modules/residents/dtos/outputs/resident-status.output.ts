import { ApiProperty } from '@nestjs/swagger';

/**
 * What the device's stored registration is actually worth (roadmap C7).
 * `unknown` covers both "the record is gone" and "this token does not own it":
 * merging them keeps the endpoint from confirming which resident ids exist,
 * and the device's recovery is the same either way — register again.
 */
export type ResidentStatus = 'active' | 'inactive' | 'unknown';

export class ResidentStatusOutput {
  @ApiProperty({ enum: ['active', 'inactive', 'unknown'] })
  status!: ResidentStatus;

  @ApiProperty({
    description:
      'False when no route passes within max_snap_distance_m of the house — the ' +
      'resident is registered but outside the collection zone, so no alert can fire.',
  })
  routeAssigned!: boolean;
}

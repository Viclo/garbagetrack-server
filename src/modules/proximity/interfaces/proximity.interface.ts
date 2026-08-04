/** Which of the day's two alerts is being sent (roadmap B8). */
export type AlertStage = 'prepare' | 'arriving';

/**
 * A GPS fix already projected onto its route's centerline — what the proximity
 * engine reasons about, instead of raw coordinates and segment numbering.
 */
export interface IRouteProgress {
  truckId: number;
  routeId: number;
  /** Distance along the route centerline, in metres. */
  offsetM: number;
  /** Distance from the centerline; large values mean the truck left the route. */
  offRouteM: number;
  /** Street the fix matched, for the alert text. */
  streetName: string | null;
  /** When the DEVICE took the fix (D6), not when the server received it. */
  recordedAt: Date;
  /**
   * The truck's most recent earlier on-route fix, which is what direction and
   * speed are derived from. Supplied by the caller: TrackingService owns
   * position storage, and it already injects this service, so reaching back the
   * other way would be circular.
   */
  previous: IPreviousFix | null;
}

export interface IPreviousFix {
  offsetM: number;
  recordedAt: Date;
}

/** The truck's recent movement along the route, derived from previous fixes. */
export interface ITruckMotion {
  /** +1 when the offset is growing, -1 when shrinking, 0 when undetermined. */
  direction: 1 | -1 | 0;
  /** Metres per second of progress along the route. */
  speedMps: number;
  /** True when the speed is the tenant default rather than a measurement. */
  estimated: boolean;
}

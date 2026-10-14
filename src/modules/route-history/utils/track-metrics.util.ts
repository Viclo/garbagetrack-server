import {
  IOffRouteStretch,
  IRawFix,
  ITrackMetrics,
  TrackPoint,
} from '../interfaces/route-history.interface';

/**
 * Further than this from the centerline, a fix counts as "off route" on the
 * history map. Tighter than the proximity engine's 150 m tolerance on
 * purpose: that one only decides whether to keep alerting residents, this one
 * shows an administrator where the truck left its streets, and at 150 m a
 * parallel street a block away would still read as on route.
 */
export const OFF_ROUTE_THRESHOLD_M = 60;

/**
 * Faster than this between two fixes (~90 km/h) is not a garbage truck, it is
 * GPS noise: a fix that bounced off a building and came back. Such a fix is
 * dropped, or the drawn path grows spikes.
 */
export const MAX_PLAUSIBLE_SPEED_MPS = 25;

/**
 * Two fixes further apart in time than this are not joined by a line: the
 * phone had no signal and nobody knows which streets the truck took. Shared
 * with the admin map, which breaks the drawn path at the same rule.
 */
export const TRACK_GAP_SECONDS = 180;

/** Resolution of the coverage estimate along the route. */
const COVERAGE_BUCKET_M = 20;

/**
 * Two consecutive on-route fixes further apart than this along the route are
 * not assumed to cover the stretch between them: the truck may have taken a
 * shortcut and skipped part of it.
 */
const COVERAGE_MAX_STEP_M = 400;

const EARTH_RADIUS_M = 6_371_000;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
};

const distanceBetween = (a: TrackPoint, b: TrackPoint): number => haversineM(a[0], a[1], b[0], b[1]);

/**
 * Raw fixes → the points worth drawing: ordered by device time (fixes replayed
 * after a signal gap arrive late), one per instant, and without GPS spikes.
 * Coordinates keep 6 decimals (~10 cm), which is far below GPS accuracy.
 */
export function cleanFixes(raw: IRawFix[]): TrackPoint[] {
  const sorted = [...raw].sort((a, b) => a.recordedAt.getTime() - b.recordedAt.getTime());
  const points: TrackPoint[] = [];

  for (const fix of sorted) {
    const point: TrackPoint = [
      round(fix.latitude, 6),
      round(fix.longitude, 6),
      Math.round(fix.recordedAt.getTime() / 1000),
      fix.offRouteM === null ? null : round(fix.offRouteM, 1),
      fix.routeOffsetM === null ? null : round(fix.routeOffsetM, 1),
    ];

    const last = points[points.length - 1];
    if (last) {
      const seconds = point[2] - last[2];
      if (seconds <= 0) continue;
      const metres = distanceBetween(last, point);
      // Measured against the last KEPT point, so a single spike is dropped and
      // the fix after it compares against where the truck really was.
      if (metres / seconds > MAX_PLAUSIBLE_SPEED_MPS) continue;
    }
    points.push(point);
  }

  return points;
}

const isOffRoute = (p: TrackPoint): boolean => p[3] !== null && p[3] > OFF_ROUTE_THRESHOLD_M;
const isOnRoute = (p: TrackPoint): boolean => p[3] !== null && p[3] <= OFF_ROUTE_THRESHOLD_M && p[4] !== null;

/**
 * Distance, coverage and off-route stretches of a cleaned run.
 *
 * Distance includes the straight line across signal gaps: the truck drove at
 * least that far, and leaving it out would under-report every run in an area
 * with poor coverage.
 */
export function computeTrackMetrics(
  points: TrackPoint[],
  centerlineLengthM: number | null,
): ITrackMetrics {
  let distanceM = 0;
  let offRouteDistanceM = 0;
  const stretches: IOffRouteStretch[] = [];
  let open: { start: TrackPoint; end: TrackPoint; distanceM: number; max: number } | null = null;

  for (let i = 0; i < points.length; i += 1) {
    const point = points[i];
    const prev = i > 0 ? points[i - 1] : null;
    const step = prev ? distanceBetween(prev, point) : 0;
    distanceM += step;

    if (isOffRoute(point)) {
      if (open && prev && point[2] - prev[2] <= TRACK_GAP_SECONDS) {
        open.end = point;
        open.distanceM += step;
        open.max = Math.max(open.max, point[3] ?? 0);
        offRouteDistanceM += step;
      } else {
        if (open) stretches.push(toStretch(open));
        open = { start: point, end: point, distanceM: 0, max: point[3] ?? 0 };
      }
    } else if (open) {
      stretches.push(toStretch(open));
      open = null;
    }
  }
  if (open) stretches.push(toStretch(open));

  return {
    pointCount: points.length,
    distanceM: Math.round(distanceM),
    coveragePct: computeCoverage(points, centerlineLengthM),
    offRouteDistanceM: Math.round(offRouteDistanceM),
    offRouteStretches: stretches,
  };
}

function toStretch(open: {
  start: TrackPoint;
  end: TrackPoint;
  distanceM: number;
  max: number;
}): IOffRouteStretch {
  return {
    startedAt: new Date(open.start[2] * 1000).toISOString(),
    endedAt: new Date(open.end[2] * 1000).toISOString(),
    distanceM: Math.round(open.distanceM),
    maxOffRouteM: Math.round(open.max),
  };
}

/**
 * The route is cut into 20 m buckets; a bucket is covered when an on-route
 * fix falls in it, or when two consecutive on-route fixes close in time and
 * distance straddle it (fixes arrive every ~15 m at best, so a bucket between
 * two of them was driven too).
 */
function computeCoverage(points: TrackPoint[], centerlineLengthM: number | null): number | null {
  if (!centerlineLengthM || centerlineLengthM <= 0) return null;

  const bucketCount = Math.max(1, Math.ceil(centerlineLengthM / COVERAGE_BUCKET_M));
  const covered = new Uint8Array(bucketCount);
  const bucketOf = (offsetM: number): number =>
    Math.min(bucketCount - 1, Math.max(0, Math.floor(offsetM / COVERAGE_BUCKET_M)));

  let prev: TrackPoint | null = null;
  for (const point of points) {
    if (!isOnRoute(point)) {
      prev = null;
      continue;
    }
    const offset = point[4] as number;
    covered[bucketOf(offset)] = 1;

    if (prev) {
      const prevOffset = prev[4] as number;
      const closeInTime = point[2] - prev[2] <= TRACK_GAP_SECONDS;
      const closeAlongRoute = Math.abs(offset - prevOffset) <= COVERAGE_MAX_STEP_M;
      if (closeInTime && closeAlongRoute) {
        const from = bucketOf(Math.min(offset, prevOffset));
        const to = bucketOf(Math.max(offset, prevOffset));
        for (let b = from; b <= to; b += 1) covered[b] = 1;
      }
    }
    prev = point;
  }

  const coveredCount = covered.reduce((sum, v) => sum + v, 0);
  return round((coveredCount / bucketCount) * 100, 1);
}

/** WKT for PostGIS, or null when there are not two points to make a line. */
export function toLineStringWkt(points: TrackPoint[]): string | null {
  if (points.length < 2) return null;
  return `LINESTRING(${points.map((p) => `${p[1]} ${p[0]}`).join(',')})`;
}

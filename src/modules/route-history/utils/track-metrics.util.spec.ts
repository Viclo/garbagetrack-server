import { cleanFixes, computeTrackMetrics, haversineM, toLineStringWkt } from './track-metrics.util';
import { IRawFix, TrackPoint } from '../interfaces/route-history.interface';

const T0 = new Date('2026-10-14T12:00:00Z').getTime();

/** ~11.1 m per 0.0001° of latitude: walks north in 10 s steps. */
function fix(i: number, extra: Partial<IRawFix> = {}): IRawFix {
  return {
    latitude: -17.4 + i * 0.0001,
    longitude: -66.15,
    recordedAt: new Date(T0 + i * 10_000),
    offRouteM: 5,
    routeOffsetM: i * 11.1,
    ...extra,
  };
}

describe('cleanFixes', () => {
  it('orders fixes by device time, not arrival order', () => {
    const points = cleanFixes([fix(2), fix(0), fix(1)]);
    expect(points.map((p) => p[2])).toEqual([0, 1, 2].map((i) => (T0 + i * 10_000) / 1000));
  });

  it('drops a GPS spike but keeps the fix after it', () => {
    const spike = fix(2, { latitude: -17.38 }); // ~2 km away in 10 s
    const points = cleanFixes([fix(0), fix(1), spike, fix(3)]);
    expect(points).toHaveLength(3);
    expect(points[2][2]).toBe((T0 + 30_000) / 1000);
  });

  it('drops duplicate timestamps', () => {
    expect(cleanFixes([fix(0), fix(0), fix(1)])).toHaveLength(2);
  });
});

describe('computeTrackMetrics', () => {
  it('sums distance and reports full coverage of a fully driven route', () => {
    const points = cleanFixes(Array.from({ length: 10 }, (_, i) => fix(i)));
    const metrics = computeTrackMetrics(points, 9 * 11.1);
    expect(metrics.distanceM).toBeGreaterThan(95);
    expect(metrics.distanceM).toBeLessThan(105);
    expect(metrics.coveragePct).toBe(100);
    expect(metrics.offRouteStretches).toHaveLength(0);
  });

  it('reports half coverage when only half the route was driven', () => {
    const points = cleanFixes(Array.from({ length: 10 }, (_, i) => fix(i)));
    expect(computeTrackMetrics(points, 2 * 9 * 11.1).coveragePct).toBeCloseTo(50, -1);
  });

  it('groups consecutive off-route fixes into one stretch', () => {
    const raw = Array.from({ length: 8 }, (_, i) =>
      fix(i, i >= 3 && i <= 5 ? { offRouteM: 120, routeOffsetM: 33 } : {}),
    );
    const metrics = computeTrackMetrics(cleanFixes(raw), 100);
    expect(metrics.offRouteStretches).toHaveLength(1);
    expect(metrics.offRouteStretches[0].maxOffRouteM).toBe(120);
    expect(metrics.offRouteDistanceM).toBeGreaterThan(20);
  });

  it('has no coverage without a centerline', () => {
    expect(computeTrackMetrics(cleanFixes([fix(0), fix(1)]), null).coveragePct).toBeNull();
  });
});

describe('helpers', () => {
  it('measures ~111 m per 0.001° of latitude', () => {
    expect(haversineM(0, 0, 0.001, 0)).toBeCloseTo(111.2, 0);
  });

  it('builds lng-lat WKT and refuses a single point', () => {
    const p: TrackPoint = [-17.4, -66.15, 0, null, null];
    expect(toLineStringWkt([p])).toBeNull();
    expect(toLineStringWkt([p, p])).toBe('LINESTRING(-66.15 -17.4,-66.15 -17.4)');
  });
});

/**
 * Route colours (identity on every admin map: live map, history, builder).
 *
 * WHY ONLY FIVE. People can tell apart roughly a handful of colours at a
 * glance, and fewer still when some readers are colour-blind. These five were
 * picked by measurement (OKLab distance, normal vision and simulated
 * deuteranopia/protanopia/tritanopia) as the largest set where EVERY pair
 * stays clearly distinct from every other AND from the off-route red
 * (#DC2626), which is reserved and never a route colour. Adding a sixth hue
 * makes some pair ambiguous, so a municipality with 80 routes still uses
 * these five.
 *
 * HOW 80 ROUTES FIT IN FIVE COLOURS. A colour only has to differ from the
 * routes drawn NEXT to it; a route across the city can share it. When a route
 * gets its geometry, it takes the colour least used by its neighbours,
 * weighted by distance and by the weekdays they share (two routes out on the
 * same day appear together on the live map). That is map colouring, and five
 * colours are enough for any realistic layout of collection sectors. Identity
 * never rests on colour alone: the route name sits next to every colour chip
 * and in each line's tooltip.
 *
 * Mirrored in garbagetrack-admin (common/utils/map-style.ts). Change both.
 */
export const ROUTE_COLORS = [
  { value: '#0369a1', label: 'Azul' },
  { value: '#15803d', label: 'Verde' },
  { value: '#7c3aed', label: 'Morado' },
  { value: '#eda100', label: 'Amarillo' },
  { value: '#e87ba4', label: 'Rosado' },
] as const;

export type RouteColor = (typeof ROUTE_COLORS)[number]['value'];

export const ROUTE_COLOR_VALUES: readonly string[] = ROUTE_COLORS.map((c) => c.value);

export const DEFAULT_ROUTE_COLOR: RouteColor = ROUTE_COLORS[0].value;

/** Routes further apart than this do not influence each other's colour. */
export const ROUTE_COLOR_NEIGHBOUR_RADIUS_M = 2000;

/**
 * Distance at which a neighbour's weight halves. Routes sharing streets or
 * running parallel a block away matter far more than ones a kilometre off.
 */
const DISTANCE_HALF_WEIGHT_M = 250;

export interface IColorNeighbour {
  color: string;
  distanceM: number;
  /** Weekdays both routes are scheduled on (0–7). */
  sharedDays: number;
}

/**
 * Picks the colour that clashes least with the route's neighbours. Ties go to
 * the colour least used across the municipality, then to palette order, so
 * the result is deterministic and the palette stays balanced as routes grow.
 */
export function chooseRouteColor(
  neighbours: IColorNeighbour[],
  usage: Record<string, number> = {},
): RouteColor {
  const clash = new Map<string, number>(ROUTE_COLOR_VALUES.map((c) => [c, 0]));
  for (const n of neighbours) {
    if (!clash.has(n.color)) continue;
    const weight = (1 + n.sharedDays) / (1 + Math.max(0, n.distanceM) / DISTANCE_HALF_WEIGHT_M);
    clash.set(n.color, (clash.get(n.color) ?? 0) + weight);
  }

  let best: RouteColor = DEFAULT_ROUTE_COLOR;
  let bestKey: [number, number, number] | null = null;
  ROUTE_COLORS.forEach(({ value }, index) => {
    const key: [number, number, number] = [clash.get(value) ?? 0, usage[value] ?? 0, index];
    if (!bestKey || compare(key, bestKey) < 0) {
      best = value;
      bestKey = key;
    }
  });
  return best;
}

/** For a route with no geometry yet: the colour least used in the municipality. */
export function leastUsedRouteColor(usage: Record<string, number>): RouteColor {
  return chooseRouteColor([], usage);
}

function compare(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < a.length; i += 1) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    // Clash scores are floats; treat near-equal as a tie so usage decides.
    if (i === 0 ? Math.abs(d) > 1e-9 : d !== 0) return d;
  }
  return 0;
}

import { chooseRouteColor, leastUsedRouteColor, ROUTE_COLORS } from './route-color.util';

const [AZUL, VERDE, MORADO, AMARILLO, ROSADO] = ROUTE_COLORS.map((c) => c.value);

describe('chooseRouteColor', () => {
  it('starts with the first colour when nothing is around', () => {
    expect(chooseRouteColor([])).toBe(AZUL);
  });

  it('avoids the colours of nearby routes', () => {
    const color = chooseRouteColor([
      { color: AZUL, distanceM: 50, sharedDays: 0 },
      { color: VERDE, distanceM: 120, sharedDays: 0 },
    ]);
    expect([MORADO, AMARILLO, ROSADO]).toContain(color);
  });

  it('prefers repeating a far route colour over a near one', () => {
    const neighbours = [AZUL, VERDE, MORADO, AMARILLO].map((color) => ({
      color,
      distanceM: 100,
      sharedDays: 0,
    }));
    neighbours.push({ color: ROSADO, distanceM: 1900, sharedDays: 0 });
    expect(chooseRouteColor(neighbours)).toBe(ROSADO);
  });

  it('weighs a neighbour out on the same days more', () => {
    const color = chooseRouteColor([
      { color: AZUL, distanceM: 300, sharedDays: 3 },
      { color: VERDE, distanceM: 300, sharedDays: 0 },
      { color: MORADO, distanceM: 300, sharedDays: 0 },
      { color: AMARILLO, distanceM: 300, sharedDays: 0 },
      { color: ROSADO, distanceM: 300, sharedDays: 0 },
    ]);
    expect(color).not.toBe(AZUL);
  });

  it('breaks ties by municipality-wide usage', () => {
    expect(leastUsedRouteColor({ [AZUL]: 3, [VERDE]: 1, [MORADO]: 3, [AMARILLO]: 3, [ROSADO]: 3 })).toBe(
      VERDE,
    );
  });

  it('ignores colours outside the palette (legacy or hand-edited rows)', () => {
    expect(chooseRouteColor([{ color: '#ff0000', distanceM: 10, sharedDays: 7 }])).toBe(AZUL);
  });
});

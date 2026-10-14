import { runSpan } from './route-track-builder.service';
import { TrackPoint } from '../interfaces/route-history.interface';

const at = (iso: string): number => new Date(iso).getTime() / 1000;
const point = (iso: string): TrackPoint => [-17.4, -66.15, at(iso), null, null];

describe('runSpan', () => {
  const session = {
    startedAt: new Date('2026-10-14T12:36:00Z'),
    endedAt: new Date('2026-10-14T12:39:00Z'),
  };

  it('keeps the session times when every fix falls inside them', () => {
    const span = runSpan(session, [point('2026-10-14T12:37:00Z'), point('2026-10-14T12:38:00Z')]);
    expect(span.startedAt.toISOString()).toBe('2026-10-14T12:36:00.000Z');
    expect(span.endedAt?.toISOString()).toBe('2026-10-14T12:39:00.000Z');
  });

  it('widens to fixes replayed from before the session opened', () => {
    const span = runSpan(session, [point('2026-10-14T12:14:00Z'), point('2026-10-14T12:41:00Z')]);
    expect(span.startedAt.toISOString()).toBe('2026-10-14T12:14:00.000Z');
    expect(span.endedAt?.toISOString()).toBe('2026-10-14T12:41:00.000Z');
  });

  it('leaves an open run open', () => {
    expect(
      runSpan({ ...session, endedAt: null }, [point('2026-10-14T12:50:00Z')]).endedAt,
    ).toBeNull();
  });
});

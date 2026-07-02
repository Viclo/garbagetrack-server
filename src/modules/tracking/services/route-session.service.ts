import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { RouteSession } from '../entities/route-session.entity';
import { Driver } from '../../drivers/entities/driver.entity';
import { Truck } from '../../trucks/entities/truck.entity';
import { Route } from '../../routes/entities/route.entity';
import { IRouteSessionSummary } from '../interfaces/tracking.interface';

/** A session with no GPS activity for longer than this is considered abandoned. */
const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
/** How often the background sweep closes abandoned open sessions. */
const SWEEP_INTERVAL_MS = 60 * 1000;

@Injectable()
export class RouteSessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RouteSessionService.name);
  private sweepTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(RouteSession) private readonly sessionsRepo: Repository<RouteSession>,
  ) {}

  onModuleInit(): void {
    // Dependency-free periodic sweep (avoids pulling in @nestjs/schedule).
    this.sweepTimer = setInterval(() => {
      this.sweepInactive().catch((err) => this.logger.error('Session sweep failed', err));
    }, SWEEP_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  /**
   * Returns the driver's current open session, resuming it if it is still fresh.
   * A stale open session (past the inactivity window) is closed and a new one is
   * created, so a driver who restarts after a long break gets a clean session.
   */
  async startOrResume(driverId: number, truckId: number, routeId: number): Promise<RouteSession> {
    const open = await this.findOpenForDriver(driverId);
    if (open) return open;

    // Close any stale (abandoned) open sessions before opening a fresh one.
    await this.closeStaleForDriver(driverId);

    const now = new Date();
    const session = this.sessionsRepo.create({
      driver: { id: driverId } as Driver,
      truck: { id: truckId } as Truck,
      route: { id: routeId } as Route,
      startedAt: now,
      lastActivityAt: now,
      endedAt: null,
    });
    return this.sessionsRepo.save(session);
  }

  /** The driver's open session, only if it is still within the activity window. */
  async findOpenForDriver(driverId: number): Promise<RouteSession | null> {
    const open = await this.sessionsRepo.findOne({
      where: { driver: { id: driverId }, endedAt: IsNull() },
      order: { startedAt: 'DESC' },
    });
    if (!open) return null;
    if (Date.now() - open.lastActivityAt.getTime() > INACTIVITY_LIMIT_MS) return null;
    return open;
  }

  /** Marks a session as still active. Best-effort; called on every GPS ping. */
  async recordActivity(sessionId: number): Promise<void> {
    await this.sessionsRepo.update({ id: sessionId }, { lastActivityAt: new Date() });
  }

  /** Explicit "Detener Ruta": end the driver's open session now. */
  async stop(driverId: number): Promise<void> {
    await this.sessionsRepo.update(
      { driver: { id: driverId }, endedAt: IsNull() },
      { endedAt: new Date() },
    );
  }

  /** Closes open sessions that have gone silent, ending them at last activity. */
  async sweepInactive(): Promise<void> {
    const cutoff = new Date(Date.now() - INACTIVITY_LIMIT_MS);
    const stale = await this.sessionsRepo.find({
      where: { endedAt: IsNull(), lastActivityAt: LessThan(cutoff) },
    });
    for (const session of stale) {
      session.endedAt = session.lastActivityAt;
    }
    if (stale.length) {
      await this.sessionsRepo.save(stale);
      this.logger.log(`Auto-closed ${stale.length} inactive route session(s)`);
    }
  }

  private async closeStaleForDriver(driverId: number): Promise<void> {
    const cutoff = new Date(Date.now() - INACTIVITY_LIMIT_MS);
    await this.sessionsRepo
      .createQueryBuilder()
      .update(RouteSession)
      .set({ endedAt: () => 'last_activity_at' })
      .where('driver_id = :driverId AND ended_at IS NULL AND last_activity_at < :cutoff', {
        driverId,
        cutoff,
      })
      .execute();
  }

  /** Per-driver cumulative total + session history for the admin view. */
  async getSummaries(driverId?: number): Promise<IRouteSessionSummary[]> {
    const sessions = await this.sessionsRepo.find({
      where: driverId ? { driver: { id: driverId } } : {},
      relations: ['driver', 'route'],
      order: { startedAt: 'DESC' },
    });

    const byDriver = new Map<number, IRouteSessionSummary>();
    for (const s of sessions) {
      if (!s.driver) continue;
      const active = s.endedAt === null;
      const endMs = (s.endedAt ?? new Date()).getTime();
      const durationSeconds = Math.max(0, Math.floor((endMs - s.startedAt.getTime()) / 1000));

      let entry = byDriver.get(s.driver.id);
      if (!entry) {
        entry = { driverId: s.driver.id, driverName: s.driver.name, totalSeconds: 0, sessions: [] };
        byDriver.set(s.driver.id, entry);
      }
      entry.totalSeconds += durationSeconds;
      entry.sessions.push({
        id: s.id,
        routeName: s.route?.name ?? null,
        startedAt: s.startedAt.toISOString(),
        endedAt: s.endedAt ? s.endedAt.toISOString() : null,
        durationSeconds,
        active,
      });
    }

    return [...byDriver.values()].sort((a, b) => b.totalSeconds - a.totalSeconds);
  }
}

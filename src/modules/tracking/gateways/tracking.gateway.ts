import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { TrackingService } from '../services/tracking.service';
import { RouteSessionService } from '../services/route-session.service';
import { TrucksService } from '../../trucks/services/trucks.service';
import { SchedulesService } from '../../schedules/services/schedules.service';
import { GpsPositionInput } from '../dtos/inputs/gps-position.input';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { UserRole } from '../../../common/enums/user-role.enum';
import { WeeklySchedule } from '../../schedules/entities/weekly-schedule.entity';
import {
  IDriverClientData,
  IDriverRouteSegment,
  IRouteStartedEvent,
  ITruckPositionEvent,
} from '../interfaces/tracking.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';

/** Admin dashboards join per-tenant rooms so a municipality only sees its own trucks. */
const adminRoom = (tenantId: number): string => `tenant:${tenantId}:admin`;

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/tracking' })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly trackingService: TrackingService,
    private readonly routeSessionService: RouteSessionService,
    private readonly trucksService: TrucksService,
    private readonly schedulesService: SchedulesService,
    private readonly jwtService: JwtService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const rawToken = (client.handshake.auth?.token ?? client.handshake.headers?.authorization) as
        | string
        | undefined;

      if (!rawToken) {
        client.disconnect();
        return;
      }

      const token = rawToken.replace('Bearer ', '');
      const payload = this.jwtService.verify<IJwtPayload>(token);

      // Pre-multi-tenant JWTs have no tenantId; force those clients to re-login
      // instead of letting them write rows without a tenant.
      if (payload.tenantId == null) {
        this.logger.warn(`Rejecting socket with legacy token (no tenantId): user ${payload.sub}`);
        client.disconnect();
        return;
      }

      client.data = { user: payload } satisfies IDriverClientData;

      if (payload.role === UserRole.ADMIN) {
        await client.join(adminRoom(payload.tenantId));
        this.logger.log(`Admin connected: user ${payload.sub} (tenant ${payload.tenantId})`);
      } else {
        this.logger.log(`Driver connected: user ${payload.sub} (tenant ${payload.tenantId})`);
        await this.tenantContext.runWith(payload.tenantId, () =>
          this.resumeOpenSession(client, payload),
        );
      }
    } catch {
      client.disconnect();
    }
  }

  /**
   * If a driver reconnects (page reload, dropped signal) while a session is
   * still open, restore route context and re-emit `route-started` with the
   * ORIGINAL `startedAt` so the client timer resumes at the correct elapsed
   * time instead of restarting from zero.
   */
  private async resumeOpenSession(client: Socket, user: IJwtPayload): Promise<void> {
    const session = await this.routeSessionService.findOpenForDriver(user.sub);
    if (!session) return;

    const truck = await this.trucksService.findByDriverId(user.sub);
    if (!truck) return;
    const schedule = await this.schedulesService.findForToday(truck.id);
    if (!schedule) return;

    client.data = {
      user,
      truckId: truck.id,
      routeId: schedule.route.id,
      sessionId: session.id,
    } satisfies IDriverClientData;

    client.emit('route-started', {
      truckId: truck.id,
      routeId: schedule.route.id,
      routeName: schedule.route.name,
      startedAt: session.startedAt.toISOString(),
      segments: this.mapSegments(schedule),
    } satisfies IRouteStartedEvent);
    this.logger.log(`Resumed open session ${session.id} for driver ${user.sub}`);
  }

  private mapSegments(schedule: WeeklySchedule): IDriverRouteSegment[] {
    // The driver app cannot call the ADMIN-only routes API, so ship the route
    // geometry (ordered start→end) alongside the start event for the map.
    return [...(schedule.route.segments ?? [])]
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .map((s) => ({
        streetName: s.streetName,
        startLatitude: s.startLatitude,
        startLongitude: s.startLongitude,
        endLatitude: s.endLatitude,
        endLongitude: s.endLongitude,
        path: s.path,
      }));
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as IDriverClientData;
    if (data?.truckId) {
      this.server
        .to(adminRoom(data.user.tenantId))
        .emit('truck-offline', { truckId: data.truckId });
    }
  }

  @SubscribeMessage('start-route')
  async handleStartRoute(
    @ConnectedSocket() client: Socket,
  ): Promise<{ event: string; data: IRouteStartedEvent | string }> {
    const data = client.data as IDriverClientData;

    if (data.user.role !== UserRole.DRIVER) {
      return { event: 'error', data: 'Only drivers can start a route' };
    }

    return this.tenantContext.runWith(data.user.tenantId, () => this.startRoute(client, data));
  }

  private async startRoute(
    client: Socket,
    data: IDriverClientData,
  ): Promise<{ event: string; data: IRouteStartedEvent | string }> {
    const truck = await this.trucksService.findByDriverId(data.user.sub);
    if (!truck) return { event: 'error', data: 'No active truck assigned to this driver' };

    const schedule = await this.schedulesService.findForToday(truck.id);
    if (!schedule) return { event: 'error', data: 'No route scheduled for today' };

    const session = await this.routeSessionService.startOrResume(
      data.user.sub,
      truck.id,
      schedule.route.id,
    );

    client.data = {
      ...data,
      truckId: truck.id,
      routeId: schedule.route.id,
      sessionId: session.id,
    } satisfies IDriverClientData;

    this.logger.log(
      `Driver ${data.user.sub} started route "${schedule.route.name}" with truck ${truck.id} (session ${session.id})`,
    );
    return {
      event: 'route-started',
      data: {
        truckId: truck.id,
        routeId: schedule.route.id,
        routeName: schedule.route.name,
        startedAt: session.startedAt.toISOString(),
        segments: this.mapSegments(schedule),
      },
    };
  }

  @SubscribeMessage('gps-update')
  async handleGpsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() position: GpsPositionInput,
  ): Promise<void> {
    const data = client.data as IDriverClientData;
    const { truckId, routeId, sessionId } = data;
    if (!truckId || !routeId) return;

    await this.tenantContext.runWith(data.user.tenantId, async () => {
      if (sessionId) {
        await this.routeSessionService
          .recordActivity(sessionId)
          .catch((err) =>
            this.logger.error(`Failed to record activity for session ${sessionId}`, err),
          );
      }

      const result = await this.trackingService
        .processGpsUpdate(truckId, routeId, position)
        .catch((err) => {
          this.logger.error(`GPS update failed for truck ${truckId}`, err);
          return null;
        });

      const event: ITruckPositionEvent = {
        truckId,
        routeId,
        latitude: position.latitude,
        longitude: position.longitude,
        segmentIndex: result?.segmentIndex ?? null,
        streetName: result?.streetName ?? null,
        timestamp: new Date().toISOString(),
      };

      this.server.to(adminRoom(data.user.tenantId)).emit('truck-position', event);
    });
  }

  @SubscribeMessage('stop-route')
  async handleStopRoute(@ConnectedSocket() client: Socket): Promise<void> {
    const data = client.data as IDriverClientData;
    if (data.truckId) {
      this.server
        .to(adminRoom(data.user.tenantId))
        .emit('truck-offline', { truckId: data.truckId });
      this.logger.log(`Driver ${data.user.sub} stopped route for truck ${data.truckId}`);
    }
    // Explicit stop ends the driving session (a mere disconnect does not, so the
    // timer keeps counting through short offline gaps).
    await this.tenantContext.runWith(data.user.tenantId, () =>
      this.routeSessionService
        .stop(data.user.sub)
        .catch((err) =>
          this.logger.error(`Failed to stop session for driver ${data.user.sub}`, err),
        ),
    );
    client.data = { user: data.user } satisfies IDriverClientData;
  }
}

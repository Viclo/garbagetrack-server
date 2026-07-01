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
import { TrucksService } from '../../trucks/services/trucks.service';
import { SchedulesService } from '../../schedules/services/schedules.service';
import { GpsPositionInput } from '../dtos/inputs/gps-position.input';
import { IJwtPayload } from '../../../common/interfaces/jwt-payload.interface';
import { UserRole } from '../../../common/enums/user-role.enum';

interface IDriverClientData {
  user: IJwtPayload;
  truckId?: number;
  routeId?: number;
}

interface IDriverRouteSegment {
  streetName: string;
  startLatitude: number;
  startLongitude: number;
  endLatitude: number;
  endLongitude: number;
  path: [number, number][] | null;
}

interface IRouteStartedEvent {
  truckId: number;
  routeId: number;
  routeName: string;
  segments: IDriverRouteSegment[];
}

interface ITruckPositionEvent {
  truckId: number;
  routeId: number;
  latitude: number;
  longitude: number;
  segmentIndex: number | null;
  streetName: string | null;
  timestamp: string;
}

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/tracking' })
export class TrackingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly trackingService: TrackingService,
    private readonly trucksService: TrucksService,
    private readonly schedulesService: SchedulesService,
    private readonly jwtService: JwtService,
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
      client.data = { user: payload } satisfies IDriverClientData;

      if (payload.role === UserRole.ADMIN) {
        await client.join('admin-dashboard');
        this.logger.log(`Admin connected: user ${payload.sub}`);
      } else {
        this.logger.log(`Driver connected: user ${payload.sub}`);
      }
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    const data = client.data as IDriverClientData;
    if (data?.truckId) {
      this.server.to('admin-dashboard').emit('truck-offline', { truckId: data.truckId });
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

    const truck = await this.trucksService.findByDriverId(data.user.sub);
    if (!truck) return { event: 'error', data: 'No active truck assigned to this driver' };

    const schedule = await this.schedulesService.findForToday(truck.id);
    if (!schedule) return { event: 'error', data: 'No route scheduled for today' };

    client.data = { ...data, truckId: truck.id, routeId: schedule.route.id };

    // The driver app cannot call the ADMIN-only routes API, so ship the route
    // geometry (ordered start→end) alongside the start event for the map.
    const segments: IDriverRouteSegment[] = [...(schedule.route.segments ?? [])]
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .map((s) => ({
        streetName: s.streetName,
        startLatitude: s.startLatitude,
        startLongitude: s.startLongitude,
        endLatitude: s.endLatitude,
        endLongitude: s.endLongitude,
        path: s.path,
      }));

    this.logger.log(
      `Driver ${data.user.sub} started route "${schedule.route.name}" with truck ${truck.id}`,
    );
    return {
      event: 'route-started',
      data: {
        truckId: truck.id,
        routeId: schedule.route.id,
        routeName: schedule.route.name,
        segments,
      },
    };
  }

  @SubscribeMessage('gps-update')
  async handleGpsUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() position: GpsPositionInput,
  ): Promise<void> {
    const { truckId, routeId } = client.data as IDriverClientData;
    if (!truckId || !routeId) return;

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

    this.server.to('admin-dashboard').emit('truck-position', event);
  }

  @SubscribeMessage('stop-route')
  handleStopRoute(@ConnectedSocket() client: Socket): void {
    const data = client.data as IDriverClientData;
    if (data.truckId) {
      this.server.to('admin-dashboard').emit('truck-offline', { truckId: data.truckId });
      this.logger.log(`Driver ${data.user.sub} stopped route for truck ${data.truckId}`);
    }
    client.data = { user: data.user } satisfies IDriverClientData;
  }
}

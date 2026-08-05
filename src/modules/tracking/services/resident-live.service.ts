import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ResidentsService } from '../../residents/services/residents.service';
import { RoutesService } from '../../routes/services/routes.service';
import { TenantsService } from '../../tenants/services/tenants.service';
import { SystemConfigService } from '../../system-config/services/system-config.service';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { RouteSessionService } from './route-session.service';
import { TrackingService } from './tracking.service';
import { ResidentLiveInput } from '../dtos/inputs/resident-live.input';
import {
  IDriverRouteSegment,
  IResidentLiveSession,
  IResidentLivePayload,
  RESIDENT_LIVE_TOKEN,
} from '../interfaces/tracking.interface';

/**
 * A collection route can run for hours, so the token has to outlive a short
 * session; the page asks for a fresh one whenever it reloads or reconnects.
 */
const TOKEN_TTL_SECONDS = 2 * 60 * 60;

/**
 * Lets a resident watch the truck coming down their own street (roadmap E4).
 *
 * Residents are not users: they hold no JWT, only the owner token their device
 * stored at registration. This exchanges that token — once, over HTTP — for a
 * short-lived one scoped to a single route, which is also how "only their
 * assigned route" is enforced: the token names one route id, and the socket
 * joins that room and no other.
 *
 * Lives in the tracking module because that is where the route session and the
 * last known position are. Residents cannot import the other way: the tracking
 * module already reaches residents through proximity.
 */
@Injectable()
export class ResidentLiveService {
  constructor(
    private readonly residentsService: ResidentsService,
    private readonly routesService: RoutesService,
    private readonly tenantsService: TenantsService,
    private readonly systemConfigService: SystemConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly routeSessionService: RouteSessionService,
    private readonly trackingService: TrackingService,
    private readonly jwtService: JwtService,
  ) {}

  async createSession(input: ResidentLiveInput, ownerToken: string): Promise<IResidentLiveSession> {
    const tenant = await this.tenantsService.findBySlug(input.tenantSlug);
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Municipio no encontrado o no está activo');
    }

    return this.tenantContext.runWith(tenant.id, async () => {
      const authorized = await this.residentsService.verifyOwnerToken(
        input.residentId,
        ownerToken,
      );
      if (!authorized) throw new ForbiddenException('No autorizado para ver esta ruta');

      const resident = await this.residentsService.findOne(input.residentId);
      if (!resident.isActive) {
        throw new ForbiddenException('Este registro está dado de baja');
      }
      if (resident.routeId == null) {
        // The out-of-zone case: there is no route to watch, and the PWA already
        // explains why on the registration screen.
        throw new NotFoundException('Todavía no tienes una ruta asignada');
      }

      const route = await this.routesService.findOne(resident.routeId);
      const session = await this.routeSessionService.findOpenForRoute(resident.routeId);

      // Paint the truck where it already is instead of leaving an empty map
      // until the next fix arrives — which, on a slow route, can be a minute.
      const positions = await this.trackingService.getLatestPositions();
      const latest = positions.find((p) => p.routeId === resident.routeId) ?? null;

      const payload: IResidentLivePayload = {
        typ: RESIDENT_LIVE_TOKEN,
        sub: resident.id,
        tenantId: tenant.id,
        routeId: resident.routeId,
      };

      return {
        token: this.jwtService.sign(payload, { expiresIn: TOKEN_TTL_SECONDS }),
        expiresInSeconds: TOKEN_TTL_SECONDS,
        routeId: route.id,
        routeName: route.name,
        segments: this.mapSegments(route.segments ?? []),
        home: { latitude: resident.latitude, longitude: resident.longitude },
        homeOffsetM: resident.routeOffsetM,
        avgSpeedKmh: await this.systemConfigService.getAvgTruckSpeedKmh(),
        active: session != null,
        startedAt: session?.startedAt.toISOString() ?? null,
        lastPosition:
          session && latest
            ? {
                truckId: latest.truckId,
                routeId: resident.routeId,
                latitude: latest.latitude,
                longitude: latest.longitude,
                segmentIndex: latest.segmentIndex,
                streetName: latest.streetName,
                timestamp: new Date(latest.timestamp).toISOString(),
              }
            : null,
      };
    });
  }

  /** Route geometry in travel order — the resident cannot call the admin API for it. */
  private mapSegments(
    segments: Array<{
      segmentIndex: number;
      streetName: string;
      startLatitude: number;
      startLongitude: number;
      endLatitude: number;
      endLongitude: number;
      path?: [number, number][] | null;
    }>,
  ): IDriverRouteSegment[] {
    return [...segments]
      .sort((a, b) => a.segmentIndex - b.segmentIndex)
      .map((s) => ({
        streetName: s.streetName,
        startLatitude: s.startLatitude,
        startLongitude: s.startLongitude,
        endLatitude: s.endLatitude,
        endLongitude: s.endLongitude,
        path: s.path ?? null,
      }));
  }
}

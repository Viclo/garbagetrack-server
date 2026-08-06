import { localDayLabel } from '../../../common/utils/local-time.util';

/**
 * A reason "Iniciar ruta" cannot proceed, written for the driver who will read
 * it on their phone.
 *
 * Two entry points start a route — the HTTP endpoint used by the Android app
 * and the Socket.IO gateway used by the web driver view — and a driver must not
 * get two different explanations for the same missing setup, so both ask this
 * for the answer. `code` is what clients branch on; the wording can change
 * freely without breaking them.
 */
export interface IRouteStartProblem {
  code:
    | 'NO_TRUCK_ASSIGNED'
    | 'NO_SCHEDULE_TODAY'
    | 'ROUTE_INACTIVE'
    | 'ROUTE_WITHOUT_SEGMENTS';
  message: string;
}

/** Minimal shapes needed to judge startability, so this stays entity-free. */
interface StartableTruck {
  licensePlate: string;
}
interface StartableSchedule {
  route: { name: string; isActive: boolean; segments?: unknown[] };
}

export const NO_TRUCK_ASSIGNED: IRouteStartProblem = {
  code: 'NO_TRUCK_ASSIGNED',
  message:
    'Todavía no tienes un camión asignado. Pide al administrador del municipio que te asigne uno para poder iniciar la ruta.',
};

/**
 * The four setup steps a route needs, checked in the order an administrator
 * would complete them: a truck, a schedule for today, an active route, and a
 * route that has actually been drawn. Returns null when everything is in place.
 */
export function findRouteStartProblem(
  truck: StartableTruck | null,
  schedule: StartableSchedule | null,
): IRouteStartProblem | null {
  if (!truck) return NO_TRUCK_ASSIGNED;

  if (!schedule) {
    return {
      code: 'NO_SCHEDULE_TODAY',
      message:
        `Tu camión (${truck.licensePlate}) no tiene una ruta programada para hoy ${localDayLabel()}. ` +
        'Si deberías salir hoy, pide al administrador que registre el horario de este día.',
    };
  }

  if (!schedule.route.isActive) {
    return {
      code: 'ROUTE_INACTIVE',
      message: `La ruta "${schedule.route.name}" está desactivada. Pide al administrador que la active o que asigne otra ruta para hoy.`,
    };
  }

  if (!schedule.route.segments?.length) {
    return {
      code: 'ROUTE_WITHOUT_SEGMENTS',
      message: `La ruta "${schedule.route.name}" todavía no está dibujada en el mapa, así que no se puede avisar a los vecinos. Pide al administrador que la complete.`,
    };
  }

  return null;
}

import { Resident } from '../../residents/entities/resident.entity';
import { AlertStage } from '../../proximity/interfaces/proximity.interface';

/** One of the day's two alerts, already decided by the proximity engine (B8). */
export interface IStageAlertInput {
  resident: Resident;
  routeId: number;
  stage: AlertStage;
  /** Street the truck is on, named in the message; null when unknown. */
  streetName: string | null;
  /** Minutes until arrival, for the 'prepare' stage only. */
  etaMinutes: number | null;
}

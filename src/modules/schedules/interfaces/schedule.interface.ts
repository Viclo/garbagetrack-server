import { DayOfWeek } from '../../../common/enums/day-of-week.enum';
import { ITruck } from '../../trucks/interfaces/truck.interface';
import { IRoute } from '../../routes/interfaces/route.interface';

export interface IWeeklySchedule {
  id: number;
  truck: Pick<ITruck, 'id' | 'name'>;
  route: Pick<IRoute, 'id' | 'name'>;
  dayOfWeek: DayOfWeek;
  createdAt: Date;
}

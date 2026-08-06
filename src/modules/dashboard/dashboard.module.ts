import { Module } from '@nestjs/common';
import { DashboardController } from './controllers/dashboard.controller';
import { DashboardService } from './services/dashboard.service';
import { SystemConfigModule } from '../system-config/system-config.module';
import { NotificationsModule } from '../notifications/notifications.module';

/**
 * Read-only aggregation over every other module's tables. It owns no entities
 * and writes nothing, which is why it can query across them directly instead of
 * pulling half the app's services into one constructor.
 */
@Module({
  imports: [SystemConfigModule, NotificationsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}

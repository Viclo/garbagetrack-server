import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
// web-push is CommonJS and the project does not set esModuleInterop, so a
// default import resolves to `.default` (undefined) at runtime — use namespace.
import * as webpush from 'web-push';
import {
  IPushPayload,
  IPushSendResult,
  IPushSubscription,
} from '../interfaces/push.interface';

/**
 * Only file in the codebase that imports `web-push`. Everything else depends on
 * this service (mirrors the ILlmClient/Gemini and old WhatsApp seams). Sends a
 * single Web Push message via VAPID; callers handle persistence and pruning.
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly configured: boolean;

  constructor(config: ConfigService) {
    const publicKey = config.get<string>('webpush.publicKey');
    const privateKey = config.get<string>('webpush.privateKey');
    const subject = config.get<string>('webpush.subject') ?? 'mailto:soporte@garbagetrack.app';

    if (publicKey && privateKey) {
      webpush.setVapidDetails(subject, publicKey, privateKey);
      this.configured = true;
    } else {
      this.configured = false;
      this.logger.warn('VAPID keys not set — Web Push is disabled (sends return "skipped")');
    }
  }

  async send(subscription: IPushSubscription, payload: IPushPayload): Promise<IPushSendResult> {
    if (!this.configured) return { status: 'skipped', statusCode: null };

    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
      );
      return { status: 'sent', statusCode: 201 };
    } catch (error) {
      const statusCode = error instanceof webpush.WebPushError ? error.statusCode : null;
      // 404/410 = subscription no longer exists; the caller prunes it (A4).
      this.logger.error(
        `Web Push send failed (endpoint ${subscription.endpoint.slice(0, 40)}…) — ` +
          `status ${statusCode ?? 'n/a'}`,
      );
      return { status: 'failed', statusCode };
    }
  }
}

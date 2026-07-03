import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  RawBodyRequest,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'node:crypto';

/**
 * Verifies Meta's X-Hub-Signature-256 header: HMAC-SHA256 of the raw request
 * body keyed with the App Secret. Without this check anyone who discovers the
 * webhook URL can forge resident registrations/unsubscribes for any tenant.
 *
 * When META_APP_SECRET is not configured the guard lets requests through and
 * warns, so deployments keep working until the secret is provisioned.
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  private readonly logger = new Logger(WebhookSignatureGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const appSecret = this.configService.get<string>('whatsapp.appSecret');
    if (!appSecret) {
      this.logger.warn('META_APP_SECRET is not set — webhook signature verification is DISABLED');
      return true;
    }

    const request = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const signature = request.header('x-hub-signature-256');

    if (!signature || !request.rawBody) {
      this.logger.warn(
        `Webhook rejected: ${signature ? 'raw body unavailable' : 'missing X-Hub-Signature-256 header'}`,
      );
      throw new ForbiddenException('Invalid webhook signature');
    }

    const expected =
      'sha256=' + crypto.createHmac('sha256', appSecret).update(request.rawBody).digest('hex');
    const received = Buffer.from(signature);
    const computed = Buffer.from(expected);

    if (received.length !== computed.length || !crypto.timingSafeEqual(received, computed)) {
      this.logger.warn('Webhook rejected: signature mismatch');
      throw new ForbiddenException('Invalid webhook signature');
    }

    return true;
  }
}

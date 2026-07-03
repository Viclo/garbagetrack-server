import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../services/whatsapp-webhook.service';
import { WebhookSignatureGuard } from '../guards/webhook-signature.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { IWhatsAppWebhookPayload } from '../interfaces/whatsapp-message.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { TenantsService, DEFAULT_TENANT_SLUG } from '../../tenants/services/tenants.service';

@ApiTags('whatsapp-webhook')
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly webhookService: WhatsappWebhookService,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantsService: TenantsService,
  ) {}

  @Public()
  @Get()
  @ApiExcludeEndpoint()
  verifyWebhook(
    @Query('hub.mode') mode: string,
    @Query('hub.challenge') challenge: string,
    @Query('hub.verify_token') verifyToken: string,
    @Res() res: Response,
  ): void {
    const expectedToken = this.configService.get<string>('whatsapp.webhookVerifyToken');

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('WhatsApp webhook verified');
      res.status(HttpStatus.OK).send(challenge);
    } else {
      res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    }
  }

  @Public()
  @Post()
  @UseGuards(WebhookSignatureGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming WhatsApp messages from Meta' })
  async receiveMessage(@Body() payload: IWhatsAppWebhookPayload): Promise<string> {
    let handled = 0;
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const { messages, contacts, metadata } = change.value;
        if (!messages?.length) continue;

        // One Meta webhook serves every municipality: the business number that
        // received the message (phone_number_id) identifies the tenant.
        const tenantId = await this.resolveTenantId(metadata?.phone_number_id);
        if (tenantId == null) {
          this.logger.warn(
            `No tenant matches phone_number_id=${metadata?.phone_number_id ?? 'n/a'} — dropping ${messages.length} message(s)`,
          );
          continue;
        }

        for (const message of messages) {
          this.logger.log(
            `Incoming WhatsApp message type="${message.type}" from=${message.from} tenant=${tenantId}`,
          );
          const contact = contacts?.find((c) => c.wa_id === message.from);
          const contactName = contact?.profile.name ?? 'Vecino/a';
          await this.tenantContext.runWith(tenantId, () =>
            this.webhookService.handleIncomingMessage(message, contactName),
          );
          handled += 1;
        }
      }
    }
    if (handled === 0) {
      // Status callbacks (sent/delivered/read) and other non-message events land here.
      this.logger.debug('Webhook received with no inbound messages to process');
    }
    return 'EVENT_RECEIVED';
  }

  /**
   * Tenant owning the receiving business number; falls back to the default
   * tenant when no tenant has claimed the number (single-tenant deployments
   * that still use the WHATSAPP_* env credentials).
   */
  private async resolveTenantId(phoneNumberId: string | undefined): Promise<number | null> {
    if (phoneNumberId) {
      const tenant = await this.tenantsService.findByWaPhoneNumberId(phoneNumberId);
      if (tenant?.isActive) return tenant.id;
    }
    const fallback = await this.tenantsService.findBySlug(DEFAULT_TENANT_SLUG);
    return fallback?.isActive ? fallback.id : null;
  }
}

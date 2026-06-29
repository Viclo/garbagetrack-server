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
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { WhatsappWebhookService } from '../services/whatsapp-webhook.service';
import { Public } from '../../../common/decorators/public.decorator';
import { IWhatsAppWebhookPayload } from '../interfaces/whatsapp-message.interface';

@ApiTags('whatsapp-webhook')
@Controller('whatsapp/webhook')
export class WhatsappWebhookController {
  private readonly logger = new Logger(WhatsappWebhookController.name);

  constructor(
    private readonly webhookService: WhatsappWebhookService,
    private readonly configService: ConfigService,
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
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive incoming WhatsApp messages from Meta' })
  async receiveMessage(@Body() payload: IWhatsAppWebhookPayload): Promise<string> {
    let handled = 0;
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const { messages, contacts } = change.value;
        if (!messages?.length) continue;

        for (const message of messages) {
          this.logger.log(`Incoming WhatsApp message type="${message.type}" from=${message.from}`);
          const contact = contacts?.find((c) => c.wa_id === message.from);
          const contactName = contact?.profile.name ?? 'Vecino/a';
          await this.webhookService.handleIncomingMessage(message, contactName);
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
}

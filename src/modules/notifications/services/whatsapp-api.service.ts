import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IWhatsAppApiResponse, ITemplateComponent } from '../interfaces/whatsapp-api.interface';
import { IWhatsAppMessageResult } from '../interfaces/notification.interface';

@Injectable()
export class WhatsAppApiService {
  private readonly logger = new Logger(WhatsAppApiService.name);
  private readonly baseUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;
  private readonly apiVersion: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.baseUrl =
      this.configService.get<string>('whatsapp.apiBaseUrl') ?? 'https://graph.facebook.com';
    this.phoneNumberId = this.configService.get<string>('whatsapp.phoneNumberId') ?? '';
    this.accessToken = this.configService.get<string>('whatsapp.accessToken') ?? '';
    this.apiVersion = this.configService.get<string>('whatsapp.apiVersion') ?? 'v19.0';
  }

  async sendTemplateMessage(
    to: string,
    templateName: string,
    bodyParams: string[],
  ): Promise<IWhatsAppMessageResult> {
    const components: ITemplateComponent[] = bodyParams.length
      ? [{ type: 'body', parameters: bodyParams.map((text) => ({ type: 'text' as const, text })) }]
      : [];

    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'es' },
        components,
      },
    });
  }

  /**
   * Resolves the WhatsApp business number tied to the configured credentials by
   * querying the phone-number node. This is the number residents must message, so
   * the registration QR is always built from Meta — never a manually typed value.
   */
  async getBusinessPhone(): Promise<{
    displayPhoneNumber: string;
    verifiedName: string | null;
  } | null> {
    if (!this.phoneNumberId || !this.accessToken) return null;

    const url = `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}?fields=display_phone_number,verified_name`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ display_phone_number?: string; verified_name?: string }>(url, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }),
      );
      const displayPhoneNumber = response.data.display_phone_number;
      if (!displayPhoneNumber) return null;
      return { displayPhoneNumber, verifiedName: response.data.verified_name ?? null };
    } catch (error) {
      this.logger.error('Failed to fetch WhatsApp business phone number', error);
      return null;
    }
  }

  async sendTextMessage(to: string, body: string): Promise<IWhatsAppMessageResult> {
    return this.post({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body, preview_url: false },
    });
  }

  private async post(payload: Record<string, unknown>): Promise<IWhatsAppMessageResult> {
    const url = `${this.baseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;
    try {
      const response = await firstValueFrom(
        this.httpService.post<IWhatsAppApiResponse>(url, payload, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        }),
      );
      return { messageId: response.data.messages[0]?.id ?? '', status: 'sent' };
    } catch (error) {
      this.logger.error('WhatsApp API call failed', error);
      return { messageId: '', status: 'failed' };
    }
  }
}

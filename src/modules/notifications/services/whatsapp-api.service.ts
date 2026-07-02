import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';
import { IWhatsAppApiResponse, ITemplateComponent } from '../interfaces/whatsapp-api.interface';
import { IWhatsAppMessageResult } from '../interfaces/notification.interface';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import { TenantsService } from '../../tenants/services/tenants.service';
import { IWhatsappCredentials } from '../../tenants/interfaces/tenant.interface';

@Injectable()
export class WhatsAppApiService {
  private readonly logger = new Logger(WhatsAppApiService.name);
  private readonly baseUrl: string;
  private readonly apiVersion: string;
  /** Env credentials — fallback for tenants without their own Meta number. */
  private readonly envPhoneNumberId: string;
  private readonly envAccessToken: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantsService: TenantsService,
  ) {
    this.baseUrl =
      this.configService.get<string>('whatsapp.apiBaseUrl') ?? 'https://graph.facebook.com';
    this.envPhoneNumberId = this.configService.get<string>('whatsapp.phoneNumberId') ?? '';
    this.envAccessToken = this.configService.get<string>('whatsapp.accessToken') ?? '';
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

  async getBusinessPhone(): Promise<{
    displayPhoneNumber: string;
    verifiedName: string | null;
  } | null> {
    const credentials = await this.resolveCredentials();
    if (!credentials) return null;

    const url = `${this.baseUrl}/${this.apiVersion}/${credentials.phoneNumberId}?fields=display_phone_number,verified_name`;
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ display_phone_number?: string; verified_name?: string }>(url, {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        }),
      );
      const displayPhoneNumber = response.data.display_phone_number;
      if (!displayPhoneNumber) {
        this.logger.warn(
          `WhatsApp phone node returned no display_phone_number: ${JSON.stringify(response.data)}`,
        );
        return null;
      }
      return { displayPhoneNumber, verifiedName: response.data.verified_name ?? null };
    } catch (error) {
      const axiosError = error as AxiosError;
      this.logger.error(
        `Failed to fetch WhatsApp business phone number (GET ${this.apiVersion}/${credentials.phoneNumberId}) — ` +
          `status ${axiosError.response?.status ?? 'n/a'}: ${JSON.stringify(axiosError.response?.data ?? axiosError.message)}`,
      );
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

  /**
   * Credentials for the CURRENT tenant: its own Meta number when configured,
   * otherwise the WHATSAPP_* env credentials (pre-multi-tenant behaviour).
   */
  private async resolveCredentials(): Promise<IWhatsappCredentials | null> {
    const tenantId = this.tenantContext.tenantIdOrNull;
    if (tenantId != null) {
      const tenant = await this.tenantsService.findById(tenantId);
      if (tenant?.waPhoneNumberId && tenant.waAccessToken) {
        return { phoneNumberId: tenant.waPhoneNumberId, accessToken: tenant.waAccessToken };
      }
    }
    if (this.envPhoneNumberId && this.envAccessToken) {
      return { phoneNumberId: this.envPhoneNumberId, accessToken: this.envAccessToken };
    }
    this.logger.warn(
      `WhatsApp credentials missing for tenant ${tenantId ?? 'n/a'} and no env fallback is set`,
    );
    return null;
  }

  private async post(payload: Record<string, unknown>): Promise<IWhatsAppMessageResult> {
    const credentials = await this.resolveCredentials();
    if (!credentials) return { messageId: '', status: 'failed' };

    const url = `${this.baseUrl}/${this.apiVersion}/${credentials.phoneNumberId}/messages`;
    try {
      const response = await firstValueFrom(
        this.httpService.post<IWhatsAppApiResponse>(url, payload, {
          headers: { Authorization: `Bearer ${credentials.accessToken}` },
        }),
      );
      return { messageId: response.data.messages[0]?.id ?? '', status: 'sent' };
    } catch (error) {
      this.logger.error('WhatsApp API call failed', error);
      return { messageId: '', status: 'failed' };
    }
  }
}

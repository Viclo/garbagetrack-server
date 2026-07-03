import { Injectable, Logger } from '@nestjs/common';
import { ResidentsService } from '../../residents/services/residents.service';
import { WhatsAppApiService } from '../../notifications/services/whatsapp-api.service';
import {
  IWhatsAppMessage,
  IWhatsAppTextMessage,
  IWhatsAppLocationMessage,
} from '../interfaces/whatsapp-message.interface';

@Injectable()
export class WhatsappWebhookService {
  private readonly logger = new Logger(WhatsappWebhookService.name);

  // Tracks phones that have been asked to share their location (TTL: 10 min)
  private readonly pendingRegistrations = new Map<string, number>();
  private readonly PENDING_TTL_MS = 10 * 60 * 1000;

  constructor(
    private readonly residentsService: ResidentsService,
    private readonly whatsAppApiService: WhatsAppApiService,
  ) {}

  /** `contactName` is the WhatsApp profile name from the webhook payload; null when absent. */
  async handleIncomingMessage(
    message: IWhatsAppMessage,
    contactName: string | null,
  ): Promise<void> {
    const phoneNumber = message.from;
    this.cleanExpiredPending();

    try {
      if (this.isUnregisterCommand(message)) {
        await this.handleUnregister(phoneNumber);
        return;
      }

      if (message.type === 'location') {
        await this.handleLocationMessage(
          message as IWhatsAppLocationMessage,
          phoneNumber,
          contactName,
        );
        return;
      }

      await this.handleTextMessage(message as IWhatsAppTextMessage, phoneNumber, contactName);
    } catch (error) {
      this.logger.error(`Error handling message from ${phoneNumber}`, error);
    }
  }

  private async handleUnregister(phoneNumber: string): Promise<void> {
    await this.residentsService.deactivate(phoneNumber);
    this.pendingRegistrations.delete(phoneNumber);
    await this.whatsAppApiService.sendTextMessage(
      phoneNumber,
      '✅ Te has dado de baja exitosamente. Ya no recibirás alertas del camión basurero.\n\nEnvía cualquier mensaje para registrarte nuevamente.',
    );
  }

  private async handleLocationMessage(
    message: IWhatsAppLocationMessage,
    phoneNumber: string,
    contactName: string | null,
  ): Promise<void> {
    const { latitude, longitude } = message.location;
    const displayName = contactName ?? 'Vecino/a';
    this.logger.log(`Location received from ${phoneNumber}: ${latitude}, ${longitude}`);

    try {
      // Store the real profile name (null stays null — never the display fallback).
      const resident = await this.residentsService.create(
        phoneNumber,
        latitude,
        longitude,
        contactName,
      );
      this.pendingRegistrations.delete(phoneNumber);

      if (!resident.route) {
        // Stored, but no active route covers this location yet — don't claim success.
        this.logger.warn(
          `Resident ${phoneNumber} stored but no active route matched their location`,
        );
        await this.whatsAppApiService.sendTextMessage(
          phoneNumber,
          `📍 Recibimos y guardamos tu ubicación, ${displayName}. Por ahora no hay una ruta de recolección activa en tu zona; te avisaremos en cuanto esté disponible. 🗑️`,
        );
        return;
      }

      await this.whatsAppApiService.sendTextMessage(
        phoneNumber,
        `✅ ¡Registro exitoso, ${displayName}!\n\nRecibirás una alerta cuando el camión basurero esté cerca de tu dirección. 🗑️\n\nEnvía *SALIR* en cualquier momento para cancelar las alertas.`,
      );
      this.logger.log(`Resident registered: ${phoneNumber} (${latitude}, ${longitude})`);
    } catch (error) {
      // Previously swallowed — log the real cause so storage failures are visible.
      this.logger.error(
        `Failed to register resident ${phoneNumber}`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.whatsAppApiService.sendTextMessage(
        phoneNumber,
        '❌ Hubo un error al registrarte. Por favor intenta nuevamente enviando tu ubicación.',
      );
    }
  }

  private async handleTextMessage(
    _message: IWhatsAppTextMessage,
    phoneNumber: string,
    contactName: string | null,
  ): Promise<void> {
    const displayName = contactName ?? 'Vecino/a';
    const existing = await this.residentsService.findByPhoneNumber(phoneNumber);

    if (existing?.isActive) {
      await this.whatsAppApiService.sendTextMessage(
        phoneNumber,
        `✅ ¡Hola ${displayName}! Ya estás registrado/a.\n\nRecibirás alertas cuando el camión esté cerca de tu dirección.\n\nEnvía *SALIR* para darte de baja.`,
      );
      return;
    }

    this.pendingRegistrations.set(phoneNumber, Date.now());
    await this.whatsAppApiService.sendTextMessage(
      phoneNumber,
      `¡Hola ${displayName}! 👋\n\nPara recibir alertas del *camión basurero*, por favor *comparte tu ubicación* 📍\n\n` +
        `Toca el clip 📎 → Ubicación → *Enviar mi ubicación actual*\n\n` +
        `Envía *SALIR* en cualquier momento para cancelar.`,
    );
  }

  private isUnregisterCommand(message: IWhatsAppMessage): boolean {
    if (message.type !== 'text') return false;
    return (message as IWhatsAppTextMessage).text.body.toUpperCase().trim() === 'SALIR';
  }

  private cleanExpiredPending(): void {
    const now = Date.now();
    for (const [phone, timestamp] of this.pendingRegistrations) {
      if (now - timestamp > this.PENDING_TTL_MS) {
        this.pendingRegistrations.delete(phone);
      }
    }
  }
}

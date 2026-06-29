export interface IWhatsAppContact {
  profile: { name: string };
  wa_id: string;
}

export interface IWhatsAppTextMessage {
  type: 'text';
  text: { body: string };
  from: string;
  id: string;
  timestamp: string;
}

export interface IWhatsAppLocationMessage {
  type: 'location';
  location: { latitude: number; longitude: number; name?: string; address?: string };
  from: string;
  id: string;
  timestamp: string;
}

export type IWhatsAppMessage = IWhatsAppTextMessage | IWhatsAppLocationMessage;

export interface IWhatsAppWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: IWhatsAppContact[];
        messages?: IWhatsAppMessage[];
      };
      field: string;
    }>;
  }>;
}

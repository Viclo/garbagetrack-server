export interface IWhatsAppApiMessage {
  id: string;
  message_status: string;
}

export interface IWhatsAppApiResponse {
  messaging_product: string;
  contacts: Array<{ input: string; wa_id: string }>;
  messages: IWhatsAppApiMessage[];
}

export interface ITemplateComponent {
  type: 'body' | 'header' | 'button';
  parameters: Array<{ type: 'text'; text: string }>;
}

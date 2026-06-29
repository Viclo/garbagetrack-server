export interface ISendNotificationParams {
  phoneNumber: string;
  currentStreetName: string;
  distanceBlocks: number;
}

export interface IWhatsAppMessageResult {
  messageId: string;
  status: 'sent' | 'failed';
}

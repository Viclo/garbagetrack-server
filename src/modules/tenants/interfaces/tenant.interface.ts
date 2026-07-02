export interface ITenant {
  id: number;
  slug: string;
  name: string;
  isActive: boolean;
  waPhoneNumberId: string | null;
  waAccessToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWhatsappCredentials {
  phoneNumberId: string;
  accessToken: string;
}

/** What the public resident page is allowed to see about a municipality. */
export interface IPublicTenant {
  name: string;
  contactPhone: string | null;
}

export interface ITenant {
  id: number;
  slug: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

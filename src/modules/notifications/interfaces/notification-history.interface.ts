/** One delivered (or attempted) alert, as the admin panel lists it. */
export interface INotificationHistoryEntry {
  id: number;
  /** Municipality-local calendar day the alert belonged to (YYYY-MM-DD). */
  sentAt: string;
  /** When the row was written — the only timestamp with a clock on it. */
  createdAt: string;
  /** 'prepare' (~20 min out) or 'arriving' (truck on the street). */
  stage: string;
  channel: string;
  /** 'sent' when at least one subscription accepted it, otherwise 'failed'. */
  messageStatus: string;
  routeId: number | null;
  routeName: string | null;
}

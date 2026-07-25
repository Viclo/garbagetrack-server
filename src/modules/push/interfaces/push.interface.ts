/**
 * A browser Web Push subscription — what `PushManager.subscribe()` yields on
 * the client, flattened to the columns we persist (roadmap A2). Independent of
 * the DeviceToken entity so WebPushService stays storage-agnostic.
 */
export interface IPushSubscription {
  endpoint: string;
  /** Client public key (base64url) from `subscription.keys.p256dh`. */
  p256dh: string;
  /** Client auth secret (base64url) from `subscription.keys.auth`. */
  auth: string;
}

/** Notification content delivered to the service worker as a JSON string. */
export interface IPushPayload {
  title: string;
  body: string;
  /** Optional arbitrary data (e.g. a deep link the SW opens on tap). */
  data?: Record<string, unknown>;
}

export type PushSendStatus = 'sent' | 'failed' | 'skipped';

export interface IPushSendResult {
  status: PushSendStatus;
  /**
   * HTTP status from the push service. 404/410 mean the subscription is gone
   * and should be pruned (roadmap A4). null when skipped or the error carried
   * no status.
   */
  statusCode: number | null;
}

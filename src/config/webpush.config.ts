import { registerAs } from '@nestjs/config';

/**
 * Web Push (VAPID) credentials. The public key is safe to expose to the
 * browser (the resident PWA subscribes with it); the private key never leaves
 * the server. Generate a pair with `npx web-push generate-vapid-keys`.
 * When unset, Web Push is disabled and WebPushService returns 'skipped'.
 */
export const webpushConfig = registerAs('webpush', () => ({
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  // `mailto:` or your site URL — push services use it to contact you about
  // problematic sends. Required by the VAPID spec.
  subject: process.env.VAPID_SUBJECT ?? 'mailto:soporte@garbagetrack.app',
}));

import { randomBytes, createHash, timingSafeEqual } from 'crypto';

/**
 * Owner tokens are the authorization key for resident self-service writes
 * (Option A): an unguessable secret the registering device holds, never the
 * phone number. We store only a SHA-256 hash — a 256-bit random token has no
 * usable structure to brute-force, so a fast hash is appropriate here (unlike
 * passwords, which need bcrypt).
 */

/** A fresh raw token, returned to the client exactly once at registration. */
export function generateOwnerToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Hash to persist alongside the resident. */
export function hashOwnerToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/** Constant-time check of a presented raw token against a stored hash. */
export function verifyOwnerToken(rawToken: string, storedHash: string): boolean {
  const presented = Buffer.from(hashOwnerToken(rawToken), 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  if (presented.length !== stored.length) return false;
  return timingSafeEqual(presented, stored);
}

/**
 * Bolivian phone numbers. The platform serves Bolivian municipalities only, so
 * the country code is implied and never typed by the resident — the PWA sends
 * the normalized E.164 form and this is the server-side check on it.
 *
 * Mobiles are 8 digits starting with 6 or 7 (Entel/Tigo/Viva). Landlines start
 * with 2/3/4 and are deliberately NOT accepted: the number is a contact label
 * for a person the municipality may need to reach about a pickup, and a
 * household landline is far more likely to be a typo than a real answer.
 */
export const BOLIVIAN_MOBILE_E164 = /^\+591[67]\d{7}$/;

export const BOLIVIAN_MOBILE_MESSAGE =
  'El teléfono debe ser un celular boliviano de 8 dígitos que empiece con 6 o 7';

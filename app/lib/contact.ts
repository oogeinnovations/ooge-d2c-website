// Shape and validation rules for the contact-us enquiry, shared by the form
// component and the `/api/contact` action so the two can't drift apart. Keep
// this module free of server-only code — it ends up in the client bundle.
import type {Rule} from '~/lib/validation';

export type ContactFormValues = {
  name: string;
  phone: string;
  email: string;
  company: string;
  city: string;
};

export const EMPTY_CONTACT: ContactFormValues = {
  name: '',
  phone: '',
  email: '',
  company: '',
  city: '',
};

export const CONTACT_RULES: Record<string, Rule> = {
  name: {label: 'Full name', required: true},
  phone: {
    label: 'WhatsApp number',
    required: true,
    pattern: /^[0-9+\-\s]{7,15}$/,
    message: 'Enter a valid phone number',
  },
  city: {label: 'City', required: true},
  email: {label: 'Email', email: true},
};

/**
 * Reduce a user-typed phone number to the digits-only, country-code-prefixed
 * form WhatsApp expects (e.g. "+91 99005 42440" → "919900542440").
 *
 * Returns null when the result can't be a real number, so the caller skips the
 * send rather than handing Netcore something it will reject.
 */
export function toWhatsAppNumber(
  input: string,
  defaultCountryCode = '91',
): string | null {
  const trimmed = input.trim();
  // "00" is the other common way to write an international prefix.
  const hadPlus = trimmed.startsWith('+') || trimmed.startsWith('00');
  let digits = trimmed.replace(/\D/g, '');

  if (trimmed.startsWith('00')) digits = digits.slice(2);

  // A bare 10-digit number is local, so prefix the default country code. If the
  // visitor already typed a country code (with + or by length) leave it alone —
  // guessing twice would corrupt a valid international number.
  if (!hadPlus && digits.length === 10) {
    digits = defaultCountryCode + digits;
  }

  // E.164 allows at most 15 digits; anything under 10 can't be a full number.
  if (digits.length < 10 || digits.length > 15) return null;

  return digits;
}

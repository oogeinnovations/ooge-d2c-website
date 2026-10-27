// Shape and validation for the B2B return request, shared by the form and the
// `/api/b2b-return` action so the two can't drift apart. Keep this module free
// of server-only code — it ends up in the client bundle.
import type {Rule} from '~/lib/validation';

/** Fixed list so the sheet stays filterable; "Other" asks for a short note. */
export const RETURN_REASONS = [
  'Defective / not working',
  'Damaged in transit',
  'Wrong item received',
  'Quantity mismatch',
  'Not as described',
  'No longer needed',
  'Other',
] as const;

export type ReturnItem = {
  name: string;
  qty: string;
  reason: string;
  /** Only used when reason is "Other". */
  note: string;
};

export type B2BReturnValues = {
  company: string;
  phone: string;
  whatsapp: string;
  pickupAddress: string;
  pincode: string;
  items: ReturnItem[];
};

export const MAX_ITEMS = 20;

export const EMPTY_RETURN: B2BReturnValues = {
  company: '',
  phone: '',
  whatsapp: '',
  pickupAddress: '',
  pincode: '',
  items: [{name: '', qty: '1', reason: '', note: ''}],
};

const PHONE = /^[0-9+\-\s]{7,15}$/;

/** Rules for the flat (non-item) fields. */
export const RETURN_RULES: Record<string, Rule> = {
  company: {label: 'Company name', required: true},
  phone: {
    label: 'Phone number',
    required: true,
    pattern: PHONE,
    message: 'Enter a valid phone number',
  },
  whatsapp: {
    label: 'WhatsApp number',
    required: true,
    pattern: PHONE,
    message: 'Enter a valid WhatsApp number',
  },
  pickupAddress: {label: 'Pickup address', required: true},
  pincode: {
    label: 'Pincode',
    required: true,
    pattern: /^[0-9]{6}$/,
    message: 'Enter a 6-digit pincode',
  },
};

/** The single string stored for an item, e.g. "Other: box was crushed". */
export function reasonText(item: {reason: string; note: string}): string {
  return item.reason === 'Other' ? `Other: ${item.note.trim()}` : item.reason;
}

/**
 * Validate the item rows. Errors are keyed `item-<index>-name` / `-qty` so the
 * form can show them under the right input. Returns {} when every row is fine.
 */
export function validateItems(items: ReturnItem[]): Record<string, string> {
  const errors: Record<string, string> = {};
  if (items.length === 0) errors.items = 'Add at least one item';
  if (items.length > MAX_ITEMS) errors.items = `Up to ${MAX_ITEMS} items`;
  items.forEach((item, i) => {
    if (!item.name.trim()) errors[`item-${i}-name`] = 'Item name is required';
    if (!(RETURN_REASONS as readonly string[]).includes(item.reason)) {
      errors[`item-${i}-reason`] = 'Choose a reason for this item';
    } else if (item.reason === 'Other' && !item.note.trim()) {
      errors[`item-${i}-note`] = 'Please describe the reason';
    }
    const qty = Number(item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 9999) {
      errors[`item-${i}-qty`] = 'Enter a quantity of 1 or more';
    }
  });
  return errors;
}

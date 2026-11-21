// Shape and validation for the B2B return request, shared by the form and the
// `/api/b2b-return` action so the two can't drift apart. Keep this module free
// of server-only code — it ends up in the client bundle.
import type {Rule} from '~/lib/validation';

/** Fixed list so the sheet stays filterable; "Other" asks for a short note. */
export const RETURN_REASONS = [
  'Defective / not working',
  'Damaged in transit',
  'Wrong item received',
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
  /** Parcel details the courier (Shipway) needs to book the pickup. */
  boxes: string;
  weight: string;
  items: ReturnItem[];
};

/** A photo of the packed boxes, already shrunk to a JPEG in the browser. */
export type BoxPhoto = {name: string; data: string};

/** 1 to 5 photos; each one is resized to at most 1600 px before upload. */
export const MIN_BOX_PHOTOS = 1;
export const MAX_BOX_PHOTOS = 5;
/** Base64 length ceiling per photo (about 1.5 MB of JPEG). */
export const MAX_PHOTO_CHARS = 2000000;

/**
 * There is no limit on the NUMBER of items; the sheet splits a return's item data
 * over as many cells as it needs. This is only a sanity ceiling on the request's
 * total size (several thousand ordinary items) so a runaway or malicious request
 * can't flood the sheet.
 */
export const MAX_ITEMS_JSON_CHARS = 600000;

export const EMPTY_RETURN: B2BReturnValues = {
  company: '',
  phone: '',
  whatsapp: '',
  pickupAddress: '',
  pincode: '',
  boxes: '',
  weight: '',
  items: [{name: '', qty: '1', reason: '', note: ''}],
};

const PHONE = /^[0-9+\-\s]{7,15}$/;

/** Rules for the flat (non-item) fields. */
export const RETURN_RULES: Record<string, Rule> = {
  company: {label: 'Store name', required: true},
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
  boxes: {
    label: 'Total boxes',
    required: true,
    pattern: /^[1-9][0-9]{0,2}$/,
    message: 'Enter the number of boxes (1 or more)',
  },
  weight: {
    label: 'Total weight',
    required: true,
    pattern: /^(?:[0-9]{1,4})(?:\.[0-9]{1,2})?$/,
    message: 'Enter the total weight in kg, e.g. 12.5',
  },
};

/** Check the box photos: errors keyed `photos`. */
export function validatePhotos(photos: BoxPhoto[]): Record<string, string> {
  if (photos.length < MIN_BOX_PHOTOS) return {photos: 'Add at least one photo of the packed boxes'};
  if (photos.length > MAX_BOX_PHOTOS) return {photos: `Add at most ${MAX_BOX_PHOTOS} photos`};
  return {};
}

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

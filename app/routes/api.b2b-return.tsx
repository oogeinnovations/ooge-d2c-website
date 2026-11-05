// POST /api/b2b-return — backend for the B2B returns form.
//
// Validates the request, assigns a return ID and appends it to the returns
// Google Sheet with status "Pending". Unlike the contact form, a failed write
// IS an error here: there's no second copy of the request anywhere, so telling
// the customer "received" when it wasn't would silently lose their return.
import {data} from 'react-router';
import type {Route} from './+types/api.b2b-return';
import {
  RETURN_RULES,
  MAX_ITEMS_JSON_CHARS,
  reasonText,
  validateItems,
} from '~/lib/b2bReturn';
import {validate} from '~/lib/validation';
import {newReturnId, storeReturn} from '~/lib/returns';

function clean(value: unknown, max = 200): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export async function action({request, context}: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return data({ok: false, error: 'Method not allowed'}, {status: 405});
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return data({ok: false, error: 'Invalid request body'}, {status: 400});
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const flat = {
    company: clean(raw.company, 160),
    phone: clean(raw.phone, 20),
    whatsapp: clean(raw.whatsapp, 20),
    pickupAddress: clean(raw.pickupAddress, 500),
    pincode: clean(raw.pincode, 6),
  };
  const rawItems = Array.isArray(raw.items) ? raw.items : [];

  // There is no cap on how MANY items, but they are stored in single sheet cells
  // (50,000 characters max), so a return that is too large overall has to be
  // split rather than silently failing. Checked before any per-item work.
  if (JSON.stringify(rawItems).length > MAX_ITEMS_JSON_CHARS) {
    return data(
      {
        ok: false,
        error:
          'This return has too many items to submit at once. Please split it into two requests.',
      },
      {status: 400},
    );
  }

  const items = rawItems
    .map((i) => {
      const item = (i ?? {}) as Record<string, unknown>;
      return {
        name: clean(item.name, 160),
        qty: clean(item.qty, 6),
        reason: clean(item.reason, 60),
        note: clean(item.note, 300),
      };
    });

  const fieldErrors = {...validate(flat, RETURN_RULES), ...validateItems(items)};
  if (Object.keys(fieldErrors).length) {
    return data(
      {ok: false, error: 'Please check the highlighted fields.', fieldErrors},
      {status: 400},
    );
  }

  const returnId = newReturnId();
  const stored = await storeReturn(context.env, {
    ...flat,
    returnId,
    submittedAt: new Date().toISOString(),
    items: items.map((i) => ({
      name: i.name,
      qty: Number(i.qty),
      reason: reasonText(i),
    })),
  });

  if (!stored.ok) {
    console.error('[b2b-return] not stored:', stored.reason, stored.detail);
    return data(
      {
        ok: false,
        error:
          'We could not save your request. Please try again, or WhatsApp us on +91 74838 30661.',
      },
      {status: 502},
    );
  }

  return data({ok: true, returnId});
}

export async function loader() {
  return data({ok: false, error: 'POST only'}, {status: 405});
}

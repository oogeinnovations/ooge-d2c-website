// POST /api/b2b-return — backend for the B2B returns form.
//
// Validates the request, assigns a return ID and appends it to the returns
// Google Sheet with status "Pending". Unlike the contact form, a failed write
// IS an error here: there's no second copy of the request anywhere, so telling
// the customer "received" when it wasn't would silently lose their return.
import {data} from 'react-router';
import type {Route} from './+types/api.b2b-return';
import {RETURN_RULES, MAX_ITEMS, validateItems} from '~/lib/b2bReturn';
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
    orderId: clean(raw.orderId, 60),
    pickupAddress: clean(raw.pickupAddress, 500),
    pincode: clean(raw.pincode, 6),
  };
  const items = (Array.isArray(raw.items) ? raw.items : [])
    .slice(0, MAX_ITEMS + 1)
    .map((i) => {
      const item = (i ?? {}) as Record<string, unknown>;
      return {name: clean(item.name, 160), qty: clean(item.qty, 6)};
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
    items: items.map((i) => ({name: i.name, qty: Number(i.qty)})),
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

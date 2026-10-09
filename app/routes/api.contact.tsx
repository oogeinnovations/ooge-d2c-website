// POST /api/contact — backend for the contact-us enquiry form.
//
// Two things happen, in this order:
//   1. A WhatsApp acknowledgement with the catalogue PDF is sent to the visitor.
//   2. The lead is appended to the Google Sheet, including whether step 1 worked.
//
// The send runs first so its outcome can be recorded in the same sheet row.
// Neither step can throw — a failure in either must not lose the enquiry or
// show the visitor an error for something we can still fix by hand.
//
// This route deliberately sends NO email. Enquiry mail belongs to the corporate
// gifting form (Web3Forms); contact submissions must stay out of that inbox.
import {data} from 'react-router';
import type {Route} from './+types/api.contact';
import {CONTACT_RULES, type ContactFormValues} from '~/lib/contact';
import {validate} from '~/lib/validation';
import {storeLead} from '~/lib/leads';
import {sendCatalogueOnWhatsApp} from '~/lib/whatsapp';

/** Trim and cap a field so one oversized value can't bloat the sheet. */
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
  const values: ContactFormValues = {
    name: clean(raw.name, 120),
    phone: clean(raw.phone, 20),
    email: clean(raw.email, 160),
    company: clean(raw.company, 160),
    city: clean(raw.city, 80),
  };

  // Re-run the same rules the form uses. Client validation is a convenience;
  // this is the one that counts, since anything can POST here.
  const fieldErrors = validate(values, CONTACT_RULES);
  if (Object.keys(fieldErrors).length) {
    return data(
      {ok: false, error: 'Please check the highlighted fields.', fieldErrors},
      {status: 400},
    );
  }

  const {env} = context;

  const ack = await sendCatalogueOnWhatsApp(env, {
    phone: values.phone,
    name: values.name,
  });

  const stored = await storeLead(env, {
    ...values,
    submittedAt: new Date().toISOString(),
    source: new URL(request.url).searchParams.get('source') || '/pages/contact',
    whatsappAck: ack.ok ? 'sent' : `failed: ${ack.detail}`,
  });

  if (!stored.ok) {
    // Surfaced in the Oxygen logs so a misconfigured or broken sheet webhook is
    // discoverable — the visitor still gets a success response, because from
    // their side the enquiry did go through.
    console.error('[contact] lead not stored:', stored.reason, stored.detail);
  }
  if (!ack.ok) {
    console.error('[contact] WhatsApp ack not sent:', ack.reason, ack.detail);
  }

  return data({ok: true, catalogueSent: ack.ok});
}

// Hitting /api/contact in a browser shouldn't render a blank route.
export async function loader() {
  return data({ok: false, error: 'POST only'}, {status: 405});
}

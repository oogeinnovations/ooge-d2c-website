// WhatsApp acknowledgement for contact-form enquiries, via Netcore CPaaS.
//
// Sends an approved media template whose header carries the catalogue PDF,
// fetched by WhatsApp from a public URL. Netcore's payload is its own shape —
// it is NOT Meta's Cloud API format, so don't port a `template.components[]`
// body onto it.
//
// API reference: https://cpaasdocs.netcorecloud.com/docs/whatsappapidoc/
// (The older `waapi.pepipost.com/api/v2/message/` host is the legacy form of
// this same endpoint.)

import {toWhatsAppNumber} from '~/lib/contact';

const ENDPOINT = 'https://cpaaswa.netcorecloud.net/api/v2/message/nc';
const TIMEOUT_MS = 8000;

export type WhatsAppAckResult =
  | {ok: true; messageId: string | null}
  | {
      ok: false;
      reason: 'not-configured' | 'invalid-number' | 'request-failed';
      detail: string;
    };

export type CatalogueRecipient = {
  /** As typed by the visitor; normalised to WhatsApp form before sending. */
  phone: string;
};

/**
 * Send the catalogue PDF to a contact-form enquirer on WhatsApp.
 *
 * Never throws: the caller records the outcome next to the lead and still shows
 * the visitor a success message, because a failed acknowledgement is something
 * the team can put right by hand.
 */
export async function sendCatalogueOnWhatsApp(
  env: Env,
  recipient: CatalogueRecipient,
): Promise<WhatsAppAckResult> {
  const apiKey = env.NETCORE_WA_API_KEY;
  const template = env.NETCORE_WA_TEMPLATE_NAME;
  const pdfUrl = env.CONTACT_CATALOGUE_PDF_URL;

  // Any of these missing means the integration hasn't been set up yet, which is
  // a normal state (e.g. local dev) rather than an error worth alarming about.
  if (!apiKey || !template || !pdfUrl) {
    return {
      ok: false,
      reason: 'not-configured',
      detail:
        'Set NETCORE_WA_API_KEY, NETCORE_WA_TEMPLATE_NAME and CONTACT_CATALOGUE_PDF_URL to enable WhatsApp acknowledgements',
    };
  }

  const to = toWhatsAppNumber(
    recipient.phone,
    env.CONTACT_DEFAULT_COUNTRY_CODE || '91',
  );
  if (!to) {
    return {
      ok: false,
      reason: 'invalid-number',
      detail: `Could not normalise "${recipient.phone}" to a WhatsApp number`,
    };
  }

  const payload = {
    message: [
      {
        recipient_whatsapp: to,
        recipient_type: 'individual',
        message_type: 'media_template',
        source: env.NETCORE_WA_SOURCE_ID ?? '',
        // Echoed back on the delivery webhook, so it doubles as a tag for
        // telling contact-form sends apart from campaign traffic.
        'x-apiheader': 'ooge-contact-form',
        type_media_template: {
          type: 'document',
          url: pdfUrl,
          filename: env.CONTACT_CATALOGUE_PDF_FILENAME || 'Ooge-Catalogue.pdf',
        },
        type_template: [
          {
            name: template,
            // The approved template (ooge_catalogue_share_delhiexpo) has a PDF
            // header and static body text — no {{n}} placeholders — so this is
            // empty. If the template ever gains body variables, add their values
            // here in order; Meta rejects the send when the counts don't match.
            attributes: [],
            language: {
              locale: env.NETCORE_WA_TEMPLATE_LANG || 'en',
              policy: 'deterministic',
            },
          },
        ],
      },
    ],
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const raw = await res.text();
    const body = safeJson(raw);

    if (!res.ok) {
      return {
        ok: false,
        reason: 'request-failed',
        detail: `Netcore returned ${res.status}: ${
          body?.message ?? raw.slice(0, 200)
        }`,
      };
    }

    // A 200 isn't sufficient on its own — Netcore signals rejection in the body.
    if (body?.status !== 'success') {
      return {
        ok: false,
        reason: 'request-failed',
        detail: body?.message ?? `Unexpected response: ${raw.slice(0, 200)}`,
      };
    }

    // Acceptance is not delivery: Netcore queues the message and reports the
    // real outcome asynchronously on its delivery webhook, which this store
    // doesn't consume. Check Netcore's Live Feed to confirm delivery.
    return {ok: true, messageId: body.data?.id ?? null};
  } catch (error) {
    return {
      ok: false,
      reason: 'request-failed',
      detail: error instanceof Error ? error.message : 'Unknown network error',
    };
  }
}

type NetcoreResponse = {
  status?: string;
  message?: string;
  data?: {id?: string};
};

function safeJson(raw: string): NetcoreResponse | null {
  try {
    return JSON.parse(raw) as NetcoreResponse;
  } catch {
    return null;
  }
}

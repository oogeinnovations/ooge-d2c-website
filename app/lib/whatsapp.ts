// WhatsApp acknowledgement for contact-form enquiries, via AiSensy.
//
// Triggers a Live "API Campaign" whose approved template has a document header
// carrying the catalogue PDF, fetched by WhatsApp from a public URL. The
// campaign (not this code) decides which template is sent, so the template can
// be swapped in the AiSensy dashboard without a deploy.
//
// API reference: https://faq.aisensy.com/how-to-setup-api-campaigns

import {toWhatsAppNumber} from '~/lib/contact';

const ENDPOINT = 'https://backend.aisensy.com/campaign/t1/api/v2';
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
  /** Shown as the contact name in AiSensy. */
  name?: string;
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
  const apiKey = env.AISENSY_API_KEY;
  const campaign = env.AISENSY_CONTACT_CAMPAIGN_NAME;
  const pdfUrl = env.CONTACT_CATALOGUE_PDF_URL;

  // Any of these missing means the integration hasn't been set up yet, which is
  // a normal state (e.g. local dev) rather than an error worth alarming about.
  if (!apiKey || !campaign || !pdfUrl) {
    return {
      ok: false,
      reason: 'not-configured',
      detail:
        'Set AISENSY_API_KEY, AISENSY_CONTACT_CAMPAIGN_NAME and CONTACT_CATALOGUE_PDF_URL to enable WhatsApp acknowledgements',
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
    apiKey,
    campaignName: campaign,
    destination: to,
    userName: recipient.name || 'Website visitor',
    source: 'ooge-contact-form',
    // The approved template has a PDF header and static body text — no {{n}}
    // placeholders — so this is empty. If the template ever gains body
    // variables, add their values here in order; Meta rejects the send when the
    // counts don't match.
    templateParams: [],
    media: {
      url: pdfUrl,
      filename: env.CONTACT_CATALOGUE_PDF_FILENAME || 'Ooge-Catalogue.pdf',
    },
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    const raw = await res.text();

    if (!res.ok) {
      return {
        ok: false,
        reason: 'request-failed',
        detail: `AiSensy returned ${res.status}: ${raw.slice(0, 200)}`,
      };
    }

    // Acceptance is not delivery: AiSensy queues the message and the real
    // outcome shows in its dashboard, which this store doesn't consume. Check
    // the AiSensy inbox/campaign report to confirm delivery.
    return {ok: true, messageId: safeJson(raw)?.submitted_message_id ?? null};
  } catch (error) {
    return {
      ok: false,
      reason: 'request-failed',
      detail: error instanceof Error ? error.message : 'Unknown network error',
    };
  }
}

function safeJson(raw: string): {submitted_message_id?: string} | null {
  try {
    return JSON.parse(raw) as {submitted_message_id?: string};
  } catch {
    return null;
  }
}

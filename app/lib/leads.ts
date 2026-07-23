// Contact-form lead capture.
//
// Oxygen (Cloudflare Workers) has no filesystem or database, so leads are
// appended to a Google Sheet through a small Apps Script web app that acts as
// the write endpoint. The script source lives in `scripts/contact-lead-sheet.gs`
// — deploy it, then put its /exec URL in `CONTACT_SHEET_WEBHOOK_URL`.
//
// NOTE: this flow deliberately sends no email. Enquiry mail is the corporate
// gifting form's job (Web3Forms); contact submissions must not reach that inbox.

/** A validated contact-form submission, ready to be written to the sheet. */
export type ContactLead = {
  name: string;
  phone: string;
  /** Optional — empty string when the visitor left it blank. */
  email: string;
  /** Optional — empty string when the visitor left it blank. */
  company: string;
  city: string;
  /** ISO-8601, stamped server-side so we don't trust the client's clock. */
  submittedAt: string;
  /** Page the enquiry came from, e.g. "/pages/contact". */
  source: string;
  /**
   * Outcome of the WhatsApp acknowledgement, recorded alongside the lead so the
   * team can see at a glance who did and didn't receive the catalogue. The send
   * is attempted before the write for exactly this reason.
   */
  whatsappAck: string;
};

export type StoreLeadResult =
  | {ok: true}
  | {ok: false; reason: 'not-configured' | 'request-failed'; detail: string};

const TIMEOUT_MS = 8000;

/**
 * Append a lead to the Google Sheet. Never throws — the caller decides how to
 * degrade, since a storage outage shouldn't lose the visitor's submission or
 * block the WhatsApp acknowledgement.
 */
export async function storeLead(
  env: Env,
  lead: ContactLead,
): Promise<StoreLeadResult> {
  const url = env.CONTACT_SHEET_WEBHOOK_URL;
  if (!url) {
    return {
      ok: false,
      reason: 'not-configured',
      detail: 'CONTACT_SHEET_WEBHOOK_URL is not set',
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      // Apps Script answers the /exec URL with a 302 to a googleusercontent.com
      // host that carries the real body; `redirect: 'follow'` is the default but
      // is spelled out here because the hop is load-bearing, not incidental.
      redirect: 'follow',
      body: JSON.stringify({token: env.CONTACT_SHEET_TOKEN ?? '', lead}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return {
        ok: false,
        reason: 'request-failed',
        detail: `Sheet webhook returned ${res.status}`,
      };
    }

    // The script replies {"ok":true} on success and {"ok":false,"error":"..."}
    // when the shared secret is wrong, so a 200 alone isn't proof of a write.
    const body = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
    } | null;

    if (!body?.ok) {
      return {
        ok: false,
        reason: 'request-failed',
        detail: body?.error ?? 'Sheet webhook rejected the write',
      };
    }

    return {ok: true};
  } catch (error) {
    return {
      ok: false,
      reason: 'request-failed',
      detail: error instanceof Error ? error.message : 'Unknown network error',
    };
  }
}

// B2B return-request storage.
//
// Same approach as `leads.ts`: Oxygen has no database, so each request is
// appended to a Google Sheet through an Apps Script web app. The script source
// is `scripts/b2b-returns-sheet.gs` — it also owns the accept → delivery
// challan → WhatsApp step, which the team triggers from the sheet's menu.

export type StoredReturn = {
  returnId: string;
  /** ISO-8601, stamped server-side so we don't trust the client's clock. */
  submittedAt: string;
  company: string;
  phone: string;
  whatsapp: string;
  orderId: string;
  pickupAddress: string;
  pincode: string;
  items: {name: string; qty: number}[];
};

export type StoreReturnResult =
  | {ok: true}
  | {ok: false; reason: 'not-configured' | 'request-failed'; detail: string};

const TIMEOUT_MS = 8000;

/** e.g. "RET-250907-K3F9" — date for sorting by eye, suffix to avoid clashes. */
export function newReturnId(now = new Date()): string {
  const d = now.toISOString().slice(2, 10).replace(/-/g, '');
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  // Unambiguous alphabet: no 0/O or 1/I, since these get read out over calls.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  return `RET-${d}-${suffix}`;
}

/** Append a return request to the sheet. Never throws. */
export async function storeReturn(
  env: Env,
  request: StoredReturn,
): Promise<StoreReturnResult> {
  const url = env.RETURNS_SHEET_WEBHOOK_URL;
  if (!url) {
    return {
      ok: false,
      reason: 'not-configured',
      detail: 'RETURNS_SHEET_WEBHOOK_URL is not set',
    };
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      redirect: 'follow',
      body: JSON.stringify({token: env.RETURNS_SHEET_TOKEN ?? '', request}),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return {
        ok: false,
        reason: 'request-failed',
        detail: `Sheet webhook returned ${res.status}`,
      };
    }
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

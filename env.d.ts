/// <reference types="vite/client" />
/// <reference types="react-router" />
/// <reference types="@shopify/oxygen-workers-types" />
/// <reference types="@shopify/hydrogen/react-router-types" />

// Enhance TypeScript's built-in typings.
import '@total-typescript/ts-reset';

declare global {
  interface Env {
    /** Set to "true" or "1" to serve the full-site maintenance page. */
    MAINTENANCE_MODE?: string;

    // ── Contact form: lead storage ──────────────────────────────────────────
    /** Google Apps Script /exec URL that appends leads to the sheet. */
    CONTACT_SHEET_WEBHOOK_URL?: string;
    /** Shared secret matching the script's `SHARED_TOKEN` property. */
    CONTACT_SHEET_TOKEN?: string;

    // ── Contact form: WhatsApp acknowledgement (AiSensy) ────────────────────
    /** AiSensy API key (Dashboard → Manage → API Key). */
    AISENSY_API_KEY?: string;
    /** Name of the LIVE AiSensy API campaign whose template has a document header. */
    AISENSY_CONTACT_CAMPAIGN_NAME?: string;
    /** Public HTTPS URL of the catalogue PDF sent as the document header. */
    CONTACT_CATALOGUE_PDF_URL?: string;
    /** Filename shown to the recipient in WhatsApp, e.g. "Ooge-Catalogue.pdf". */
    CONTACT_CATALOGUE_PDF_FILENAME?: string;
    /** Country code prefixed to local numbers. Defaults to "91" (India). */
    CONTACT_DEFAULT_COUNTRY_CODE?: string;

    // ── B2B returns: request storage ────────────────────────────────────────
    /** Apps Script /exec URL that appends return requests to the returns sheet. */
    RETURNS_SHEET_WEBHOOK_URL?: string;
    /** Shared secret matching that script's `SHARED_TOKEN` property. */
    RETURNS_SHEET_TOKEN?: string;
  }
}

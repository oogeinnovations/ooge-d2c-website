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

    // ── Contact form: WhatsApp acknowledgement (Netcore CPaaS) ──────────────
    /** Netcore WhatsApp API key, sent as a Bearer token. */
    NETCORE_WA_API_KEY?: string;
    /** Netcore "source" id (a UUID from the dashboard), sent with each message. */
    NETCORE_WA_SOURCE_ID?: string;
    /** Name of the APPROVED template that carries a document header. */
    NETCORE_WA_TEMPLATE_NAME?: string;
    /** Template language code, e.g. "en" or "en_US". Defaults to "en". */
    NETCORE_WA_TEMPLATE_LANG?: string;
    /** Public HTTPS URL of the catalogue PDF sent as the document header. */
    CONTACT_CATALOGUE_PDF_URL?: string;
    /** Filename shown to the recipient in WhatsApp, e.g. "Ooge-Catalogue.pdf". */
    CONTACT_CATALOGUE_PDF_FILENAME?: string;
    /** Country code prefixed to local numbers. Defaults to "91" (India). */
    CONTACT_DEFAULT_COUNTRY_CODE?: string;
  }
}

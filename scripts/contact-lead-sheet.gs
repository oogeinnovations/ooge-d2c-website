/**
 * Google Apps Script web app that receives contact-form leads and appends them
 * to a Google Sheet. This is the storage backend for `app/lib/leads.ts` —
 * Oxygen (Cloudflare Workers) can't hold a database, so the sheet is it.
 *
 * ── Deploy ────────────────────────────────────────────────────────────────
 *  1. Create a Google Sheet. Copy its ID from the URL — the long string between
 *     /d/ and /edit in docs.google.com/spreadsheets/d/<THIS>/edit.
 *  2. Open Apps Script (either Extensions → Apps Script from the sheet, or a
 *     standalone project at script.google.com), paste this file, and save.
 *  3. Project Settings → Script Properties → add two properties:
 *       SHARED_TOKEN = a long random string (generate: openssl rand -hex 24)
 *       SHEET_ID     = the sheet ID from step 1
 *  4. Deploy → New deployment → type "Web app".
 *       Execute as:        Me
 *       Who has access:    Anyone
 *     Copy the /exec URL it gives you.
 *  5. In the storefront's `.env` (and in Oxygen's env vars for production):
 *       CONTACT_SHEET_WEBHOOK_URL=<the /exec URL>
 *       CONTACT_SHEET_TOKEN=<the same SHARED_TOKEN value>
 *
 * "Who has access: Anyone" means the URL is publicly reachable, which is why
 * every write is gated on the shared token below. Treat the token as a secret
 * and rotate it in both places if it ever leaks.
 *
 * Re-deploy note: editing this script does NOT update the live web app. Use
 * Deploy → Manage deployments → edit → New version, or you'll keep serving the
 * old code at the same URL.
 */

var HEADERS = [
  'Submitted at',
  'Name',
  'WhatsApp number',
  'Email',
  'Company',
  'City',
  'Source page',
  'WhatsApp ack',
];

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('SHARED_TOKEN');
    if (!expected) return json({ok: false, error: 'SHARED_TOKEN not set'});

    var payload = JSON.parse(e.postData.contents);

    // Constant-time-ish comparison isn't available here; length check first at
    // least avoids leaking via early exit on the common wrong-length case.
    if (
      !payload.token ||
      payload.token.length !== expected.length ||
      payload.token !== expected
    ) {
      return json({ok: false, error: 'Invalid token'});
    }

    var lead = payload.lead || {};

    // Two submissions landing at once would otherwise race on the same row.
    // Open by ID so this works as a standalone script too. Falls back to the
    // bound spreadsheet when SHEET_ID isn't set (script opened from a sheet).
    var sheetId = props.getProperty('SHEET_ID');
    var ss = sheetId
      ? SpreadsheetApp.openById(sheetId)
      : SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return json({ok: false, error: 'SHEET_ID not set'});

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = ss.getSheets()[0];
      if (sheet.getLastRow() === 0) {
        sheet.appendRow(HEADERS);
        sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
        sheet.setFrozenRows(1);
      }
      sheet.appendRow([
        lead.submittedAt || new Date().toISOString(),
        lead.name || '',
        // Leading apostrophe keeps "+919876543210" as text — otherwise Sheets
        // reads the leading + as a formula and mangles the number.
        "'" + (lead.phone || ''),
        lead.email || '',
        lead.company || '',
        lead.city || '',
        lead.source || '',
        lead.whatsappAck || '',
      ]);
    } finally {
      lock.releaseLock();
    }

    return json({ok: true});
  } catch (err) {
    return json({ok: false, error: String(err)});
  }
}

function doGet() {
  // Handy for confirming the deployment is live without writing a row.
  return json({ok: true, service: 'ooge-contact-leads'});
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

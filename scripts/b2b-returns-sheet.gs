/**
 * Google Apps Script for B2B returns. Two jobs:
 *
 *  1. STORE  - web app endpoint (`doPost`) that appends return requests from
 *              the storefront (`app/lib/returns.ts`) to the sheet as "Pending".
 *  2. ACCEPT - set a row's Status dropdown to "Accepted" (or use the sheet
 *              menu "Ooge Returns -> Accept & send DC"). It generates a delivery challan (DC) PDF, saves it to Drive,
 *              writes the download link into the row, and sends the PDF to the
 *              customer's WhatsApp via AiSensy.
 *
 * The customer prints the DC, puts it in the parcel with the items, and hands
 * it to the Shipway pickup executive. The team downloads its own copy from the
 * "DC link" column. Shipments are arranged manually - type the courier AWB into
 * the "AWB" column BEFORE accepting if you want it printed on the DC.
 *
 * -- Deploy ----------------------------------------------------------------
 *  1. Create a NEW Google Sheet for returns (not the contact-leads sheet).
 *     Open Extensions -> Apps Script from it and paste this file.
 *  2. Project Settings -> Script Properties, add:
 *       SHARED_TOKEN        random string (openssl rand -hex 24)
 *       RECEIVER_NAME / RECEIVER_ADDRESS / RECEIVER_GSTIN / RECEIVER_PHONE  optional overrides;
 *                           the Begur, Bengaluru details are built in as defaults
 *       AISENSY_API_KEY     AiSensy API key (Dashboard -> Manage -> API Key)
 *       DC_CAMPAIGN_NAME    name of the LIVE AiSensy API campaign (see below)
 *       DEFAULT_COUNTRY_CODE optional, defaults to "91"
 *     (SHEET_ID is only needed if the script is NOT opened from the sheet.)
 *  3. Deploy -> New deployment -> Web app. Execute as: Me. Who has access: Anyone.
 *     Copy the /exec URL.
 *  4. Storefront `.env` and Oxygen env vars:
 *       RETURNS_SHEET_WEBHOOK_URL=<the /exec URL>
 *       RETURNS_SHEET_TOKEN=<the same SHARED_TOKEN>
 *  5. Run `setupTrigger` ONCE from the editor (pick it in the function
 *     dropdown, click Run, allow access). This turns on the Status trigger.
 *  6. Reload the sheet. An "Ooge Returns" menu appears; the first use asks you
 *     to authorise Drive / external-request access.
 *
 * -- WhatsApp (AiSensy) ----------------------------------------------------
 * In AiSensy: create a WhatsApp template with a DOCUMENT header and exactly two
 * body variables, get it approved, then create an API Campaign using it and set
 * it Live (Campaigns -> API Campaign). Its name goes in DC_CAMPAIGN_NAME.
 * Example body:
 *     "Hi {{1}}, your return {{2}} is approved. Please print the attached
 *      delivery challan and place it inside the parcel with the items before
 *      handing it to our pickup executive."
 * {{1}} = company name, {{2}} = return ID. If your template differs, edit
 * `sendDcOnWhatsApp_` - the number of templateParams must match the variables.
 *
 * The DC PDF is shared as "anyone with the link can view" so WhatsApp can fetch
 * it; the link is unguessable but treat DCs as non-secret documents. The send
 * uses Drive's direct host (drive.usercontent.google.com), not drive.google.com,
 * because WhatsApp drops documents behind a redirect.
 *
 * Re-deploy note: editing this script does NOT update the live web app. Use
 * Deploy -> Manage deployments -> edit -> New version. (Menu actions run the saved
 * script immediately; only `doPost` needs the re-deploy.)
 */

var SHEET_NAME = 'Returns';
var DC_FOLDER_NAME = 'Ooge B2B Return DCs';

// Return-to address printed on the DC. Script Properties RECEIVER_NAME /
// RECEIVER_ADDRESS override these if set.
var DEFAULT_RECEIVER_NAME = 'Ooge Innovations Private Limited';
var DEFAULT_RECEIVER_PHONE = '+91 86602 28701';
var DEFAULT_RECEIVER_GSTIN = '29AAECO2789D1Z6';
var DEFAULT_RECEIVER_ADDRESS =
  'No 2, BCR Garden, Post, off Hosur Road, near BCR Public School,\n' +
  'Chikka Begur, Madiwala, Industrial Layout, Begur\n' +
  'Bengaluru, Karnataka 560114\n' +
  'India';

var HEADERS = [
  'Submitted at',
  'Return ID',
  'Status',
  'Company',
  'Phone',
  'WhatsApp number',
  'Order ID',
  'Items',
  'Pickup address',
  'Pincode',
  'AWB',
  'DC no.',
  'DC link',
  'DC WhatsApp',
  'Items (JSON)',
];

// -- Storefront endpoint -----------------------------------------------------

function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var expected = props.getProperty('SHARED_TOKEN');
    if (!expected) return json({ok: false, error: 'SHARED_TOKEN not set'});

    var payload = JSON.parse(e.postData.contents);
    if (
      !payload.token ||
      payload.token.length !== expected.length ||
      payload.token !== expected
    ) {
      return json({ok: false, error: 'Invalid token'});
    }

    var r = payload.request || {};
    var items = r.items || [];

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var sheet = getSheet_();
      appendByHeader_(sheet, {
        'Submitted at': r.submittedAt || new Date().toISOString(),
        'Return ID': r.returnId || '',
        Status: 'Pending',
        Company: r.company || '',
        // Leading apostrophe keeps "+91..." as text rather than a formula.
        Phone: "'" + (r.phone || ''),
        'WhatsApp number': "'" + (r.whatsapp || ''),
        'Order ID': "'" + (r.orderId || ''),
        Items: items
          .map(function (i) {
            return i.name + ' x ' + i.qty;
          })
          .join('\n'),
        'Pickup address': r.pickupAddress || '',
        Pincode: "'" + (r.pincode || ''),
        'Items (JSON)': JSON.stringify(items),
      });
    } finally {
      lock.releaseLock();
    }
    return json({ok: true});
  } catch (err) {
    return json({ok: false, error: String(err)});
  }
}

function doGet() {
  return json({ok: true, service: 'ooge-b2b-returns'});
}

// -- Sheet menu --------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ooge Returns')
    .addItem('Accept & send DC (selected row)', 'acceptSelected')
    .addItem('Regenerate DC PDF only (selected row)', 'regenerateSelected')
    .addItem('Mark rejected (selected row)', 'rejectSelected')
    .addToUi();
}

/** Accept the selected return: generate the DC, then WhatsApp it. */
function acceptSelected() {
  var ui = SpreadsheetApp.getUi();
  var ctx = selectedReturn_(ui);
  if (!ctx) return;

  if (ctx.get('DC no.')) {
    var again = ui.alert(
      'DC already generated',
      ctx.get('DC no.') +
        ' was already created for this return. Generate a NEW DC and send it again?',
      ui.ButtonSet.YES_NO,
    );
    if (again !== ui.Button.YES) return;
  }

  var done = acceptRow_(ctx);
  var dc = done.dc;
  var result = done.result;

  ui.alert(
    result.ok
      ? 'DC ' + dc.dcNo + ' generated and sent on WhatsApp.'
      : 'DC ' + dc.dcNo + ' generated, but WhatsApp failed:\n\n' + result.detail +
          '\n\nDownload it from the "DC link" column and send it manually.',
  );
}

/** Generate the DC, mark the row Accepted, and WhatsApp it. No UI. */
function acceptRow_(ctx) {
  var dc = generateDc_(ctx);
  ctx.set('Status', 'Accepted');
  ctx.set('DC no.', dc.dcNo);
  ctx.set('DC link', dc.url);
  var result = sendDcOnWhatsApp_(ctx, dc.file);
  ctx.set('DC WhatsApp', result.ok ? 'sent' : 'failed: ' + result.detail);
  return {dc: dc, result: result};
}

/**
 * Installable onEdit trigger (create it once with setupTrigger). Changing a
 * row's Status dropdown to "Accepted" generates and sends the DC, so the menu
 * isn't needed. Triggers can't show pop-ups, so the outcome goes in the row's
 * "DC WhatsApp" column instead.
 */
function onStatusEdit(e) {
  if (!e || !e.range || String(e.value) !== 'Accepted') return;
  var sheet = e.range.getSheet();
  var row = e.range.getRow();
  if (sheet.getName() !== SHEET_NAME || row < 2) return;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (e.range.getColumn() !== headers.indexOf('Status') + 1) return;

  var ctx = rowContext_(sheet, row);
  if (!ctx) return;
  // Already has a DC: don't issue a second one (and re-message the customer)
  // just because the dropdown was touched again.
  if (ctx.get('DC no.')) return;

  try {
    acceptRow_(ctx);
  } catch (err) {
    ctx.set('DC WhatsApp', 'error: ' + err);
  }
}

/** Run this ONCE from the editor to switch on the Status-dropdown trigger. */
function setupTrigger() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'onStatusEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onStatusEdit').forSpreadsheet(ss).onEdit().create();
}

/** Rebuild the PDF (e.g. after adding an AWB) without messaging the customer. */
function regenerateSelected() {
  var ui = SpreadsheetApp.getUi();
  var ctx = selectedReturn_(ui);
  if (!ctx) return;
  var dc = generateDc_(ctx, ctx.get('DC no.') || null);
  ctx.set('DC no.', dc.dcNo);
  ctx.set('DC link', dc.url);
  ui.alert('DC ' + dc.dcNo + ' regenerated. Customer was NOT messaged.');
}

function rejectSelected() {
  var ui = SpreadsheetApp.getUi();
  var ctx = selectedReturn_(ui);
  if (!ctx) return;
  ctx.set('Status', 'Rejected');
}

// -- Delivery challan --------------------------------------------------------

function generateDc_(ctx, existingDcNo) {
  var dcNo = existingDcNo || nextDcNo_();
  var html = dcHtml_(ctx, dcNo);
  var pdf = Utilities.newBlob(html, 'text/html', dcNo + '.html')
    .getAs('application/pdf')
    .setName(dcNo + ' - ' + ctx.get('Return ID') + '.pdf');

  var file = getDcFolder_().createFile(pdf);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {dcNo: dcNo, file: file, url: file.getUrl()};
}

/** DC-YYMMDD-NNN, with NNN a running counter so numbers are never reused. */
function nextDcNo_() {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var props = PropertiesService.getScriptProperties();
    var n = Number(props.getProperty('DC_COUNTER') || '0') + 1;
    props.setProperty('DC_COUNTER', String(n));
    var d = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'yyMMdd');
    return 'DC-' + d + '-' + ('000' + n).slice(-3);
  } finally {
    lock.releaseLock();
  }
}

function dcHtml_(ctx, dcNo) {
  var p = PropertiesService.getScriptProperties();
  var items = [];
  try {
    items = JSON.parse(ctx.get('Items (JSON)') || '[]');
  } catch (e) {}

  var rows = items
    .map(function (it, i) {
      return (
        '<tr><td class="c">' + (i + 1) + '</td><td>' + esc_(it.name) +
        '</td><td class="c">' + esc_(it.qty) + '</td></tr>'
      );
    })
    .join('');
  var total = items.reduce(function (s, it) {
    return s + Number(it.qty || 0);
  }, 0);

  var receiver =
    '<b>' + esc_(p.getProperty('RECEIVER_NAME') || DEFAULT_RECEIVER_NAME) + '</b><br>' +
    nl2br_(p.getProperty('RECEIVER_ADDRESS') || DEFAULT_RECEIVER_ADDRESS) +
    '<br>Phone: ' + esc_(p.getProperty('RECEIVER_PHONE') || DEFAULT_RECEIVER_PHONE) +
    '<br>GSTIN: ' + esc_(p.getProperty('RECEIVER_GSTIN') || DEFAULT_RECEIVER_GSTIN);

  var sender =
    '<b>' + esc_(ctx.get('Company')) + '</b><br>' +
    nl2br_(ctx.get('Pickup address')) +
    '<br>Pincode: ' + esc_(ctx.get('Pincode')) +
    '<br>Phone: ' + esc_(ctx.get('Phone'));

  var awb = ctx.get('AWB');
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');

  // Google's HTML->PDF renderer supports only basic CSS: tables and inline
  // borders, no flex/grid. Keep the layout table-based.
  return (
    '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}' +
    'h1{font-size:20px;text-align:center;margin:0 0 4px;letter-spacing:1px}' +
    '.sub{text-align:center;color:#555;margin-bottom:14px}' +
    'table{width:100%;border-collapse:collapse}' +
    'td,th{border:1px solid #333;padding:7px;vertical-align:top}' +
    'th{background:#eee;text-align:left}' +
    '.c{text-align:center;width:60px}' +
    '.nb td{border:none;padding:2px 0}' +
    '.sp{height:14px}' +
    '</style></head><body>' +
    '<h1>DELIVERY CHALLAN</h1>' +
    '<div class="sub">Goods returned - not for sale</div>' +
    '<table><tr>' +
    '<td><b>DC No:</b> ' + esc_(dcNo) + '<br><b>Date:</b> ' + today + '</td>' +
    '<td><b>Return ID:</b> ' + esc_(ctx.get('Return ID')) +
    '<br><b>Order ID:</b> ' + esc_(ctx.get('Order ID')) +
    (awb ? '<br><b>AWB:</b> ' + esc_(awb) : '') + '</td>' +
    '</tr></table><div class="sp"></div>' +
    '<table><tr><th width="50%">PICKUP FROM (Sender)</th>' +
    '<th width="50%">DELIVER TO (Receiver)</th></tr>' +
    '<tr><td>' + sender + '</td><td>' + receiver + '</td></tr></table>' +
    '<div class="sp"></div>' +
    '<table><tr><th class="c">S.No</th><th>Item description</th>' +
    '<th class="c">Qty</th></tr>' + rows +
    '<tr><td></td><td align="right"><b>Total quantity</b></td>' +
    '<td class="c"><b>' + total + '</b></td></tr></table>' +
    '<div class="sp"></div>' +
    '<p>Goods are being returned to the supplier against the above order. ' +
    'Please keep a printed copy of this challan inside the parcel and hand one ' +
    'copy to the pickup executive.</p>' +
    '<div class="sp"></div><div class="sp"></div>' +
    '<table class="nb"><tr><td>Sender signature &amp; stamp</td>' +
    '<td align="right">Receiver signature &amp; stamp</td></tr></table>' +
    '</body></html>'
  );
}

// -- WhatsApp (AiSensy) ------------------------------------------------------

function sendDcOnWhatsApp_(ctx, file) {
  var p = PropertiesService.getScriptProperties();
  var apiKey = p.getProperty('AISENSY_API_KEY');
  var campaign = p.getProperty('DC_CAMPAIGN_NAME');
  if (!apiKey || !campaign) {
    return {ok: false, detail: 'AISENSY_API_KEY / DC_CAMPAIGN_NAME not set'};
  }

  var to = toWhatsAppNumber_(
    ctx.get('WhatsApp number'),
    p.getProperty('DEFAULT_COUNTRY_CODE') || '91',
  );
  if (!to) {
    return {ok: false, detail: 'Invalid WhatsApp number: ' + ctx.get('WhatsApp number')};
  }

  // Drive's direct-download host. The older drive.google.com/uc?export=download
  // form answers with a 303 redirect first, and WhatsApp then silently fails to
  // attach the document (the message shows "delivered" but never arrives).
  var pdfUrl =
    'https://drive.usercontent.google.com/download?id=' + file.getId() + '&export=download';

  var payload = {
    apiKey: apiKey,
    campaignName: campaign,
    destination: to,
    userName: ctx.get('Company'),
    // Order matters: {{1}} company, {{2}} return ID.
    templateParams: [ctx.get('Company'), ctx.get('Return ID')],
    source: 'b2b-return-dc',
    media: {url: pdfUrl, filename: file.getName()},
  };

  try {
    var res = UrlFetchApp.fetch(
      'https://backend.aisensy.com/campaign/t1/api/v2',
      {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    );
    var raw = res.getContentText();
    // A 200 means AiSensy accepted it for sending, not that WhatsApp delivered
    // it - check the AiSensy dashboard for delivery status.
    if (res.getResponseCode() === 200) return {ok: true, detail: ''};
    return {
      ok: false,
      detail: 'AiSensy ' + res.getResponseCode() + ': ' + raw.slice(0, 200),
    };
  } catch (err) {
    return {ok: false, detail: String(err)};
  }
}

/** Mirrors `toWhatsAppNumber` in app/lib/contact.ts. */
function toWhatsAppNumber_(input, defaultCc) {
  var t = String(input || '').replace(/^'/, '').trim();
  var hadPlus = t.indexOf('+') === 0 || t.indexOf('00') === 0;
  var digits = t.replace(/\D/g, '');
  if (t.indexOf('00') === 0) digits = digits.slice(2);
  if (!hadPlus && digits.length === 10) digits = defaultCc + digits;
  if (digits.length < 10 || digits.length > 15) return null;
  return digits;
}

// -- Helpers -----------------------------------------------------------------

function getSheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('SHEET_ID not set');
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    // Status dropdown for the whole column, so edits stay consistent.
    sheet
      .getRange(2, HEADERS.indexOf('Status') + 1, 998, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation()
          .requireValueInList(['Pending', 'Accepted', 'Rejected', 'Picked up', 'Received'], true)
          .build(),
      );
  }
  return sheet;
}

/** Append a row, placing each value under its header so column order is free. */
function appendByHeader_(sheet, values) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  sheet.appendRow(
    headers.map(function (h) {
      return values[h] !== undefined ? values[h] : '';
    }),
  );
}

/**
 * The selected row as {get,set} by header name. Alerts and returns null if the
 * selection isn't a data row of the Returns sheet.
 */
function selectedReturn_(ui) {
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveRange() && sheet.getActiveRange().getRow();
  if (sheet.getName() !== SHEET_NAME || !row || row < 2) {
    ui.alert('Select a return row on the "' + SHEET_NAME + '" sheet first.');
    return null;
  }
  var ctx = rowContext_(sheet, row);
  if (!ctx) ui.alert('That row has no Return ID.');
  return ctx;
}

/** {get,set} accessors for one data row, keyed by header. Null if no Return ID. */
function rowContext_(sheet, row) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var values = sheet.getRange(row, 1, 1, headers.length).getValues()[0];
  var cols = {};
  headers.forEach(function (h, i) {
    cols[h] = i;
  });
  ['Return ID', 'Status', 'DC no.', 'DC link', 'DC WhatsApp'].forEach(function (h) {
    if (cols[h] === undefined) throw new Error('Missing column: ' + h);
  });
  if (!values[cols['Return ID']]) return null;
  return {
    get: function (h) {
      return String(values[cols[h]] === undefined ? '' : values[cols[h]]).replace(/^'/, '');
    },
    set: function (h, v) {
      sheet.getRange(row, cols[h] + 1).setValue(v);
      values[cols[h]] = v;
    },
  };
}

function getDcFolder_() {
  var it = DriveApp.getFoldersByName(DC_FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(DC_FOLDER_NAME);
}

function esc_(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br_(s) {
  return esc_(s).replace(/\r?\n/g, '<br>');
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

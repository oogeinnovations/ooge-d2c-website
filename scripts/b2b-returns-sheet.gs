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
  'Pickup address',
  'Pincode',
  'Items',
  'Approved items',
  'AWB',
  'DC no.',
  'DC link',
  'DC WhatsApp',
  'Items data',
];

// 'Items data' holds the structured item list (name, qty, reason, approved) the
// script works from. It is hidden; the readable lists are 'Items' and
// 'Approved items'.
var DATA_HEADER = 'Items data';

// One row per RETURN. The 'Items' cell lists every item on its own line, each
// starting with a tick mark: "[x] name - Qty - reason". To leave an item out of
// the return, edit the cell and change its "[x]" to "[ ]" (or use Ooge Returns >
// Select items to approve for a popup with real checkboxes). The DC lists only
// the items still marked [x]. Items start out all ticked.

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
      ensureHeaders_(sheet);
      applyDropdowns_(sheet);
      var stored = items.map(function (i) {
        return {
          name: i.name || '',
          qty: Number(i.qty) || 0,
          reason: i.reason || '',
          approved: true,
        };
      });
      appendByHeader_(sheet, {
        'Submitted at': r.submittedAt || new Date().toISOString(),
        'Return ID': r.returnId || '',
        Status: 'Pending',
        Company: r.company || '',
        // Leading apostrophe keeps "+91..." as text rather than a formula.
        Phone: "'" + (r.phone || ''),
        'WhatsApp number': "'" + (r.whatsapp || ''),
        'Pickup address': r.pickupAddress || '',
        Pincode: "'" + (r.pincode || ''),
        Items: itemLines_(stored, false),
        'Approved items': 'All items',
        'Items data': JSON.stringify(stored),
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
    .addItem('Select items to approve (selected row)', 'selectItems')
    .addItem('Accept & send DC (selected row)', 'acceptSelected')
    .addItem('Regenerate DC PDF only (selected row)', 'regenerateSelected')
    .addItem('Mark rejected (selected row)', 'rejectSelected')
    .addSeparator()
    .addItem('Clean up old columns (one time)', 'cleanupOldColumns')
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

  var done;
  try {
    done = acceptRow_(ctx);
  } catch (err) {
    ui.alert(String(err.message || err));
    return;
  }
  var dc = done.dc;
  var result = done.result;

  ui.alert(
    result.ok
      ? 'DC ' + dc.dcNo + ' generated and sent on WhatsApp.'
      : 'DC ' + dc.dcNo + ' generated, but WhatsApp failed:\n\n' + result.detail +
          '\n\nDownload it from the "DC link" column and send it manually.',
  );
}

function hasApprovedItems_(ctx) {
  return ctx.items.some(function (it) {
    return it.approved !== false;
  });
}

/** Generate the DC, mark the row Accepted, and WhatsApp it. No UI. */
function acceptRow_(ctx) {
  syncFromCell_(ctx);
  if (!hasApprovedItems_(ctx)) {
    throw new Error('No items are approved. Mark at least one item [x] in the Items cell (or use Ooge Returns > Select items to approve).');
  }
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
    ctx.set('Status', 'Pending');
    ctx.set('DC WhatsApp', 'error: ' + (err.message || err));
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

/**
 * Columns from earlier versions of this sheet. They are no longer used, so the
 * menu item below removes them once -- but only the ones that hold no data, so
 * nothing is ever lost.
 */
var OLD_COLUMNS = ['Order ID', 'Items (JSON)', 'Item name', 'Quantity', 'Reason', 'Approve item'];

function cleanupOldColumns() {
  var ui = SpreadsheetApp.getUi();
  var sheet = getSheet_();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows = Math.max(sheet.getLastRow() - 1, 0);
  var remove = [];
  var kept = [];
  OLD_COLUMNS.forEach(function (h) {
    var col = headers.indexOf(h) + 1;
    if (!col) return;
    var hasData =
      rows > 0 &&
      sheet.getRange(2, col, rows, 1).getValues().some(function (r) {
        return r[0] !== '' && r[0] !== null;
      });
    (hasData ? kept : remove).push({name: h, col: col});
  });
  if (remove.length === 0 && kept.length === 0) {
    ui.alert('Nothing to clean up: the old columns are already gone.');
    return;
  }
  var msg =
    remove.length > 0
      ? 'These empty old columns will be deleted:\n\n' +
        remove.map(function (c) { return '  - ' + c.name; }).join('\n')
      : 'No empty old columns to delete.';
  if (kept.length > 0) {
    msg +=
      '\n\nThese still hold data from older returns, so they are being kept:\n\n' +
      kept.map(function (c) { return '  - ' + c.name; }).join('\n');
  }
  if (remove.length === 0) {
    ui.alert(msg);
    return;
  }
  if (ui.alert('Clean up old columns', msg + '\n\nContinue?', ui.ButtonSet.YES_NO) !== ui.Button.YES) {
    return;
  }
  // Right to left, so earlier column numbers stay valid while deleting.
  remove
    .sort(function (a, b) { return b.col - a.col; })
    .forEach(function (c) { sheet.deleteColumn(c.col); });
  ui.alert('Done. Removed ' + remove.length + ' old column(s).');
}

/**
 * One line per item. Ticked-style (approvedOnly=false) lines start "[x] " or
 * "[ ] " so the Items cell doubles as the checklist; approvedOnly=true gives the
 * plain list of ticked items for the 'Approved items' cell.
 */
function itemLines_(items, approvedOnly) {
  return items
    .filter(function (it) {
      return !approvedOnly || it.approved !== false;
    })
    .map(function (it) {
      var text = it.name + ' - Qty ' + it.qty + (it.reason ? ' - ' + it.reason : '');
      return approvedOnly ? text : (it.approved === false ? '[ ] ' : '[x] ') + text;
    })
    .join('\n');
}

/**
 * Read the tick marks in the 'Items' cell back into ctx.items. Line N belongs
 * to item N. If the line count no longer matches (someone added or removed a
 * line), the stored flags are kept rather than guessing. Returns true if the
 * cell was usable.
 */
function readTicksFromCell_(ctx) {
  var lines = String(ctx.get('Items')).split(/\r?\n/).filter(function (l) {
    return l.trim() !== '';
  });
  if (lines.length !== ctx.items.length || lines.length === 0) return false;
  lines.forEach(function (l, i) {
    var m = l.match(/^\s*(?:\[\s*([^\]]*?)\s*\]|(\u2611|\u2705|\u2714)|(\u2610))/);
    if (!m) return; // no mark on this line: keep its stored flag
    ctx.items[i].approved = !(m[3] !== undefined || (m[1] !== undefined && m[1] === ''));
  });
  return true;
}

/** Apply the cell's ticks, and write the result back to the data + summary cells. */
function syncFromCell_(ctx) {
  if (!readTicksFromCell_(ctx)) return;
  ctx.set(DATA_HEADER, JSON.stringify(ctx.items));
  var all = ctx.items.every(function (it) {
    return it.approved !== false;
  });
  ctx.set('Approved items', all ? 'All items' : itemLines_(ctx.items, true) || 'None');
}

/** Popup: one checkbox per item of the selected return. */
function selectItems() {
  var ui = SpreadsheetApp.getUi();
  var ctx = selectedReturn_(ui);
  if (!ctx) return;
  if (ctx.items.length === 0) {
    ui.alert('This return has no items to choose from.');
    return;
  }
  var sheet = SpreadsheetApp.getActiveSheet();
  var row = sheet.getActiveRange().getRow();
  readTicksFromCell_(ctx); // start from whatever is ticked in the cell now
  var html = selectItemsHtml_(ctx, row);
  ui.showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(560).setHeight(120 + 62 * ctx.items.length),
    'Select items to approve - ' + ctx.get('Return ID'),
  );
}

function selectItemsHtml_(ctx, row) {
  var boxes = ctx.items
    .map(function (it, i) {
      return (
        '<label class="it"><input type="checkbox" value="' + i + '"' +
        (it.approved === false ? '' : ' checked') + '>' +
        '<span><b>' + esc_(it.name) + '</b> &nbsp; Qty ' + esc_(it.qty) +
        '<br><small>' + esc_(it.reason) + '</small></span></label>'
      );
    })
    .join('');
  var note = ctx.get('DC no.')
    ? '<p class="warn">A DC (' + esc_(ctx.get('DC no.')) +
      ') already exists for this return. Changing the selection does not change it; use "Regenerate DC PDF only" afterwards.</p>'
    : '';
  return (
    '<html><head><base target="_top"><style>' +
    'body{font-family:Arial,sans-serif;font-size:14px;margin:16px;color:#111}' +
    '.it{display:flex;gap:10px;align-items:flex-start;padding:9px 6px;border-bottom:1px solid #e3e3e3;cursor:pointer}' +
    '.it input{margin-top:3px;transform:scale(1.2)}small{color:#666}' +
    '.warn{background:#fff4d6;padding:8px;border-radius:4px;font-size:12px}' +
    'button{margin-top:14px;padding:9px 20px;font-size:14px;background:#1a73e8;color:#fff;border:0;border-radius:4px;cursor:pointer}' +
    'button.g{background:#eee;color:#111;margin-left:8px}' +
    '</style></head><body>' + note +
    '<div id="list">' + boxes + '</div>' +
    '<button onclick="save()">Save</button>' +
    '<button class="g" onclick="google.script.host.close()">Cancel</button>' +
    '<script>' +
    'function save(){var v=[].slice.call(document.querySelectorAll("input:checked")).map(function(x){return Number(x.value)});' +
    'google.script.run.withSuccessHandler(function(){google.script.host.close()})' +
    '.withFailureHandler(function(e){alert(e.message||e)})' +
    '.saveItemSelection(' + Number(row) + ',' + JSON.stringify(String(ctx.get('Return ID'))) + ',v);}' +
    '</script></body></html>'
  );
}

/** Called from the popup: store which items are approved for this return. */
function saveItemSelection(row, returnId, selected) {
  var sheet = getSheet_();
  ensureHeaders_(sheet);
  var ctx = rowContext_(sheet, row);
  if (!ctx || ctx.get('Return ID') !== returnId) {
    throw new Error('That row changed. Close this window, reselect the return and try again.');
  }
  var items = ctx.items;
  items.forEach(function (it, i) {
    it.approved = selected.indexOf(i) !== -1;
  });
  ctx.set(DATA_HEADER, JSON.stringify(items));
  ctx.set('Items', itemLines_(items, false));
  var all = items.every(function (it) {
    return it.approved;
  });
  ctx.set('Approved items', all ? 'All items' : itemLines_(items, true) || 'None');
  return items.filter(function (it) { return it.approved; }).length;
}

/** Rebuild the PDF (e.g. after adding an AWB) without messaging the customer. */
function regenerateSelected() {
  var ui = SpreadsheetApp.getUi();
  var ctx = selectedReturn_(ui);
  if (!ctx) return;
  syncFromCell_(ctx);
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
  var items = ctx.items.filter(function (it) {
    return it.approved !== false;
  });

  var rows = items
    .map(function (it, i) {
      return (
        '<tr><td class="c">' + (i + 1) + '</td><td>' + esc_(it.name) +
        '</td><td>' + esc_(it.reason) +
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
    (awb ? '<br><b>AWB:</b> ' + esc_(awb) : '') +
    '</td>' +
    '</tr></table><div class="sp"></div>' +
    '<table><tr><th width="50%">PICKUP FROM (Sender)</th>' +
    '<th width="50%">DELIVER TO (Receiver)</th></tr>' +
    '<tr><td>' + sender + '</td><td>' + receiver + '</td></tr></table>' +
    '<div class="sp"></div>' +
    '<table><tr><th class="c">S.No</th><th>Item description</th>' +
    '<th>Reason for return</th><th class="c">Qty</th></tr>' + rows +
    '<tr><td></td><td></td><td align="right"><b>Total quantity</b></td>' +
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
    sheet.hideColumns(HEADERS.indexOf(DATA_HEADER) + 1);
  }
  return sheet;
}

/**
 * Add any header from HEADERS that an older sheet doesn't have yet, at the end,
 * so adding a field never needs a manual edit (and never shifts existing data).
 */
function ensureHeaders_(sheet) {
  var have = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  HEADERS.forEach(function (h) {
    if (have.indexOf(h) === -1) {
      var col = sheet.getLastColumn() + 1;
      sheet.getRange(1, col).setValue(h).setFontWeight('bold');
      if (h === DATA_HEADER) sheet.hideColumns(col);
      have.push(h);
    }
  });
}

/** The Status dropdown, down its whole column. */
function applyDropdowns_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var lists = {
    Status: ['Pending', 'Accepted', 'Rejected', 'Picked up', 'Received'],
  };
  Object.keys(lists).forEach(function (h) {
    var col = headers.indexOf(h) + 1;
    if (!col) return;
    sheet
      .getRange(2, col, 998, 1)
      .setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(lists[h], true).build(),
      );
  });
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

/**
 * {get,set,items} for one data row, keyed by header. Items come from the hidden
 * 'Items data' JSON ([{name, qty, reason, approved}]); returns made before that
 * column existed fall back to their old 'Items (JSON)'. Null if no Return ID.
 */
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

  var ctx = {
    get: function (h) {
      return String(values[cols[h]] === undefined ? '' : values[cols[h]]).replace(/^'/, '');
    },
    set: function (h, v) {
      if (cols[h] === undefined) return;
      sheet.getRange(row, cols[h] + 1).setValue(v);
      values[cols[h]] = v;
    },
  };
  ctx.items = [];
  [DATA_HEADER, 'Items (JSON)'].some(function (h) {
    try {
      var parsed = JSON.parse(ctx.get(h) || '[]');
      if (parsed.length) ctx.items = parsed;
    } catch (e) {}
    return ctx.items.length > 0;
  });
  return ctx;
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

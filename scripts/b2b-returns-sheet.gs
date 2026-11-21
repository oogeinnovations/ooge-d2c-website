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
 * {{1}} = company name, {{2}} = return ID.
 *
 * Optional, to send the customer the inspection outcome (accepted / replaced with
 * the same or an alternate product / rejected / not accepted for return): create
 * a Utility template WITH a document header and {{1}} store name, {{2}} return ID,
 * {{3}} a one-line count summary. Make a Live API Campaign from it and set its
 * name as the script property DC_CAMPAIGN_NAME_OUTCOME. The item-by-item list is
 * a PDF attached to that message (and saved in the 'Outcome PDF' column), so it
 * works for any number of items. Used by 'Save & notify customer' in the items
 * panel; without the property the inspection and PDF are still saved, with no
 * message.
 *
 * Optional, to message customers when you reject a return: create a Utility
 * template with {{1}} store name, {{2}} return ID, {{3}} reason (no document
 * header), make a Live API Campaign from it, and set its name as the script
 * property DC_CAMPAIGN_NAME_REJECT. Used by the Reject & notify button in the
 * items panel; without it, rejecting only changes the Status.
 *
 * Optional, to also send the AWB number: create a second template with a third
 * variable ({{3}} = AWB number), make a Live API Campaign from it, and set its
 * name as the script property DC_CAMPAIGN_NAME_AWB. When that property is set it
 * is used instead of DC_CAMPAIGN_NAME; remove it to go back to the first one. If your template differs, edit
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
  'Boxes',
  'Weight (kg)',
  'Box photos',
  'Items',
  'Approved items',
  'AWB',
  'DC no.',
  'DC link',
  'DC WhatsApp',
  'Inspection result',
  'Outcome WhatsApp',
  'Outcome PDF',
  'Items data',
];

// 'Items data' holds the structured item list (name, qty, reason, approved) the
// script works from. It is hidden; the readable lists are 'Items' and
// 'Approved items'.
var DATA_HEADER = 'Items data';

// A sheet cell holds at most 50,000 characters, so a return's item data is split
// across hidden cells ('Items data', 'Items data 2', ...) of DATA_CHUNK characters.
// That way a return can have any number of items. Every chunk starts with "~" so
// Sheets can never read the start of a chunk as a formula or drop a leading quote.
var DATA_CHUNK = 40000;
var CELL_TEXT_MAX = 45000;

/** Keep a readable list inside one cell: cut at a line end and say how many were left out. */
function fitCell_(text) {
  text = String(text);
  if (text.length <= CELL_TEXT_MAX) return text;
  var cut = text.lastIndexOf('\n', CELL_TEXT_MAX - 120);
  if (cut < 1) cut = CELL_TEXT_MAX - 120;
  var left = text.slice(cut).split('\n').filter(function (l) { return l.trim() !== ''; }).length;
  return text.slice(0, cut) + '\n... and ' + left + ' more (open the items panel for the full list)';
}

// One row per RETURN. The 'Items' cell lists every item (name - Qty - reason).
// To choose which items you are taking back, open Ooge Returns > Open items panel:
// a side panel follows the selected row and shows its items with checkboxes
// (all ticked by default). The DC lists only the ticked items. 'Approved items'
// shows the result.

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
    // Box photos go to Drive first (outside the lock: it can take a few seconds).
    var photoLinks = saveBoxPhotos_(r.returnId || 'RET', r.photos || []);

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
        Boxes: r.boxes || '',
        'Weight (kg)': r.weight || '',
        'Box photos': photoLinks.join('\n'),
        Items: fitCell_(itemLines_(stored, false)),
        'Approved items': 'All items',
      });
      rowContext_(sheet, sheet.getLastRow()).setItems(stored);
    } finally {
      lock.releaseLock();
    }
    return json({ok: true});
  } catch (err) {
    return json({ok: false, error: String(err)});
  }
}

/**
 * Save the customer's box photos (base64 JPEGs) to the "Ooge B2B Return box photos"
 * folder, readable by anyone with the link so the team and the courier can open
 * them. Returns the links. Set the BOX_PHOTOS_FOLDER_ID script property to use a
 * particular folder; otherwise the folder is found or made by name.
 */
function saveBoxPhotos_(returnId, photos) {
  if (!photos || !photos.length) return [];
  var props = PropertiesService.getScriptProperties();
  var folderId = props.getProperty('BOX_PHOTOS_FOLDER_ID');
  var folder;
  if (folderId) {
    folder = DriveApp.getFolderById(folderId);
  } else {
    var it = DriveApp.getFoldersByName('Ooge B2B Return box photos');
    folder = it.hasNext() ? it.next() : DriveApp.createFolder('Ooge B2B Return box photos');
    props.setProperty('BOX_PHOTOS_FOLDER_ID', folder.getId());
  }
  return photos.slice(0, 5).map(function (p, i) {
    var blob = Utilities.newBlob(Utilities.base64Decode(String(p.data || '')), 'image/jpeg', returnId + '-box-' + (i + 1) + '.jpg');
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return file.getUrl();
  });
}

function doGet() {
  return json({ok: true, service: 'ooge-b2b-returns'});
}

// -- Sheet menu --------------------------------------------------------------

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Ooge Returns')
    .addItem('Open items panel (tick items, accept)', 'openPanel')
    .addItem('Accept & send DC (selected row)', 'acceptSelected')
    .addItem('Regenerate DC PDF only (selected row)', 'regenerateSelected')
    .addItem('Mark rejected (selected row)', 'rejectSelected')
    .addSeparator()
    .addItem('Delete old columns (one time)', 'cleanupOldColumns')
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
  if (!hasApprovedItems_(ctx)) {
    throw new Error('No items are approved. Tick at least one item in the panel (Ooge Returns > Open items panel).');
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
 * Columns from earlier versions of this sheet. None of them is used any more, so
 * the menu item below deletes them in one go. The confirmation box says which
 * ones still hold data, so nothing is removed without you seeing it first.
 */
var OLD_COLUMNS = ['Order ID', 'Items (JSON)', 'Item name', 'Quantity', 'Reason', 'Approve item'];

function cleanupOldColumns() {
  var ui = SpreadsheetApp.getUi();
  var sheet = getSheet_();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows = Math.max(sheet.getLastRow() - 1, 0);
  var found = [];
  OLD_COLUMNS.forEach(function (h) {
    var col = headers.indexOf(h) + 1;
    if (!col) return;
    var hasData =
      rows > 0 &&
      sheet.getRange(2, col, rows, 1).getValues().some(function (r) {
        return r[0] !== '' && r[0] !== null;
      });
    found.push({name: h, col: col, hasData: hasData});
  });
  if (found.length === 0) {
    ui.alert('Nothing to clean up: the old columns are already gone.');
    return;
  }
  var withData = found.filter(function (c) { return c.hasData; });
  var msg =
    'These old columns will be deleted:\n\n' +
    found
      .map(function (c) { return '  - ' + c.name + (c.hasData ? '   (has old data)' : ''); })
      .join('\n');
  if (withData.length > 0) {
    msg += '\n\nThe ones marked "has old data" hold values from returns made before the current layout.';
  }
  if (ui.alert('Delete old columns', msg + '\n\nContinue?', ui.ButtonSet.YES_NO) !== ui.Button.YES) {
    return;
  }
  // Right to left, so earlier column numbers stay valid while deleting.
  found
    .sort(function (a, b) { return b.col - a.col; })
    .forEach(function (c) { sheet.deleteColumn(c.col); });
  ui.alert('Done. Deleted ' + found.length + ' old column(s).');
}

/** One "name - Qty 2 - reason" line per item; approvedOnly keeps ticked items. */
function itemLines_(items, approvedOnly) {
  return items
    .filter(function (it) {
      return !approvedOnly || it.approved !== false;
    })
    .map(function (it) {
      return it.name + ' - Qty ' + it.qty + (it.reason ? ' - ' + it.reason : '');
    })
    .join('\n');
}

// -- Items panel ---------------------------------------------------------------
// A sidebar that follows the selected row: it lists that return's items with
// real checkboxes (ticking saves at once) and has the Accept button. Sheets
// cannot hold several checkboxes in one cell, so they live here instead.

function openPanel() {
  SpreadsheetApp.getUi().showSidebar(
    HtmlService.createHtmlOutput(panelHtml_()).setTitle('Return items'),
  );
}

/** What the panel shows for the currently selected row. */
function getPanelState() {
  var sheet = SpreadsheetApp.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) {
    return {none: true, message: 'Open the "' + SHEET_NAME + '" sheet and click a return.'};
  }
  var range = sheet.getActiveRange();
  var row = range ? range.getRow() : 0;
  if (row < 2) return {none: true, message: 'Click a return row to see its items.'};
  var ctx = rowContext_(sheet, row);
  if (!ctx) return {none: true, message: 'That row has no return. Click a row with a Return ID.'};
  return {
    row: row,
    returnId: ctx.get('Return ID'),
    company: ctx.get('Company'),
    status: ctx.get('Status'),
    dcNo: ctx.get('DC no.'),
    outcome: ctx.get('Outcome WhatsApp'),
    items: ctx.items,
  };
}

/** From the panel: store which items are ticked for this return. */
function saveItemSelection(row, returnId, selected) {
  var sheet = getSheet_();
  ensureHeaders_(sheet);
  var ctx = rowContext_(sheet, row);
  if (!ctx || ctx.get('Return ID') !== returnId) {
    throw new Error('That row changed. Click the return again.');
  }
  var items = ctx.items;
  items.forEach(function (it, i) {
    it.approved = selected.indexOf(i) !== -1;
  });
  ctx.setItems(items);
  var all = items.every(function (it) {
    return it.approved;
  });
  ctx.set('Approved items', all ? 'All items' : fitCell_(itemLines_(items, true)) || 'None');
  return items.filter(function (it) { return it.approved; }).length;
}

/** From the panel: accept the return (DC for the ticked items, sent on WhatsApp). */
function acceptFromPanel(row, returnId, force) {
  try {
    var sheet = getSheet_();
    var ctx = rowContext_(sheet, row);
    if (!ctx || ctx.get('Return ID') !== returnId) {
      return {ok: false, text: 'That row changed. Click the return again.'};
    }
    if (ctx.get('DC no.') && !force) {
      return {ok: false, confirm: true, text: ctx.get('DC no.') + ' already exists for this return.'};
    }
    var done = acceptRow_(ctx);
    return {
      ok: done.result.ok,
      text: done.result.ok
        ? 'DC ' + done.dc.dcNo + ' made and sent on WhatsApp.'
        : 'DC ' + done.dc.dcNo + ' made, but WhatsApp failed: ' + done.result.detail +
          ' Download it from the DC link column and send it yourself.',
    };
  } catch (err) {
    return {ok: false, text: String(err.message || err)};
  }
}

/**
 * From the panel: reject the return and tell the customer on WhatsApp. The
 * reason is optional. Needs the DC_CAMPAIGN_NAME_REJECT script property (a Live
 * AiSensy API campaign for the rejection template); without it the return is
 * still marked Rejected, just with no message.
 */
function rejectFromPanel(row, returnId, reason, force) {
  try {
    var sheet = getSheet_();
    var ctx = rowContext_(sheet, row);
    if (!ctx || ctx.get('Return ID') !== returnId) {
      return {ok: false, text: 'That row changed. Click the return again.'};
    }
    if (ctx.get('DC no.') && !force) {
      return {
        ok: false,
        confirm: true,
        text: 'A DC (' + ctx.get('DC no.') + ') was already made for this return.',
      };
    }
    ctx.set('Status', 'Rejected');
    var res = sendRejectionOnWhatsApp_(ctx, reason);
    if (res.ok) {
      ctx.set('DC WhatsApp', 'rejection sent');
      return {ok: true, text: 'Rejected. The customer was told on WhatsApp.'};
    }
    if (res.notConfigured) {
      ctx.set('DC WhatsApp', 'rejected (no message sent: rejection campaign not set up)');
      return {
        ok: true,
        text: 'Marked Rejected, but no WhatsApp was sent: the rejection campaign is not set up yet.',
      };
    }
    ctx.set('DC WhatsApp', 'rejection message failed: ' + res.detail);
    return {
      ok: false,
      text: 'Marked Rejected, but the WhatsApp failed: ' + res.detail + ' Tell the customer yourself.',
    };
  } catch (err) {
    return {ok: false, text: String(err.message || err)};
  }
}

function sendRejectionOnWhatsApp_(ctx, reason) {
  var p = PropertiesService.getScriptProperties();
  var apiKey = p.getProperty('AISENSY_API_KEY');
  var campaign = p.getProperty('DC_CAMPAIGN_NAME_REJECT');
  if (!apiKey || !campaign) {
    return {ok: false, notConfigured: true, detail: 'DC_CAMPAIGN_NAME_REJECT not set'};
  }
  var to = toWhatsAppNumber_(
    ctx.get('WhatsApp number'),
    p.getProperty('DEFAULT_COUNTRY_CODE') || '91',
  );
  if (!to) {
    return {ok: false, detail: 'Invalid WhatsApp number: ' + ctx.get('WhatsApp number')};
  }
  // WhatsApp variables can't hold line breaks, tabs or long runs of spaces, and
  // can't be empty, so tidy the reason and fall back to a neutral sentence.
  var why = String(reason || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 200);
  var payload = {
    apiKey: apiKey,
    campaignName: campaign,
    destination: to,
    userName: ctx.get('Company'),
    // {{1}} store name, {{2}} return ID, {{3}} reason.
    templateParams: [
      ctx.get('Company'),
      ctx.get('Return ID'),
      why || 'Please reply to this message for details.',
    ],
    source: 'b2b-return-rejected',
  };
  try {
    var res = UrlFetchApp.fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) return {ok: true, detail: ''};
    return {ok: false, detail: 'AiSensy ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200)};
  } catch (err) {
    return {ok: false, detail: String(err)};
  }
}

// -- Goods inspection ---------------------------------------------------------
// After the goods arrive, the team checks each accepted item and records: the
// quantity actually received, a decision, and (if the same product is not in
// stock) an alternate product. Saved per item in the hidden items data; the
// readable summary goes in the 'Inspection result' column.

var DECISIONS = {
  replace_same: 'Accept - replace with the same product',
  replace_alt: 'Accept - replace with an alternate product',
  reject: 'Reject',
};

function approvedItems_(ctx) {
  return ctx.items.filter(function (it) {
    return it.approved !== false;
  });
}

/** One readable line for an inspected item. */
function inspectionLine_(it) {
  var d = it.insp || {};
  if (!d.dec) return it.name + ' - not inspected yet';
  return (
    it.name + ' - received ' + (d.rcv === '' || d.rcv === undefined ? '?' : d.rcv) +
    ' of ' + it.qty + ' - ' + DECISIONS[d.dec] +
    (d.dec === 'replace_alt' && d.alt ? ' (' + d.alt + ')' : '') +
    (d.note ? ' - ' + d.note : '')
  );
}

/**
 * Product-name suggestions for the 'Alternate product' box, taken from the
 * website's own product search so the team picks an exact store product.
 * The site address can be overridden with the SITE_URL script property.
 * Never throws: on any problem there are simply no suggestions, and the team
 * can still type the name by hand.
 */
function suggestProducts(query) {
  try {
    var q = String(query || '').trim().slice(0, 60);
    if (q.length < 2) return [];
    var base = PropertiesService.getScriptProperties().getProperty('SITE_URL') || 'https://ooge.in';
    var res = UrlFetchApp.fetch(base.replace(/\/+$/, '') + '/api/product-suggest?q=' + encodeURIComponent(q), {
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) return [];
    var items = (JSON.parse(res.getContentText()).items || []).filter(function (x) {
      return typeof x === 'string';
    });
    return items.slice(0, 10);
  } catch (err) {
    return [];
  }
}

/** From the panel: store the inspection for this return's accepted items. */
function saveInspection(row, returnId, data) {
  try {
    var sheet = getSheet_();
    ensureHeaders_(sheet);
    var ctx = rowContext_(sheet, row);
    if (!ctx || ctx.get('Return ID') !== returnId) {
      return {ok: false, text: 'That row changed. Click the return again.'};
    }
    var items = ctx.items;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var d = data && data[i];
      if (it.approved === false || !d) continue;
      var rcv = String(d.rcv === undefined || d.rcv === null ? '' : d.rcv).trim();
      if (rcv !== '' && (!/^[0-9]+$/.test(rcv) || Number(rcv) > 999999)) {
        return {ok: false, text: 'Received quantity for "' + it.name + '" must be a whole number.'};
      }
      var dec = String(d.dec || '');
      if (dec !== '' && !DECISIONS[dec]) {
        return {ok: false, text: 'Unknown decision for "' + it.name + '".'};
      }
      var alt = String(d.alt || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 160);
      if (dec === 'replace_alt' && !alt) {
        return {ok: false, text: 'Enter the alternate product for "' + it.name + '".'};
      }
      it.insp = {
        rcv: rcv === '' ? '' : Number(rcv),
        dec: dec,
        alt: dec === 'replace_alt' ? alt : '',
        note: String(d.note || '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200),
      };
    }
    ctx.setItems(items);
    var done = approvedItems_(ctx).filter(function (it) {
      return it.insp && it.insp.dec;
    });
    ctx.set(
      'Inspection result',
      done.length ? fitCell_(approvedItems_(ctx).map(inspectionLine_).join('\n')) : '',
    );
    return {ok: true, text: 'Inspection saved (' + done.length + ' of ' + approvedItems_(ctx).length + ' items decided).'};
  } catch (err) {
    return {ok: false, text: String(err.message || err)};
  }
}

/** Counts per outcome, by item line (not by quantity). */
function outcomeCounts_(ctx) {
  var n = {accepted: 0, alt: 0, rejected: 0, notAccepted: 0};
  ctx.items.forEach(function (it) {
    if (it.approved === false) n.notAccepted++;
    else if (it.insp && it.insp.dec === 'reject') n.rejected++;
    else if (it.insp && it.insp.dec === 'replace_alt') {
      n.accepted++;
      n.alt++;
    } else if (it.insp && it.insp.dec === 'replace_same') n.accepted++;
  });
  var parts = [];
  if (n.accepted) {
    parts.push(
      n.accepted + ' accepted for replacement' + (n.alt ? ' (' + n.alt + ' with an alternate)' : ''),
    );
  }
  if (n.rejected) parts.push(n.rejected + ' rejected');
  if (n.notAccepted) parts.push(n.notAccepted + ' not accepted for return');
  return parts.join(', ');
}

/** What the customer sees against one item. */
function outcomeText_(it) {
  if (it.approved === false) return 'Not accepted for return';
  var d = it.insp || {};
  if (d.dec === 'replace_same') {
    return 'Accepted - will be replaced with the same product (' + it.name + ')';
  }
  if (d.dec === 'replace_alt') {
    return 'Accepted - will be replaced with ' + d.alt + ' (instead of ' + it.name + ')';
  }
  return 'Rejected after inspection';
}

/** Customer-facing outcome statement: every item, whatever the count. */
function outcomeHtml_(ctx) {
  var p = PropertiesService.getScriptProperties();
  var rows = ctx.items
    .map(function (it, i) {
      var d = it.insp || {};
      var accepted = it.approved !== false;
      return (
        '<tr><td class="c">' + (i + 1) + '</td><td>' + esc_(it.name) + '</td>' +
        '<td class="c">' + esc_(it.qty) + '</td>' +
        '<td class="c">' + (accepted && d.rcv !== '' && d.rcv !== undefined ? esc_(d.rcv) : '-') + '</td>' +
        '<td><b>' + esc_(outcomeText_(it)) + '</b></td>' +
        '<td>' + esc_(accepted ? d.note || '' : '') + '</td></tr>'
      );
    })
    .join('');
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');
  return (
    '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:12px;color:#111;margin:24px}' +
    'h1{font-size:19px;text-align:center;margin:0 0 4px;letter-spacing:1px}' +
    '.sub{text-align:center;color:#555;margin-bottom:14px}' +
    'table{width:100%;border-collapse:collapse}' +
    'td,th{border:1px solid #333;padding:6px;vertical-align:top}' +
    'th{background:#eee;text-align:left}.c{text-align:center}.sp{height:12px}' +
    '</style></head><body>' +
    '<h1>RETURN OUTCOME</h1>' +
    '<div class="sub">' + esc_(p.getProperty('RECEIVER_NAME') || DEFAULT_RECEIVER_NAME) + '</div>' +
    '<table><tr>' +
    '<td><b>Return ID:</b> ' + esc_(ctx.get('Return ID')) +
    '<br><b>Store:</b> ' + esc_(ctx.get('Company')) + '</td>' +
    '<td><b>DC no:</b> ' + esc_(ctx.get('DC no.')) +
    '<br><b>Date:</b> ' + today + '</td></tr></table>' +
    '<div class="sp"></div><p><b>' + esc_(outcomeCounts_(ctx)) + '.</b></p>' +
    '<table><thead><tr><th class="c" width="6%">S.No</th><th width="30%">Product</th>' +
    '<th class="c" width="11%">Qty requested</th><th class="c" width="11%">Qty received by us</th>' +
    '<th width="26%">Outcome</th><th width="18%">Remarks</th></tr></thead>' +
    '<tbody>' + rows + '</tbody></table>' +
    '<div class="sp"></div><p>For any questions, reply to the WhatsApp message this came with.</p>' +
    '</body></html>'
  );
}

function createOutcomePdf_(ctx) {
  var pdf = Utilities.newBlob(outcomeHtml_(ctx), 'text/html', 'outcome.html')
    .getAs('application/pdf')
    .setName('Return outcome ' + ctx.get('Return ID') + '.pdf');
  var file = getDcFolder_().createFile(pdf);
  // Public link, like the DC: WhatsApp has to fetch it to attach it.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file;
}

/** From the panel: tell the customer the outcome. Everything must be decided first. */
function notifyOutcome(row, returnId) {
  try {
    var sheet = getSheet_();
    ensureHeaders_(sheet);
    var ctx = rowContext_(sheet, row);
    if (!ctx || ctx.get('Return ID') !== returnId) {
      return {ok: false, text: 'That row changed. Click the return again.'};
    }
    var missing = approvedItems_(ctx).filter(function (it) {
      return !it.insp || !it.insp.dec || it.insp.rcv === '' || it.insp.rcv === undefined;
    });
    if (missing.length) {
      return {
        ok: false,
        text: 'Enter the received quantity and a decision for: ' +
          missing.map(function (it) { return it.name; }).join(', ') + '.',
      };
    }
    var file = createOutcomePdf_(ctx);
    ctx.set('Outcome PDF', file.getUrl());
    var res = sendOutcomeOnWhatsApp_(ctx, outcomeCounts_(ctx), file);
    if (res.ok) {
      ctx.set('Outcome WhatsApp', 'sent');
      return {ok: true, text: 'Saved. The customer was sent the outcome on WhatsApp.'};
    }
    if (res.notConfigured) {
      ctx.set('Outcome WhatsApp', 'not sent (outcome campaign not set up)');
      return {
        ok: true,
        text: 'Saved and the outcome PDF is made (see the Outcome PDF column), but no WhatsApp was sent: the outcome campaign is not set up yet.',
      };
    }
    ctx.set('Outcome WhatsApp', 'failed: ' + res.detail);
    return {
      ok: false,
      text: 'Saved, but the WhatsApp failed: ' + res.detail +
        ' Send the PDF from the Outcome PDF column to the customer yourself.',
    };
  } catch (err) {
    return {ok: false, text: String(err.message || err)};
  }
}

function sendOutcomeOnWhatsApp_(ctx, counts, file) {
  var p = PropertiesService.getScriptProperties();
  var apiKey = p.getProperty('AISENSY_API_KEY');
  var campaign = p.getProperty('DC_CAMPAIGN_NAME_OUTCOME');
  if (!apiKey || !campaign) {
    return {ok: false, notConfigured: true, detail: 'DC_CAMPAIGN_NAME_OUTCOME not set'};
  }
  var to = toWhatsAppNumber_(
    ctx.get('WhatsApp number'),
    p.getProperty('DEFAULT_COUNTRY_CODE') || '91',
  );
  if (!to) {
    return {ok: false, detail: 'Invalid WhatsApp number: ' + ctx.get('WhatsApp number')};
  }
  var payload = {
    apiKey: apiKey,
    campaignName: campaign,
    destination: to,
    userName: ctx.get('Company'),
    // {{1}} store name, {{2}} return ID, {{3}} one-line counts.
    templateParams: [ctx.get('Company'), ctx.get('Return ID'), counts],
    source: 'b2b-return-outcome',
    // Direct Drive host, as with the DC: the plain drive.google.com link redirects
    // and WhatsApp then drops the document.
    media: {
      url: 'https://drive.usercontent.google.com/download?id=' + file.getId() + '&export=download',
      filename: file.getName(),
    },
  };
  try {
    var res = UrlFetchApp.fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) return {ok: true, detail: ''};
    return {ok: false, detail: 'AiSensy ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200)};
  } catch (err) {
    return {ok: false, detail: String(err)};
  }
}

/** From the panel: a one-page inspection sheet (PDF) for the team to print. */
function printInspection(row, returnId) {
  try {
    var sheet = getSheet_();
    var ctx = rowContext_(sheet, row);
    if (!ctx || ctx.get('Return ID') !== returnId) {
      return {ok: false, text: 'That row changed. Click the return again.'};
    }
    if (approvedItems_(ctx).length === 0) {
      return {ok: false, text: 'No items are approved for this return.'};
    }
    var name = 'Inspection ' + ctx.get('Return ID') + '.pdf';
    var pdf = Utilities.newBlob(inspectionHtml_(ctx), 'text/html', 'inspection.html')
      .getAs('application/pdf')
      .setName(name);
    // Private to your Google account: it is an internal paper, not for customers.
    var file = getDcFolder_().createFile(pdf);
    return {ok: true, url: file.getUrl(), text: 'Inspection sheet ready.'};
  } catch (err) {
    return {ok: false, text: String(err.message || err)};
  }
}

function inspectionHtml_(ctx) {
  var box = function (on) {
    return on ? '&#9745;' : '&#9744;';
  };
  var rows = approvedItems_(ctx)
    .map(function (it, i) {
      var d = it.insp || {};
      return (
        '<tr style="height:46px"><td class="c">' + (i + 1) + '</td>' +
        '<td><b>' + esc_(it.name) + '</b><br><small>' + esc_(it.reason) + '</small></td>' +
        '<td class="c">' + esc_(it.qty) + '</td>' +
        '<td class="c">' + (d.rcv === '' || d.rcv === undefined ? '' : esc_(d.rcv)) + '</td>' +
        '<td>' + box(d.dec === 'replace_same') + ' Accept, replace (same)<br>' +
        box(d.dec === 'replace_alt') + ' Accept, replace (alternate)<br>' +
        box(d.dec === 'reject') + ' Reject</td>' +
        '<td>' + esc_(d.alt || '') + '</td>' +
        '<td>' + esc_(d.note || '') + '</td></tr>'
      );
    })
    .join('');
  var notAccepted = ctx.items
    .filter(function (it) {
      return it.approved === false;
    })
    .map(function (it) {
      return esc_(it.name) + ' x' + esc_(it.qty);
    });
  var today = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd MMM yyyy');
  return (
    '<html><head><meta charset="utf-8"><style>' +
    'body{font-family:Arial,sans-serif;font-size:11px;color:#111;margin:20px}' +
    'h1{font-size:18px;text-align:center;margin:0 0 4px;letter-spacing:1px}' +
    '.sub{text-align:center;color:#555;margin-bottom:12px}' +
    'table{width:100%;border-collapse:collapse}' +
    'td,th{border:1px solid #333;padding:6px;vertical-align:top}' +
    'th{background:#eee;text-align:left}.c{text-align:center}' +
    'small{color:#555}.nb td{border:none;padding:3px 0}.sp{height:12px}' +
    '</style></head><body>' +
    '<h1>RETURN INSPECTION SHEET</h1>' +
    '<div class="sub">Accepted for return vs received</div>' +
    '<table><tr>' +
    '<td><b>Return ID:</b> ' + esc_(ctx.get('Return ID')) +
    '<br><b>Store:</b> ' + esc_(ctx.get('Company')) +
    '<br><b>Phone:</b> ' + esc_(ctx.get('Phone')) + '</td>' +
    '<td><b>DC no:</b> ' + esc_(ctx.get('DC no.')) +
    '<br><b>AWB:</b> ' + esc_(ctx.get('AWB')) +
    '<br><b>Printed on:</b> ' + today + '</td>' +
    '<td><b>Received on:</b> ____________<br><br><b>Received by:</b> ____________</td>' +
    '</tr></table><div class="sp"></div>' +
    '<table><tr><th class="c" width="4%">S.No</th><th width="22%">Item / reason for return</th>' +
    '<th class="c" width="8%">Accepted qty</th><th class="c" width="8%">Received qty</th>' +
    '<th width="24%">Decision</th><th width="17%">Alternate product<br><small>(if same is not available)</small></th>' +
    '<th width="17%">Remarks</th></tr>' + rows + '</table>' +
    (notAccepted.length
      ? '<p><b>Not accepted for return (not expected):</b> ' + notAccepted.join(', ') + '</p>'
      : '') +
    '<div class="sp"></div><div class="sp"></div>' +
    '<table class="nb"><tr><td>Inspected by: ____________________</td>' +
    '<td>Signature: ____________________</td>' +
    '<td align="right">Date: ____________</td></tr></table>' +
    '</body></html>'
  );
}

function panelHtml_() {
  return (
    '<html><head><base target="_top"><style>' +
    'body{font-family:Arial,sans-serif;font-size:13px;margin:0;padding:14px;color:#111}' +
    'h3{margin:0 0 2px;font-size:15px}.sub{color:#666;margin-bottom:12px}' +
    '.it{display:flex;gap:10px;align-items:flex-start;padding:10px 4px;border-bottom:1px solid #e3e3e3;cursor:pointer}' +
    '.it input{margin-top:2px;transform:scale(1.25)}.it small{color:#666}' +
    '#count{margin:12px 0 6px;font-weight:bold}' +
    'button{width:100%;margin-top:8px;padding:10px;font-size:14px;background:#1a73e8;color:#fff;border:0;border-radius:4px;cursor:pointer}' +
    'button:disabled{background:#9bbcf0;cursor:default}' +
    '#msg{margin-top:10px;padding:8px;border-radius:4px;display:none}' +
    '.rej{margin-top:18px;padding-top:12px;border-top:1px solid #e3e3e3}.rej label{display:block;font-weight:bold;margin-bottom:4px}' +
    'textarea{width:100%;box-sizing:border-box;font:inherit;padding:6px;border:1px solid #ccc;border-radius:4px}' +
    'button.red{background:#c5221f}button.red:disabled{background:#e8a3a1}' +
    '.insphead{margin-top:18px;padding-top:12px;border-top:1px solid #e3e3e3;font-weight:bold;font-size:14px}' +
    '.ins{padding:10px 0;border-bottom:1px solid #eee}.ins label{display:block;color:#555;font-size:12px;margin:6px 0 2px}' +
    '.ins input,.ins select{width:100%;box-sizing:border-box;font:inherit;padding:5px;border:1px solid #ccc;border-radius:4px}' +
    'button.green{background:#188038}button.green:disabled{background:#8fc79c}' +
    'button.grey{background:#5f6368}button.grey:disabled{background:#b0b3b7}#link{margin-top:8px}' +
    '.ok{background:#e6f4ea}.bad{background:#fde7e9}.note{color:#666;font-size:12px;margin-top:12px}' +
    '</style></head><body>' +
    '<div id="empty" class="sub">Loading...</div>' +
    '<div id="main" style="display:none">' +
    '<h3 id="title"></h3><div class="sub" id="sub"></div>' +
    '<div style="margin:2px 0 6px"><a href="#" onclick="setAll(true);return false" style="font-size:12px">Tick all</a> &nbsp; ' +
    '<a href="#" onclick="setAll(false);return false" style="font-size:12px">Untick all</a></div>' +
    '<div id="list"></div><div id="count"></div>' +
    '<button id="accept" onclick="accept(false)">Accept &amp; send DC</button>' +
    '<div id="msg"></div>' +
    '<div id="inspwrap" style="display:none"><div class="insphead">Goods inspection</div>' +
    '<div class="note" style="margin:4px 0 8px">After the goods arrive, record what was received and decide each item.</div>' +
    '<div id="insp"></div><datalist id="altlist"></datalist>' +
    '<button id="saveinsp" onclick="saveInsp(false)">Save inspection</button>' +
    '<button id="notifyinsp" class="green" onclick="saveInsp(true)">Save &amp; notify customer</button>' +
    '<button id="printinsp" class="grey" onclick="printInsp()">Print inspection sheet</button>' +
    '<div id="link"></div></div>' +
    '<div class="rej"><label for="reason">Reason for rejecting (optional)</label>' +
    '<textarea id="reason" rows="2" placeholder="e.g. Item was used and not in original packaging"></textarea>' +
    '<button id="reject" class="red" onclick="reject(false)">Reject &amp; notify</button></div>' +
    '<div class="note">Untick any item you are not taking back. The DC lists only the ticked items.</div>' +
    '</div><script>' +
    'var cur=null,key="";' +
    'function $(i){return document.getElementById(i)}' +
    'function show(m,c){var e=$("msg");e.textContent=m;e.className=c;e.style.display="block"}' +
    'function render(st){' +
    ' if(st.none){$("main").style.display="none";$("empty").style.display="block";$("empty").textContent=st.message;cur=null;key="";return}' +
    ' var k=st.row+"|"+st.returnId+"|"+JSON.stringify(st.items)+"|"+st.status+"|"+st.dcNo+"|"+st.outcome;' +
    ' if(k===key)return; key=k;' +
    ' if(!cur||cur.returnId!==st.returnId){$("reason").value="";$("link").textContent="";$("msg").style.display="none"}' +
    ' cur=st;' +
    ' $("empty").style.display="none";$("main").style.display="block";' +
    ' $("title").textContent=st.returnId;' +
    ' $("sub").textContent=st.company+" - "+st.status+(st.dcNo?" - "+st.dcNo:"");' +
    ' var l=$("list");l.textContent="";' +
    ' st.items.forEach(function(it,i){' +
    '  var lab=document.createElement("label");lab.className="it";' +
    '  var cb=document.createElement("input");cb.type="checkbox";cb.checked=it.approved!==false;cb.onchange=function(){save()};' +
    '  var sp=document.createElement("span");var b=document.createElement("b");b.textContent=it.name+"  x"+it.qty;' +
    '  var sm=document.createElement("small");sm.textContent=it.reason||"";' +
    '  sp.appendChild(b);sp.appendChild(document.createElement("br"));sp.appendChild(sm);' +
    '  lab.appendChild(cb);lab.appendChild(sp);l.appendChild(lab)});' +
    ' count();renderInsp(st)}' +
    'function ticked(){return [].map.call(document.querySelectorAll("#list input"),function(x,i){return x.checked?i:-1}).filter(function(i){return i>=0})}' +
    'function count(){var n=ticked().length;$("count").textContent=n+" of "+cur.items.length+" items approved";$("accept").disabled=n===0}' +
    'function setAll(v){[].forEach.call(document.querySelectorAll("#list input"),function(x){x.checked=v});save()}' +
    'function save(){count();var st=cur;google.script.run.withFailureHandler(function(e){show(e.message||e,"bad")})' +
    ' .saveItemSelection(st.row,st.returnId,ticked())}' +
    'function accept(force){var st=cur;$("accept").disabled=true;show("Working...","ok");' +
    ' google.script.run.withSuccessHandler(function(r){' +
    '  if(r.confirm){if(confirm(r.text+" Make a NEW DC and send it again?"))return accept(true);$("msg").style.display="none";count();return}' +
    '  show(r.text,r.ok?"ok":"bad");key="";count()})' +
    ' .withFailureHandler(function(e){show(e.message||e,"bad");count()})' +
    ' .acceptFromPanel(st.row,st.returnId,!!force)}' +
    'var DEC=[["replace_same","Accept - replace with the same product"],["replace_alt","Accept - replace with an alternate product"],["reject","Reject"]];' +
    'function renderInsp(st){var w=$("inspwrap"),b=$("insp");b.textContent="";' +
    ' var on=st.status!=="Pending"&&st.status!=="Rejected";w.style.display=on?"block":"none";if(!on)return;' +
    ' st.items.forEach(function(it,i){if(it.approved===false)return;var d=it.insp||{};' +
    '  var div=document.createElement("div");div.className="ins";div.setAttribute("data-i",i);' +
    '  var t=document.createElement("b");t.textContent=it.name+"  (accepted x"+it.qty+")";div.appendChild(t);' +
    '  function lab(x){var l=document.createElement("label");l.textContent=x;div.appendChild(l)}' +
    '  lab("Received quantity");var r=document.createElement("input");r.type="number";r.min="0";r.className="rcv";r.value=(d.rcv===undefined)?"":d.rcv;div.appendChild(r);' +
    '  lab("Decision");var s=document.createElement("select");s.className="dec";var o0=document.createElement("option");o0.value="";o0.textContent="Choose...";s.appendChild(o0);' +
    '  DEC.forEach(function(x){var o=document.createElement("option");o.value=x[0];o.textContent=x[1];if(d.dec===x[0])o.selected=true;s.appendChild(o)});div.appendChild(s);' +
    '  var al=document.createElement("input");al.className="alt";al.placeholder="Alternate product (type to search)";al.setAttribute("list","altlist");al.setAttribute("autocomplete","off");al.oninput=function(){suggest(al.value)};al.value=d.alt||"";al.style.display=d.dec==="replace_alt"?"block":"none";al.style.marginTop="6px";div.appendChild(al);' +
    '  s.onchange=function(){al.style.display=s.value==="replace_alt"?"block":"none"};' +
    '  lab("Remarks (optional)");var n=document.createElement("input");n.className="note2";n.value=d.note||"";div.appendChild(n);' +
    '  b.appendChild(div)})}' +
    'var sugTimer=null;' +
    'function suggest(v){clearTimeout(sugTimer);if(v.trim().length<2)return;' +
    ' sugTimer=setTimeout(function(){google.script.run.withSuccessHandler(function(items){' +
    '  var d=$("altlist");d.textContent="";(items||[]).forEach(function(x){var o=document.createElement("option");o.value=x;d.appendChild(o)})})' +
    '  .withFailureHandler(function(){}).suggestProducts(v)},300)}' +
    'function inspData(){var out=cur.items.map(function(){return null});' +
    ' [].forEach.call(document.querySelectorAll("#insp .ins"),function(div){var i=Number(div.getAttribute("data-i"));' +
    '  out[i]={rcv:div.querySelector(".rcv").value,dec:div.querySelector(".dec").value,alt:div.querySelector(".alt").value,note:div.querySelector(".note2").value}});return out}' +
    'function busy(on){["saveinsp","notifyinsp","printinsp"].forEach(function(i){$(i).disabled=on})}' +
    'function bad(e){busy(false);show(e.message||e,"bad")}' +
    'function saveInsp(notify){var st=cur;busy(true);show("Working...","ok");' +
    ' google.script.run.withSuccessHandler(function(r){' +
    '  if(!r.ok){busy(false);show(r.text,"bad");return}' +
    '  if(!notify){busy(false);show(r.text,"ok");key="";return}' +
    '  google.script.run.withSuccessHandler(function(n){busy(false);show(n.text,n.ok?"ok":"bad");key=""})' +
    '   .withFailureHandler(bad).notifyOutcome(st.row,st.returnId)})' +
    ' .withFailureHandler(bad).saveInspection(st.row,st.returnId,inspData())}' +
    'function printInsp(){var st=cur;busy(true);show("Making the sheet...","ok");' +
    ' google.script.run.withSuccessHandler(function(r){' +
    '  if(!r.ok){busy(false);show(r.text,"bad");return}' +
    '  google.script.run.withSuccessHandler(function(p){busy(false);' +
    '   if(!p.ok){show(p.text,"bad");return}' +
    '   show("Inspection sheet ready.","ok");var l=$("link");l.textContent="";' +
    '   var a=document.createElement("a");a.href=p.url;a.target="_blank";a.textContent="Open the inspection sheet (then print)";l.appendChild(a)})' +
    '   .withFailureHandler(bad).printInspection(st.row,st.returnId)})' +
    ' .withFailureHandler(bad).saveInspection(st.row,st.returnId,inspData())}' +
    'function reject(force){var st=cur;' +
    ' if(!force&&!confirm("Reject "+st.returnId+" and message the customer on WhatsApp?"))return;' +
    ' $("reject").disabled=true;show("Working...","ok");' +
    ' google.script.run.withSuccessHandler(function(r){' +
    '  $("reject").disabled=false;' +
    '  if(r.confirm){if(confirm(r.text+" Reject anyway?"))return reject(true);$("msg").style.display="none";return}' +
    '  show(r.text,r.ok?"ok":"bad");key="";if(r.ok)$("reason").value=""})' +
    ' .withFailureHandler(function(e){$("reject").disabled=false;show(e.message||e,"bad")})' +
    ' .rejectFromPanel(st.row,st.returnId,$("reason").value,!!force)}' +
    'function poll(){google.script.run.withSuccessHandler(render).getPanelState()}' +
    'poll();setInterval(poll,1500);' +
    '</script></body></html>'
  );
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
  // If DC_CAMPAIGN_NAME_AWB is set, use that campaign: its template has a third
  // variable for the AWB number. Otherwise fall back to the two-variable one.
  var awbCampaign = p.getProperty('DC_CAMPAIGN_NAME_AWB');
  var withAwb = Boolean(awbCampaign);
  var campaign = awbCampaign || p.getProperty('DC_CAMPAIGN_NAME');
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

  var params = [ctx.get('Company'), ctx.get('Return ID')];
  if (withAwb) {
    // A variable cannot be empty, so say so when no AWB was entered yet.
    params.push(ctx.get('AWB') || 'will be shared shortly');
  }
  var payload = {
    apiKey: apiKey,
    campaignName: campaign,
    destination: to,
    userName: ctx.get('Company'),
    // Order matters: {{1}} company, {{2}} return ID, and (new template only)
    // {{3}} the AWB number.
    templateParams: params,
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

  function chunkName(k) {
    return k === 1 ? DATA_HEADER : DATA_HEADER + ' ' + k;
  }
  function addColumn(name) {
    var col = sheet.getLastColumn() + 1;
    sheet.getRange(1, col).setValue(name).setFontWeight('bold');
    sheet.hideColumns(col);
    cols[name] = col - 1;
    values[col - 1] = '';
  }

  var ctx = {
    get: function (h) {
      return String(values[cols[h]] === undefined ? '' : values[cols[h]]).replace(/^'/, '');
    },
    set: function (h, v) {
      if (cols[h] === undefined) return;
      sheet.getRange(row, cols[h] + 1).setValue(v);
      values[cols[h]] = v;
    },
    /** Store the item list, split over as many hidden cells as it needs. */
    setItems: function (items) {
      var json = JSON.stringify(items);
      var chunks = [];
      for (var i = 0; i < json.length; i += DATA_CHUNK) chunks.push(json.slice(i, i + DATA_CHUNK));
      if (!chunks.length) chunks.push('[]');
      chunks.forEach(function (c, k) {
        var name = chunkName(k + 1);
        if (cols[name] === undefined) addColumn(name);
        ctx.set(name, '~' + c);
      });
      // Blank any leftover chunk cells from an earlier, longer list.
      for (var k = chunks.length + 1; cols[chunkName(k)] !== undefined; k++) ctx.set(chunkName(k), '');
      ctx.items = items;
    },
  };

  // Items: the chunks joined back together. Returns made before chunking kept the
  // whole list in one 'Items data' cell (no "~"), or in the older 'Items (JSON)'.
  var json = '';
  for (var k = 1; cols[chunkName(k)] !== undefined; k++) {
    var raw = String(values[cols[chunkName(k)]] === undefined ? '' : values[cols[chunkName(k)]]);
    if (raw === '') break;
    json += raw.charAt(0) === '~' ? raw.slice(1) : raw;
  }
  ctx.items = [];
  [json, ctx.get('Items (JSON)')].some(function (text) {
    try {
      var parsed = JSON.parse(text || '[]');
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

// -- Outbox for the B2B Returns app ------------------------------------------
// The B2B Returns app (claude.ai) cannot call AiSensy itself. When the team taps
// "Send on WhatsApp" there, the app uploads the PDF to Google Drive (shared by
// link) and drops a small JSON send request (send-*.json) into the "Ooge B2B
// Return DCs" folder - the same folder this script keeps the DCs in, already
// shared with the team. processOutbox() runs every minute, sends the matching AiSensy
// campaign (the same templates as above), and writes the result back into the
// request file, which the app reads to show Sent or Failed.
//
// One-time setup: pick setupOutbox in the function dropdown, click Run, allow
// access. It turns on the every-minute trigger. Anyone using the app needs to
// be able to add files to the "Ooge B2B Return DCs" folder; to share it with
// more people, put their emails (comma-separated) in the Script Property
// OUTBOX_EDITORS and run setupOutbox again, or share the folder from Drive.

var OUTBOX_KINDS = {dc: true, received: true, shipped: true, outcome: true, reject: true};

function setupOutbox() {
  var folder = getOutboxFolder_();
  var editors = String(PropertiesService.getScriptProperties().getProperty('OUTBOX_EDITORS') || '')
    .split(',')
    .map(function (e) { return e.trim(); })
    .filter(function (e) { return /@/.test(e); });
  if (editors.length) folder.addEditors(editors);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processOutbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processOutbox').timeBased().everyMinutes(1).create();
  Logger.log('Outbox folder: ' + folder.getUrl() + (editors.length ? ' (shared with ' + editors.join(', ') + ')' : ''));
}

function getOutboxFolder_() {
  return getDcFolder_();
}

/** Runs every minute: send every queued request in the outbox folder. */
function processOutbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return;
  try {
    var files = getOutboxFolder_().searchFiles("title contains 'send-' and trashed = false");
    var started = Date.now();
    while (files.hasNext() && Date.now() - started < 240000) {
      var f = files.next();
      if (!/^send-.*\.json$/.test(f.getName())) continue;
      var req;
      try {
        req = JSON.parse(f.getBlob().getDataAsString());
      } catch (err) {
        writeOutboxResult_(f, {status: 'failed', detail: 'Unreadable request'});
        continue;
      }
      if (req.status && req.status !== 'queued') continue;
      var r = sendFromApp_(req);
      req.status = r.ok ? 'sent' : 'failed';
      req.detail = r.detail || '';
      req.doneAt = new Date().toISOString();
      writeOutboxResult_(f, req);
    }
  } finally {
    lock.releaseLock();
  }
}

function writeOutboxResult_(file, data) {
  var name = file.getName().replace(/^send-/, data.status === 'sent' ? 'sent-' : 'failed-');
  try {
    file.setContent(JSON.stringify(data));
    file.setName(name);
  } catch (err) {
    // Could not change the app user's file: leave a result file beside it instead.
    file.getParents().next().createFile(name, JSON.stringify(data), 'application/json');
  }
}

/** WhatsApp variables can't be empty or hold line breaks. */
function waVar_(v, fallback) {
  var s = String(v === undefined || v === null ? '' : v)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 200);
  return s || fallback;
}

function sendFromApp_(req) {
  var p = PropertiesService.getScriptProperties();
  var apiKey = p.getProperty('AISENSY_API_KEY');
  if (!apiKey) return {ok: false, detail: 'AISENSY_API_KEY not set'};
  if (!req || !OUTBOX_KINDS[req.kind]) return {ok: false, detail: 'Unknown request type'};
  var to = toWhatsAppNumber_(req.whatsapp, p.getProperty('DEFAULT_COUNTRY_CODE') || '91');
  if (!to) return {ok: false, detail: 'Invalid WhatsApp number: ' + req.whatsapp};
  var company = waVar_(req.company, 'Customer');
  var returnId = waVar_(req.returnId, '-');
  var campaign;
  var params;
  var media = null;
  if (req.kind === 'dc') {
    var awbCampaign = p.getProperty('DC_CAMPAIGN_NAME_AWB');
    campaign = awbCampaign || p.getProperty('DC_CAMPAIGN_NAME');
    params = [company, returnId];
    if (awbCampaign) params.push(waVar_(req.awb, 'will be shared shortly'));
  } else if (req.kind === 'received') {
    // Goods received note: {{1}} store, {{2}} return ID, {{3}} one-line summary; PDF lists every product.
    campaign = p.getProperty('DC_CAMPAIGN_NAME_RECEIVED') || 'b2b_return_received_note';
    params = [company, returnId, waVar_(req.summary, 'see the attached note')];
  } else if (req.kind === 'shipped') {
    // Shipment sent: {{1}} store, {{2}} return ID, {{3}} courier and AWB, {{4}} products; PDF = shipment delivery challan.
    campaign = p.getProperty('DC_CAMPAIGN_NAME_SHIPPED') || 'b2b_return_replacement_shipment';
    params = [company, returnId, waVar_(req.awb, 'will be shared shortly'), waVar_(req.summary, 'see the attached delivery challan')];
  } else if (req.kind === 'outcome') {
    campaign = p.getProperty('DC_CAMPAIGN_NAME_OUTCOME');
    params = [company, returnId, waVar_(req.summary, 'Please see the attached outcome')];
  } else {
    campaign = p.getProperty('DC_CAMPAIGN_NAME_REJECT');
    params = [company, returnId, waVar_(req.reason, 'Please reply to this message for details.')];
  }
  if (!campaign) return {ok: false, detail: 'AiSensy campaign for "' + req.kind + '" is not set in Script Properties'};
  if (req.kind !== 'reject') {
    if (!/^[A-Za-z0-9_-]{10,}$/.test(String(req.fileId || ''))) return {ok: false, detail: 'Missing PDF'};
    // Drive's direct host: WhatsApp drops documents behind a redirect.
    media = {
      url: 'https://drive.usercontent.google.com/download?id=' + req.fileId + '&export=download',
      filename: waVar_(req.filename, returnId + '.pdf'),
    };
  }
  var payload = {
    apiKey: apiKey,
    campaignName: campaign,
    destination: to,
    userName: company,
    templateParams: params,
    source: 'b2b-returns-app-' + req.kind,
  };
  if (media) payload.media = media;
  try {
    var res = UrlFetchApp.fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 200) return {ok: true, detail: ''};
    return {ok: false, detail: 'AiSensy ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200)};
  } catch (err) {
    return {ok: false, detail: String(err)};
  }
}

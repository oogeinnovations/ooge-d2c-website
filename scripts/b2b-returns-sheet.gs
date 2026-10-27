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
  ctx.set(DATA_HEADER, JSON.stringify(items));
  var all = items.every(function (it) {
    return it.approved;
  });
  ctx.set('Approved items', all ? 'All items' : itemLines_(items, true) || 'None');
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
    '.ok{background:#e6f4ea}.bad{background:#fde7e9}.note{color:#666;font-size:12px;margin-top:12px}' +
    '</style></head><body>' +
    '<div id="empty" class="sub">Loading...</div>' +
    '<div id="main" style="display:none">' +
    '<h3 id="title"></h3><div class="sub" id="sub"></div>' +
    '<div id="list"></div><div id="count"></div>' +
    '<button id="accept" onclick="accept(false)">Accept &amp; send DC</button>' +
    '<div id="msg"></div>' +
    '<div class="note">Untick any item you are not taking back. The DC lists only the ticked items.</div>' +
    '</div><script>' +
    'var cur=null,key="";' +
    'function $(i){return document.getElementById(i)}' +
    'function show(m,c){var e=$("msg");e.textContent=m;e.className=c;e.style.display="block"}' +
    'function render(st){' +
    ' if(st.none){$("main").style.display="none";$("empty").style.display="block";$("empty").textContent=st.message;cur=null;key="";return}' +
    ' var k=st.row+"|"+st.returnId+"|"+JSON.stringify(st.items)+"|"+st.status+"|"+st.dcNo;' +
    ' if(k===key)return; key=k; cur=st;' +
    ' $("empty").style.display="none";$("main").style.display="block";$("msg").style.display="none";' +
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
    ' count()}' +
    'function ticked(){return [].map.call(document.querySelectorAll("#list input"),function(x,i){return x.checked?i:-1}).filter(function(i){return i>=0})}' +
    'function count(){var n=ticked().length;$("count").textContent=n+" of "+cur.items.length+" items approved";$("accept").disabled=n===0}' +
    'function save(){count();var st=cur;google.script.run.withFailureHandler(function(e){show(e.message||e,"bad")})' +
    ' .saveItemSelection(st.row,st.returnId,ticked())}' +
    'function accept(force){var st=cur;$("accept").disabled=true;show("Working...","ok");' +
    ' google.script.run.withSuccessHandler(function(r){' +
    '  if(r.confirm){if(confirm(r.text+" Make a NEW DC and send it again?"))return accept(true);$("msg").style.display="none";count();return}' +
    '  show(r.text,r.ok?"ok":"bad");key="";count()})' +
    ' .withFailureHandler(function(e){show(e.message||e,"bad");count()})' +
    ' .acceptFromPanel(st.row,st.returnId,!!force)}' +
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

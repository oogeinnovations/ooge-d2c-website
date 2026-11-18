// Reads a filled-in bulk-return file (.xlsx from the template, or a .csv) in the
// browser and turns it into the form's item rows. Nothing is uploaded anywhere:
// the file is parsed on the customer's own device, and only the resulting items
// are submitted with the form like any others.
import {RETURN_REASONS, type ReturnItem} from '~/lib/b2bReturn';

export type ParsedUpload = {items: ReturnItem[]; errors: string[]};

/** Parse a CSV text: handles quotes, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  // A leading byte-order mark (Excel adds one when saving CSV) is not data.
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.replace(/[^A-Za-z]/g, '').toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n - 1;
}

/** Text of an element, skipping phonetic runs (<rPh>) that Excel adds for some languages. */
function textOf(el: Element): string {
  return Array.from(el.getElementsByTagName('t'))
    .filter((t) => t.parentElement?.nodeName !== 'rPh')
    .map((t) => t.textContent ?? '')
    .join('');
}

/** Rows of the first worksheet of an .xlsx file, as plain text cells. */
export async function readXlsxRows(bytes: Uint8Array): Promise<string[][]> {
  // Loaded on demand, so the library only reaches customers who use bulk upload.
  const {unzipSync, strFromU8} = await import('fflate/browser');
  const files = unzipSync(bytes, {
    filter: (f) => /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/.test(f.name),
  });
  const sheetName = Object.keys(files)
    .filter((n) => n.startsWith('xl/worksheets/'))
    .sort((a, b) => parseInt(a.replace(/\D/g, ''), 10) - parseInt(b.replace(/\D/g, ''), 10))[0];
  if (!sheetName) throw new Error('No worksheet found');

  const parse = (u8: Uint8Array) =>
    new DOMParser().parseFromString(strFromU8(u8), 'application/xml');

  const shared = files['xl/sharedStrings.xml']
    ? Array.from(parse(files['xl/sharedStrings.xml']).getElementsByTagName('si')).map(textOf)
    : [];

  const out: string[][] = [];
  for (const rowEl of Array.from(parse(files[sheetName]).getElementsByTagName('row'))) {
    const r = parseInt(rowEl.getAttribute('r') ?? '', 10);
    const cells: string[] = [];
    for (const c of Array.from(rowEl.getElementsByTagName('c'))) {
      const type = c.getAttribute('t');
      const v = c.getElementsByTagName('v')[0]?.textContent ?? '';
      const value =
        type === 's' ? (shared[Number(v)] ?? '')
        : type === 'inlineStr' ? textOf(c)
        : v;
      const i = colIndex(c.getAttribute('r') ?? 'A');
      while (cells.length < i) cells.push('');
      cells[i] = value;
    }
    while (out.length < r - 1) out.push([]);
    out[r - 1] = cells;
  }
  return out;
}

const norm = (s: string) => s.trim().toLowerCase();

/** Turn sheet rows into form items, collecting every problem with its row number. */
export function rowsToItems(rows: string[][]): ParsedUpload {
  // Find the header row (extra title rows above it are fine). A file without
  // "Product name" and "Quantity" columns is not the return template, so say that
  // once, clearly, instead of listing every row as wrong.
  const headerAt = rows.findIndex(
    (r) => r.some((c) => /product|item/.test(norm(c))) && r.some((c) => /quantity|qty/.test(norm(c))),
  );
  if (headerAt < 0) {
    return {
      items: [],
      errors: [
        'This file does not look like the return template (it needs "Product name" and "Quantity" columns). Click "Download template", fill in the Quantity and Reason for the products you are returning, and upload that file.',
      ],
    };
  }
  const head = rows[headerAt].map(norm);
  const find = (re: RegExp, fallback: number) => {
    const i = head.findIndex((h) => re.test(h));
    return i >= 0 ? i : fallback;
  };
  const colName = find(/product|item/, 0);
  const colQty = find(/quantity|qty/, 1);
  const colReason = head.findIndex((h) => /reason/.test(h) && !/detail/.test(h));
  const colReasonAt = colReason >= 0 ? colReason : 2;
  const colNote = find(/detail|note|remark/, 3);

  const items: ReturnItem[] = [];
  const errors: string[] = [];
  const canon = new Map(RETURN_REASONS.map((r) => [norm(r), r as string]));

  rows.forEach((row, idx) => {
    if (idx <= headerAt) return;
    const name = (row[colName] ?? '').trim();
    const qtyRaw = (row[colQty] ?? '').trim();
    const reasonRaw = (row[colReasonAt] ?? '').trim();
    const note = (row[colNote] ?? '').trim();
    const where = `Row ${idx + 1}${name ? ` (${name})` : ''}`;

    // Not being returned: no quantity (or 0), and nothing else typed.
    const qtyNum = Number(qtyRaw);
    if (qtyRaw === '' || (qtyRaw !== '' && qtyNum === 0)) {
      if (qtyRaw === '' && reasonRaw !== '' && name) {
        errors.push(`${where}: a reason is chosen but the Quantity is empty.`);
      }
      return;
    }
    if (!name) return void errors.push(`Row ${idx + 1}: the product name is missing.`);
    if (!Number.isInteger(qtyNum) || qtyNum < 1 || qtyNum > 9999) {
      return void errors.push(`${where}: Quantity must be a whole number from 1 to 9999.`);
    }
    const reason = canon.get(norm(reasonRaw));
    if (!reason) {
      return void errors.push(
        `${where}: ${reasonRaw ? `"${reasonRaw}" is not a valid reason` : 'choose a Reason'} (use the dropdown).`,
      );
    }
    if (reason === 'Other' && !note) {
      return void errors.push(`${where}: describe the reason in the Details column.`);
    }
    items.push({
      name: name.slice(0, 160),
      qty: String(qtyNum),
      reason,
      note: reason === 'Other' ? note.slice(0, 300) : '',
    });
  });
  return {items, errors};
}

export async function parseReturnFile(file: File): Promise<ParsedUpload> {
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv')) return rowsToItems(parseCsv(await file.text()));
  if (lower.endsWith('.xlsx')) {
    return rowsToItems(await readXlsxRows(new Uint8Array(await file.arrayBuffer())));
  }
  return {items: [], errors: ['Please upload the .xlsx template (or a .csv file).']};
}

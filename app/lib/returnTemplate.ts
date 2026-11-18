// Builds the downloadable "bulk return" Excel template: every store product name
// is already filled in, and the customer only enters a Quantity and picks a
// Reason (a real dropdown) for the products they are returning.
//
// An .xlsx file is a zip of XML parts, so it is written by hand with `fflate`.
// That is the only way to get a working dropdown: a CSV can't have one, and the
// common spreadsheet libraries don't run on Oxygen (Cloudflare Workers).
// 'fflate/browser' on purpose: the default server entry pulls in a Node-only
// module that Oxygen (Cloudflare Workers) cannot load.
import {strToU8, zipSync} from 'fflate/browser';
import {RETURN_REASONS} from '~/lib/b2bReturn';

export const TEMPLATE_HEADERS = [
  'Product name',
  'Quantity',
  'Reason',
  'Details (only if Reason is Other)',
] as const;

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

const XML = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';

/** Escape for XML text and drop control characters Excel refuses to open. */
function esc(text: string): string {
  const printable = Array.from(text)
    .filter((ch) => {
      const c = ch.charCodeAt(0);
      return c >= 32 || c === 9 || c === 10 || c === 13;
    })
    .join('');
  return printable
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cell(ref: string, text: string, style = 0): string {
  return `<c r="${ref}" t="inlineStr"${style ? ` s="${style}"` : ''}><is><t xml:space="preserve">${esc(text)}</t></is></c>`;
}

const HELP = [
  'How to fill this in',
  '1. Find each product you are returning.',
  '2. Type the Quantity (a whole number).',
  '3. Choose a Reason from the dropdown.',
  '4. If the reason is Other, describe it in Details.',
  '5. Leave every other product blank, then upload this file.',
];

/** The finished workbook as bytes, ready to send as a download. */
export function buildReturnTemplate(products: string[]): Uint8Array {
  const names = [...new Set(products.map((p) => p.trim()).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b),
  );
  const last = Math.max(names.length + 1, 2);

  const header = [
    ...TEMPLATE_HEADERS.map((h, i) => cell(`${'ABCD'[i]}1`, h, 1)),
    cell('F1', HELP[0], 1),
  ].join('');
  const body = names
    .map((name, i) => {
      const r = i + 2;
      const help = HELP[i + 1] ? cell(`F${r}`, HELP[i + 1]) : '';
      return `<row r="${r}">${cell(`A${r}`, name)}${help}</row>`;
    })
    .join('');
  // If there are fewer products than help lines, keep the remaining help lines.
  const extra = HELP.slice(names.length + 1)
    .map((line, i) => {
      const r = names.length + 2 + i;
      return `<row r="${r}">${cell(`F${r}`, line)}</row>`;
    })
    .join('');

  const reasons = RETURN_REASONS.join(',');
  const sheet =
    XML +
    `<worksheet xmlns="${NS}">` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<cols><col min="1" max="1" width="44" customWidth="1"/><col min="2" max="2" width="12" customWidth="1"/>' +
    '<col min="3" max="3" width="28" customWidth="1"/><col min="4" max="4" width="34" customWidth="1"/>' +
    '<col min="5" max="5" width="3" customWidth="1"/><col min="6" max="6" width="52" customWidth="1"/></cols>' +
    `<sheetData><row r="1">${header}</row>${body}${extra}</sheetData>` +
    '<dataValidations count="2">' +
    `<dataValidation type="whole" operator="greaterThanOrEqual" allowBlank="1" showErrorMessage="1" errorTitle="Quantity" error="Enter a whole number, 0 or more." sqref="B2:B${last}"><formula1>0</formula1></dataValidation>` +
    `<dataValidation type="list" allowBlank="1" showErrorMessage="1" errorTitle="Reason" error="Choose a reason from the list." sqref="C2:C${last}"><formula1>"${esc(reasons)}"</formula1></dataValidation>` +
    '</dataValidations></worksheet>';

  const styles =
    XML +
    `<styleSheet xmlns="${NS}">` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
    '<fill><patternFill patternType="solid"><fgColor rgb="FFE8E8E8"/><bgColor indexed="64"/></patternFill></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>' +
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    '</styleSheet>';

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      XML +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ),
    '_rels/.rels': strToU8(
      XML +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    'xl/workbook.xml': strToU8(
      XML +
        `<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        '<sheets><sheet name="Return items" sheetId="1" r:id="rId1"/></sheets></workbook>',
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      XML +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    ),
    'xl/worksheets/sheet1.xml': strToU8(sheet),
    'xl/styles.xml': strToU8(styles),
  };
  return zipSync(files, {level: 6});
}

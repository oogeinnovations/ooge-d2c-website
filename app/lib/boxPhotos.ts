// Shrink a photo in the browser before upload: at most 1600 px on the long side,
// saved as JPEG. A phone photo of 4-8 MB becomes about 200-400 KB, so a request
// with several photos stays small. Browser-only (uses canvas).
//
// IMPORTANT: the site's Content-Security-Policy does not allow images loaded from
// blob: or data: URLs, so anything that goes through <img src="..."> fails, even
// for a plain JPEG. Files are therefore decoded with createImageBitmap(), which
// makes no URL, and thumbnails are drawn on a <canvas> rather than shown in <img>.
import type {BoxPhoto} from '~/lib/b2bReturn';

const MAX_SIDE = 1600;
const QUALITY = 0.75;

const COMMON = /\.(jpe?g|png|webp|gif|bmp|avif|ico)$/i;
const HEIC = /\.(heic|heif)$/i;

/**
 * Why a chosen file clearly can't be a photo, or null to let the browser try. Only
 * files that are obviously not pictures (a PDF, a spreadsheet) are turned away
 * here; everything else is attempted, so any picture format the browser can open
 * is accepted.
 */
export function photoProblem(file: {name: string; type: string}): string | null {
  const type = file.type.toLowerCase();
  const looksImage =
    type.startsWith('image/') || HEIC.test(file.name) || (type === '' && COMMON.test(file.name));
  return looksImage
    ? null
    : `"${file.name}" is not a photo. Please choose a picture of the boxes.`;
}

/** What to tell the customer when the browser could not open a picture. */
export function undecodableMessage(file: {name: string; type: string}): string {
  const type = file.type.toLowerCase();
  if (type === 'image/heic' || type === 'image/heif' || HEIC.test(file.name)) {
    return `"${file.name}" is a HEIC photo (the default iPhone format), which this browser can't open. Please use a JPG or PNG. On an iPhone, choose the photo from the Photos app, or set Settings > Camera > Formats > Most Compatible.`;
  }
  return `"${file.name}" could not be opened. It may be damaged or in a format this browser doesn't support. Please try another photo (JPG or PNG).`;
}

export async function shrinkPhoto(file: File): Promise<BoxPhoto> {
  const problem = photoProblem(file);
  if (problem) throw new Error(problem);
  if (typeof createImageBitmap !== 'function') {
    throw new Error('This browser cannot process photos. Please update it or try another one.');
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error(undecodableMessage(file));
  }
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');
    ctx.fillStyle = '#fff'; // a transparent PNG would otherwise turn black as a JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
    const base = file.name.replace(/\.[^.]+$/, '') || 'box';
    return {name: base.slice(0, 60) + '.jpg', data: dataUrl.split(',')[1] ?? ''};
  } finally {
    bitmap.close();
  }
}

/** Draw a stored photo (base64 JPEG) into a square canvas, cropped to fill it. */
export async function drawThumb(canvas: HTMLCanvasElement, base64: string): Promise<void> {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const bitmap = await createImageBitmap(new Blob([bytes], {type: 'image/jpeg'}));
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const size = canvas.width;
    const s = Math.max(size / bitmap.width, size / bitmap.height);
    const w = bitmap.width * s;
    const h = bitmap.height * s;
    ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);
  } finally {
    bitmap.close();
  }
}

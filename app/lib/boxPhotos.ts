// Shrink a photo in the browser before upload: at most 1600 px on the long side,
// saved as JPEG. A phone photo of 4-8 MB becomes about 200-400 KB, so a request
// with several photos stays small. Browser-only (uses canvas).
import type {BoxPhoto} from '~/lib/b2bReturn';

const MAX_SIDE = 1600;
const QUALITY = 0.75;

export async function shrinkPhoto(file: File): Promise<BoxPhoto> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('Not an image'));
      i.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not available');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
    const base = file.name.replace(/\.[^.]+$/, '') || 'box';
    return {name: base.slice(0, 60) + '.jpg', data: dataUrl.split(',')[1] ?? ''};
  } finally {
    URL.revokeObjectURL(url);
  }
}

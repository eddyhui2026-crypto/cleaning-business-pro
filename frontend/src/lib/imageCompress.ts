/**
 * Compress and resize an image file for upload (e.g. staff before/after photos).
 * - Max dimension 1920px (keeps aspect ratio)
 * - Output as JPEG quality 0.82 to reduce size on mobile photos
 * - Skips compression if file is already small (< 400KB) and small dimensions
 */

const MAX_SIZE_PX = 1920;
const JPEG_QUALITY = 0.82;
const SKIP_IF_SMALLER_BYTES = 400 * 1024;
const SKIP_IF_MAX_DIMENSION = 1200;

export function compressImageForUpload(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) return Promise.resolve(file as unknown as Blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const maxDim = Math.max(w, h);

      // Skip resize if already small enough in size and dimensions
      if (file.size <= SKIP_IF_SMALLER_BYTES && maxDim <= SKIP_IF_MAX_DIMENSION) {
        resolve(file as unknown as Blob);
        return;
      }

      const scale = maxDim <= MAX_SIZE_PX ? 1 : MAX_SIZE_PX / maxDim;
      const cw = Math.round(w * scale);
      const ch = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file as unknown as Blob);
        return;
      }
      ctx.drawImage(img, 0, 0, cw, ch);

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else resolve(file as unknown as Blob);
        },
        'image/jpeg',
        JPEG_QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file as unknown as Blob);
    };

    img.src = url;
  });
}

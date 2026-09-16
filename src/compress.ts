/** Local canvas-based image compression. No network, no WASM CDN. */

export type OutputFormat = 'image/jpeg' | 'image/webp' | 'image/png';

export interface CompressOptions {
  maxWidth: number;
  quality: number; // 0.1–1 for JPEG/WebP; ignored for PNG
  format: OutputFormat;
}

export interface CompressResult {
  blob: Blob;
  width: number;
  height: number;
  mime: string;
}

function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).catch(() => loadViaImage(file));
  }
  return loadViaImage(file);
}

function loadViaImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode image'));
    };
    img.src = url;
  });
}

function targetSize(
  srcW: number,
  srcH: number,
  maxWidth: number,
): { w: number; h: number } {
  if (maxWidth <= 0 || srcW <= maxWidth) {
    return { w: srcW, h: srcH };
  }
  const scale = maxWidth / srcW;
  return {
    w: Math.max(1, Math.round(srcW * scale)),
    h: Math.max(1, Math.round(srcH * scale)),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob failed'));
      },
      type,
      type === 'image/png' ? undefined : quality,
    );
  });
}

let webpEncodeCached: boolean | null = null;

/** Prefer WebP when the browser can encode it; else fall back to JPEG. */
export async function canEncodeWebP(): Promise<boolean> {
  if (webpEncodeCached !== null) return webpEncodeCached;
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  try {
    const blob = await canvasToBlob(c, 'image/webp', 0.8);
    webpEncodeCached = blob.type === 'image/webp' && blob.size > 0;
  } catch {
    webpEncodeCached = false;
  }
  return webpEncodeCached;
}

export async function compressImage(
  source: Blob | HTMLImageElement | ImageBitmap,
  options: CompressOptions,
): Promise<CompressResult> {
  let bitmap: ImageBitmap | HTMLImageElement;
  let shouldClose = false;

  if (source instanceof Blob) {
    bitmap = await loadBitmap(source);
    shouldClose = typeof ImageBitmap !== 'undefined' && bitmap instanceof ImageBitmap;
  } else {
    bitmap = source;
  }

  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const { w, h } = targetSize(srcW, srcH, options.maxWidth);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { alpha: options.format === 'image/png' });
  if (!ctx) {
    if (shouldClose && bitmap instanceof ImageBitmap) bitmap.close();
    throw new Error('Canvas 2D unavailable');
  }

  // JPEG has no alpha — fill white so transparent PNGs don't go black
  if (options.format === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);

  if (shouldClose && bitmap instanceof ImageBitmap) bitmap.close();

  let mime: OutputFormat = options.format;
  let quality = Math.min(1, Math.max(0.1, options.quality));

  // iOS Safari < 14 cannot encode WebP; fall back to JPEG
  if (mime === 'image/webp') {
    const ok = await canEncodeWebP();
    if (!ok) mime = 'image/jpeg';
  }

  const blob = await canvasToBlob(canvas, mime, quality);
  return { blob, width: w, height: h, mime: blob.type || mime };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export function extensionFor(mime: string): string {
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/png') return 'png';
  return 'jpg';
}

export function outputFilename(originalName: string, mime: string): string {
  const base = originalName.replace(/\.[^.]+$/, '') || 'image';
  return `${base}-shiboru.${extensionFor(mime)}`;
}

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: string;
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.85,
  mimeType: 'image/jpeg',
};

/**
 * Compress an image file using an HTML canvas.
 * Returns a new File with a reduced size suitable for mobile uploads.
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip compression for non-image files and small images
  if (!file.type.startsWith('image/')) {
    return file;
  }

  if (file.size < 200 * 1024) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;

      // Scale down if dimensions exceed max
      if (width > opts.maxWidth || height > opts.maxHeight) {
        const ratio = Math.min(
          opts.maxWidth / width,
          opts.maxHeight / height
        );
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear el contexto del canvas'));
        return;
      }

      // White background for JPEG transparency
      if (opts.mimeType === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('La compresión no produjo un blob'));
            return;
          }

          const extension = opts.mimeType === 'image/png' ? 'png' : 'jpg';
          const compressedFile = new File(
            [blob],
            file.name.replace(/\.[^.]+$/, `.${extension}`),
            { type: opts.mimeType }
          );

          resolve(compressedFile);
        },
        opts.mimeType,
        opts.quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Error al cargar la imagen para compresión'));
    };

    img.src = url;
  });
}

/**
 * Compress a photo for upload. Keeps JPEG with good quality.
 */
export function compressPhoto(file: File): Promise<File> {
  return compressImage(file, {
    maxWidth: 1600,
    maxHeight: 1600,
    quality: 0.82,
    mimeType: 'image/jpeg',
  });
}

/**
 * Compress an INE photo for OCR and upload.
 * Keeps higher quality because OCR needs readable text.
 */
export function compressInePhoto(file: File): Promise<File> {
  return compressImage(file, {
    maxWidth: 2048,
    maxHeight: 2048,
    quality: 0.9,
    mimeType: 'image/jpeg',
  });
}

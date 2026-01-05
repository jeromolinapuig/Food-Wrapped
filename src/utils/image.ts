type CompressOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1
  mimeType?: string;
};

const fileNameToJpeg = (name: string) =>
  name.replace(/\.[^.]+$/, '') + '.jpg';

export async function compressImage(
  file: File,
  { maxWidth = 1200, maxHeight = 1200, quality = 0.65, mimeType = 'image/jpeg' }: CompressOptions = {}
): Promise<File> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const img = await loadImage(imageUrl);
    const { width, height } = getScaledSize(img.width, img.height, maxWidth, maxHeight);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo crear el canvas.');
    ctx.drawImage(img, 0, 0, width, height);

    const blob = await canvasToBlob(canvas, mimeType, quality);
    const compressedFile = new File([blob], fileNameToJpeg(file.name), {
      type: mimeType,
      lastModified: Date.now(),
    });
    return compressedFile;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo cargar la imagen.'));
    img.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo comprimir la imagen.'));
      },
      type,
      quality
    );
  });
}

function getScaledSize(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  const ratio = Math.min(maxWidth / width, maxHeight / height, 1);
  return {
    width: Math.round(width * ratio),
    height: Math.round(height * ratio),
  };
}

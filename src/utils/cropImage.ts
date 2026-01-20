export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function cropImageFile(
  file: File,
  cropArea: CropArea,
  outputType = 'image/jpeg',
  quality = 0.95
): Promise<File> {
  const imageBitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return file;
  }

  ctx.drawImage(
    imageBitmap,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    cropArea.width,
    cropArea.height
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error('No se pudo generar la imagen recortada'));
      },
      outputType,
      quality
    );
  });

  const name = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
  return new File([blob], name, { type: outputType });
}

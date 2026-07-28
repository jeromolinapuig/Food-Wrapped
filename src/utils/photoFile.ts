const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

const HEIC_EXTENSION = /\.(heic|heif)$/i;
const HEIC_BRANDS = ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'];

const jpegFileName = (name: string) => {
  const baseName = name.replace(/\.[^/.]+$/, '');
  return `${baseName || 'photo'}.jpg`;
};

async function hasHeicSignature(file: File) {
  if (file.size < 12) return false;

  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const header = String.fromCharCode(...bytes);
  return (
    header.slice(4, 8) === 'ftyp' &&
    HEIC_BRANDS.some((brand) => header.includes(brand))
  );
}

export async function isHeicPhoto(file: File) {
  return (
    HEIC_MIME_TYPES.has(file.type.toLowerCase()) ||
    HEIC_EXTENSION.test(file.name) ||
    (await hasHeicSignature(file))
  );
}

export async function preparePhotoForCrop(file: File): Promise<File> {
  if (!(await isHeicPhoto(file))) return file;

  const { heicTo } = await import('heic-to/csp');
  const jpeg = await heicTo({
    blob: file,
    type: 'image/jpeg',
    quality: 0.92,
  });

  return new File([jpeg], jpegFileName(file.name), {
    type: 'image/jpeg',
    lastModified: file.lastModified,
  });
}

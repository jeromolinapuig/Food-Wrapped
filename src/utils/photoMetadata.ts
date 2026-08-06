import { formatLocalDateTime, MIN_DATE } from './datetime';

const JPEG_SOI = 0xffd8;
const APP1_MARKER = 0xffe1;
const EXIF_HEADER = 'Exif\0\0';
const TIFF_MAGIC = 42;
const TAG_DATETIME = 0x0132;
const TAG_EXIF_IFD = 0x8769;
const TAG_DATETIME_ORIGINAL = 0x9003;
const TAG_DATETIME_DIGITIZED = 0x9004;
const TYPE_ASCII = 2;

type ByteOrder = 'little' | 'big';

const getUint16 = (view: DataView, offset: number, byteOrder: ByteOrder) =>
  view.getUint16(offset, byteOrder === 'little');

const getUint32 = (view: DataView, offset: number, byteOrder: ByteOrder) =>
  view.getUint32(offset, byteOrder === 'little');

export async function getPhotoTakenDateTime(file: File): Promise<string | null> {
  try {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    const exifDate =
      readExifDateTime(view) ?? readEmbeddedTiffDateTime(view);
    if (!exifDate) return null;

    const parsed = parseExifDateTime(exifDate);
    if (!parsed || parsed < MIN_DATE || parsed > new Date()) return null;

    return formatLocalDateTime(parsed);
  } catch {
    return null;
  }
}

function readExifDateTime(view: DataView): string | null {
  if (view.byteLength < 4 || view.getUint16(0) !== JPEG_SOI) return null;

  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) return null;

    const marker = view.getUint16(offset);
    const segmentLength = view.getUint16(offset + 2);
    const segmentStart = offset + 4;
    const segmentEnd = offset + 2 + segmentLength;

    if (segmentLength < 2 || segmentEnd > view.byteLength) return null;

    if (marker === APP1_MARKER && readAscii(view, segmentStart, EXIF_HEADER.length) === EXIF_HEADER) {
      const dateTime = readTiffDateTime(
        view,
        segmentStart + EXIF_HEADER.length,
        segmentEnd,
      );
      if (dateTime) return dateTime;
    }

    offset = segmentEnd;
  }

  return null;
}

function readEmbeddedTiffDateTime(view: DataView): string | null {
  for (let offset = 0; offset + 8 <= view.byteLength; offset += 1) {
    const isLittleEndianTiff =
      view.getUint8(offset) === 0x49 &&
      view.getUint8(offset + 1) === 0x49 &&
      view.getUint16(offset + 2, true) === TIFF_MAGIC;
    const isBigEndianTiff =
      view.getUint8(offset) === 0x4d &&
      view.getUint8(offset + 1) === 0x4d &&
      view.getUint16(offset + 2, false) === TIFF_MAGIC;

    if (!isLittleEndianTiff && !isBigEndianTiff) continue;
    const dateTime = readTiffDateTime(
      view,
      offset,
      view.byteLength,
    );
    if (dateTime) return dateTime;
  }

  return null;
}

function readTiffDateTime(view: DataView, tiffStart: number, tiffEnd: number): string | null {
  if (tiffStart + 8 > tiffEnd) return null;

  const byteOrderMark = readAscii(view, tiffStart, 2);
  const byteOrder: ByteOrder | null =
    byteOrderMark === 'II' ? 'little' : byteOrderMark === 'MM' ? 'big' : null;
  if (!byteOrder || getUint16(view, tiffStart + 2, byteOrder) !== TIFF_MAGIC) return null;

  const ifd0Offset = getUint32(view, tiffStart + 4, byteOrder);
  const ifd0 = readIfd(view, tiffStart, tiffEnd, tiffStart + ifd0Offset, byteOrder);
  if (!ifd0) return null;

  const exifIfdOffset = ifd0.pointers.get(TAG_EXIF_IFD);
  if (exifIfdOffset != null) {
    const exifIfd = readIfd(view, tiffStart, tiffEnd, tiffStart + exifIfdOffset, byteOrder);
    const original = exifIfd?.strings.get(TAG_DATETIME_ORIGINAL) ?? exifIfd?.strings.get(TAG_DATETIME_DIGITIZED);
    if (original) return original;
  }

  return ifd0.strings.get(TAG_DATETIME) ?? null;
}

function readIfd(
  view: DataView,
  tiffStart: number,
  tiffEnd: number,
  ifdOffset: number,
  byteOrder: ByteOrder
): { strings: Map<number, string>; pointers: Map<number, number> } | null {
  if (ifdOffset + 2 > tiffEnd) return null;

  const entryCount = getUint16(view, ifdOffset, byteOrder);
  const entriesStart = ifdOffset + 2;
  const entriesEnd = entriesStart + entryCount * 12;
  if (entriesEnd > tiffEnd) return null;

  const strings = new Map<number, string>();
  const pointers = new Map<number, number>();

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = entriesStart + index * 12;
    const tag = getUint16(view, entryOffset, byteOrder);
    const type = getUint16(view, entryOffset + 2, byteOrder);
    const count = getUint32(view, entryOffset + 4, byteOrder);
    const valueOffset = entryOffset + 8;

    if (tag === TAG_EXIF_IFD) {
      pointers.set(tag, getUint32(view, valueOffset, byteOrder));
    } else if (type === TYPE_ASCII && (tag === TAG_DATETIME || tag === TAG_DATETIME_ORIGINAL || tag === TAG_DATETIME_DIGITIZED)) {
      const stringOffset = count <= 4 ? valueOffset : tiffStart + getUint32(view, valueOffset, byteOrder);
      if (stringOffset >= tiffStart && stringOffset + count <= tiffEnd) {
        strings.set(tag, readAscii(view, stringOffset, count).replace(/\0+$/, ''));
      }
    }
  }

  return { strings, pointers };
}

function parseExifDateTime(value: string): Date | null {
  const match = /^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!match) return null;

  const [, yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue = '00'] = match;
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);
  const hour = Number(hourValue);
  const minute = Number(minuteValue);
  const second = Number(secondValue);
  const date = new Date(year, month - 1, day, hour, minute, second);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return null;
  }

  return date;
}

function readAscii(view: DataView, offset: number, length: number) {
  let value = '';
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

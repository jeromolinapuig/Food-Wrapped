type DownloadEntryPostImageInput = {
  restaurantName: string;
  burgerName?: string | null;
  ratingValue: string;
  photoUrl?: string | null;
  notes?: string | null;
};

const WIDTH = 1080;
const HEIGHT = 1920;
const STAR_COUNT = 5;

function getThemeColors() {
  const root = getComputedStyle(document.documentElement);
  return {
    bg: root.getPropertyValue('--bw-bg').trim() || '#f3f3f7',
    cardBg: root.getPropertyValue('--bw-card-bg').trim() || '#f7f7fb',
    surface: root.getPropertyValue('--bw-surface').trim() || '#ffffff',
    text: root.getPropertyValue('--bw-text').trim() || '#111111',
    textMuted: root.getPropertyValue('--bw-text-muted').trim() || '#666666',
    accent: root.getPropertyValue('--bw-accent').trim() || '#ff3b8d',
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const img = image as ImageBitmap;
  const srcW = img.width;
  const srcH = img.height;
  const srcRatio = srcW / srcH;
  const targetRatio = width / height;

  let cropW = srcW;
  let cropH = srcH;
  let cropX = 0;
  let cropY = 0;

  if (srcRatio > targetRatio) {
    cropW = srcH * targetRatio;
    cropX = (srcW - cropW) / 2;
  } else {
    cropH = srcW / targetRatio;
    cropY = (srcH - cropH) / 2;
  }

  ctx.drawImage(image, cropX, cropY, cropW, cropH, x, y, width, height);
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number
) {
  let rotation = (Math.PI / 2) * 3;
  const step = Math.PI / 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  for (let i = 0; i < 5; i += 1) {
    ctx.lineTo(cx + Math.cos(rotation) * outerRadius, cy + Math.sin(rotation) * outerRadius);
    rotation += step;
    ctx.lineTo(cx + Math.cos(rotation) * innerRadius, cy + Math.sin(rotation) * innerRadius);
    rotation += step;
  }
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  if (!text.trim()) return [];
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width <= maxWidth) {
      line = testLine;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length >= maxLines) break;
  }

  if (line && lines.length < maxLines) lines.push(line);
  if (lines.length === maxLines && words.length > 0) {
    const last = lines[maxLines - 1] ?? '';
    const ellipsis = '...';
    let trimmed = last;
    while (trimmed && ctx.measureText(`${trimmed}${ellipsis}`).width > maxWidth) {
      trimmed = trimmed.slice(0, -1);
    }
    lines[maxLines - 1] = `${trimmed}${ellipsis}`;
  }

  return lines;
}

function safeFilenamePart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

function isAppleMobile() {
  const ua = navigator.userAgent || '';
  const platform = navigator.platform || '';
  const touchPoints = navigator.maxTouchPoints || 0;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isIPadOS = platform === 'MacIntel' && touchPoints > 1;
  return isIOS || isIPadOS;
}

async function shareImageFile(blob: Blob, fileName: string) {
  if (!('share' in navigator) || !('canShare' in navigator)) return false;
  const file = new File([blob], fileName, { type: 'image/png' });
  if (!navigator.canShare({ files: [file] })) return false;
  await navigator.share({
    files: [file],
    title: fileName,
  });
  return true;
}

export async function downloadEntryPostImage({
  restaurantName,
  burgerName,
  ratingValue,
  photoUrl,
  notes,
}: DownloadEntryPostImageInput) {
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  const theme = getThemeColors();

  const gradient = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  gradient.addColorStop(0, theme.bg);
  gradient.addColorStop(1, theme.cardBg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const headerCenterY = 124;
  const logoSize = 84;
  const logoUrl = '/logo.png';
  const appName = 'Burger Wrapped';
  const logoGap = 20;

  ctx.font = '700 60px "Segoe UI", sans-serif';
  const appTextWidth = ctx.measureText(appName).width;
  const headerWidth = logoSize + logoGap + appTextWidth;
  const headerLeft = (WIDTH - headerWidth) / 2;

  try {
    const logoResponse = await fetch(logoUrl);
    const logoBlob = await logoResponse.blob();
    const logoBitmap = await createImageBitmap(logoBlob);
    drawRoundedRect(ctx, headerLeft, headerCenterY - logoSize / 2, logoSize, logoSize, 16);
    ctx.save();
    ctx.clip();
    drawCoverImage(ctx, logoBitmap, headerLeft, headerCenterY - logoSize / 2, logoSize, logoSize);
    ctx.restore();
    logoBitmap.close();
  } catch {
    ctx.fillStyle = theme.surface;
    drawRoundedRect(ctx, headerLeft, headerCenterY - logoSize / 2, logoSize, logoSize, 16);
    ctx.fill();
  }

  ctx.fillStyle = theme.text;
  ctx.font = '700 60px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(appName, headerLeft + logoSize + logoGap, headerCenterY);
  ctx.textBaseline = 'alphabetic';

  const dividerY = 220;
  ctx.fillStyle = theme.textMuted;
  ctx.fillRect(70, dividerY, WIDTH - 140, 2);

  const textLeft = 86;
  const textMaxWidth = WIDTH - 172;
  const contentTop = 310;

  ctx.fillStyle = theme.text;
  ctx.font = '700 66px "Segoe UI", sans-serif';
  const restaurantLines = wrapText(ctx, restaurantName || 'Restaurant', textMaxWidth, 2);
  restaurantLines.forEach((line, index) => {
    ctx.fillText(line, textLeft, contentTop + index * 72);
  });

  let currentY = contentTop + restaurantLines.length * 72 + 12;
  if (burgerName) {
    ctx.fillStyle = theme.textMuted;
    ctx.font = '600 42px "Segoe UI", sans-serif';
    const burgerLines = wrapText(ctx, burgerName, textMaxWidth, 2);
    burgerLines.forEach((line, index) => {
      ctx.fillText(line, textLeft, currentY + index * 48);
    });
    currentY += burgerLines.length * 48 + 26;
  }

  let photoBottomY = currentY;
  if (photoUrl) {
    const photoX = 72;
    const photoY = currentY;
    const photoW = WIDTH - 144;
    const photoH = 860;
    drawRoundedRect(ctx, photoX, photoY, photoW, photoH, 36);
    ctx.save();
    ctx.clip();
    try {
      const response = await fetch(photoUrl);
      const blob = await response.blob();
      const bitmap = await createImageBitmap(blob);
      drawCoverImage(ctx, bitmap, photoX, photoY, photoW, photoH);
      bitmap.close();
    } catch {
      // If photo fails to load, skip photo block entirely.
    }
    ctx.restore();
    photoBottomY = photoY + photoH;
  }
  currentY = photoBottomY + 66;

  if (notes) {
    ctx.fillStyle = theme.textMuted;
    ctx.font = '400 32px "Segoe UI", sans-serif';
    const noteLines = wrapText(ctx, notes, textMaxWidth, 4);
    noteLines.forEach((line, index) => {
      ctx.fillText(line, textLeft, currentY + index * 42);
    });
    currentY += noteLines.length * 42 + 40;
  }

  const parsedRating = Number.parseFloat(ratingValue);
  const safeRating = Number.isFinite(parsedRating) ? Math.max(0, Math.min(STAR_COUNT, parsedRating)) : 0;
  const baseY = currentY + 52;
  const starAreaX = 72;
  const starAreaW = WIDTH - 144;
  const spacing = starAreaW / STAR_COUNT;
  const starRadius = Math.min(44, spacing * 0.42);

  for (let i = 0; i < STAR_COUNT; i += 1) {
    const centerX = starAreaX + spacing * i + spacing / 2;
    const fullThreshold = i + 1;
    const halfThreshold = i + 0.5;
    const isFull = safeRating >= fullThreshold;
    const isHalf = !isFull && safeRating >= halfThreshold;

    ctx.save();
    drawStar(ctx, centerX, baseY, starRadius, starRadius * 0.45);
    ctx.clip();
    ctx.fillStyle = theme.surface;
    ctx.fillRect(centerX - starRadius - 2, baseY - starRadius - 2, starRadius * 2 + 4, starRadius * 2 + 4);
    if (isFull || isHalf) {
      ctx.fillStyle = theme.accent;
      const fillWidth = isFull ? starRadius * 2 + 4 : starRadius + 2;
      ctx.fillRect(centerX - starRadius - 2, baseY - starRadius - 2, fillWidth, starRadius * 2 + 4);
    }
    ctx.restore();

    ctx.strokeStyle = theme.textMuted;
    ctx.lineWidth = 2;
    drawStar(ctx, centerX, baseY, starRadius, starRadius * 0.45);
    ctx.stroke();
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });
  if (!blob) throw new Error('Unable to create image');

  const restaurant = safeFilenamePart(restaurantName || 'restaurant');
  const burger = safeFilenamePart(burgerName || 'burger');
  const filename = `burger-wrapped-${restaurant}-${burger}.png`;

  if (isAppleMobile()) {
    try {
      const didShare = await shareImageFile(blob, filename);
      if (didShare) return;
    } catch {
      // If share is cancelled or unavailable, keep default download fallback.
    }
  }

  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 60_000);
}

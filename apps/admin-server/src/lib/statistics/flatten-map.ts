// Draws the whole Leaflet map onto one canvas and returns one JPEG: the PDF service fails on many tiles/pin svgs.

const MAX_SCALE = 2;
export const MAP_TOTAL_BUDGET = 200_000;
export const MAP_IMAGE_MIME = 'image/jpeg';
const MAX_CHARS = MAP_TOTAL_BUDGET;
const MIN_SCALE = 0.4;
const SCALE_STEP = 0.8;
const QUALITY = 0.8;
const LAST_RESORT_QUALITY = 0.6;

// Position of an element relative to the map container, in CSS pixels.
export function drawBox(
  el: Element,
  mapBox: { left: number; top: number }
): { x: number; y: number; width: number; height: number } {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left - mapBox.left,
    y: rect.top - mapBox.top,
    width: rect.width,
    height: rect.height,
  };
}

export function svgToDataUrl(
  svg: Element,
  width: number,
  height: number
): string {
  const copy = svg.cloneNode(true) as SVGElement;
  // Strip the inline transform: the image is drawn at its measured position already.
  copy.style.removeProperty('transform');
  if (!copy.getAttribute('style')) copy.removeAttribute('style');
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(width));
  copy.setAttribute('height', String(height));
  const xml = new XMLSerializer().serializeToString(copy);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
}

export function pinsShareOneDrawing(markers: HTMLElement[]): boolean {
  if (markers.length < 2) return true;
  const signature = (marker: HTMLElement) => {
    const rect = marker.getBoundingClientRect();
    return `${marker.querySelector('svg')?.outerHTML ?? ''}|${rect.width}x${rect.height}`;
  };
  const first = signature(markers[0]);
  return markers.every((marker) => signature(marker) === first);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

// Retries render(scale, quality) with smaller sizes until the data URL fits the budget.
export function fitDataUrlToBudget(
  render: (scale: number, quality: number) => string,
  {
    maxChars = MAX_CHARS,
    startScale,
    minScale = MIN_SCALE,
    step = SCALE_STEP,
  }: {
    maxChars?: number;
    startScale: number;
    minScale?: number;
    step?: number;
  }
): string | null {
  let scale = Math.max(startScale, minScale);
  while (scale >= minScale) {
    const url = render(scale, QUALITY);
    if (url.length <= maxChars) return url;
    scale *= step;
  }
  const last = render(minScale, LAST_RESORT_QUALITY);
  return last.length <= maxChars ? last : null;
}

// Returns a JPEG data URL of the map, or null when it cannot be drawn or made small enough.
export async function flattenMapToImage(
  mapEl: HTMLElement,
  { tiles = true, maxChars }: { tiles?: boolean; maxChars?: number } = {}
): Promise<string | null> {
  try {
    const box = mapEl.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) return null;

    const overlay = mapEl.querySelector('.leaflet-overlay-pane svg');
    const overlayRect = overlay?.getBoundingClientRect();
    const overlayImage =
      overlay && overlayRect
        ? await loadImage(
            svgToDataUrl(overlay, overlayRect.width, overlayRect.height)
          )
        : null;

    const markers = mapEl.querySelectorAll<HTMLElement>('.leaflet-marker-icon');
    if (!pinsShareOneDrawing(Array.from(markers))) {
      console.error(
        'Map pins differ; flatten-map draws every pin like the first one'
      );
    }
    const pinSvg = markers[0]?.querySelector('svg');
    const firstPin = markers[0]?.getBoundingClientRect();
    const pinImage =
      pinSvg && firstPin
        ? await loadImage(svgToDataUrl(pinSvg, firstPin.width, firstPin.height))
        : null;

    const tileEls = tiles
      ? Array.from(
          mapEl.querySelectorAll<HTMLImageElement>('img.leaflet-tile')
        ).filter((tile) => tile.complete && tile.naturalWidth > 0)
      : [];

    const drawAt = (scale: number, quality: number): string => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(box.width * scale));
      canvas.height = Math.max(1, Math.round(box.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d canvas context');
      ctx.scale(scale, scale);

      ctx.fillStyle = '#e8e8ec';
      ctx.fillRect(0, 0, box.width, box.height);

      tileEls.forEach((tile) => {
        const b = drawBox(tile, box);
        ctx.drawImage(tile, b.x, b.y, b.width, b.height);
      });

      if (overlayImage && overlayRect) {
        const b = drawBox(overlay as Element, box);
        ctx.drawImage(overlayImage, b.x, b.y, b.width, b.height);
      }

      if (pinImage) {
        markers.forEach((marker) => {
          const b = drawBox(marker, box);
          ctx.drawImage(pinImage, b.x, b.y, b.width, b.height);
        });
      }

      if (tileEls.length > 0) {
        const text = '© OpenStreetMap-bijdragers';
        ctx.font = '10px sans-serif';
        const textWidth = ctx.measureText(text).width;
        const boxWidth = textWidth + 8;
        const boxHeight = 14;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.fillRect(
          box.width - boxWidth,
          box.height - boxHeight,
          boxWidth,
          boxHeight
        );
        ctx.fillStyle = '#333';
        ctx.fillText(text, box.width - boxWidth + 4, box.height - 4);
      }

      return canvas.toDataURL(MAP_IMAGE_MIME, quality);
    };

    return fitDataUrlToBudget(drawAt, {
      startScale: Math.min(MAX_SCALE, window.devicePixelRatio || 1),
      ...(maxChars !== undefined ? { maxChars } : {}),
    });
  } catch (error) {
    console.error('Failed to flatten the map', error);
    return null;
  }
}

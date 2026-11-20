// Copies the chart block, drops data-pdf-exclude elements and sends only HTML (server adds the CSS).
import { waitForChartAnimations } from './chart-motion';
import { MAP_TOTAL_BUDGET, flattenMapToImage } from './flatten-map';

// The map's own zoom buttons are made by Leaflet, so we cannot tag them.
const EXCLUDE_SELECTOR =
  '[data-pdf-exclude], .leaflet-control-container, .leaflet-tooltip';

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Replaces a map by one image so the PDF gets one element, not tiles and pin svgs.
async function flattenMapInClone(
  liveMap: HTMLElement | undefined,
  cloneMap: HTMLElement,
  mapBudget: number
) {
  const rect = liveMap?.getBoundingClientRect();
  const hasSize = !!rect && rect.width > 0 && rect.height > 0;
  if (hasSize) {
    cloneMap.style.width = `${Math.round(rect.width)}px`;
    cloneMap.style.height = `${Math.round(rect.height)}px`;
  }

  let image: string | null = null;
  if (liveMap) {
    image =
      (await flattenMapToImage(liveMap, { maxChars: mapBudget })) ??
      (await flattenMapToImage(liveMap, {
        tiles: false,
        maxChars: mapBudget,
      }));
  }

  // Never send tiles or separate pins: that is what the PDF service chokes on.
  cloneMap.innerHTML = '';
  if (image) {
    const img = cloneMap.ownerDocument.createElement('img');
    img.className = 'pdf-map-image';
    img.setAttribute('src', image);
    img.setAttribute('alt', liveMap?.getAttribute('aria-label') ?? '');
    cloneMap.appendChild(img);
  } else {
    const note = cloneMap.ownerDocument.createElement('p');
    note.className = 'pdf-map-fallback';
    note.textContent = 'Kaart kon niet worden weergegeven';
    cloneMap.appendChild(note);
  }
}

// Returns the HTML of one block without the elements marked as excluded.
export async function captureBlockHtml(
  element: HTMLElement,
  { mapBudget }: { mapBudget?: number } = {}
): Promise<string> {
  await waitForChartAnimations(element);
  const clone = element.cloneNode(true) as HTMLElement;

  const liveMaps = element.querySelectorAll<HTMLElement>('.pdf-map');
  const cloneMaps = clone.querySelectorAll<HTMLElement>('.pdf-map');
  // mapBudget is per map; without it the maps in a card share the full budget.
  const perMap =
    mapBudget ?? Math.floor(MAP_TOTAL_BUDGET / Math.max(1, cloneMaps.length));
  await Promise.all(
    Array.from(cloneMaps).map((map, index) =>
      flattenMapInClone(liveMaps[index], map, perMap)
    )
  );

  clone.querySelectorAll('style').forEach((node) => node.remove());
  clone.querySelectorAll('[data-chart-animating]').forEach((node) => {
    node.removeAttribute('data-chart-animating');
  });
  clone.querySelectorAll(EXCLUDE_SELECTOR).forEach((node) => node.remove());
  clone.querySelectorAll('[data-hl-part]').forEach((node) => {
    for (const name of [
      'data-hl-part',
      'data-hl-kind',
      'data-hl',
      'tabindex',
    ]) {
      node.removeAttribute(name);
    }
  });
  clone.querySelectorAll('.sr-only').forEach((node) => node.remove());
  return clone.outerHTML;
}

// "2026-09-12" -> "12 september 2026"
export function formatDutchDay(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return day;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

// The title block at the top of the "Alles downloaden" PDF.
export function buildHeaderHtml({
  widgetLabel,
  from,
  to,
  total,
}: {
  widgetLabel: string;
  from: string;
  to: string;
  total: number;
}): string {
  return (
    '<div class="pdf-header">' +
    '<h1 class="pdf-header-title">Enquêtes</h1>' +
    `<p class="pdf-header-widget">${escapeHtml(widgetLabel)}</p>` +
    `<p class="pdf-header-period">Van ${escapeHtml(formatDutchDay(from))} tot ${escapeHtml(formatDutchDay(to))}</p>` +
    `<p class="pdf-header-count">${total} reacties</p>` +
    '</div>'
  );
}

export async function captureBlocksHtml(
  elements: HTMLElement[],
  headerHtml = ''
): Promise<string> {
  const mapCount = elements.reduce(
    (sum, element) => sum + element.querySelectorAll('.pdf-map').length,
    0
  );
  const mapBudget = Math.floor(MAP_TOTAL_BUDGET / Math.max(1, mapCount));
  const blocks = await Promise.all(
    elements.map((element) => captureBlockHtml(element, { mapBudget }))
  );
  return headerHtml + blocks.join('');
}

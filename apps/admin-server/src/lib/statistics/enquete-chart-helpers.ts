// One fixed colour per answer option, in design order, so legend, chart and details match.
export const CHART_COLORS = [
  '#7078e8', // indigo
  '#d3238e', // magenta
  '#4aa0a4', // teal
  '#9a7bcb', // lavender
  '#3fa22d', // green
  '#5b9be0', // light blue
  '#c2521f', // orange
  '#5c7f24', // olive
] as const;

export function colorForIndex(index: number): string {
  const safe = Number.isFinite(index) && index >= 0 ? Math.floor(index) : 0;
  return CHART_COLORS[safe % CHART_COLORS.length];
}

export const AXIS_STEP = 20;

export function niceAxisMax(maxCount: number): number {
  const safe = Number.isFinite(maxCount) && maxCount > 0 ? maxCount : 0;
  return Math.max(AXIS_STEP, Math.ceil(safe / AXIS_STEP) * AXIS_STEP);
}

export function axisTicks(axisMax: number): number[] {
  const ticks: number[] = [];
  for (let value = 0; value <= axisMax; value += AXIS_STEP) ticks.push(value);
  return ticks;
}

export const DONUT_OUTER = 78; // 156px donut
export const DONUT_INNER = 66; // 12px ring
export const LABEL_OFFSET = 20;
const LABEL_HALF_WIDTH = 18; // "100%" at 14px
const LABEL_HALF_HEIGHT = 10;

export function donutLabelPoint(
  cx: number,
  cy: number,
  midAngle: number,
  outerRadius: number
): { x: number; y: number } {
  const radian = Math.PI / 180;
  const radius = outerRadius + LABEL_OFFSET;
  return {
    x: cx + radius * Math.cos(-midAngle * radian),
    y: cy + radius * Math.sin(-midAngle * radian),
  };
}

// Which slices get a % label (hidden under 3% or when too close to the last one).
export const MIN_LABEL_PERCENTAGE = 3;
export const MIN_LABEL_ANGLE = 14;
export function visibleDonutLabels(counts: number[]): boolean[] {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total) return [];
  let running = 0;
  let lastAngle: number | null = null;
  return counts.map((count) => {
    const mid = (360 * (running + count / 2)) / total;
    running += count;
    if (Math.round((count / total) * 100) < MIN_LABEL_PERCENTAGE) return false;
    if (lastAngle !== null && mid - lastAngle < MIN_LABEL_ANGLE) return false;
    lastAngle = mid;
    return true;
  });
}

export function donutCanvasSize(): { width: number; height: number } {
  return {
    width: 2 * (DONUT_OUTER + LABEL_OFFSET + LABEL_HALF_WIDTH) + 8,
    height: 2 * (DONUT_OUTER + LABEL_OFFSET + LABEL_HALF_HEIGHT),
  };
}

// Grey for "Overgeslagen" segments; 3.65:1 on white (needs >= 3:1 for graphics).
export const SKIPPED_COLOR = '#85858f';

// Bar length for an average place: place 1 = full bar, last place = 1/n.
export function rankingBarWidth(average: number | null, n: number): number {
  if (average === null || !Number.isFinite(average) || n < 1) return 0;
  const share = (n + 1 - average) / n;
  return Math.min(1, Math.max(0, share));
}

export const FOCUS_RING =
  'cursor-pointer disabled:cursor-not-allowed rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5b5fc7] focus-visible:ring-offset-2';

const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp'];

function extensionOf(value: string): string {
  const path = value.split(/[?#]/)[0];
  const last = path.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  return dot < 0 ? '' : last.slice(dot + 1).toLowerCase();
}

// True only for an uploaded file with a url whose name or url path ends in an image extension.
export function isImageFile(file: {
  name: string;
  url: string | null;
}): boolean {
  if (!file.url) return false;
  return (
    IMAGE_EXTENSIONS.includes(extensionOf(file.name)) ||
    IMAGE_EXTENSIONS.includes(extensionOf(file.url))
  );
}

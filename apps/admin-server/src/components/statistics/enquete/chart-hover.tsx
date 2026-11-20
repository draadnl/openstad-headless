import { useReducedMotion } from '@/lib/statistics/chart-motion';
import { type CSSProperties, useCallback, useRef, useState } from 'react';

// Highlight styles live in CSS on data attributes; the PDF capture strips them.
export const CHART_HOVER_CSS = `
[data-hl-part] { transition: opacity 150ms ease-out, transform 150ms ease-out, filter 150ms ease-out; cursor: pointer; }
[data-hl-part][data-hl="dim"] { opacity: 0.4; }
[data-hl-part][data-hl="on"] { filter: brightness(1.08); }
[data-hl-part][data-hl-kind="row"] .pdf-bar-fill { transition: height 150ms ease-out; }
[data-hl-part][data-hl-kind="row"][data-hl="on"] .pdf-bar-fill { height: 1.125rem; }
[data-hl-part][data-hl-kind="stack"][data-hl="on"] { transform: scaleY(1.45); }
[data-hl-part][data-hl-kind="slice"][data-hl="on"] { transform: translate(var(--pop-x, 0px), var(--pop-y, 0px)); }
[data-hl-part]:focus-visible { outline: 2px solid #5b5fc7; outline-offset: 2px; }
.leaflet-marker-icon.enq-pin { cursor: pointer; }
.leaflet-marker-icon.enq-pin > svg { transition: transform 150ms ease-out; transform-origin: bottom center; }
.leaflet-marker-icon.enq-pin:hover > svg, .leaflet-marker-icon.enq-pin:focus-visible > svg { transform: scale(1.3); }
@media (prefers-reduced-motion: reduce) {
  [data-hl-part], [data-hl-part] .pdf-bar-fill, .leaflet-marker-icon.enq-pin > svg { transition: none; }
}
`;

type Tip = { left: number; top: number; text: string };

export function tipText(label: string, count: number, percentage: number) {
  return `${label}: ${count} (${percentage}%)`;
}

export function useChartHover() {
  const [active, setActive] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  useReducedMotion();

  const show = useCallback((key: number, el: Element, text: string) => {
    setActive(key);
    const box = containerRef.current?.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    setTip({
      left: rect.left + rect.width / 2 - (box?.left ?? 0),
      top: rect.top - (box?.top ?? 0),
      text,
    });
  }, []);
  const hide = useCallback(() => {
    setActive(null);
    setTip(null);
  }, []);

  const state = (key: number) =>
    active === null ? undefined : active === key ? 'on' : 'dim';

  const partProps = (key: number, kind: string, text: string) => ({
    tabIndex: 0,
    'data-hl-part': '',
    'data-hl-kind': kind,
    'data-hl': state(key),
    onMouseEnter: (e: React.MouseEvent) => show(key, e.currentTarget, text),
    onMouseLeave: hide,
    onFocus: (e: React.FocusEvent) => show(key, e.currentTarget, text),
    onBlur: hide,
  });
  const legendProps = (key: number) => ({
    tabIndex: 0,
    'data-hl-part': '',
    'data-hl-kind': 'legend',
    'data-hl': state(key),
    onMouseEnter: () => setActive(key),
    onMouseLeave: hide,
    onFocus: () => setActive(key),
    onBlur: hide,
  });

  return { active, tip, containerRef, partProps, legendProps, state };
}

export function HoverTip({ tip }: { tip: Tip | null }) {
  if (!tip) return null;
  const style: CSSProperties = {
    left: tip.left,
    top: tip.top - 6,
    transform: 'translate(-50%, -100%)',
  };
  return (
    <div
      role="tooltip"
      aria-hidden="true"
      data-pdf-exclude
      data-testid="chart-tooltip"
      style={style}
      className="pointer-events-none absolute z-20 whitespace-nowrap rounded-md bg-[#1e1e2e] px-2 py-1 text-xs text-white shadow-md">
      {tip.text}
    </div>
  );
}

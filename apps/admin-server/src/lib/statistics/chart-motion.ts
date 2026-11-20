import { type RefObject, useEffect, useState } from 'react';

// One short entry animation for every chart on the Enquêtes tab.
export const CHART_ANIMATION_MS = 600;
export const CHART_ANIMATION_EASING = 'ease-out';

// Bars grow from the left, pins fade in; clip-path keeps the bars' centring.
export const CHART_MOTION_CSS = `
@media (prefers-reduced-motion: no-preference) {
  .enq-motion-pending .pdf-bar-fill,
  .enq-motion-pending .pdf-stacked-track {
    clip-path: inset(-8px 100% -8px 0);
  }
  .enq-motion-pending .leaflet-marker-icon,
  .enq-motion-pending .pdf-donut {
    opacity: 0;
  }
  .enq-motion .pdf-bar-fill,
  .enq-motion .pdf-stacked-track {
    animation: enq-grow ${CHART_ANIMATION_MS}ms ${CHART_ANIMATION_EASING} both;
  }
  .enq-motion .leaflet-marker-icon {
    animation: enq-fade ${CHART_ANIMATION_MS}ms ${CHART_ANIMATION_EASING} both;
  }
}
@keyframes enq-grow {
  from { clip-path: inset(-8px 100% -8px 0); }
  to { clip-path: inset(-8px 0 -8px 0); }
}
@keyframes enq-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
`;

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
  try {
    return !!window.matchMedia && window.matchMedia(QUERY).matches;
  } catch {
    return false;
  }
}

// True when the user asked for less motion. Follows changes of the setting.
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia(QUERY);
    const onChange = () => setReduced(query.matches);
    onChange();
    query.addEventListener?.('change', onChange);
    return () => query.removeEventListener?.('change', onChange);
  }, []);
  return reduced;
}

// Charts that animate with script (the donut) mark themselves while they run.
export const ANIMATING_ATTRIBUTE = 'data-chart-animating';

// Resolves when no chart is still growing (so the PDF is complete), or after `maxMs`.
export async function waitForChartAnimations(
  element: HTMLElement,
  maxMs = CHART_ANIMATION_MS * 2
): Promise<void> {
  const started = Date.now();
  while (
    element.querySelector(`[${ANIMATING_ATTRIBUTE}="true"]`) &&
    Date.now() - started < maxMs
  ) {
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

// True from the first moment the element is visible on screen, and stays true.
export function useInViewOnce(
  ref: RefObject<Element | null>,
  { threshold = 0.25 }: { threshold?: number } = {}
): boolean {
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined'
  );
  useEffect(() => {
    if (visible) return;
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, threshold, visible]);
  return visible;
}

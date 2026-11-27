import { useChartColors } from '@/lib/statistics/chart-palette';
import {
  axisTicks,
  colorForIndex,
  niceAxisMax,
} from '@/lib/statistics/enquete-chart-helpers';

import { HoverTip, tipText, useChartHover } from './chart-hover';
import type { EnqueteOption } from './types';

const ROW_HEIGHT = 32;
const LABEL_WIDTH = 300;
const COUNT_WIDTH = 60;
const LABEL_WIDTH_CSS = `min(${LABEL_WIDTH}px, 45%)`;

export function BarRows({
  options,
  ariaLabel,
}: {
  options: EnqueteOption[];
  ariaLabel: string;
}) {
  const palette = useChartColors();
  const axisMax = niceAxisMax(Math.max(0, ...options.map((o) => o.count)));
  const ticks = axisTicks(axisMax);
  const hover = useChartHover();

  const gridLines = (
    <div
      aria-hidden="true"
      className="pdf-bar-grid pointer-events-none absolute inset-0">
      {ticks.map((tick) => (
        <div
          key={tick}
          className="pdf-bar-gridline absolute top-0 h-full w-px bg-[#eeeef2]"
          style={{ left: `${(tick / axisMax) * 100}%` }}
        />
      ))}
    </div>
  );

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="pdf-bars relative"
      ref={hover.containerRef}>
      {options.map((option, index) => (
        <div
          key={`${option.label}-${index}`}
          className="pdf-bar-row flex cursor-pointer items-center text-sm text-[#1e1e2e]"
          style={{ height: ROW_HEIGHT }}
          {...hover.partProps(
            index,
            'row',
            tipText(option.label, option.count, option.percentage)
          )}>
          <div
            className="pdf-bar-label flex shrink-0 items-center gap-3 pr-4"
            style={{ width: LABEL_WIDTH_CSS }}>
            <span
              aria-hidden="true"
              className="pdf-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorForIndex(index, palette) }}
            />
            <span className="min-w-0 truncate" title={option.label}>
              {option.label}
            </span>
          </div>
          <div
            className="pdf-bar-count shrink-0 tabular-nums"
            style={{ width: COUNT_WIDTH }}>
            {option.count}
          </div>
          <div className="pdf-bar-track relative h-full min-w-0 flex-1">
            {gridLines}
            <div
              className="pdf-bar-fill absolute left-0 top-1/2 h-3.5 -translate-y-1/2"
              style={{
                width: `${(option.count / axisMax) * 100}%`,
                backgroundColor: colorForIndex(index, palette),
              }}
            />
          </div>
        </div>
      ))}

      <HoverTip tip={hover.tip} />
      <div
        className="pdf-bar-axis flex text-sm text-[#1e1e2e]"
        aria-hidden="true">
        <div
          className="shrink-0"
          style={{ width: `calc(${LABEL_WIDTH_CSS} + ${COUNT_WIDTH}px)` }}
        />
        <div className="pdf-bar-ticks relative mt-2 h-6 min-w-0 flex-1">
          {ticks.map((tick) => (
            <span
              key={tick}
              className="pdf-bar-tick absolute -translate-x-1/2"
              style={{ left: `${(tick / axisMax) * 100}%` }}>
              {tick}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

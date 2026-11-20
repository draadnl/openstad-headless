import {
  SKIPPED_COLOR,
  colorForIndex,
} from '@/lib/statistics/enquete-chart-helpers';

import { HoverTip, tipText, useChartHover } from './chart-hover';
import type { EnqueteStackedRow } from './types';

const ROW_MIN_HEIGHT = 32;
const LABEL_WIDTH = 300;
const COUNT_WIDTH = 60;
const LABEL_WIDTH_CSS = `min(${LABEL_WIDTH}px, 45%)`;

export function StackedRows({
  legend,
  rows,
  number,
}: {
  legend?: string[];
  rows: EnqueteStackedRow[];
  number: number;
}) {
  const hover = useChartHover();
  // Dilemma key line for the grey part, only when someone skipped.
  const hasSkippedKey =
    !legend?.length &&
    rows.some((row) => row.sideLabels) &&
    rows.some((row) =>
      row.segments.some((segment) => segment.skipped && segment.count > 0)
    );
  return (
    <div className="pdf-stacked relative" ref={hover.containerRef}>
      {hasSkippedKey ? (
        <ul
          aria-hidden="true"
          className="pdf-stacked-legend m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm text-[#1e1e2e]">
          <li className="pdf-stacked-legend-item flex items-center gap-2">
            <span
              className="pdf-dot inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: SKIPPED_COLOR }}
            />
            Overgeslagen
          </li>
        </ul>
      ) : null}

      {legend && legend.length > 0 ? (
        <ul
          aria-hidden="true"
          className="pdf-stacked-legend m-0 mb-3 flex list-none flex-wrap gap-x-5 gap-y-1 p-0 text-sm text-[#1e1e2e]">
          {(legend ?? []).map((label, index) => (
            <li
              key={`${label}-${index}`}
              className="pdf-stacked-legend-item flex cursor-pointer items-center gap-2"
              {...hover.legendProps(index)}>
              <span
                className="pdf-dot inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor:
                    index === legend!.length - 1 && label === 'Overgeslagen'
                      ? SKIPPED_COLOR
                      : colorForIndex(index),
                }}
              />
              {label}
            </li>
          ))}
        </ul>
      ) : null}

      {rows.map((row, rowIndex) => (
        <div
          key={`${row.label}-${rowIndex}`}
          className="pdf-bar-row pdf-stacked-row flex items-center py-3 text-sm text-[#1e1e2e]"
          style={{ minHeight: ROW_MIN_HEIGHT }}>
          <div
            className="pdf-bar-label shrink-0 pr-4"
            style={{ width: LABEL_WIDTH_CSS }}>
            {row.sideLabels ? (
              <span
                aria-hidden="true"
                className="pdf-stacked-key flex flex-col items-start gap-y-1">
                {row.sideLabels.slice(0, 2).map((side, sideIndex) => (
                  <span
                    key={`${side}-${sideIndex}`}
                    className="pdf-stacked-key-item flex items-center gap-2">
                    <span
                      className="pdf-dot inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: colorForIndex(sideIndex) }}
                    />
                    {side}
                  </span>
                ))}
              </span>
            ) : (
              row.label
            )}
          </div>
          <div
            aria-hidden="true"
            className="pdf-bar-count shrink-0 tabular-nums"
            style={{ width: COUNT_WIDTH }}>
            {row.total}
          </div>
          <div className="pdf-stacked-track flex h-3.5 min-w-0 flex-1 bg-[#eeeef2]">
            {row.segments.map((segment, index) =>
              segment.count > 0 ? (
                <div
                  key={`${segment.label}-${index}`}
                  className="pdf-stacked-fill h-full cursor-pointer"
                  role="img"
                  aria-label={tipText(
                    segment.label,
                    segment.count,
                    segment.percentage
                  )}
                  {...hover.partProps(
                    index,
                    'stack',
                    tipText(segment.label, segment.count, segment.percentage)
                  )}
                  style={{
                    width: `${segment.percentage}%`,
                    backgroundColor: segment.skipped
                      ? SKIPPED_COLOR
                      : colorForIndex(index),
                  }}
                />
              ) : null
            )}
          </div>
          {/* Screen readers get the numbers as text, not only as colours. */}
          <span className="sr-only">
            {`Vraag ${number}, ${row.label}: ${row.total} antwoorden. ${row.segments
              .map((s) => `${s.label} ${s.count} (${s.percentage}%)`)
              .join(', ')}`}
          </span>
        </div>
      ))}
      <HoverTip tip={hover.tip} />
    </div>
  );
}

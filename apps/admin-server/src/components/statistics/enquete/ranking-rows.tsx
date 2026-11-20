import {
  colorForIndex,
  rankingBarWidth,
} from '@/lib/statistics/enquete-chart-helpers';

import type { EnqueteOption } from './types';

const ROW_HEIGHT = 32;
const LABEL_WIDTH = 300;
const COUNT_WIDTH = 60;
const LABEL_WIDTH_CSS = `min(${LABEL_WIDTH}px, 45%)`;

const formatAverage = (average: number) => String(average).replace('.', ',');

export function RankingRows({
  options,
  number,
}: {
  options: EnqueteOption[];
  number: number;
}) {
  // Tick for place p sits at the end of the bar for average place p.
  const places = Array.from({ length: options.length }, (_, i) => i + 1);
  const tickLeft = (place: number) =>
    `${((options.length + 1 - place) / options.length) * 100}%`;

  const gridLines = (
    <div
      aria-hidden="true"
      className="pdf-bar-grid pointer-events-none absolute inset-0">
      {places.map((place) => (
        <div
          key={place}
          className="pdf-bar-gridline absolute top-0 h-full w-px bg-[#eeeef2]"
          style={{ left: tickLeft(place) }}
        />
      ))}
    </div>
  );

  return (
    <div className="pdf-bars">
      {options.map((option, index) => {
        const average = option.average ?? null;
        const text =
          average === null
            ? 'niet geplaatst'
            : `gem. ${formatAverage(average)}`;
        return (
          <div
            key={`${option.label}-${index}`}
            className="pdf-bar-row flex items-center text-sm text-[#1e1e2e]"
            style={{ height: ROW_HEIGHT }}>
            <div
              className="pdf-bar-label flex shrink-0 items-center gap-3 pr-4"
              style={{ width: LABEL_WIDTH_CSS }}>
              <span
                aria-hidden="true"
                className="pdf-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: colorForIndex(index) }}
              />
              <span className="min-w-0 truncate" title={option.label}>
                {option.label}
              </span>
            </div>
            <div
              aria-hidden="true"
              className="pdf-bar-count shrink-0 tabular-nums"
              style={{ width: COUNT_WIDTH + 20 }}>
              {text}
            </div>
            <div
              aria-hidden="true"
              className="pdf-bar-track relative h-full min-w-0 flex-1">
              {gridLines}
              <div
                className="pdf-bar-fill absolute left-0 top-1/2 h-3.5 -translate-y-1/2"
                style={{
                  width: `${rankingBarWidth(average, options.length) * 100}%`,
                  backgroundColor: colorForIndex(index),
                }}
              />
            </div>
            <span className="sr-only">
              {`Vraag ${number}, plek ${index + 1}: ${option.label}, ${text}, ${option.count} keer geplaatst`}
            </span>
          </div>
        );
      })}

      <div
        className="pdf-bar-axis flex text-sm text-[#1e1e2e]"
        aria-hidden="true">
        <div
          className="shrink-0"
          style={{ width: `calc(${LABEL_WIDTH_CSS} + ${COUNT_WIDTH + 20}px)` }}
        />
        <div className="pdf-bar-ticks relative mt-2 h-6 min-w-0 flex-1">
          {places.map((place) => (
            <span
              key={place}
              className="pdf-bar-tick absolute -translate-x-1/2"
              style={{ left: tickLeft(place) }}>
              {place}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

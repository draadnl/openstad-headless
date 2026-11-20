import { colorForIndex } from '@/lib/statistics/enquete-chart-helpers';

import type { EnqueteOption } from './types';

type LegendHover = { legendProps: (key: number) => Record<string, unknown> };

export function Legend({
  options,
  hover,
}: {
  options: EnqueteOption[];
  hover?: LegendHover;
}) {
  return (
    <ul className="pdf-legend m-0 table list-none p-0">
      {options.map((option, index) => (
        <li
          key={`${option.label}-${index}`}
          className="pdf-legend-item table-row h-6 cursor-pointer text-sm text-[#1e1e2e]"
          {...(hover ? hover.legendProps(index) : {})}>
          <span className="pdf-legend-dot-cell table-cell pr-3 align-middle">
            <span
              aria-hidden="true"
              className="pdf-dot inline-block h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: colorForIndex(index) }}
            />
          </span>
          <span className="pdf-legend-label table-cell align-middle">
            {option.label}
          </span>
          <span className="pdf-legend-count table-cell pl-6 align-middle tabular-nums">
            {option.count}
          </span>
        </li>
      ))}
    </ul>
  );
}

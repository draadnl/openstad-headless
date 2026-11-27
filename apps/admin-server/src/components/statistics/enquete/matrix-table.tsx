import { useChartColors } from '@/lib/statistics/chart-palette';
import { contrastRatio } from '@/lib/statistics/contrast';
import { colorForIndex } from '@/lib/statistics/enquete-chart-helpers';

import { HoverTip, useChartHover } from './chart-hover';
import type { EnqueteStackedRow } from './types';

const DARK_TEXT = '#000000';
const LIGHT_TEXT = '#ffffff';

const toRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const toHex = (rgb: number[]) =>
  `#${rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

export function tintForPercentage(color: string, percentage: number): string {
  const share = Math.min(1, Math.max(0, percentage / 100));
  return toHex(toRgb(color).map((channel) => 255 + (channel - 255) * share));
}

export function textColorOn(background: string): string {
  return contrastRatio(background, DARK_TEXT) >=
    contrastRatio(background, LIGHT_TEXT)
    ? DARK_TEXT
    : LIGHT_TEXT;
}

export function MatrixTable({
  title,
  legend,
  rows,
  number,
}: {
  title?: string;
  legend: string[];
  rows: EnqueteStackedRow[];
  number: number;
}) {
  const palette = useChartColors();
  const hover = useChartHover();
  const cellHover = (index: number) => ({
    ...hover.legendProps(index),
    tabIndex: undefined,
  });

  const captionHeading = `Vraag ${number}${title ? `: ${title}` : ''}`;

  return (
    <div
      className="pdf-matrix relative overflow-x-auto"
      ref={hover.containerRef}>
      <table className="pdf-matrix-table w-full border-collapse text-sm text-[#1e1e2e]">
        <caption className="pdf-matrix-caption sr-only">
          {`${captionHeading}${/[.?!:]$/.test(captionHeading) ? '' : '.'} Percentage per onderwerp en antwoord.`}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="pdf-matrix-corner">
              <span className="pdf-matrix-caption sr-only">Onderwerp</span>
            </th>
            {legend.map((label, index) => (
              <th
                key={`${label}-${index}`}
                scope="col"
                className="pdf-matrix-head cursor-pointer px-2 py-2 text-center font-semibold"
                {...hover.legendProps(index)}>
                <span
                  className="pdf-dot mr-1 inline-block h-2.5 w-2.5 rounded-full align-middle"
                  style={{ backgroundColor: colorForIndex(index, palette) }}
                />
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={`${row.label}-${rowIndex}`} className="pdf-matrix-row">
              <th
                scope="row"
                className="pdf-matrix-rowhead px-2 py-2 text-left font-normal">
                {row.label}
              </th>
              {legend.map((label, index) => {
                const segment = row.segments[index];
                const percentage = segment?.percentage ?? 0;
                const background = tintForPercentage(
                  colorForIndex(index, palette),
                  percentage
                );
                return (
                  <td
                    key={`${label}-${index}`}
                    className="pdf-matrix-cell px-2 py-2 text-center tabular-nums"
                    title={`${label}: ${segment?.count ?? 0} (${percentage}%)`}
                    style={{
                      backgroundColor: background,
                      color: textColorOn(background),
                    }}
                    {...cellHover(index)}>
                    {`${percentage}%`}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <HoverTip tip={hover.tip} />
    </div>
  );
}

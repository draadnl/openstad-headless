import { useChartHover } from './chart-hover';
import { DonutChart } from './donut-chart';
import { Legend } from './legend';
import type { EnqueteOption } from './types';

// On narrow cards the donut wraps under the legend instead of overflowing.
export function DonutRow({
  options,
  play,
  ariaLabel,
}: {
  options: EnqueteOption[];
  play: boolean;
  ariaLabel: string;
}) {
  const hover = useChartHover();
  return (
    <div className="pdf-donut-row flex flex-wrap items-center gap-y-4">
      <div className="pdf-donut-legend w-[45%] shrink-0">
        <Legend options={options} hover={hover} />
      </div>
      <div className="pdf-donut-chart flex flex-1 basis-[240px] justify-center">
        <DonutChart
          play={play}
          options={options}
          hover={hover}
          ariaLabel={ariaLabel}
        />
      </div>
    </div>
  );
}

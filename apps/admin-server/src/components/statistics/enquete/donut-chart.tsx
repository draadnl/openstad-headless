import {
  ANIMATING_ATTRIBUTE,
  CHART_ANIMATION_EASING,
  CHART_ANIMATION_MS,
  useReducedMotion,
} from '@/lib/statistics/chart-motion';
import { useChartColors } from '@/lib/statistics/chart-palette';
import {
  DONUT_INNER,
  DONUT_OUTER,
  colorForIndex,
  donutCanvasSize,
  donutLabelPoint,
  visibleDonutLabels,
} from '@/lib/statistics/enquete-chart-helpers';
import { useState } from 'react';
import { Cell, Pie, PieChart } from 'recharts';

import { HoverTip, tipText, type useChartHover } from './chart-hover';
import type { EnqueteOption } from './types';

export function DonutChart({
  options,
  ariaLabel,
  play = true,
  hover,
}: {
  options: EnqueteOption[];
  ariaLabel: string;
  // False until the card has been seen; then the donut shows its final size (PDF-safe).
  play?: boolean;
  hover?: ReturnType<typeof useChartHover>;
}) {
  const palette = useChartColors();
  const data = options.filter((option) => option.count > 0);
  const reduced = useReducedMotion();
  const [running, setRunning] = useState(true);
  const animate = !reduced && play;
  const { width, height } = donutCanvasSize();
  const hoverProps = (i: number) =>
    hover
      ? hover.partProps(
          options.indexOf(data[i]),
          'slice',
          tipText(data[i].label, data[i].count, data[i].percentage)
        )
      : null;
  const total = data.reduce((sum, option) => sum + option.count, 0);
  const shown = visibleDonutLabels(data.map((option) => option.count));
  let runningTotal = 0;
  const pops = data.map((option) => {
    const mid = 90 - (360 * (runningTotal + option.count / 2)) / (total || 1);
    runningTotal += option.count;
    const rad = (mid * Math.PI) / 180;
    return { x: Math.cos(rad) * 6, y: -Math.sin(rad) * 6 };
  });

  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className="pdf-donut"
      {...{ [ANIMATING_ATTRIBUTE]: animate && running ? 'true' : 'false' }}
      ref={hover?.containerRef}
      style={{ width, height, overflow: 'visible', position: 'relative' }}>
      <PieChart width={width} height={height} style={{ overflow: 'visible' }}>
        <Pie
          key={play ? 'play' : 'static'}
          data={data}
          dataKey="count"
          nameKey="label"
          innerRadius={DONUT_INNER}
          outerRadius={DONUT_OUTER}
          startAngle={90}
          endAngle={-270}
          stroke="#ffffff"
          strokeWidth={2}
          isAnimationActive={animate}
          animationDuration={CHART_ANIMATION_MS}
          animationEasing={CHART_ANIMATION_EASING}
          onAnimationStart={() => setRunning(true)}
          onAnimationEnd={() => setRunning(false)}
          onMouseEnter={(_d: unknown, i: number, e: any) =>
            hoverProps(i)?.onMouseEnter(e)
          }
          onMouseLeave={() => hover?.legendProps(0).onMouseLeave()}
          onFocus={(_d: unknown, i: number, e: any) =>
            hoverProps(i)?.onFocus(e)
          }
          onBlur={() => hover?.legendProps(0).onBlur()}
          label={false}
          labelLine={false}>
          {data.map((option, i) => {
            const key = options.indexOf(option);
            const props = hover
              ? hover.partProps(
                  key,
                  'slice',
                  tipText(option.label, option.count, option.percentage)
                )
              : {};
            return (
              <Cell
                key={option.label}
                fill={colorForIndex(key, palette)}
                className="cursor-pointer"
                {...(props as any)}
                style={
                  {
                    '--pop-x': `${pops[i].x.toFixed(2)}px`,
                    '--pop-y': `${pops[i].y.toFixed(2)}px`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </Pie>
        {/* Own label layer: recharts' label prop did not render for every donut. Also drawn when play is false (PDF). */}
        <g className="pdf-donut-labels">
          {data.map((option, i) => {
            if (!shown[i]) return null;
            const mid =
              90 -
              (360 *
                (data.slice(0, i).reduce((sum, o) => sum + o.count, 0) +
                  option.count / 2)) /
                (total || 1);
            const { x, y } = donutLabelPoint(
              width / 2,
              height / 2,
              mid,
              DONUT_OUTER
            );
            return (
              <text
                key={option.label}
                x={x}
                y={y}
                fill="#1e1e2e"
                fontSize={14}
                textAnchor="middle"
                dominantBaseline="central">
                {Math.round((option.count / total) * 100)}%
              </text>
            );
          })}
        </g>
      </PieChart>
      {hover ? <HoverTip tip={hover.tip} /> : null}
    </div>
  );
}

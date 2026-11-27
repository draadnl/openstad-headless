import {
  CHART_ANIMATION_EASING,
  CHART_ANIMATION_MS,
  useInViewOnce,
  useReducedMotion,
} from '@/lib/statistics/chart-motion';
import { useRef } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// Area chart that animates once when scrolled into view, never with reduced motion.
export function SubmissionsAreaChart({ data }: { data: any[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInViewOnce(ref);
  const reduced = useReducedMotion();
  const animate = visible && !reduced;

  return (
    <div ref={ref}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            interval="preserveStartEnd"
            tick={{ fontSize: 12 }}
          />
          <YAxis allowDecimals={false} />
          <Tooltip />
          {/* Remount on change so the animation plays once when it becomes visible */}
          <Area
            key={animate ? 'play' : 'static'}
            type="monotone"
            dataKey="counted"
            stroke="#8B8FD8"
            fill="#8B8FD8"
            fillOpacity={0.3}
            isAnimationActive={animate}
            animationDuration={CHART_ANIMATION_MS}
            animationEasing={CHART_ANIMATION_EASING}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

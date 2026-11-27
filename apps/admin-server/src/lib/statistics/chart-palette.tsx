import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

import { CHART_COLORS } from './enquete-chart-helpers';

const HEX = /^#[0-9a-fA-F]{6}$/;

export function resolvePalette(colors?: unknown): readonly string[] {
  if (!Array.isArray(colors)) return CHART_COLORS;
  const valid = colors.filter(
    (c): c is string => typeof c === 'string' && HEX.test(c)
  );
  return valid.length > 0 ? valid.slice(0, 8) : CHART_COLORS;
}

const ChartPaletteContext = createContext<readonly string[]>(CHART_COLORS);

export function ChartPaletteProvider({
  colors,
  children,
}: {
  colors?: string[];
  children: ReactNode;
}) {
  const palette = useMemo(() => resolvePalette(colors), [colors]);
  return (
    <ChartPaletteContext.Provider value={palette}>
      {children}
    </ChartPaletteContext.Provider>
  );
}

export function useChartColors(): readonly string[] {
  return useContext(ChartPaletteContext);
}

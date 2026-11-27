import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { parseConfig } = require('./config-field');

const colors = (input) =>
  parseConfig('projectConfig', { statistics: { chartColors: input } })
    .statistics.chartColors;

describe('project config statistics.chartColors', () => {
  it('defaults to an empty list', () => {
    expect(parseConfig('projectConfig', {}).statistics.chartColors).toEqual([]);
  });

  it('keeps valid hex values and drops everything else', () => {
    expect(
      colors(['#112233', 'red', '#12345', '#GGGGGG', 'url(x)', '#AABBCC'])
    ).toEqual(['#112233', '#AABBCC']);
  });

  it('keeps at most 8 colours', () => {
    expect(colors(Array.from({ length: 12 }, () => '#000000'))).toHaveLength(8);
  });

  it('rejects a non-array value', () => {
    expect(() => colors('#112233')).toThrow(/array of strings/);
  });
});

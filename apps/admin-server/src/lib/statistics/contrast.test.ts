import { describe, expect, it } from 'vitest';

import { contrastRatio, formatContrast, relativeLuminance } from './contrast';

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white, in either order', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
  });

  it('is 1 for identical colours', () => {
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
  });

  it('is about 4.54 for #767676 on white', () => {
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });
});

describe('formatContrast', () => {
  it('rounds down so a failing ratio never shows as 3.0', () => {
    expect(formatContrast(2.96)).toBe('2.9');
    expect(formatContrast(3)).toBe('3.0');
    expect(formatContrast(4.58)).toBe('4.5');
  });
});

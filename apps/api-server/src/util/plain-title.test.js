import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { plainTitle } = require('./plain-title');

describe('plainTitle', () => {
  it.each([
    ['Kosten < 5', 'Kosten < 5'],
    ['Wijk A & B & C', 'Wijk A & B & C'],
    ['"Groen" > grijs', '"Groen" > grijs'],
    ["Tom's map", "Tom's map"],
  ])('keeps %j as plain text', (input, expected) => {
    expect(plainTitle(input)).toBe(expected);
  });

  it('strips tags', () => {
    expect(plainTitle('<b>Wijk</b> <script>alert(1)</script>Noord')).toBe(
      'Wijk Noord'
    );
  });

  it('turns tags only or whitespace into an empty string', () => {
    expect(plainTitle('<b></b>')).toBe('');
    expect(plainTitle('   ')).toBe('');
    expect(plainTitle(undefined)).toBe('');
  });

  it('gives the same result when run twice', () => {
    const once = plainTitle('Kosten < 5 & meer');
    expect(plainTitle(once)).toBe(once);
  });
});

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_MAX_INPUT_MEGAPIXELS,
  resolveMaxInputPixels,
  resolveThrottle,
} from './memory-settings.js';

describe('resolveMaxInputPixels', () => {
  it('uses the default when nothing is configured', () => {
    expect(resolveMaxInputPixels(undefined)).toBe(
      DEFAULT_MAX_INPUT_MEGAPIXELS * 1e6
    );
    expect(resolveMaxInputPixels('')).toBe(DEFAULT_MAX_INPUT_MEGAPIXELS * 1e6);
  });

  it('converts megapixels to pixels', () => {
    expect(resolveMaxInputPixels('50')).toBe(50e6);
    expect(resolveMaxInputPixels('0.5')).toBe(500000);
  });

  it('falls back to the default on invalid input', () => {
    expect(resolveMaxInputPixels('veel')).toBe(
      DEFAULT_MAX_INPUT_MEGAPIXELS * 1e6
    );
    expect(resolveMaxInputPixels('-1')).toBe(
      DEFAULT_MAX_INPUT_MEGAPIXELS * 1e6
    );
    expect(resolveMaxInputPixels('0')).toBe(DEFAULT_MAX_INPUT_MEGAPIXELS * 1e6);
  });
});

describe('resolveThrottle', () => {
  it('uses memory-safe defaults when nothing is configured', () => {
    expect(resolveThrottle({})).toEqual({
      ccProcessors: 2,
      ccPrefetchers: 4,
      ccRequests: 100,
    });
  });

  it('treats empty values from docker compose as not configured', () => {
    expect(
      resolveThrottle({
        THROTTLE_CC_PROCESSORS: '',
        THROTTLE_CC_PREFETCHER: '',
        THROTTLE_CC_REQUESTS: '',
      })
    ).toEqual({ ccProcessors: 2, ccPrefetchers: 4, ccRequests: 100 });
  });

  it('reads configured values as numbers', () => {
    expect(
      resolveThrottle({
        THROTTLE_CC_PROCESSORS: '4',
        THROTTLE_CC_PREFETCHER: '20',
        THROTTLE_CC_REQUESTS: '250',
      })
    ).toEqual({ ccProcessors: 4, ccPrefetchers: 20, ccRequests: 250 });
  });
});

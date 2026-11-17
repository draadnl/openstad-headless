/**
 * Settings that bound how much memory image processing can use. They live in
 * one place because they only make sense together: the container has a fixed
 * memory limit, and every one of these multiplies with the others.
 */
const DEFAULT_MAX_INPUT_MEGAPIXELS = 120;
const DEFAULT_CC_PROCESSORS = 2;
const DEFAULT_CC_PREFETCHERS = 4;
const DEFAULT_CC_REQUESTS = 100;

const positiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/**
 * The upload size limit says nothing about decoded size: a 0.8 MB interlaced
 * PNG of 250 megapixels needs about 900 MB to resize. sharp refuses anything
 * above 268 megapixels by default; this lowers that to a size that still fits
 * the largest phone cameras (108 megapixels).
 */
const resolveMaxInputPixels = (envValue) =>
  Math.round(positiveNumber(envValue, DEFAULT_MAX_INPUT_MEGAPIXELS) * 1e6);

/**
 * image-steam holds the complete original in memory for every request that has
 * a prefetch slot, and decodes one image per processor slot. With the library
 * defaults (20 and 4) a burst of uncached requests for large photos peaked at
 * 1.3 GB in testing; with 4 and 2 the same burst stays around 540 MB and takes
 * about twice as long. Requests above the limits wait in line, they do not fail.
 */
const resolveThrottle = (env = process.env) => ({
  ccProcessors: positiveNumber(
    env.THROTTLE_CC_PROCESSORS,
    DEFAULT_CC_PROCESSORS
  ),
  ccPrefetchers: positiveNumber(
    env.THROTTLE_CC_PREFETCHER,
    DEFAULT_CC_PREFETCHERS
  ),
  ccRequests: positiveNumber(env.THROTTLE_CC_REQUESTS, DEFAULT_CC_REQUESTS),
});

module.exports = {
  DEFAULT_MAX_INPUT_MEGAPIXELS,
  resolveMaxInputPixels,
  resolveThrottle,
};

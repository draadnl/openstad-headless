const os = require('node:os');
const path = require('node:path');
const { Worker } = require('node:worker_threads');
const sharp = require('sharp');

/**
 * HEIC is the default photo format on iPhone, but neither libvips build in this
 * repo can decode it: the prebuilt sharp binaries ship libheif without the HEVC
 * codec, so reading metadata succeeds while decoding pixels fails with
 * "source: bad seek". Browsers other than Safari cannot render it either.
 *
 * Uploads are therefore decoded here with the WebAssembly build of libheif,
 * which does include libde265, and stored as JPEG. Everything downstream then
 * sees an ordinary image.
 */
const HEIC_EXTENSIONS = ['heic', 'heif'];

const HEIC_MIME_TYPES = [
  'image/heic',
  'image/heic-sequence',
  'image/heif',
  'image/heif-sequence',
];

const HEIC_JPEG_QUALITY = 90;

const HEIC_UNREADABLE = 'HEIC_UNREADABLE';
const HEIC_TOO_MANY_PIXELS = 'HEIC_TOO_MANY_PIXELS';
const HEIC_NOT_ENOUGH_MEMORY = 'HEIC_NOT_ENOUGH_MEMORY';

/**
 * HEIC compresses so well that the upload size limit says nothing about the
 * decoded size: a 2.4 MB file holding 200 megapixels needs an 800 MB raw
 * buffer. The cap is on pixels, not bytes. The default leaves room for the
 * largest phone photos, which currently top out at 48 megapixels.
 */
const HEIC_MAX_MEGAPIXELS = Number(process.env.HEIC_MAX_MEGAPIXELS) || 50;

/**
 * A single 48 megapixel conversion peaks around 650 MB of resident memory, so
 * conversions run one at a time unless configured otherwise.
 */
const maxConcurrentConversions =
  Number(process.env.HEIC_MAX_CONCURRENT_CONVERSIONS) || 1;

/**
 * Peak resident memory of a conversion, measured at 12, 24 and 48 megapixels:
 * roughly 13 MB per megapixel (the WebAssembly heap of libheif plus the raw
 * RGBA copy handed back by the worker). Rounded up, because an estimate that is
 * too low ends in the container being OOM-killed, which also takes down every
 * other upload in flight.
 */
const HEIC_BYTES_PER_PIXEL = 14;

/**
 * Memory kept free for the fixed cost of a conversion (worker thread and
 * WebAssembly module, about 35 MB) and for everything else the server is doing
 * at that moment.
 */
const HEIC_MEMORY_HEADROOM_BYTES = 64 * 1024 * 1024;

const ISPE_BOX_SIZE = 20;
const ISPE_MARKER = Buffer.from('ispe');

/**
 * Largest pixel count declared by any image spatial extents box in the file.
 * Reading this costs nothing compared to decoding, so it is what the pixel cap
 * is checked against. The box size is verified to avoid matching the four
 * marker bytes inside compressed image data.
 */
const maxPixelsFromIspeBoxes = (buffer) => {
  let max = 0;
  let offset = 0;

  while (offset < buffer.length) {
    const at = buffer.indexOf(ISPE_MARKER, offset);
    if (at === -1) break;
    offset = at + ISPE_MARKER.length;

    if (at < 4 || at + 16 > buffer.length) continue;
    if (buffer.readUInt32BE(at - 4) !== ISPE_BOX_SIZE) continue;

    const width = buffer.readUInt32BE(at + 8);
    const height = buffer.readUInt32BE(at + 12);
    if (width < 1 || height < 1) continue;

    max = Math.max(max, width * height);
  }

  return max;
};

const heicError = (code, message) =>
  Object.assign(new Error(message), { code });

const getFileExtension = (fileName) => {
  if (typeof fileName !== 'string' || !fileName.includes('.')) {
    return null;
  }
  const extension = fileName.split('.').pop().toLowerCase();
  return extension.length > 0 ? extension : null;
};

/**
 * Whether an upload claims to be HEIC based on the only two things available at
 * filter time. Browsers report the mime type inconsistently, so the extension
 * counts as well. The buffer itself is the real check and happens in
 * convertHeicToJpeg.
 */
const looksLikeHeicUpload = (fileName, mimeType) => {
  const extension = getFileExtension(fileName);
  if (extension !== null && HEIC_EXTENSIONS.includes(extension)) {
    return true;
  }
  return (
    typeof mimeType === 'string' &&
    HEIC_MIME_TYPES.includes(mimeType.toLowerCase())
  );
};

const replaceExtension = (fileName, extension) => {
  if (typeof fileName !== 'string' || fileName.length === 0) {
    return `image.${extension}`;
  }
  const lastDot = fileName.lastIndexOf('.');
  const base = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return `${base}.${extension}`;
};

/**
 * Memory limit of the container (cgroup) in bytes, or 0 when there is none or
 * it cannot be determined. Older Node versions report "no limit" as a huge
 * number instead of 0.
 */
const getMemoryLimitBytes = () => {
  if (typeof process.constrainedMemory !== 'function') return 0;
  const limit = Number(process.constrainedMemory());
  if (!Number.isFinite(limit) || limit <= 0 || limit > os.totalmem()) return 0;
  return limit;
};

/**
 * Megapixels that can be decoded right now without running into the memory
 * limit of the container, or Infinity when no limit is known. Refusing one
 * upload with a readable message beats the kernel killing the whole process.
 */
const getConvertibleMegapixels = ({
  limitBytes = getMemoryLimitBytes(),
  usedBytes = process.memoryUsage.rss(),
} = {}) => {
  if (!limitBytes) return Infinity;
  const availableBytes = limitBytes - usedBytes - HEIC_MEMORY_HEADROOM_BYTES;
  return Math.max(0, availableBytes / HEIC_BYTES_PER_PIXEL / 1e6);
};

/**
 * Decode in a worker thread that is thrown away afterwards. The WebAssembly
 * heap of libheif never shrinks, so decoding in the main thread would keep
 * hundreds of megabytes resident until the next restart.
 */
const decodeInWorker = (buffer) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, 'heic-worker.js'), {
      workerData: { buffer },
    });
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      // Wait for the worker to be gone before continuing, so its heap is
      // released before sharp starts encoding.
      worker.terminate().then(
        () => fn(value),
        () => fn(value)
      );
    };

    worker.once('message', (message) => {
      if (message && message.error) {
        return settle(reject, heicError(HEIC_UNREADABLE, message.error));
      }
      settle(resolve, message);
    });
    worker.once('error', (error) => settle(reject, error));
    worker.once('exit', (code) =>
      settle(
        reject,
        heicError(HEIC_UNREADABLE, `HEIC decoder stopped with code ${code}.`)
      )
    );
  });

/**
 * Give the raw pixels back right away instead of whenever the garbage
 * collector gets to them: a 48 megapixel photo is a 195 MB buffer, and while it
 * lingers the next conversion sees that much less free memory.
 */
const releasePixels = (data) => {
  if (data && data.buffer && typeof data.buffer.transfer === 'function') {
    data.buffer.transfer(0);
  }
};

let activeConversions = 0;
const waiting = [];

const acquireSlot = () => {
  if (activeConversions < maxConcurrentConversions) {
    activeConversions++;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
};

const releaseSlot = () => {
  const next = waiting.shift();
  if (next) {
    next();
    return;
  }
  activeConversions--;
};

/**
 * Decode a HEIC buffer and re-encode it as JPEG. Throws when the buffer is not
 * HEIC, which is what makes this the authoritative check rather than the
 * extension. Conversions are capped because a 12 megapixel photo needs a 46 MB
 * raw buffer on top of the decoder's own heap.
 */
const convertHeicToJpeg = async (buffer) => {
  const pixels = maxPixelsFromIspeBoxes(buffer);
  if (pixels === 0) {
    throw heicError(HEIC_UNREADABLE, 'No HEIC image dimensions found.');
  }
  if (pixels > HEIC_MAX_MEGAPIXELS * 1e6) {
    throw heicError(
      HEIC_TOO_MANY_PIXELS,
      `Image is ${Math.round(pixels / 1e6)} megapixels, the maximum is ${HEIC_MAX_MEGAPIXELS}.`
    );
  }

  await acquireSlot();
  try {
    // Checked inside the slot: only then is the memory of the previous
    // conversion released and the measurement meaningful.
    const convertibleMegapixels = getConvertibleMegapixels();
    if (pixels > convertibleMegapixels * 1e6) {
      console.warn(
        `HEIC upload of ${Math.round(pixels / 1e6)} megapixels refused: only enough free memory for ${Math.floor(convertibleMegapixels)} megapixels. Raise the memory limit of the image server to accept larger HEIC photos.`
      );
      throw heicError(
        HEIC_NOT_ENOUGH_MEMORY,
        `Image is ${Math.round(pixels / 1e6)} megapixels, which is too large to convert on this server right now.`
      );
    }

    const { width, height, data } = await decodeInWorker(buffer);

    try {
      return await sharp(
        Buffer.from(data.buffer, data.byteOffset, data.length),
        { raw: { width, height, channels: 4 } }
      )
        .jpeg({ quality: HEIC_JPEG_QUALITY })
        .toBuffer();
    } finally {
      releasePixels(data);
    }
  } finally {
    releaseSlot();
  }
};

module.exports = {
  HEIC_EXTENSIONS,
  HEIC_MIME_TYPES,
  HEIC_JPEG_QUALITY,
  HEIC_MAX_MEGAPIXELS,
  HEIC_TOO_MANY_PIXELS,
  HEIC_NOT_ENOUGH_MEMORY,
  HEIC_UNREADABLE,
  getConvertibleMegapixels,
  looksLikeHeicUpload,
  maxPixelsFromIspeBoxes,
  replaceExtension,
  convertHeicToJpeg,
};

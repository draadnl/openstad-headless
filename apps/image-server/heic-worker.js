const { parentPort, workerData } = require('node:worker_threads');

/**
 * Decodes one HEIC file to raw RGBA and hands the pixels back to the main
 * thread. This runs in a worker thread because the WebAssembly heap of libheif
 * only ever grows: decoding a 48 megapixel photo leaves about 480 MB resident
 * for as long as the module stays loaded. Terminating the worker after every
 * conversion is the only way to give that memory back.
 */
const run = async () => {
  const decode = require('heic-decode');
  const { width, height, data } = await decode({ buffer: workerData.buffer });

  // Uint8ClampedArray owns its ArrayBuffer, so it can be transferred instead
  // of copied.
  parentPort.postMessage({ width, height, data }, [data.buffer]);
};

run().catch((error) => {
  parentPort.postMessage({
    error: (error && error.message) || 'HEIC decoding failed',
  });
});

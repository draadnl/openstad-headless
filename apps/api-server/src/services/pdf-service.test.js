import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  fetchImageAsDataUrl,
  generatePdf,
  isPdfConfigured,
} = require('./pdf-service');

const IMAGE_APP_URL = 'https://img.example.org';
const IMAGE_APP_URL_INTERNAL = 'http://openstad-image-server:31450';

function imageResponse() {
  return new Response(Buffer.from('png-bytes'), {
    status: 200,
    headers: { 'content-type': 'image/png' },
  });
}

describe('fetchImageAsDataUrl', () => {
  let fetchMock;
  let originalEnv;

  beforeEach(() => {
    originalEnv = {
      IMAGE_APP_URL: process.env.IMAGE_APP_URL,
      IMAGE_APP_URL_INTERNAL: process.env.IMAGE_APP_URL_INTERNAL,
    };
    process.env.IMAGE_APP_URL = IMAGE_APP_URL;
    process.env.IMAGE_APP_URL_INTERNAL = IMAGE_APP_URL_INTERNAL;
    fetchMock = vi.fn().mockResolvedValue(imageResponse());
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('fetches an image-server url through the internal url', async () => {
    const result = await fetchImageAsDataUrl(`${IMAGE_APP_URL}/image/logo.png`);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${IMAGE_APP_URL_INTERNAL}/image/logo.png`
    );
    expect(result).toBe(
      `data:image/png;base64,${Buffer.from('png-bytes').toString('base64')}`
    );
  });

  it('fetches an internal image-server url', async () => {
    await fetchImageAsDataUrl(`${IMAGE_APP_URL_INTERNAL}/image/logo.png`);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not fetch a url on another host', async () => {
    await expect(
      fetchImageAsDataUrl('https://attacker.example/logo.png')
    ).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch a host that only starts with the image-server host', async () => {
    await expect(
      fetchImageAsDataUrl('https://img.example.org.attacker.example/logo.png')
    ).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch anything when no image-server url is configured', async () => {
    delete process.env.IMAGE_APP_URL;
    delete process.env.IMAGE_APP_URL_INTERNAL;

    await expect(
      fetchImageAsDataUrl(`${IMAGE_APP_URL}/image/logo.png`)
    ).rejects.toThrow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a data url unchanged', async () => {
    const dataUrl = 'data:image/png;base64,AAAA';

    expect(await fetchImageAsDataUrl(dataUrl)).toBe(dataUrl);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('generatePdf', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = {
      PDF_API_ENDPOINT: process.env.PDF_API_ENDPOINT,
      PDF_API_KEY: process.env.PDF_API_KEY,
    };
    process.env.PDF_API_ENDPOINT = 'https://pdf.example/api';
    process.env.PDF_API_KEY = 'secret-key-sentinel';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it('isPdfConfigured needs both settings', () => {
    expect(isPdfConfigured()).toBe(true);
    delete process.env.PDF_API_KEY;
    expect(isPdfConfigured()).toBe(false);
  });

  it('returns the pdf bytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(Buffer.from('abc')))
    );
    const out = await generatePdf('<p>x</p>');
    expect(out.toString()).toBe('abc');
  });

  it('refuses a response whose content-length is over maxBytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(Buffer.from('abc'), {
          headers: { 'content-length': '100' },
        })
      )
    );
    await expect(
      generatePdf('<p>x</p>', { maxBytes: 10 })
    ).rejects.toMatchObject({
      code: 'PDF_TOO_LARGE',
    });
  });

  it('stops a stream that grows over maxBytes without a content-length', async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(8));
        controller.enqueue(new Uint8Array(8));
        controller.close();
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(stream)));
    await expect(
      generatePdf('<p>x</p>', { maxBytes: 10 })
    ).rejects.toMatchObject({
      code: 'PDF_TOO_LARGE',
    });
  });

  it('accepts exactly maxBytes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(Buffer.alloc(10)))
    );
    const out = await generatePdf('<p>x</p>', { maxBytes: 10 });
    expect(out.length).toBe(10);
  });

  it('never puts the upstream body or the key in the error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('upstream says answer-sentinel and secret-key-sentinel', {
          status: 500,
        })
      )
    );
    const err = await generatePdf('<p>x</p>').catch((e) => e);
    expect(err.code).toBe('PDF_UPSTREAM_ERROR');
    expect(err.status).toBe(500);
    expect(JSON.stringify([err.message, err.stack])).not.toMatch(/sentinel/);
  });

  it('maps a timeout to PDF_TIMEOUT', async () => {
    const timeout = Object.assign(new Error('t'), { name: 'TimeoutError' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(timeout));
    await expect(generatePdf('<p>x</p>')).rejects.toMatchObject({
      code: 'PDF_TIMEOUT',
    });
  });
});

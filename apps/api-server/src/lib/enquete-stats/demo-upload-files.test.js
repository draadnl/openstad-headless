import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  DEMO_FILES,
  buildPlaceholderPng,
  buildPlaceholderPdf,
  matchesDemoUpload,
  pickDemoCandidate,
  ensureDemoUploads,
} = require('./demo-upload-files');

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('buildPlaceholderPng', () => {
  it('writes the PNG signature and the requested size', () => {
    const png = buildPlaceholderPng({
      width: 64,
      height: 48,
      color: [10, 20, 30],
      digit: 7,
    });
    expect([...png.subarray(0, 8)]).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(64);
    expect(png.readUInt32BE(20)).toBe(48);
    expect(png.subarray(png.length - 8, png.length - 4).toString('ascii')).toBe(
      'IEND'
    );
  });
});

describe('large demo photos', () => {
  const find = (slug) => DEMO_FILES.find((f) => f.slug === slug);

  it('has a large landscape and a tall portrait photo', () => {
    const landscape = find('demo-buurtfoto-7');
    const portrait = find('demo-buurtfoto-8');
    expect(landscape.width).toBe(2400);
    expect(landscape.height).toBe(1600);
    expect(portrait.width).toBe(900);
    expect(portrait.height).toBe(1600);
  });

  it('builds them at their size and under 200 KB', () => {
    for (const slug of ['demo-buurtfoto-7', 'demo-buurtfoto-8']) {
      const file = find(slug);
      const png = buildPlaceholderPng(file);
      expect(png.readUInt32BE(16)).toBe(file.width);
      expect(png.readUInt32BE(20)).toBe(file.height);
      expect(png.length).toBeLessThan(200 * 1024);
    }
  });
});

describe('buildPlaceholderPdf', () => {
  it('starts with %PDF- and ends with %%EOF, with a correct xref offset', () => {
    const pdf = buildPlaceholderPdf('Rapport 1');
    const text = pdf.toString('latin1');
    expect(text.startsWith('%PDF-')).toBe(true);
    expect(text.endsWith('%%EOF')).toBe(true);
    const startxref = Number(text.match(/startxref\n(\d+)\n/)[1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
  });
});

describe('matchesDemoUpload', () => {
  const url = `http://localhost:31450/image/demo-buurtfoto-1-${UUID}.png`;
  it('matches the right slug', () => {
    expect(matchesDemoUpload(url, 'demo-buurtfoto-1', 'image')).toBe(true);
  });
  it('rejects another slug', () => {
    expect(matchesDemoUpload(url, 'demo-buurtfoto-2', 'image')).toBe(false);
  });
  it('accepts a converted extension', () => {
    expect(
      matchesDemoUpload(
        `http://x/image/demo-buurtfoto-1-${UUID}.webp`,
        'demo-buurtfoto-1',
        'image'
      )
    ).toBe(true);
  });
  it('matches documents and rejects origin-less paths', () => {
    expect(
      matchesDemoUpload(
        `http://x/document/demo-rapport-1-${UUID}.pdf`,
        'demo-rapport-1',
        'document'
      )
    ).toBe(true);
    expect(
      matchesDemoUpload(
        `/image/demo-buurtfoto-1-${UUID}.png`,
        'demo-buurtfoto-1',
        'image'
      )
    ).toBe(false);
  });
});

describe('matchesDemoUpload with underscore extension', () => {
  it('matches the real stored shapes', () => {
    const o = 'http://localhost:31450';
    expect(
      matchesDemoUpload(
        `${o}/image/demo-buurtfoto-1-${UUID}_png`,
        'demo-buurtfoto-1',
        'image'
      )
    ).toBe(true);
    expect(
      matchesDemoUpload(
        `${o}/image/demo-buurtfoto-1-${UUID}_webp`,
        'demo-buurtfoto-1',
        'image'
      )
    ).toBe(true);
    expect(
      matchesDemoUpload(
        `${o}/document/demo-rapport-1-${UUID}_pdf`,
        'demo-rapport-1',
        'document'
      )
    ).toBe(true);
    expect(
      matchesDemoUpload(
        `${o}/image/demo-buurtfoto-1-${UUID}.png`,
        'demo-buurtfoto-1',
        'image'
      )
    ).toBe(true);
  });
});

describe('pickDemoCandidate', () => {
  const a = `http://x/image/demo-buurtfoto-1-${UUID}_png`;
  const b = `http://x/image/demo-buurtfoto-1-aaaaaaaa-4000-4000-8000-000000000000_png`;
  it('picks the most used URL', () => {
    expect(pickDemoCandidate([a, b, a], 'demo-buurtfoto-1', 'image')).toBe(a);
  });
  it('breaks ties alphabetically and returns null without a match', () => {
    expect(pickDemoCandidate([b, a], 'demo-buurtfoto-1', 'image')).toBe(a);
    expect(pickDemoCandidate([a], 'demo-buurtfoto-2', 'image')).toBeNull();
  });
});

describe('ensureDemoUploads two runs', () => {
  const makeServer = () => {
    const created = new Set();
    let n = 0;
    const fetchImpl = vi.fn(async (url, opts) => {
      if (opts.method === 'GET') {
        return { status: created.has(url) ? 200 : 404, ok: created.has(url) };
      }
      const field = url.endsWith('/document') ? 'document' : 'image';
      const slug = opts.body.get(field).name.replace(/\.(png|pdf)$/, '');
      const id = `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
      const ext = field === 'document' ? 'pdf' : 'png';
      const out = `http://localhost:31450/${field}/${slug}-${id}_${ext}`;
      created.add(out);
      return { status: 200, ok: true, json: async () => ({ url: out }) };
    });
    return fetchImpl;
  };

  it('second run reuses every file', async () => {
    const fetchImpl = makeServer();
    const args = {
      uploadBase: 'http://localhost:31450',
      token: 't',
      fetchImpl,
    };
    const run1 = await ensureDemoUploads({ ...args, storedUrls: [] });
    expect(run1.uploaded).toBe(13);
    const run2 = await ensureDemoUploads({
      ...args,
      storedUrls: Object.values(run1.urls),
    });
    expect(run2.uploaded).toBe(0);
    expect(run2.reused).toBe(13);
    expect(run2.urls).toEqual(run1.urls);
  });

  it('throws on a 429 check and performs no upload', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 429, ok: false }));
    await expect(
      ensureDemoUploads({
        storedUrls: [
          `http://localhost:31450/image/demo-buurtfoto-1-${UUID}_png`,
        ],
        uploadBase: 'http://localhost:31450',
        token: 'topsecret',
        fetchImpl,
        files: [DEMO_FILES[0]],
      })
    ).rejects.toThrow(/Check of demo-buurtfoto-1 failed with status 429/);
    expect(fetchImpl.mock.calls.some((c) => c[1].method === 'POST')).toBe(
      false
    );
  });
});

describe('ensureDemoUploads', () => {
  const files = [
    DEMO_FILES.find((f) => f.slug === 'demo-buurtfoto-1'),
    DEMO_FILES.find((f) => f.slug === 'demo-rapport-1'),
  ];
  const storedUrls = [
    `http://public.example/image/demo-buurtfoto-1-${UUID}.png`,
    `http://public.example/document/demo-rapport-1-${UUID}.pdf`,
  ];

  it('reuses files that still exist (0 uploads)', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, ok: true }));
    const res = await ensureDemoUploads({
      storedUrls,
      uploadBase: 'http://localhost:31450',
      token: 't',
      fetchImpl,
      files,
    });
    expect(res.uploaded).toBe(0);
    expect(res.reused).toBe(2);
    expect(res.urls['demo-buurtfoto-1']).toBe(storedUrls[0]);
    expect(fetchImpl.mock.calls[0][0]).toContain('localhost:31450');
  });

  it('uploads on 404 and when there is no candidate, sending the token', async () => {
    const fetchImpl = vi.fn(async (url, opts) => {
      if (opts.method === 'GET') return { status: 404, ok: false };
      return {
        status: 200,
        ok: true,
        json: async () => ({ url: `${url}-new` }),
      };
    });
    const res = await ensureDemoUploads({
      storedUrls: [storedUrls[0]],
      uploadBase: 'http://localhost:31450/',
      token: 'secret',
      fetchImpl,
      files,
    });
    expect(res.uploaded).toBe(2);
    expect(res.reused).toBe(0);
    const posts = fetchImpl.mock.calls.filter((c) => c[1].method === 'POST');
    expect(posts).toHaveLength(2);
    expect(posts[0][1].headers['image-token']).toBe('secret');
    expect(posts[0][0]).toBe('http://localhost:31450/image');
    expect(posts[1][0]).toBe('http://localhost:31450/document');
  });

  it('throws a clear error on 401 without leaking the token', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 401, ok: false }));
    await expect(
      ensureDemoUploads({
        storedUrls: [],
        uploadBase: 'http://localhost:31450',
        token: 'topsecret',
        fetchImpl,
        files,
      })
    ).rejects.toThrow(/status 401/);
    await ensureDemoUploads({
      storedUrls: [],
      uploadBase: 'http://localhost:31450',
      token: 'topsecret',
      fetchImpl,
      files,
    }).catch((e) => expect(e.message).not.toContain('topsecret'));
  });
});

describe('ensureDemoUploads without a token', () => {
  const files = [
    DEMO_FILES.find((f) => f.slug === 'demo-buurtfoto-1'),
    DEMO_FILES.find((f) => f.slug === 'demo-rapport-1'),
  ];
  const stored = [
    `http://public.example/image/demo-buurtfoto-1-${UUID}.png`,
    `http://public.example/document/demo-rapport-1-${UUID}.pdf`,
  ];

  it('resolves with 0 uploads and no POST when every file is reused', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200, ok: true }));
    const res = await ensureDemoUploads({
      storedUrls: stored,
      uploadBase: 'http://localhost:31450',
      fetchImpl,
      files,
    });
    expect(res.uploaded).toBe(0);
    expect(res.reused).toBe(2);
    expect(fetchImpl.mock.calls.some((c) => c[1].method === 'POST')).toBe(
      false
    );
  });

  it('rejects with the token message before any POST when a file is missing', async () => {
    const fetchImpl = vi.fn(async (url) => ({
      status: url.includes('demo-rapport-1') ? 404 : 200,
      ok: !url.includes('demo-rapport-1'),
    }));
    await expect(
      ensureDemoUploads({
        storedUrls: stored,
        uploadBase: 'http://localhost:31450',
        fetchImpl,
        files,
      })
    ).rejects.toThrow(
      'IMAGE_VERIFICATION_TOKEN ontbreekt: er moeten demo-bestanden geüpload worden.'
    );
    expect(fetchImpl.mock.calls.some((c) => c[1].method === 'POST')).toBe(
      false
    );
  });
});

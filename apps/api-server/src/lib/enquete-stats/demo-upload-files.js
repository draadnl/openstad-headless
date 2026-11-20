// Placeholder files for the demo survey plus an idempotent upload.
const zlib = require('zlib');

const DEMO_FILES = [
  {
    slug: 'demo-buurtfoto-1',
    kind: 'image',
    label: 'Buurtfoto 1',
    color: [231, 76, 60],
    digit: 1,
  },
  {
    slug: 'demo-buurtfoto-2',
    kind: 'image',
    label: 'Buurtfoto 2',
    color: [52, 152, 219],
    digit: 2,
  },
  {
    slug: 'demo-buurtfoto-3',
    kind: 'image',
    label: 'Buurtfoto 3',
    color: [46, 204, 113],
    digit: 3,
  },
  {
    slug: 'demo-buurtfoto-4',
    kind: 'image',
    label: 'Buurtfoto 4',
    color: [243, 156, 18],
    digit: 4,
  },
  {
    slug: 'demo-buurtfoto-5',
    kind: 'image',
    label: 'Buurtfoto 5',
    color: [155, 89, 182],
    digit: 5,
  },
  {
    slug: 'demo-buurtfoto-6',
    kind: 'image',
    label: 'Buurtfoto 6',
    color: [26, 188, 156],
    digit: 6,
  },
  // Large landscape and tall portrait photos to test the image viewer layout.
  {
    slug: 'demo-buurtfoto-7',
    kind: 'image',
    label: 'Buurtfoto 7 (landschap)',
    color: [41, 128, 185],
    digit: 7,
    width: 2400,
    height: 1600,
  },
  {
    slug: 'demo-buurtfoto-8',
    kind: 'image',
    label: 'Buurtfoto 8 (portret)',
    color: [192, 57, 43],
    digit: 8,
    width: 900,
    height: 1600,
  },
  {
    slug: 'demo-optie-park',
    kind: 'image',
    label: 'Park',
    color: [39, 174, 96],
    digit: 1,
  },
  {
    slug: 'demo-optie-plein',
    kind: 'image',
    label: 'Plein',
    color: [127, 140, 141],
    digit: 2,
  },
  {
    slug: 'demo-optie-speeltuin',
    kind: 'image',
    label: 'Speeltuin',
    color: [230, 126, 34],
    digit: 3,
  },
  { slug: 'demo-rapport-1', kind: 'document', label: 'Rapport 1' },
  { slug: 'demo-rapport-2', kind: 'document', label: 'Rapport 2' },
];

// 5x7 bitmap font for the digits 0-9 (each row is a 5-char string).
const DIGIT_FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
};

const buildPlaceholderPng = ({
  width = 320,
  height = 240,
  color = [200, 200, 200],
  digit = 0,
} = {}) => {
  const glyph = DIGIT_FONT[digit] || DIGIT_FONT[0];
  const scale = Math.max(1, Math.floor((height * 0.6) / 7));
  const glyphW = 5 * scale;
  const glyphH = 7 * scale;
  const left = Math.floor((width - glyphW) / 2);
  const top = Math.floor((height - glyphH) / 2);

  const rowLen = 1 + width * 3;
  const raw = Buffer.alloc(rowLen * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * rowLen;
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      let pixel = color;
      const gx = Math.floor((x - left) / scale);
      const gy = Math.floor((y - top) / scale);
      if (
        x >= left &&
        y >= top &&
        gx >= 0 &&
        gx < 5 &&
        gy >= 0 &&
        gy < 7 &&
        glyph[gy][gx] === '1'
      ) {
        pixel = [255, 255, 255];
      }
      const o = rowStart + 1 + x * 3;
      raw[o] = pixel[0];
      raw[o + 1] = pixel[1];
      raw[o + 2] = pixel[2];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const buildPlaceholderPdf = (title = 'Demo') => {
  const safe = String(title).replace(/[^A-Za-z0-9 .,-]/g, '');
  const stream = `BT /F1 24 Tf 72 720 Td (${safe}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let out = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefStart = Buffer.byteLength(out);
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    out += `${String(off).padStart(10, '0')} 00000 n \n`;
  });
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(out, 'latin1');
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The image server stores `<name>-<uuid>.<ext>` and may convert PNG to another format.
const matchesDemoUpload = (url, slug, kind) => {
  if (typeof url !== 'string') return false;
  let pathname;
  try {
    pathname = new URL(url).pathname;
  } catch (e) {
    return false;
  }
  const uuid =
    '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}';
  const re =
    kind === 'document'
      ? new RegExp(`^/document/${escapeRegExp(slug)}-${uuid}[._]pdf$`)
      : new RegExp(`^/image/${escapeRegExp(slug)}-${uuid}[._][A-Za-z0-9]+$`);
  return re.test(pathname);
};

// Picks the most used stored URL that matches a demo file.
const pickDemoCandidate = (storedUrls, slug, kind) => {
  const counts = new Map();
  for (const url of storedUrls) {
    if (matchesDemoUpload(url, slug, kind)) {
      counts.set(url, (counts.get(url) || 0) + 1);
    }
  }
  let best = null;
  for (const [url, count] of counts) {
    if (
      best === null ||
      count > best.count ||
      (count === best.count && url < best.url)
    ) {
      best = { url, count };
    }
  }
  return best ? best.url : null;
};

const swapOrigin = (url, base) => {
  const u = new URL(url);
  const b = new URL(base);
  u.protocol = b.protocol;
  u.host = b.host;
  return u.toString();
};

const ensureDemoUploads = async ({
  storedUrls = [],
  uploadBase,
  token,
  fetchImpl = fetch,
  files = DEMO_FILES,
}) => {
  if (!uploadBase) throw new Error('uploadBase is required');
  const base = uploadBase.replace(/\/+$/, '');

  const urls = {};
  let uploaded = 0;
  let reused = 0;

  for (const file of files) {
    const candidate = pickDemoCandidate(storedUrls, file.slug, file.kind);

    if (candidate) {
      let status;
      try {
        const res = await fetchImpl(swapOrigin(candidate, base), {
          method: 'GET',
        });
        status = res.status;
      } catch (e) {
        status = 'network error';
      }
      if (status === 200) {
        urls[file.slug] = candidate;
        reused++;
        continue;
      }
      if (status !== 404) {
        throw new Error(`Check of ${file.slug} failed with status ${status}`);
      }
    }

    // The token is only needed for a real upload
    if (!token) {
      throw new Error(
        'IMAGE_VERIFICATION_TOKEN ontbreekt: er moeten demo-bestanden geüpload worden.'
      );
    }
    const isDoc = file.kind === 'document';
    const field = isDoc ? 'document' : 'image';
    const body = isDoc
      ? buildPlaceholderPdf(file.label)
      : buildPlaceholderPng({
          width: file.width || 320,
          height: file.height || 240,
          color: file.color,
          digit: file.digit,
        });
    const form = new FormData();
    form.append(
      field,
      new Blob([body], { type: isDoc ? 'application/pdf' : 'image/png' }),
      `${file.slug}.${isDoc ? 'pdf' : 'png'}`
    );

    const res = await fetchImpl(`${base}/${field}`, {
      method: 'POST',
      headers: { 'image-token': token },
      body: form,
    });
    if (!res.ok) {
      throw new Error(
        `Upload of ${file.slug} failed with status ${res.status}`
      );
    }
    const json = await res.json();
    if (!json || !json.url) {
      throw new Error(`Upload of ${file.slug} returned no url`);
    }
    urls[file.slug] = json.url;
    uploaded++;
  }

  return { urls, uploaded, reused };
};

module.exports = {
  DEMO_FILES,
  buildPlaceholderPng,
  buildPlaceholderPdf,
  matchesDemoUpload,
  pickDemoCandidate,
  ensureDemoUploads,
};

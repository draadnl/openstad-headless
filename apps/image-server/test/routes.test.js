import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterAll, beforeAll, expect, test } from 'vitest';

const TOKEN = 'test-token';
const SERVER_PATH = fileURLToPath(new URL('../server.js', import.meta.url));

let BASE_URL;
let serverProcess;
let workDir;
let jpeg;
let uploadedImageName;
let uploadedDocumentName;

/** Ask the OS for a free port so parallel worktrees and sessions never collide. */
const getFreePort = () =>
  new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });

const pdf = Buffer.from(
  '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'
);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Spawn server.js with extra env and poll GET /health until it answers. */
const startServer = async (env = {}) => {
  const port = await getFreePort();
  const baseUrl = `http://localhost:${port}`;
  const proc = spawn(process.execPath, [SERVER_PATH], {
    cwd: workDir,
    env: {
      ...process.env,
      PORT_API: String(port),
      APP_URL: `localhost:${port}`,
      IMAGES_DIR: path.join(workDir, 'images') + '/',
      DOCUMENTS_DIR: path.join(workDir, 'documents') + '/',
      IMAGE_VERIFICATION_TOKEN: TOKEN,
      MAX_FILE_UPLOAD_SIZE_MB: '1',
      S3_ENDPOINT: '',
      ...env,
    },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  proc.stderr.on('data', (chunk) => {
    stderr += chunk;
  });

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null || proc.signalCode) {
      throw new Error(
        `Server exited early with code ${proc.exitCode}, signal ${proc.signalCode}\n${stderr}`
      );
    }
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return { proc, baseUrl };
    } catch {}
    await sleep(100);
  }
  proc.kill();
  throw new Error('Server did not become healthy in time');
};

/** Open a raw POST /image whose multipart body never completes. */
const openPartialUpload = (baseUrl) => {
  const boundary = 'XBOUNDARY';
  const partHead = `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
  const length = Buffer.byteLength(partHead) + jpeg.length + 64;
  const socket = net.connect(Number(new URL(baseUrl).port), 'localhost');
  socket.on('error', () => {});
  // Drain responses so a server-side close surfaces as 'close' on this socket.
  socket.resume();
  socket.write(
    `POST /image HTTP/1.1\r\nHost: localhost\r\nimage-token: ${TOKEN}\r\nContent-Type: multipart/form-data; boundary=${boundary}\r\nContent-Length: ${length}\r\n\r\n${partHead}`
  );
  return socket;
};

const formWith = (field, files) => {
  const form = new FormData();
  for (const { buffer, type, name } of files) {
    form.append(field, new Blob([buffer], { type }), name);
  }
  return form;
};

const upload = (route, form, signal, baseUrl = BASE_URL) =>
  fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { 'image-token': TOKEN },
    body: form,
    signal,
  });

const lastPathSegment = (url) => new URL(url).pathname.split('/').pop();

beforeAll(async () => {
  jpeg = await sharp({
    create: { width: 64, height: 64, channels: 3, background: '#3366cc' },
  })
    .jpeg()
    .toBuffer();

  workDir = await mkdtemp(path.join(os.tmpdir(), 'image-server-test-'));
  await mkdir(path.join(workDir, 'images'));
  await mkdir(path.join(workDir, 'documents'));

  const server = await startServer({ MAX_CONCURRENT_UPLOADS: '2' });
  serverProcess = server.proc;
  BASE_URL = server.baseUrl;
}, 20000);

afterAll(async () => {
  serverProcess?.kill();
  if (workDir) await rm(workDir, { recursive: true, force: true });
});

test('GET /health reports the server as up', async () => {
  const response = await fetch(`${BASE_URL}/health`);
  expect(response.status).toBe(200);
  expect((await response.json()).status).toBe('UP');
});

test('POST /image without an image-token is rejected', async () => {
  const response = await fetch(`${BASE_URL}/image`, {
    method: 'POST',
    body: formWith('image', [
      { buffer: jpeg, type: 'image/jpeg', name: 'photo.jpg' },
    ]),
  });
  expect(response.status).toBe(401);
});

test('POST /image stores a jpeg and returns its name and url', async () => {
  const response = await upload(
    '/image',
    formWith('image', [{ buffer: jpeg, type: 'image/jpeg', name: 'photo.jpg' }])
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.name).toBe('photo_jpg');
  expect(typeof body.url).toBe('string');
  uploadedImageName = lastPathSegment(body.url);
});

test('POST /image rejects a disallowed file type with 415', async () => {
  const response = await upload(
    '/image',
    formWith('image', [
      {
        buffer: Buffer.from('MZ'),
        type: 'application/octet-stream',
        name: 'evil.exe',
      },
    ])
  );
  expect(response.status).toBe(415);
});

test('POST /image rejects a file over the upload limit with 413', async () => {
  const response = await upload(
    '/image',
    formWith('image', [
      {
        buffer: Buffer.alloc(1024 * 1024 + 1),
        type: 'image/jpeg',
        name: 'big.jpg',
      },
    ])
  );
  expect(response.status).toBe(413);
});

// Runs after the 415 and 413 tests: with 2 slots, a slot leaked on those
// error paths would leave queued uploads hanging here.
test('POST /image queues uploads beyond the concurrency cap and completes them all', async () => {
  const responses = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      upload(
        '/image',
        formWith('image', [
          { buffer: jpeg, type: 'image/jpeg', name: `queued${i}.jpg` },
        ])
      )
    )
  );
  const bodies = await Promise.all(responses.map((r) => r.json()));
  expect(responses.map((r) => r.status)).toEqual(Array(6).fill(200));
  expect(bodies.map(({ name }) => name).sort()).toEqual(
    Array.from({ length: 6 }, (_, i) => `queued${i}_jpg`).sort()
  );
  for (const body of bodies) expect(typeof body.url).toBe('string');
});

test('an upload aborted while queued does not leak its slot', async () => {
  // Two holders take both slots, two more requests queue and then abort.
  const holders = [openPartialUpload(BASE_URL), openPartialUpload(BASE_URL)];
  await sleep(200);
  const queued = [openPartialUpload(BASE_URL), openPartialUpload(BASE_URL)];
  await sleep(200);
  for (const socket of queued) socket.destroy();
  await sleep(200);
  // Freeing the holders hands their slots to the dead queued requests.
  for (const holder of holders) holder.destroy();
  await sleep(200);

  // With the leak, both slots stay held forever and this upload never starts.
  const response = await upload(
    '/image',
    formWith('image', [
      { buffer: jpeg, type: 'image/jpeg', name: 'after.jpg' },
    ]),
    AbortSignal.timeout(2000)
  );
  expect(response.status).toBe(200);
}, 5000);

test('uploads beyond the queue cap get a 503 with Retry-After', async () => {
  const { proc, baseUrl } = await startServer({
    MAX_CONCURRENT_UPLOADS: '1',
    MAX_QUEUED_UPLOADS: '1',
  });
  const sockets = [];
  try {
    sockets.push(openPartialUpload(baseUrl));
    await sleep(200);
    sockets.push(openPartialUpload(baseUrl));
    await sleep(200);

    const response = await upload(
      '/image',
      formWith('image', [
        { buffer: jpeg, type: 'image/jpeg', name: 'rejected.jpg' },
      ]),
      AbortSignal.timeout(2000),
      baseUrl
    );
    expect(response.status).toBe(503);
    expect(response.headers.get('retry-after')).toBe('10');
    expect((await response.json()).error).toMatch(
      /Too many concurrent uploads/
    );
  } finally {
    for (const socket of sockets) socket.destroy();
    proc.kill();
  }
}, 20000);

test('a slot held past the deadline is reclaimed', async () => {
  const { proc, baseUrl } = await startServer({
    MAX_CONCURRENT_UPLOADS: '1',
    UPLOAD_SLOT_TIMEOUT_MS: '500',
  });
  const holder = openPartialUpload(baseUrl);
  try {
    const holderClosed = new Promise((resolve) =>
      holder.once('close', resolve)
    );
    await Promise.race([holderClosed, sleep(2000)]);
    expect(holder.destroyed).toBe(true);

    const response = await upload(
      '/image',
      formWith('image', [
        { buffer: jpeg, type: 'image/jpeg', name: 'after-deadline.jpg' },
      ]),
      AbortSignal.timeout(3000),
      baseUrl
    );
    expect(response.status).toBe(200);
  } finally {
    holder.destroy();
    proc.kill();
  }
}, 20000);

test('POST /images stores multiple images', async () => {
  const response = await upload(
    '/images',
    formWith('image', [
      { buffer: jpeg, type: 'image/jpeg', name: 'one.jpg' },
      { buffer: jpeg, type: 'image/jpeg', name: 'two.jpg' },
    ])
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toHaveLength(2);
  expect(body.map(({ name }) => name)).toEqual(['one_jpg', 'two_jpg']);
  for (const item of body) expect(typeof item.url).toBe('string');
});

test('GET /image/:file serves the stored image', async () => {
  const response = await fetch(`${BASE_URL}/image/${uploadedImageName}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/^image\//);
  await response.arrayBuffer();
});

test('GET /image/:file/:/rs=w:10 serves a resized image', async () => {
  const response = await fetch(
    `${BASE_URL}/image/${uploadedImageName}/:/rs=w:10`
  );
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toMatch(/^image\//);
  const { width } = await sharp(
    Buffer.from(await response.arrayBuffer())
  ).metadata();
  expect(width).toBe(10);
});

test('POST /document stores a pdf and returns its metadata', async () => {
  const response = await upload(
    '/document',
    formWith('document', [
      { buffer: pdf, type: 'application/pdf', name: 'report.pdf' },
    ])
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({
    name: 'report_pdf',
    size: pdf.length,
    mimeType: 'application/pdf',
  });
  expect(typeof body.url).toBe('string');
  uploadedDocumentName = lastPathSegment(body.url);
});

test('POST /documents stores multiple documents', async () => {
  const response = await upload(
    '/documents',
    formWith('document', [
      { buffer: pdf, type: 'application/pdf', name: 'a.pdf' },
      { buffer: pdf, type: 'application/pdf', name: 'b.pdf' },
    ])
  );
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toHaveLength(2);
  expect(body.map(({ name }) => name)).toEqual(['a_pdf', 'b_pdf']);
});

test('GET /document/:file serves the stored document as an attachment', async () => {
  const response = await fetch(`${BASE_URL}/document/${uploadedDocumentName}`);
  expect(response.status).toBe(200);
  expect(response.headers.get('content-disposition')).toMatch(/^attachment/);
  expect(Buffer.from(await response.arrayBuffer())).toEqual(pdf);
});

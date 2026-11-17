import { readFileSync } from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { expect, test } from 'vitest';

import {
  HEIC_EXTENSIONS,
  HEIC_MAX_MEGAPIXELS,
  HEIC_MIME_TYPES,
  HEIC_TOO_MANY_PIXELS,
  HEIC_UNREADABLE,
  convertHeicToJpeg,
  getConvertibleMegapixels,
  looksLikeHeicUpload,
  maxPixelsFromIspeBoxes,
  replaceExtension,
} from './heic';

const ispeBox = (width, height) => {
  const box = Buffer.alloc(20);
  box.writeUInt32BE(20, 0);
  box.write('ispe', 4, 'ascii');
  box.writeUInt32BE(0, 8);
  box.writeUInt32BE(width, 12);
  box.writeUInt32BE(height, 16);
  return box;
};

const fileWith = (...boxes) =>
  Buffer.concat([Buffer.from('....ftypheic'), ...boxes]);

test('the heic extension and mime type lists cover both spellings', () => {
  expect(HEIC_EXTENSIONS).toEqual(expect.arrayContaining(['heic', 'heif']));
  expect(HEIC_MIME_TYPES).toEqual(
    expect.arrayContaining(['image/heic', 'image/heif'])
  );
});

test('looksLikeHeicUpload recognises the extension regardless of casing', () => {
  expect(looksLikeHeicUpload('IMG_1234.heic', 'image/heic')).toBe(true);
  expect(looksLikeHeicUpload('IMG_1234.HEIC', '')).toBe(true);
  expect(looksLikeHeicUpload('IMG_1234.heif', undefined)).toBe(true);
});

test('looksLikeHeicUpload recognises the mime type when the name has no extension', () => {
  expect(looksLikeHeicUpload('IMG_1234', 'image/heic')).toBe(true);
  expect(looksLikeHeicUpload('IMG_1234', 'image/heic-sequence')).toBe(true);
  expect(looksLikeHeicUpload('IMG_1234', 'IMAGE/HEIF')).toBe(true);
});

test('looksLikeHeicUpload leaves the supported formats alone', () => {
  expect(looksLikeHeicUpload('foto.jpg', 'image/jpeg')).toBe(false);
  expect(looksLikeHeicUpload('foto.png', 'image/png')).toBe(false);
  expect(looksLikeHeicUpload('foto.webp', 'image/webp')).toBe(false);
  expect(looksLikeHeicUpload('foto.avif', 'image/avif')).toBe(false);
});

test('looksLikeHeicUpload handles missing input', () => {
  expect(looksLikeHeicUpload(undefined, undefined)).toBe(false);
  expect(looksLikeHeicUpload('', '')).toBe(false);
});

test('replaceExtension swaps the extension for jpg', () => {
  expect(replaceExtension('IMG_1234.heic', 'jpg')).toBe('IMG_1234.jpg');
  expect(replaceExtension('foto.vakantie.HEIC', 'jpg')).toBe(
    'foto.vakantie.jpg'
  );
  expect(replaceExtension('zonder-extensie', 'jpg')).toBe(
    'zonder-extensie.jpg'
  );
  expect(replaceExtension('', 'jpg')).toBe('image.jpg');
});

test('maxPixelsFromIspeBoxes reads the declared dimensions', () => {
  expect(maxPixelsFromIspeBoxes(fileWith(ispeBox(4032, 3024)))).toBe(
    4032 * 3024
  );
});

test('maxPixelsFromIspeBoxes takes the largest of several boxes', () => {
  const buffer = fileWith(
    ispeBox(320, 240),
    ispeBox(8000, 6000),
    ispeBox(1, 1)
  );
  expect(maxPixelsFromIspeBoxes(buffer)).toBe(8000 * 6000);
});

test('maxPixelsFromIspeBoxes ignores marker bytes that are not a box', () => {
  const notABox = Buffer.concat([
    Buffer.from([0, 0, 0, 99]),
    Buffer.from('ispe'),
    Buffer.alloc(12, 0xff),
  ]);
  expect(maxPixelsFromIspeBoxes(fileWith(notABox))).toBe(0);
});

test('maxPixelsFromIspeBoxes returns zero without any dimensions', () => {
  expect(maxPixelsFromIspeBoxes(Buffer.from('geen heic bestand'))).toBe(0);
  expect(maxPixelsFromIspeBoxes(Buffer.alloc(0))).toBe(0);
});

test('convertHeicToJpeg refuses an image above the pixel cap before decoding', async () => {
  const tooBig = Math.ceil(Math.sqrt(HEIC_MAX_MEGAPIXELS * 1e6)) + 1000;
  await expect(
    convertHeicToJpeg(fileWith(ispeBox(tooBig, tooBig)))
  ).rejects.toMatchObject({ code: HEIC_TOO_MANY_PIXELS });
});

test('convertHeicToJpeg refuses input without heic dimensions', async () => {
  await expect(
    convertHeicToJpeg(Buffer.from('geen heic bestand'))
  ).rejects.toThrow();
});

const MB = 1024 * 1024;
const sampleHeic = () =>
  readFileSync(path.join(__dirname, 'test-fixtures', 'sample-64x48.heic'));

test('convertHeicToJpeg turns a real heic file into a jpeg of the same size', async () => {
  const jpeg = await convertHeicToJpeg(sampleHeic());
  const metadata = await sharp(jpeg).metadata();

  expect(metadata.format).toBe('jpeg');
  expect(metadata.width).toBe(64);
  expect(metadata.height).toBe(48);
});

test('convertHeicToJpeg handles conversions that arrive at the same time', async () => {
  const results = await Promise.all([
    convertHeicToJpeg(sampleHeic()),
    convertHeicToJpeg(sampleHeic()),
    convertHeicToJpeg(sampleHeic()),
  ]);

  for (const jpeg of results) {
    expect(jpeg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
  }
});

test('convertHeicToJpeg rejects a truncated heic file without crashing', async () => {
  const truncated = sampleHeic().subarray(0, 400);

  await expect(convertHeicToJpeg(truncated)).rejects.toMatchObject({
    code: HEIC_UNREADABLE,
  });
});

test('getConvertibleMegapixels is unlimited without a memory limit', () => {
  expect(getConvertibleMegapixels({ limitBytes: 0, usedBytes: 100 * MB })).toBe(
    Infinity
  );
});

test('getConvertibleMegapixels refuses a 24 megapixel photo in a 500 MB container', () => {
  const megapixels = getConvertibleMegapixels({
    limitBytes: 500 * MB,
    usedBytes: 150 * MB,
  });

  expect(megapixels).toBeGreaterThan(12.2);
  expect(megapixels).toBeLessThan(24.5);
});

test('getConvertibleMegapixels accepts the largest allowed photo in a 1 GiB container', () => {
  const megapixels = getConvertibleMegapixels({
    limitBytes: 1024 * MB,
    usedBytes: 150 * MB,
  });

  expect(megapixels).toBeGreaterThan(HEIC_MAX_MEGAPIXELS);
});

test('getConvertibleMegapixels never goes below zero', () => {
  expect(
    getConvertibleMegapixels({ limitBytes: 500 * MB, usedBytes: 490 * MB })
  ).toBe(0);
});

import { describe, expect, test } from 'vitest';

import {
  EDITOR_CREATE_FIELDS,
  filterResourceCreateBody,
} from './resource-create-body.js';

const user = (role) => ({ id: 1, role });

const submission = () => ({
  title: 'Een nieuw idee voor het park',
  summary: 'Samenvatting',
  description: 'Beschrijving',
  budget: 1000,
  images: [{ url: 'https://img.example/a.png' }],
  documents: [],
  location: { lat: 52, lng: 4 },
  extraData: { embeddedUrl: 'https://example.com' },
  timeline: null,
  publishDate: '2026-01-01T00:00:00.000Z',
  tags: [1],
  statuses: [2],
  links: '[]',
  confirmationUser: true,
  confirmationAdmin: false,
  widgetId: 7,
});

const privileged = () => ({
  sort: 9999,
  score: 1,
  viewableByRole: 'admin',
  startDate: '2000-01-01T00:00:00.000Z',
  createdAt: '2000-01-01T00:00:00.000Z',
  updatedAt: '2000-01-01T00:00:00.000Z',
  deletedAt: null,
  id: 123,
  isSpam: false,
  projectId: 99,
  userId: 42,
  someFutureColumn: 'x',
});

describe('filterResourceCreateBody', () => {
  test.each(['all', 'anonymous', 'member', 'moderator'])(
    '%s: keeps a normal submission, drops privileged fields',
    (role) => {
      const body = { ...submission(), ...privileged() };
      expect(filterResourceCreateBody(body, user(role))).toEqual(submission());
    }
  );

  test('no user: treated as public', () => {
    const body = { ...submission(), ...privileged() };
    expect(filterResourceCreateBody(body, undefined)).toEqual(submission());
  });

  test.each(['editor', 'admin', 'superuser'])(
    '%s: may also set editor fields, but never timestamps or system fields',
    (role) => {
      const body = { ...submission(), ...privileged() };
      const result = filterResourceCreateBody(body, user(role));

      const expected = { ...submission() };
      EDITOR_CREATE_FIELDS.forEach((key) => (expected[key] = body[key]));
      expect(result).toEqual(expected);

      [
        'createdAt',
        'updatedAt',
        'deletedAt',
        'id',
        'isSpam',
        'projectId',
        'userId',
        'someFutureColumn',
      ].forEach((key) => expect(result).not.toHaveProperty(key));
    }
  );

  test('does not add keys that were not sent', () => {
    expect(filterResourceCreateBody({ title: 'x' }, user('member'))).toEqual({
      title: 'x',
    });
  });

  test('ignores inherited properties', () => {
    const body = Object.create({ sort: 1 });
    body.title = 'x';
    expect(filterResourceCreateBody(body, user('editor'))).toEqual({
      title: 'x',
    });
  });

  test('handles empty bodies', () => {
    expect(filterResourceCreateBody(undefined, user('member'))).toEqual({});
    expect(filterResourceCreateBody(null, user('member'))).toEqual({});
  });
});

import { describe, expect, it } from 'vitest';

import {
  groupProjectsByFolder,
  parseFolderQuery,
  sidenavFolderItems,
  sortNewestFirst,
} from './project-folders';

const folders = [
  { id: 1, name: 'Templates' },
  { id: 2, name: 'Beheer' },
  { id: 3, name: 'Leeg' },
];

const projects = [
  { id: 10, createdAt: '2026-01-01T00:00:00Z', folderId: 1 },
  { id: 11, createdAt: '2026-03-01T00:00:00Z', folderId: null },
  { id: 12, createdAt: '2026-02-01T00:00:00Z', folderId: 2 },
  { id: 13, createdAt: '2026-04-01T00:00:00Z' },
  { id: 14, createdAt: '2026-05-01T00:00:00Z', folderId: 1 },
];

describe('sortNewestFirst', () => {
  it('puts the newest project first without changing the input', () => {
    const input = [...projects];
    expect(sortNewestFirst(input).map((p) => p.id)).toEqual([
      14, 13, 11, 12, 10,
    ]);
    expect(input).toEqual(projects);
  });

  it('puts projects without a date last', () => {
    expect(
      sortNewestFirst([{ id: 1 }, { id: 2, createdAt: '2026-01-01' }]).map(
        (p) => p.id
      )
    ).toEqual([2, 1]);
  });
});

describe('groupProjectsByFolder', () => {
  it('shows folder rows with counts and only loose projects, newest first', () => {
    const result = groupProjectsByFolder(projects, folders, { isAdmin: true });
    expect(result.folders.map((r) => [r.folder.name, r.count])).toEqual([
      ['Beheer', 1],
      ['Leeg', 0],
      ['Templates', 2],
    ]);
    expect(result.projects.map((p) => p.id)).toEqual([13, 11]);
  });

  it('hides empty folders for non-admins', () => {
    const result = groupProjectsByFolder(projects, folders, { isAdmin: false });
    expect(result.folders.map((r) => r.folder.name)).toEqual([
      'Beheer',
      'Templates',
    ]);
  });

  it('shows only the projects of the opened folder', () => {
    const result = groupProjectsByFolder(projects, folders, { folderId: 1 });
    expect(result.folders).toEqual([]);
    expect(result.projects.map((p) => p.id)).toEqual([14, 10]);
  });

  it('shows a flat list including folder projects while searching', () => {
    const result = groupProjectsByFolder(projects, folders, {
      hasSearch: true,
      isAdmin: true,
    });
    expect(result.folders).toEqual([]);
    expect(result.projects.map((p) => p.id)).toEqual([14, 13, 11, 12, 10]);
  });

  it('treats a project with an unknown folder as loose', () => {
    const result = groupProjectsByFolder(
      [{ id: 1, createdAt: '2026-01-01', folderId: 99 }],
      folders
    );
    expect(result.projects.map((p) => p.id)).toEqual([1]);
  });

  it('handles missing input', () => {
    const result = groupProjectsByFolder([], [], {});
    expect(result).toEqual({ folders: [], projects: [] });
  });
});

describe('parseFolderQuery', () => {
  it('parses a number string', () => {
    expect(parseFolderQuery('12')).toBe(12);
  });
  it('uses the first value of an array', () => {
    expect(parseFolderQuery(['7', '9'])).toBe(7);
  });
  it('rejects values that are not purely digits', () => {
    expect(parseFolderQuery('12abc')).toBeNull();
  });
  it('returns null when undefined', () => {
    expect(parseFolderQuery(undefined)).toBeNull();
  });
});

describe('sidenavFolderItems', () => {
  it('lists "Alle projecten" first, then folders by name with hrefs', () => {
    const items = sidenavFolderItems(folders, {
      pathname: '/projects',
      folderQuery: undefined,
    });
    expect(items.map((i) => i.label)).toEqual([
      'Alle projecten',
      'Beheer',
      'Leeg',
      'Templates',
    ]);
    expect(items.map((i) => i.href)).toEqual([
      '/projects',
      '/projects?folder=2',
      '/projects?folder=3',
      '/projects?folder=1',
    ]);
  });

  it('marks "Alle projecten" active without a folder query', () => {
    const items = sidenavFolderItems(folders, {
      pathname: '/projects',
      folderQuery: undefined,
    });
    expect(items.filter((i) => i.active).map((i) => i.key)).toEqual(['all']);
  });

  it('marks the folder active when the query matches', () => {
    const items = sidenavFolderItems(folders, {
      pathname: '/projects',
      folderQuery: '2',
    });
    expect(items.filter((i) => i.active).map((i) => i.key)).toEqual([
      'folder-2',
    ]);
  });

  it('marks nothing active on another pathname', () => {
    const items = sidenavFolderItems(folders, {
      pathname: '/projects/5/widgets',
      folderQuery: undefined,
    });
    expect(items.some((i) => i.active)).toBe(false);
  });
});

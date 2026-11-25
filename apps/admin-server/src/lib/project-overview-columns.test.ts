import { describe, expect, it } from 'vitest';

import {
  countIssuesByProject,
  formatIsoDate,
  participationLabels,
  withOverviewCounts,
} from './project-overview-columns';

describe('formatIsoDate', () => {
  it('formats an ISO string using local date parts', () => {
    const d = new Date(2026, 9, 31, 12, 0, 0);
    expect(formatIsoDate(d.toISOString())).toBe('2026-10-31');
  });

  it('formats a Date', () => {
    expect(formatIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('gives the local day for a late-evening UTC timestamp', () => {
    const local = new Date(2026, 9, 31, 0, 30, 0);
    expect(formatIsoDate(local.toISOString())).toBe('2026-10-31');
  });

  it.each([null, undefined, '', 'garbage'])('returns "" for %j', (v) => {
    expect(formatIsoDate(v as any)).toBe('');
  });
});

describe('countIssuesByProject', () => {
  it('counts two entries for the same project as 2', () => {
    expect(countIssuesByProject([{ id: 3 }, { id: 3 }, { id: 4 }])).toEqual({
      3: 2,
      4: 1,
    });
  });

  it('counts a blocked-domains entry as 1 (reflects only the last 24 hours)', () => {
    expect(
      countIssuesByProject([{ id: 7, blockedDomains: ['a.nl', 'b.nl'] }])
    ).toEqual({ 7: 1 });
  });

  it('ignores entries without a numeric id', () => {
    expect(
      countIssuesByProject([{}, { id: '5' }, null, { id: NaN }] as any)
    ).toEqual({});
  });

  it.each([undefined, null, {}, 'x'])('returns {} for %j', (v) => {
    expect(countIssuesByProject(v as any)).toEqual({});
  });
});

describe('withOverviewCounts', () => {
  it('gives 0 for projects without issues and does not mutate input', () => {
    const input = [{ id: 1 }, { id: 2 }];
    const out = withOverviewCounts(input, { 1: 3 });
    expect(out).toEqual([
      { id: 1, issueCount: 3 },
      { id: 2, issueCount: 0 },
    ]);
    expect(input).toEqual([{ id: 1 }, { id: 2 }]);
    expect(out![0]).not.toBe(input[0]);
  });

  it('passes undefined through', () => {
    expect(withOverviewCounts(undefined, {})).toBeUndefined();
  });
});

describe('participationLabels', () => {
  it('lists everything that is on, in order', () => {
    expect(
      participationLabels({
        config: {
          votes: { isActive: true },
          comments: { canComment: true },
          resources: { canAddNewResources: true },
        },
      })
    ).toEqual(['Stemmen', 'Reacties', 'Inzendingen']);
  });

  it('lists only votes', () => {
    expect(
      participationLabels({ config: { votes: { isActive: true } } })
    ).toEqual(['Stemmen']);
  });

  it('returns [] when nothing is on', () => {
    expect(
      participationLabels({
        config: { votes: { isActive: false }, comments: { canComment: false } },
      })
    ).toEqual([]);
  });

  it('returns [] without config', () => {
    expect(participationLabels({})).toEqual([]);
    expect(participationLabels(undefined)).toEqual([]);
  });

  it('does not count truthy non-booleans', () => {
    expect(
      participationLabels({ config: { votes: { isActive: 'true' } } })
    ).toEqual([]);
  });
});

// @vitest-environment jsdom
import toast from 'react-hot-toast';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  PDF_ERROR_MESSAGE,
  PDF_NOT_CONFIGURED_MESSAGE,
  PDF_SERVICE_FAILED_MESSAGE,
  downloadPdf,
} from './download-pdf';

vi.mock('react-hot-toast', () => ({ default: { error: vi.fn() } }));

const args = {
  project: '2',
  widgetId: '175',
  html: '<p>x</p>',
  filename: 'a.pdf',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(toast.error).mockClear();
});

describe('downloadPdf error messages', () => {
  it.each([
    [502, PDF_SERVICE_FAILED_MESSAGE],
    [504, PDF_SERVICE_FAILED_MESSAGE],
    [503, PDF_NOT_CONFIGURED_MESSAGE],
    [500, PDF_ERROR_MESSAGE],
  ])('status %i shows the right message', async (status, message) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status }));
    expect(await downloadPdf(args)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(message);
  });

  it('shows the default message on a network failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    expect(await downloadPdf(args)).toBe(false);
    expect(toast.error).toHaveBeenCalledWith(PDF_ERROR_MESSAGE);
  });
});

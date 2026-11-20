import toast from 'react-hot-toast';

export const PDF_ERROR_MESSAGE = 'PDF maken is mislukt. Probeer het opnieuw.';

export const PDF_SERVICE_FAILED_MESSAGE =
  'De PDF-dienst gaf geen antwoord of de PDF is te groot. Probeer het later opnieuw of download minder vragen.';
export const PDF_NOT_CONFIGURED_MESSAGE =
  'PDF maken is niet ingesteld op deze omgeving.';

class PdfRequestError extends Error {
  constructor(public status: number) {
    super(`PDF request failed: ${status}`);
  }
}

function messageFor(err: unknown): string {
  const status = err instanceof PdfRequestError ? err.status : null;
  if (status === 502 || status === 504) return PDF_SERVICE_FAILED_MESSAGE;
  if (status === 503) return PDF_NOT_CONFIGURED_MESSAGE;
  return PDF_ERROR_MESSAGE;
}

// Sends the block HTML to our api-server and saves the PDF that comes back.
export async function downloadPdf({
  project,
  widgetId,
  html,
  filename,
}: {
  project: string | string[] | undefined;
  widgetId: string;
  html: string;
  filename: string;
}): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/openstad/stats/project/${project}/enquete/${widgetId}/pdf`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html, filename }),
      }
    );
    if (!res.ok) throw new PdfRequestError(res.status);

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('PDF download failed');
    toast.error(messageFor(err));
    return false;
  }
}

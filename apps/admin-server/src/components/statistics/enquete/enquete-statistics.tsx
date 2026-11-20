import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PDF_ERROR_MESSAGE, downloadPdf } from '@/lib/statistics/download-pdf';
import {
  buildHeaderHtml,
  captureBlocksHtml,
} from '@/lib/statistics/pdf-capture';
import React, { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { EmptyState } from './empty-state';
import { QuestionCard } from './question-card';
import type { EnqueteSummary } from './types';

type WidgetOption = { id: number; description?: string };

function widgetLabel(widget: WidgetOption) {
  return `Widget ${widget.id}${widget.description ? ` - ${widget.description}` : ''}`;
}

export function EnqueteStatistics({
  project,
  from,
  to,
}: {
  project: string | string[] | undefined;
  from: string;
  to: string;
}) {
  const [widgets, setWidgets] = useState<WidgetOption[] | null>(null);
  const [widgetId, setWidgetId] = useState<string>('');
  const [summary, setSummary] = useState<EnqueteSummary | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'gone'>(
    'idle'
  );
  const [pdfBusy, setPdfBusy] = useState(false);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!project) return;
    const controller = new AbortController();
    fetch(`/api/openstad/api/project/${project}/submission/widgets`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch widgets');
        return res.json();
      })
      .then((data: WidgetOption[]) => {
        setWidgets(data);
        setWidgetId((current) =>
          current && data.some((w) => String(w.id) === current)
            ? current
            : data[0]
              ? String(data[0].id)
              : ''
        );
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching widgets:', err);
          setWidgets([]);
        }
      });
    return () => controller.abort();
  }, [project]);

  useEffect(() => {
    if (!project || !widgetId) return;
    const controller = new AbortController();
    setState('loading');
    const params = new URLSearchParams({ from, to });
    fetch(
      `/api/openstad/stats/project/${project}/enquete/${widgetId}?${params}`,
      { signal: controller.signal }
    )
      .then((res) => {
        if (res.status === 404) {
          setState('gone');
          setSummary(null);
          return null;
        }
        if (!res.ok) throw new Error('Failed to fetch enquete stats');
        return res.json();
      })
      .then((data) => {
        if (!data) return;
        setSummary(data);
        setState('idle');
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          console.error('Error fetching enquete stats:', err);
          setState('error');
        }
      });
    return () => controller.abort();
  }, [project, widgetId, from, to]);

  const selectedWidget = widgets?.find((w) => String(w.id) === widgetId);

  // One PDF with the title block and every question card, in screen order.
  const downloadAll = async () => {
    if (!cardsRef.current || !summary || pdfBusy) return;
    setPdfBusy(true);
    // try/finally so the button never stays disabled when the capture throws
    try {
      const cards = Array.from(cardsRef.current.children) as HTMLElement[];
      await downloadPdf({
        project,
        widgetId,
        html: await captureBlocksHtml(
          cards,
          buildHeaderHtml({
            widgetLabel: selectedWidget
              ? widgetLabel(selectedWidget)
              : `Widget ${widgetId}`,
            from,
            to,
            total: summary.total,
          })
        ),
        filename: `enquete-${widgetId}-statistieken.pdf`,
      });
    } catch (err) {
      console.error('PDF capture failed');
      toast.error(PDF_ERROR_MESSAGE);
    } finally {
      setPdfBusy(false);
    }
  };

  if (widgets === null) {
    return <p className="text-muted-foreground">Laden...</p>;
  }

  if (widgets.length === 0) {
    return <EmptyState message="Er zijn nog geen enquêtes in dit project" />;
  }

  return (
    <div className="p-4 sm:p-8">
      <h2 className="m-0 text-lg font-semibold">Enquêtes</h2>

      <div className="mt-5 flex max-w-[720px] flex-wrap items-center gap-3 lg:flex-nowrap">
        <label
          htmlFor="enquete-widget-select"
          className="text-sm font-medium text-[#1e1e2e]">
          Bekijk gegevens van:
        </label>
        <Select value={widgetId} onValueChange={setWidgetId}>
          <SelectTrigger
            id="enquete-widget-select"
            title={selectedWidget ? widgetLabel(selectedWidget) : ''}
            className="h-9 w-full min-w-0 max-w-full rounded-md lg:max-w-[460px] lg:flex-1 bg-white text-left text-sm">
            <span className="block min-w-0 flex-1 truncate text-left">
              <SelectValue placeholder="Kies een enquête" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {widgets.map((widget) => (
              <SelectItem key={widget.id} value={String(widget.id)}>
                {widgetLabel(widget)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {summary?.pdfEnabled && summary.questions.length > 0 ? (
          <button
            type="button"
            className="shrink-0 cursor-pointer py-2 text-sm sm:ml-auto disabled:cursor-not-allowed text-[#5b5fc7] underline underline-offset-2 hover:text-[#4347a8]"
            onClick={downloadAll}
            disabled={pdfBusy}
            aria-busy={pdfBusy}
            aria-label="Alle vragen downloaden als PDF">
            {pdfBusy ? 'Bezig…' : 'Alles downloaden'}
          </button>
        ) : null}
      </div>

      {state === 'gone' ? (
        <EmptyState message="Deze enquête bestaat niet meer" />
      ) : state === 'error' ? (
        <EmptyState message="De gegevens konden niet worden geladen" />
      ) : summary ? (
        <>
          <p className="mb-6 mt-6 text-base text-[#1e1e2e]">
            {summary.total} reacties
          </p>
          {summary.total === 0 ? (
            <EmptyState message="Geen reacties in deze periode" />
          ) : (
            <div ref={cardsRef} className="flex flex-col gap-6">
              {summary.questions.map((question, index) => (
                <QuestionCard
                  key={question.fieldKey}
                  question={question}
                  number={index + 1}
                  project={project}
                  widgetId={widgetId}
                  from={from}
                  to={to}
                  pdfEnabled={!!summary.pdfEnabled}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}

import { Card } from '@/components/ui/card';
import {
  CHART_MOTION_CSS,
  useInViewOnce,
  useReducedMotion,
} from '@/lib/statistics/chart-motion';
import { PDF_ERROR_MESSAGE, downloadPdf } from '@/lib/statistics/download-pdf';
import { FOCUS_RING } from '@/lib/statistics/enquete-chart-helpers';
import { fetchAllEnqueteImages } from '@/lib/statistics/fetch-enquete-images';
import { captureBlockHtml } from '@/lib/statistics/pdf-capture';
import { useRef, useState } from 'react';
import toast from 'react-hot-toast';

import { AnswersDialog } from './answers-dialog';
import { AnswersMap } from './answers-map';
import { BarRows } from './bar-rows';
import { CHART_HOVER_CSS } from './chart-hover';
import { DonutRow } from './donut-row';
import { FileList } from './file-list';
import { OpenAnswers } from './open-answers';
import { RankingRows } from './ranking-rows';
import { StackedRows } from './stacked-rows';
import type { EnqueteFile, EnqueteQuestion } from './types';

const noAnswers = (
  <p className="pdf-none mt-4 text-sm text-muted-foreground">
    Nog geen antwoorden op deze vraag.
  </p>
);

const summaryLabel = (question: EnqueteQuestion, number: number) =>
  `Antwoorden op vraag ${number}: ${(question.options ?? [])
    .map((o) => `${o.label} ${o.count}`)
    .join(', ')}`;

function renderBody(
  question: EnqueteQuestion,
  number: number,
  onOpenDetails?: () => void,
  play = true,
  fetchAllImages?: (signal?: AbortSignal) => Promise<EnqueteFile[]>
) {
  const options = question.options ?? [];

  switch (question.chart) {
    case 'donut':
      if (question.answeredCount === 0) return noAnswers;
      return (
        <DonutRow
          play={play}
          options={options}
          ariaLabel={`Antwoorden op vraag ${number}: ${options
            .map((o) => `${o.label} ${o.percentage}%`)
            .join(', ')}`}
        />
      );
    case 'bar':
      if (question.answeredCount === 0) return noAnswers;
      return (
        <div className="pdf-bars-wrap mt-4">
          <BarRows
            options={options}
            ariaLabel={summaryLabel(question, number)}
          />
        </div>
      );
    case 'open':
      return (
        <OpenAnswers
          answeredCount={question.answeredCount}
          latest={question.latest}
        />
      );
    case 'map':
      return (
        <>
          <AnswersMap
            points={question.points ?? []}
            areaIds={question.areaIds ?? []}
            pointsTruncated={!!question.pointsTruncated}
            number={number}
          />
          {question.answeredCount === 0 ? noAnswers : null}
        </>
      );
    case 'files':
      if (question.answeredCount === 0) return noAnswers;
      return (
        <FileList
          answeredCount={question.answeredCount}
          fileCount={question.fileCount ?? 0}
          files={question.preview ?? []}
          onOpenDetails={onOpenDetails}
          fetchAllImages={fetchAllImages}
        />
      );
    case 'ranking':
      if (question.answeredCount === 0) return noAnswers;
      return (
        <div className="pdf-bars-wrap mt-4">
          <RankingRows options={options} number={number} />
        </div>
      );
    case 'stacked':
      if (question.answeredCount === 0) return noAnswers;
      return (
        <div className="pdf-bars-wrap mt-4">
          <StackedRows
            legend={question.legend ?? []}
            rows={question.rows ?? []}
            number={number}
          />
        </div>
      );
    default:
      return null;
  }
}

export function QuestionCard({
  question,
  number,
  project,
  widgetId,
  from,
  to,
  pdfEnabled = false,
}: {
  question: EnqueteQuestion;
  number: number;
  project: string | string[] | undefined;
  widgetId: string;
  from: string;
  to: string;
  pdfEnabled?: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const visible = useInViewOnce(cardRef);
  const reduced = useReducedMotion();
  const motionClass = reduced
    ? ''
    : visible
      ? 'enq-motion'
      : 'enq-motion-pending';

  const download = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    // try/finally so the button never stays disabled when the capture throws
    try {
      await downloadPdf({
        project,
        widgetId,
        html: await captureBlockHtml(cardRef.current),
        filename: `enquete-${widgetId}-vraag-${number}.pdf`,
      });
    } catch (err) {
      console.error('PDF capture failed');
      toast.error(PDF_ERROR_MESSAGE);
    } finally {
      setBusy(false);
    }
  };
  const linkClass = `text-sm text-[#5b5fc7] underline underline-offset-2 hover:text-[#4347a8] ${FOCUS_RING}`;

  return (
    <Card
      ref={cardRef}
      className={`pdf-card ${motionClass} w-full min-w-0 max-w-[720px] rounded-xl border border-[#e4e4e9] bg-white p-4 sm:p-5 shadow-none`}>
      <style>{CHART_MOTION_CSS + CHART_HOVER_CSS}</style>
      <div className="pdf-card-head flex flex-col gap-2 sm:flex-row sm:flex-nowrap sm:items-start sm:justify-between sm:gap-x-6">
        <h3 className="pdf-card-title m-0 min-w-0 break-words sm:flex-1 text-lg font-semibold text-[#1e1e2e]">
          {number}. {question.title}
        </h3>
        <div data-pdf-exclude className="flex shrink-0 gap-4 whitespace-nowrap">
          {pdfEnabled ? (
            <button
              type="button"
              className={linkClass}
              onClick={download}
              disabled={busy}
              aria-busy={busy}
              aria-label={`Vraag ${number} downloaden als PDF`}>
              {busy ? 'Bezig…' : 'Downloaden'}
            </button>
          ) : null}
          {question.personalData ? null : (
            <button
              type="button"
              className={linkClass}
              onClick={() => setDetailsOpen(true)}
              aria-label={`Meer details over vraag ${number}`}>
              Meer details
            </button>
          )}
        </div>
      </div>

      {renderBody(
        question,
        number,
        question.personalData ? undefined : () => setDetailsOpen(true),
        visible && !reduced,
        question.personalData
          ? undefined
          : (signal) =>
              fetchAllEnqueteImages({
                project,
                widgetId,
                fieldKey: question.fieldKey,
                from,
                to,
                signal,
              })
      )}

      {question.personalData ? null : (
        <AnswersDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          project={project}
          widgetId={widgetId}
          from={from}
          to={to}
          fieldKey={question.fieldKey}
          title={question.title}
          number={number}
          options={question.options ?? []}
        />
      )}
    </Card>
  );
}

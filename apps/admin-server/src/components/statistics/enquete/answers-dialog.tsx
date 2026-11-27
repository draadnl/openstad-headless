import { useChartColors } from '@/lib/statistics/chart-palette';
import {
  FOCUS_RING,
  colorForIndex,
} from '@/lib/statistics/enquete-chart-helpers';
import { fetchAllEnqueteImages } from '@/lib/statistics/fetch-enquete-images';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { format } from 'date-fns';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';

import { FileLinks } from './file-list';
import type { EnqueteFile, EnqueteOption } from './types';

type Row = { createdAt: string; answer: string; files?: EnqueteFile[] };
type Order = 'asc' | 'desc';

const PAGE_SIZE = 25;
const thClass =
  'sticky top-0 z-10 h-[33px] border-b border-[#e5e7eb] bg-[#fafafa] px-4 text-[13px] font-normal text-[#6b6b7b]';

// Radix parts are used directly: the shared Dialog adds a white blur and its own X.
export function AnswersDialog({
  open,
  onOpenChange,
  project,
  widgetId,
  from,
  to,
  fieldKey,
  title,
  number,
  options,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: string | string[] | undefined;
  widgetId: string;
  from: string;
  to: string;
  fieldKey: string;
  title: string;
  number: number;
  options: EnqueteOption[];
}) {
  const palette = useChartColors();
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState<Order>('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (pageToLoad: number, signal?: AbortSignal) => {
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({
          fieldKey,
          page: String(pageToLoad),
          pageSize: String(PAGE_SIZE),
          from,
          to,
          order,
        });
        const res = await fetch(
          `/api/openstad/stats/project/${project}/enquete/${widgetId}/details?${params}`,
          { signal }
        );
        if (!res.ok) throw new Error('Failed to fetch details');
        const data = await res.json();
        setTotal(data.total);
        setPage(pageToLoad);
        setRows((current) =>
          pageToLoad === 1 ? data.rows : [...current, ...data.rows]
        );
      } catch (err: any) {
        if (err?.name !== 'AbortError') setError(true);
      } finally {
        setLoading(false);
      }
    },
    [project, widgetId, fieldKey, from, to, order]
  );

  // (Re)start from page 1 when the window opens or the sort order changes.
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setRows([]);
    load(1, controller.signal);
    return () => controller.abort();
  }, [open, load]);

  const colorFor = (answer: string) => {
    const index = options.findIndex((option) => option.label === answer);
    return index === -1 ? null : colorForIndex(index, palette);
  };

  const fetchAllImages = (signal?: AbortSignal) =>
    fetchAllEnqueteImages({ project, widgetId, fieldKey, from, to, signal });

  const numberFor = (index: number) =>
    order === 'desc' ? total - index : index + 1;

  const onScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const el = event.currentTarget;
    const nearEnd = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearEnd && !loading && rows.length < total) load(page + 1);
  };

  const formatDate = (value: string, pattern: string) => {
    try {
      return format(new Date(value), pattern);
    } catch {
      return value;
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:!animate-none" />
        {/* The animate keyframes set `transform` themselves, so the dialog is
            centred with grid here and not with translate. The wrapper also plays
            an invisible exit, so Radix keeps the subtree mounted until Overlay
            and Content have finished their own exit. */}
        <div
          data-testid="answers-dialog-centre"
          data-state={open ? 'open' : 'closed'}
          className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4 duration-200 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:!animate-none">
          <DialogPrimitive.Content
            aria-describedby="enquete-answers-intro"
            className="pointer-events-auto relative flex max-h-[85vh] w-[960px] max-w-[calc(100vw-2rem)] flex-col gap-6 rounded-xl bg-white p-4 sm:p-8 shadow-xl duration-200 ease-out focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:!animate-none">
            <div className="border-b border-[#e4e4e9] pb-4 pr-12">
              <DialogPrimitive.Title className="m-0 text-base font-bold leading-[23px] text-[#1e1e2e]">
                {number}. {title}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="enquete-answers-intro"
                className="mt-[5px] text-[13px] text-[#64748b]">
                Hieronder zie je alle gegeven antwoorden op deze vraag.
              </DialogPrimitive.Description>
            </div>

            <div
              className="min-h-0 flex-1 overflow-x-auto overflow-y-auto [scrollbar-color:#dbe3ee_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[#dbe3ee] [&::-webkit-scrollbar]:w-1"
              onScroll={onScroll}
              data-testid="answers-scroll">
              <table className="w-full border-collapse text-[13px] text-[#1e1e2e]">
                <thead>
                  <tr className="text-left">
                    <th className={`${thClass} w-16`}>#</th>
                    <th
                      className={thClass}
                      aria-sort={order === 'desc' ? 'descending' : 'ascending'}>
                      <button
                        type="button"
                        className={`inline-flex min-h-[44px] min-w-[44px] items-center gap-1 font-normal ${FOCUS_RING}`}
                        onClick={() =>
                          setOrder((current) =>
                            current === 'desc' ? 'asc' : 'desc'
                          )
                        }>
                        Datum
                        {order === 'desc' ? (
                          <ArrowDown
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th className={thClass}>Tijd</th>
                    <th className={thClass}>Antwoord</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const color = colorFor(row.answer);
                    return (
                      <tr key={index} className="h-9 border-b border-[#f1f1f4]">
                        <td className="px-4 text-[#9a9aa8]">
                          {numberFor(index)}
                        </td>
                        <td className="whitespace-nowrap px-4">
                          {formatDate(row.createdAt, 'dd-MM-yyyy')}
                        </td>
                        <td className="whitespace-nowrap px-4">
                          {formatDate(row.createdAt, 'HH:mm')}
                        </td>
                        <td className="px-4">
                          <span className="inline-flex items-center gap-2">
                            {color ? (
                              <span
                                aria-hidden="true"
                                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                            ) : null}
                            {row.files ? (
                              <FileLinks
                                files={row.files}
                                fetchAllImages={fetchAllImages}
                              />
                            ) : (
                              row.answer
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {error ? (
                <p className="py-4 text-center text-sm text-[#c2521f]">
                  De antwoorden konden niet worden geladen
                </p>
              ) : null}
              {!loading && !error && rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-[#6b6b7b]">
                  Geen antwoorden gevonden
                </p>
              ) : null}
              {rows.length < total ? (
                <div className="py-4 text-center">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => load(page + 1)}
                    className={`min-h-[44px] min-w-[44px] text-sm text-[#5b5fc7] underline underline-offset-2 disabled:opacity-50 ${FOCUS_RING}`}>
                    {loading ? 'Laden...' : 'Meer laden'}
                  </button>
                </div>
              ) : null}
            </div>

            <DialogPrimitive.Close
              aria-label="Sluiten"
              className={`absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-sm text-[#6b6b7b] transition-colors hover:bg-[#f1f1f4] hover:text-[#1e1e2e] ${FOCUS_RING}`}>
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

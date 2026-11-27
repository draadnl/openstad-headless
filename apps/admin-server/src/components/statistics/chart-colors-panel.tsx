import ColorPicker from '@/components/colorpicker';
import { useProject } from '@/hooks/use-project';
import { contrastRatio, formatContrast } from '@/lib/statistics/contrast';
import { CHART_COLORS } from '@/lib/statistics/enquete-chart-helpers';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export const MIN_CONTRAST = 3;
const WHITE = '#ffffff';
const SLOTS = 8;

const HEX = /^#[0-9a-fA-F]{6}$/;

function toSlots(colors?: unknown): string[] {
  const valid = Array.isArray(colors)
    ? colors.filter((c): c is string => typeof c === 'string' && HEX.test(c))
    : [];
  return Array.from(
    { length: SLOTS },
    (_, i) => valid[i] ?? CHART_COLORS[i % CHART_COLORS.length]
  );
}

export function ChartColorsPanel() {
  const { data: projectData, updateProject } = useProject();
  const saved = projectData?.config?.statistics?.chartColors;
  const [open, setOpen] = useState(false);
  const [slots, setSlots] = useState<string[]>(() => toSlots(saved));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setSlots(toSlots(saved));
  }, [open, saved]);

  const ratios = slots.map((c) => contrastRatio(c, WHITE));
  const allPass = ratios.every((r) => r >= MIN_CONTRAST);

  async function save(chartColors: string[]) {
    setBusy(true);
    try {
      await updateProject({ statistics: { chartColors } });
      setOpen(false);
    } catch (error) {
      console.error('Saving chart colours failed:', error);
      toast.error('Opslaan van de kleuren is niet gelukt');
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Trigger asChild>
        <button
          type="button"
          className="shrink-0 cursor-pointer py-2 text-sm text-[#5b5fc7] underline underline-offset-2 hover:text-[#4347a8]">
          Kleuren
        </button>
      </DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 motion-reduce:!animate-none" />
        <div className="pointer-events-none fixed inset-0 z-50 grid place-items-center p-4">
          <DialogPrimitive.Content
            aria-describedby="chart-colors-intro"
            className="pointer-events-auto relative flex max-h-[85vh] w-[560px] max-w-[calc(100vw-2rem)] flex-col gap-4 overflow-y-auto rounded-xl bg-white p-4 shadow-xl focus:outline-none sm:p-8">
            <div className="border-b border-[#e4e4e9] pb-4 pr-12">
              <DialogPrimitive.Title className="m-0 text-base font-bold text-[#1e1e2e]">
                Kleuren van de grafieken
              </DialogPrimitive.Title>
              <DialogPrimitive.Description
                id="chart-colors-intro"
                className="mt-[5px] text-[13px] text-[#64748b]">
                Kies 8 kleuren. Elke kleur moet minimaal {MIN_CONTRAST}:1
                contrast hebben met wit.
              </DialogPrimitive.Description>
            </div>

            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {slots.map((color, index) => {
                const ratio = ratios[index];
                const passes = ratio >= MIN_CONTRAST;
                return (
                  <li
                    key={index}
                    className="flex flex-wrap items-center gap-3 text-sm text-[#1e1e2e]">
                    <span className="w-20">Kleur {index + 1}</span>
                    <ColorPicker
                      label={`Kleur ${index + 1}`}
                      value={color}
                      onChange={(e) => {
                        const next = e.target.value;
                        setSlots((current) =>
                          current.map((c, i) => (i === index ? next : c))
                        );
                      }}
                    />
                    <span>Contrast met wit: {formatContrast(ratio)}:1</span>
                    <span
                      className={
                        passes
                          ? 'font-medium text-[#166534]'
                          : 'font-medium text-[#b91c1c]'
                      }>
                      {passes ? 'Voldoet' : 'Te licht'}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e4e4e9] pt-4">
              <button
                type="button"
                className="cursor-pointer text-sm text-[#5b5fc7] underline underline-offset-2 hover:text-[#4347a8] disabled:cursor-not-allowed"
                disabled={busy}
                onClick={() => save([])}>
                Standaardkleuren herstellen
              </button>
              <p
                id="chart-colors-save-hint"
                role="status"
                className="text-sm text-[#b42318]">
                {allPass ? '' : 'Opslaan kan pas als elke kleur voldoet.'}
              </p>
              <button
                type="button"
                className="rounded-md bg-[#5b5fc7] px-4 py-2 text-sm font-medium text-white hover:bg-[#4347a8] disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!allPass || busy}
                aria-describedby="chart-colors-save-hint"
                onClick={() => save(slots)}>
                Opslaan
              </button>
            </div>

            <DialogPrimitive.Close
              aria-label="Sluiten"
              className="absolute right-4 top-4 rounded-sm p-1 text-[#1e1e2e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#5b5fc7]">
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

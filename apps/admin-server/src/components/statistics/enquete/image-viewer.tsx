import { FOCUS_RING } from '@/lib/statistics/enquete-chart-helpers';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import React from 'react';

import type { EnqueteFile } from './types';

// 44x44 tap target; arrows sit beside the image from `sm` up.
const navButton = `flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-full bg-white/90 text-[#1e1e2e] shadow hover:bg-white disabled:opacity-40 ${FOCUS_RING}`;

// Lightbox for upload images (Radix Dialog: focus trap, Escape, focus return).
export function ImageViewer({
  images,
  index,
  onIndexChange,
  onClose,
}: {
  images: EnqueteFile[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  // The element that opened the viewer, so focus can go back to it on close.
  const opener = React.useRef<HTMLElement | null>(
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
  );
  const image = images[index];
  const last = images.length - 1;
  const go = (next: number) => {
    if (next >= 0 && next <= last) onIndexChange(next);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      go(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      go(index + 1);
    }
  };

  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/80 duration-200 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 motion-reduce:!animate-none" />
        {/* Centred with grid: the animate keyframes set `transform` themselves. */}
        <div
          data-testid="image-viewer-centre"
          className="pointer-events-none fixed inset-0 z-[60] grid place-items-center p-4">
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onKeyDown={onKeyDown}
            onCloseAutoFocus={(event) => {
              const el = opener.current;
              if (el && el.isConnected && el !== document.body) {
                event.preventDefault();
                el.focus();
              }
            }}
            className="pointer-events-auto relative flex w-[960px] max-w-[calc(100vw-2rem)] flex-col items-center gap-3 duration-200 ease-out focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 motion-reduce:!animate-none">
            <DialogPrimitive.Title className="m-0 h-5 max-w-full truncate px-8 text-sm font-bold leading-5 text-white">
              {image?.name}
            </DialogPrimitive.Title>
            {/* Fixed stage: the height never follows the image, so the controls stay put. */}
            <div
              data-testid="image-viewer-stage"
              className="grid h-[75vh] w-full grid-cols-2 grid-rows-[minmax(0,1fr)_auto] gap-3 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:grid-rows-1">
              <div
                data-testid="image-viewer-image-box"
                className="relative col-span-2 row-start-1 h-full min-h-0 min-w-0 sm:col-span-1 sm:col-start-2">
                {image?.url ? (
                  <img
                    src={image.url}
                    alt={image.name}
                    className="h-full w-full rounded-md object-contain"
                  />
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Vorige afbeelding"
                disabled={index <= 0}
                onClick={() => go(index - 1)}
                className={`${navButton} row-start-2 justify-self-start sm:col-start-1 sm:row-start-1 sm:justify-self-center`}>
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Volgende afbeelding"
                disabled={index >= last}
                onClick={() => go(index + 1)}
                className={`${navButton} row-start-2 justify-self-end sm:col-start-3 sm:row-start-1 sm:justify-self-center`}>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <p
              className="m-0 h-5 text-sm leading-5 text-white"
              aria-live="polite"
              data-testid="image-viewer-counter">
              {index + 1} / {images.length}
            </p>
            <DialogPrimitive.Close
              aria-label="Sluiten"
              className={`absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#1e1e2e] hover:bg-white ${FOCUS_RING}`}>
              <X className="h-5 w-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

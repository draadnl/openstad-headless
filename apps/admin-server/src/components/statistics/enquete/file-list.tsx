import {
  FOCUS_RING,
  isImageFile,
} from '@/lib/statistics/enquete-chart-helpers';
import { FileText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { ImageViewer } from './image-viewer';
import type { EnqueteFile } from './types';

export function FileLinks({
  files,
  fetchAllImages,
}: {
  files: EnqueteFile[];
  fetchAllImages?: (signal?: AbortSignal) => Promise<EnqueteFile[]>;
}) {
  const images = files.filter(isImageFile);
  const others = files.filter((file) => !isImageFile(file));
  const [viewer, setViewer] = useState<{
    list: EnqueteFile[];
    index: number;
  } | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  const openViewer = (index: number) => {
    const clicked = images[index];
    setViewer({ list: images, index });
    if (!fetchAllImages) return;
    controller.current?.abort();
    controller.current = new AbortController();
    fetchAllImages(controller.current.signal)
      .then((all) => {
        const at = all.findIndex(
          (file) => file.url === clicked.url && file.name === clicked.name
        );
        if (at === -1) return;
        setViewer((current) => {
          if (!current) return current;
          const shown = current.list[current.index];
          const keep = all.findIndex(
            (file) => file.url === shown.url && file.name === shown.name
          );
          return { list: all, index: keep === -1 ? at : keep };
        });
      })
      .catch(() => {});
  };

  return (
    <div>
      {images.length > 0 ? (
        <ul className="pdf-files-list m-0 mb-2 flex list-none flex-wrap gap-3 p-0">
          {images.map((file, index) => (
            <li
              key={`${file.name}-${index}`}
              className="pdf-files-item flex w-16 flex-col gap-1">
              <button
                type="button"
                aria-label={`Bekijk ${file.name}`}
                onClick={() => openViewer(index)}
                className={`block rounded-md ${FOCUS_RING}`}>
                <img
                  src={file.url as string}
                  alt={file.name}
                  loading="lazy"
                  width={64}
                  height={64}
                  className="h-16 w-16 rounded-md object-cover"
                  data-pdf-exclude
                />
              </button>
              <span className="pdf-file-name block truncate text-xs">
                {file.name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {others.length > 0 ? (
        <ul className="pdf-files-list m-0 list-none p-0">
          {others.map((file, index) => (
            <li key={`${file.name}-${index}`} className="pdf-files-item">
              {file.url ? (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex max-w-full items-center gap-1 align-bottom text-[#5b5fc7] underline underline-offset-2 hover:text-[#4347a8] ${FOCUS_RING}`}>
                  <FileText aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span className="pdf-file-name truncate">{file.name}</span>
                </a>
              ) : (
                <span className="inline-block max-w-full truncate align-bottom">
                  {file.name}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {viewer ? (
        <ImageViewer
          images={viewer.list}
          index={viewer.index}
          onIndexChange={(index) =>
            setViewer((current) => (current ? { ...current, index } : current))
          }
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}

export function FileList({
  answeredCount,
  fileCount,
  files,
  onOpenDetails,
  fetchAllImages,
}: {
  answeredCount: number;
  fileCount: number;
  files: EnqueteFile[];
  onOpenDetails?: () => void;
  fetchAllImages?: (signal?: AbortSignal) => Promise<EnqueteFile[]>;
}) {
  const hidden = fileCount - files.length;
  return (
    <div className="pdf-files mt-4 text-sm text-[#1e1e2e]">
      <p className="pdf-files-count m-0 mb-2 text-[#6b6b7b]">
        {answeredCount} antwoorden · {fileCount} bestanden
      </p>
      <FileLinks files={files} fetchAllImages={fetchAllImages} />
      {hidden > 0 ? (
        <p className="pdf-files-more m-0 mt-2 text-[#6b6b7b]">
          en {hidden} meer
          {onOpenDetails ? (
            <span data-pdf-exclude>
              {' – '}
              <button
                type="button"
                onClick={onOpenDetails}
                className={`text-[#5b5fc7] underline underline-offset-2 hover:text-[#4347a8] ${FOCUS_RING}`}>
                bekijk Meer details
              </button>
            </span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

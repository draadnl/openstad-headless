export type EnqueteOption = {
  label: string;
  count: number;
  percentage: number;
  average?: number | null;
};

export type EnqueteSegment = {
  label: string;
  count: number;
  percentage: number;
  skipped?: boolean;
};

export type EnqueteStackedRow = {
  label: string;
  total: number;
  segments: EnqueteSegment[];
  sideLabels?: string[];
};

export type EnqueteFile = { name: string; url: string | null };

export type EnqueteQuestion = {
  fieldKey: string;
  type: string;
  title: string;
  chart: 'donut' | 'bar' | 'open' | 'map' | 'stacked' | 'ranking' | 'files';
  answeredCount: number;
  options?: EnqueteOption[];
  legend?: string[];
  fileCount?: number;
  preview?: EnqueteFile[];
  rows?: EnqueteStackedRow[];
  latest?: string[];
  personalData?: boolean;
  points?: { lat: number; lng: number }[];
  pointsTruncated?: boolean;
  areaIds?: number[];
};

export type EnqueteSummary = {
  total: number;
  pdfEnabled?: boolean;
  questions: EnqueteQuestion[];
};

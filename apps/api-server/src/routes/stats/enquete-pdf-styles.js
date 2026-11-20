// Fixed stylesheet of the statistics PDF; the browser sends no CSS.
const fs = require('fs');
const path = require('path');

// Fonts are read once from disk (never client input) and inlined.
function fontFace(weight) {
  const file = path.join(
    __dirname,
    'fonts',
    `inter-latin-${weight}-normal.woff2`
  );
  const base64 = fs.readFileSync(file).toString('base64');
  return `@font-face {
  font-family: 'Inter';
  font-weight: ${weight};
  font-style: normal;
  src: url(data:font/woff2;base64,${base64}) format('woff2');
}`;
}

const PDF_CSS = `
${fontFace(400)}
${fontFace(600)}
@page {
  size: A4;
  margin: 8mm;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  font-family: 'Inter', Arial, Helvetica, sans-serif;
  font-size: 14px;
  color: #1e1e2e;
}
svg {
  overflow: visible;
}

.pdf-header {
  margin-bottom: 24px;
}
.pdf-header-title {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 600;
}
.pdf-header-widget,
.pdf-header-period,
.pdf-header-count {
  margin: 0 0 4px;
  font-size: 14px;
}

.pdf-card {
  width: 720px;
  margin: 0 0 24px;
  padding: 20px;
  border: 1px solid #e4e4e9;
  border-radius: 12px;
  background: #fff;
  page-break-inside: avoid;
}
.pdf-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.pdf-card-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #1e1e2e;
}
.pdf-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: #6b6b7b;
}
.pdf-none {
  margin: 16px 0 0;
  font-size: 14px;
  color: #6b6b7b;
}

.pdf-donut-row {
  display: flex;
  align-items: center;
  margin-top: 8px;
}
.pdf-donut-legend {
  width: 45%;
  flex-shrink: 0;
}
.pdf-donut-chart {
  display: flex;
  flex: 1;
  justify-content: center;
}
.pdf-legend {
  display: table;
  margin: 0;
  padding: 0;
  list-style: none;
}
.pdf-legend-item {
  display: table-row;
  height: 24px;
  font-size: 14px;
}
.pdf-legend-dot-cell,
.pdf-legend-label,
.pdf-legend-count {
  display: table-cell;
  vertical-align: middle;
}
.pdf-legend-dot-cell {
  padding-right: 12px;
}
.pdf-legend-dot-cell .pdf-dot {
  margin-right: 0;
}
.pdf-dot {
  display: inline-block;
  width: 10px;
  height: 10px;
  margin-right: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.pdf-legend-count {
  padding-left: 24px;
  font-variant-numeric: tabular-nums;
}

.pdf-bars-wrap {
  margin-top: 16px;
}
.pdf-bar-row {
  display: flex;
  align-items: center;
  font-size: 14px;
}
.pdf-bar-label {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  padding-right: 16px;
}
.pdf-bar-count {
  flex-shrink: 0;
}
.pdf-bar-track {
  position: relative;
  height: 100%;
  min-width: 0;
  flex: 1;
}
.pdf-bar-grid {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
}
.pdf-bar-gridline {
  position: absolute;
  top: 0;
  height: 100%;
  width: 1px;
  background: #eeeef2;
}
.pdf-bar-fill {
  position: absolute;
  left: 0;
  top: 50%;
  height: 14px;
  margin-top: -7px;
}
.pdf-bar-axis {
  display: flex;
  font-size: 14px;
}
.pdf-bar-ticks {
  position: relative;
  height: 24px;
  min-width: 0;
  margin-top: 8px;
  flex: 1;
}
.pdf-bar-tick {
  position: absolute;
  transform: translateX(-50%);
}

.pdf-stacked {
  width: 100%;
}
.pdf-stacked-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  margin: 0 0 12px;
  padding: 0;
  list-style: none;
  font-size: 14px;
}
.pdf-stacked-legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
.pdf-stacked-track {
  display: flex;
  flex: 1;
  min-width: 0;
  height: 14px;
  overflow: hidden;
  background: #eeeef2;
}
.pdf-stacked-fill {
  height: 100%;
}
.pdf-stacked-row {
  align-items: center;
  min-height: 32px;
  padding: 12px 0;
}
.pdf-stacked-key {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}
.pdf-stacked-key-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pdf-files {
  margin-top: 16px;
  font-size: 14px;
}
.pdf-files-count {
  margin: 0 0 8px;
  color: #6b6b7b;
}
.pdf-files-list {
  list-style: none;
  margin: 0;
  padding: 0;
}
.pdf-files-item {
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.pdf-files-more {
  margin: 8px 0 0;
  color: #6b6b7b;
}
.pdf-file-name {
  color: #5b5fc7;
  text-decoration: underline;
}

.pdf-open {
  display: flex;
  align-items: center;
  margin-top: 24px;
}
.pdf-open-total {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 42%;
}
.pdf-open-number {
  font-size: 36px;
  line-height: 1;
}
.pdf-open-label {
  margin-top: 8px;
  font-size: 14px;
}
.pdf-open-list {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
}
.pdf-open-title {
  margin: 0 0 8px;
  font-size: 12px;
  color: #6b6b7b;
}
.pdf-open-quote {
  display: flex;
  max-width: 100%;
  margin: 0 0 4px;
  font-size: 14px;
}
.pdf-open-quote-text {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pdf-open-quote-mark {
  flex-shrink: 0;
}
.pdf-open-more {
  font-size: 18px;
  line-height: 1;
}
.pdf-count {
  margin: 24px 0 0;
  font-size: 14px;
}

.pdf-map {
  position: relative;
  width: 100%;
  aspect-ratio: 823 / 367;
  overflow: hidden;
  background: #e8e8ec;
  margin-top: 16px;
}
.pdf-map .pdf-map-image {
  display: block;
  width: 100%;
  height: 100%;
}
.pdf-map .pdf-map-fallback {
  margin: 0;
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: #6b6b7b;
}
.pdf-map .leaflet-pane,
.pdf-map .leaflet-tile,
.pdf-map .leaflet-marker-icon,
.pdf-map .leaflet-zoom-animated {
  position: absolute;
  left: 0;
  top: 0;
}
.pdf-map .leaflet-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.pdf-map .leaflet-tile {
  width: 256px;
  height: 256px;
}
.pdf-map .leaflet-marker-icon {
  display: block;
}
.pdf-map .leaflet-overlay-pane svg {
  position: absolute;
  left: 0;
  top: 0;
}
`;

module.exports = { PDF_CSS };

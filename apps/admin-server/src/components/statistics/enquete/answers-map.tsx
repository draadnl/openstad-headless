import { loadReactLeaflet } from '@/components/maps/load-react-leaflet';
import { useProject } from '@/hooks/use-project';
import {
  type Bounds,
  type LatLng,
  PIN_SIZE,
  boundsOf,
  cutoutRings,
  flattenLatLngs,
  mapFitPadding,
  outlineRings,
  pinLabel,
  scalePinHtml,
  unionBounds,
} from '@/lib/statistics/enquete-map-helpers';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';

const PIN_COLOR = '#00747a';
const MAX_FOCUSABLE_PINS = 25;

const mapCss = `
.enquete-answers-map .leaflet-control-zoom {
  display: flex;
  border: 0;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  overflow: hidden;
}
.enquete-answers-map .leaflet-control-zoom a {
  width: 26px;
  height: 26px;
  line-height: 26px;
  border: 0;
  border-radius: 0;
  background: #fff;
  color: #062037;
  font-size: 16px;
}
.enquete-answers-map .leaflet-control-zoom a:hover {
  background: #f4f4f6;
}
`;

async function fetchAreas(ids: string[]) {
  const results = await Promise.all(
    ids.map(async (id) => {
      const res = await fetch(`/api/openstad/api/area/${id}`);
      if (!res.ok) return null;
      return res.json();
    })
  );
  return results.filter(Boolean);
}

export function AnswersMap({
  points,
  areaIds,
  pointsTruncated,
  number,
}: {
  points: LatLng[];
  areaIds: number[];
  pointsTruncated: boolean;
  number: number;
}) {
  const [leaflet, setLeaflet] = useState<any>(null);
  const [markerIcon, setMarkerIcon] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    loadReactLeaflet()
      .then((module) => {
        if (!cancelled) setLeaflet(module);
      })
      .catch((error) => console.error('Failed to load react-leaflet', error));
    import('@openstad-headless/leaflet-map/src/marker-icon')
      .then((module) => {
        const MarkerIcon = module.default;
        if (!cancelled) {
          const icon = MarkerIcon({
            icon: { color: PIN_COLOR, className: '--defaultIcon' },
          });
          icon.options = {
            ...icon.options,
            className: `${icon.options.className ?? ''} enq-pin`.trim(),
            html: scalePinHtml(icon.options.html, PIN_SIZE),
            iconSize: [PIN_SIZE.width, PIN_SIZE.height],
            iconAnchor: PIN_SIZE.anchor,
            popupAnchor: [0, -PIN_SIZE.height],
          };
          setMarkerIcon(icon);
        }
      })
      .catch((error) => console.error('Failed to load marker icon', error));
    return () => {
      cancelled = true;
    };
  }, []);

  const { data: project, isLoading: projectLoading } = useProject() as any;
  const rawAreaId = project?.config?.map?.areaId;
  const projectAreaId =
    rawAreaId && String(rawAreaId) !== '0' ? String(rawAreaId) : null;
  const ids =
    areaIds.length > 0
      ? areaIds.map(String)
      : projectAreaId && !projectLoading
        ? [projectAreaId]
        : [];

  const { data: areas, isLoading: areasLoading } = useSWR(
    ids.length > 0 ? ['enquete-map-areas', ...ids] : null,
    () => fetchAreas(ids)
  );

  const polygons = useMemo(
    () => (areas ?? []).map((area: any) => area.polygon),
    [areas]
  );
  const cutout = useMemo(() => cutoutRings(polygons), [polygons]);
  const outline = useMemo(() => outlineRings(polygons), [polygons]);
  const bounds: Bounds | null = useMemo(
    () => unionBounds(boundsOf(flattenLatLngs(polygons)), boundsOf(points)),
    [polygons, points]
  );

  const ready =
    leaflet &&
    markerIcon &&
    !areasLoading &&
    !(areaIds.length === 0 && projectLoading);
  const label = `Kaart met ${points.length} gekozen locaties bij vraag ${number}`;

  return (
    <div className="mt-4">
      <div
        role="group"
        aria-label={label}
        className="pdf-map enquete-answers-map relative isolate w-full overflow-hidden bg-[#e8e8ec]"
        style={{ aspectRatio: '823 / 367' }}>
        <style>{mapCss}</style>
        <span data-pdf-exclude className="sr-only">
          {points.length} locaties
        </span>
        {ready ? (
          <MapBody
            leaflet={leaflet}
            markerIcon={markerIcon}
            points={points}
            cutout={cutout}
            outline={outline}
            bounds={bounds}
          />
        ) : null}
      </div>
      {/* Keyboard note for large maps; removed from the PDF clone */}
      {points.length > MAX_FOCUSABLE_PINS ? (
        <p className="sr-only" data-pdf-exclude>
          Deze kaart toont {points.length} locaties. De pins zijn niet met het
          toetsenbord te bereiken; gebruik ‘Meer details’ voor alle antwoorden.
        </p>
      ) : null}
      {pointsTruncated ? (
        <p className="pdf-note mb-0 mt-2 text-xs text-[#6b6b7b]">
          Eerste 2.000 locaties getoond
        </p>
      ) : null}
    </div>
  );
}

function FitBounds({ bounds, useMap }: { bounds: Bounds | null; useMap: any }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) map.fitBounds(bounds, mapFitPadding());
  }, [bounds, map]);
  return null;
}

function MapBody({
  leaflet,
  markerIcon,
  points,
  cutout,
  outline,
  bounds,
}: {
  leaflet: any;
  markerIcon: any;
  points: LatLng[];
  cutout: [number, number][][];
  outline: [number, number][][];
  bounds: Bounds | null;
}) {
  const { MapContainer, TileLayer, Marker, Polygon, Tooltip, useMap } = leaflet;
  return (
    <MapContainer
      center={[52.1, 5.3]}
      zoom={7}
      zoomSnap={0.1}
      scrollWheelZoom={false}
      attributionControl={false}
      style={{ height: '100%', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        referrerPolicy="no-referrer-when-downgrade"
        crossOrigin="anonymous"
      />
      {cutout.length > 0 ? (
        <Polygon
          positions={cutout}
          interactive={false}
          pathOptions={{ stroke: false, fillColor: '#000', fillOpacity: 0.15 }}
        />
      ) : null}
      {outline.length > 0 ? (
        <Polygon
          positions={outline}
          interactive={false}
          pathOptions={{ color: '#000', weight: 2, fill: false }}
        />
      ) : null}
      {points.map((point, index) => (
        <Marker
          key={index}
          position={[point.lat, point.lng]}
          icon={markerIcon}
          keyboard={points.length <= MAX_FOCUSABLE_PINS}
          interactive={points.length <= MAX_FOCUSABLE_PINS}
          title={
            points.length <= MAX_FOCUSABLE_PINS
              ? pinLabel(point, index, points.length)
              : undefined
          }>
          {points.length <= MAX_FOCUSABLE_PINS ? (
            <Tooltip direction="top" offset={[0, -PIN_SIZE.height]}>
              {pinLabel(point, index, points.length)}
            </Tooltip>
          ) : null}
        </Marker>
      ))}
      <FitBounds bounds={bounds} useMap={useMap} />
    </MapContainer>
  );
}

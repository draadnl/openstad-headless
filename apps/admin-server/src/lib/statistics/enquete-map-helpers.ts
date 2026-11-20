// Small map helpers for the survey statistics map. No Leaflet needed here.

export type LatLng = { lat: number; lng: number };
export type Bounds = [[number, number], [number, number]];

// Pulls every point out of the nested area shapes.
export function flattenLatLngs(input: unknown): LatLng[] {
  if (!Array.isArray(input)) return [];
  if (
    input.length > 0 &&
    typeof input[0]?.lat === 'number' &&
    typeof input[0]?.lng === 'number'
  ) {
    return input.filter(
      (p: any) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)
    );
  }
  return input.flatMap((item) => flattenLatLngs(item));
}

// The smallest box that holds all given points, or null for none.
export function boundsOf(points: LatLng[]): Bounds | null {
  if (!points.length) return null;
  let south = Infinity;
  let west = Infinity;
  let north = -Infinity;
  let east = -Infinity;
  for (const { lat, lng } of points) {
    if (lat < south) south = lat;
    if (lat > north) north = lat;
    if (lng < west) west = lng;
    if (lng > east) east = lng;
  }
  return [
    [south, west],
    [north, east],
  ];
}

// The smallest box that holds both boxes. A missing box is ignored.
export function unionBounds(a: Bounds | null, b: Bounds | null): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return [
    [Math.min(a[0][0], b[0][0]), Math.min(a[0][1], b[0][1])],
    [Math.max(a[1][0], b[1][0]), Math.max(a[1][1], b[1][1])],
  ];
}

const WORLD_BOX: [number, number][] = [
  [-90, -180],
  [-90, 180],
  [90, 180],
  [90, -180],
];

// World ring plus area rings: shades the world and leaves the areas clear.
export function cutoutRings(polygon: unknown): [number, number][][] {
  const rings: [number, number][][] = [];

  const collect = (node: unknown) => {
    if (!Array.isArray(node)) return;
    if (
      node.length > 0 &&
      typeof (node[0] as any)?.lat === 'number' &&
      typeof (node[0] as any)?.lng === 'number'
    ) {
      const ring = flattenLatLngs(node).map(
        ({ lat, lng }) => [lat, lng] as [number, number]
      );
      if (ring.length >= 3) rings.push(ring);
      return;
    }
    node.forEach(collect);
  };
  collect(polygon);

  return rings.length ? [WORLD_BOX, ...rings] : [];
}

// Area rings only (no world box), for the thin black outline.
export function outlineRings(polygon: unknown): [number, number][][] {
  const rings = cutoutRings(polygon);
  return rings.slice(1);
}

// Matching pin height and tip anchor for a given width.
const PIN_VIEWBOX = { width: 44.2, height: 56, tipX: 22.1, tipY: 53 };

export function pinGeometry(width: number): {
  width: number;
  height: number;
  anchor: [number, number];
} {
  const height = Math.round((width * PIN_VIEWBOX.height) / PIN_VIEWBOX.width);
  return {
    width,
    height,
    anchor: [
      Math.round((width * PIN_VIEWBOX.tipX) / PIN_VIEWBOX.width),
      Math.round((height * PIN_VIEWBOX.tipY) / PIN_VIEWBOX.height),
    ],
  };
}

export const PIN_SIZE = pinGeometry(22);

// Sets width/height on the first <svg> of the icon html.
export function scalePinHtml(
  html: string,
  size: { width: number; height: number }
): string {
  return html.replace(
    /(<svg\b[^>]*?)\swidth="[^"]*"\sheight="[^"]*"/,
    `$1 width="${size.width}" height="${size.height}"`
  );
}

export function mapFitPadding(): {
  paddingTopLeft: [number, number];
  paddingBottomRight: [number, number];
} {
  return {
    paddingTopLeft: [8, PIN_SIZE.height + 4],
    paddingBottomRight: [8, 8],
  };
}

export function pinLabel(point: LatLng, index: number, total: number): string {
  return `Locatie ${index + 1} van ${total}: ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
}

// Demo seed helper: deterministic map pins inside an area.

// An uneven, town-shaped outline (about 15 x 10 km). Points are {lat, lng}.
const DEMO_AREA_RING = [
  [51.69, 4.79],
  [51.693, 4.86],
  [51.685, 4.935],
  [51.66, 4.975],
  [51.625, 4.965],
  [51.598, 4.93],
  [51.59, 4.86],
  [51.6, 4.79],
  [51.63, 4.752],
  [51.665, 4.758],
].map(([lat, lng]) => ({ lat, lng }));

function makeRandom(seed) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function insideRing(point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const crosses =
      a.lng > point.lng !== b.lng > point.lng &&
      point.lat <
        ((b.lat - a.lat) * (point.lng - a.lng)) / (b.lng - a.lng) + a.lat;
    if (crosses) inside = !inside;
  }
  return inside;
}

// Distance (degrees of latitude) from a point to the nearest side of the ring.
function distanceToEdge(point, ring) {
  const scale = Math.cos((point.lat * Math.PI) / 180);
  const px = point.lng * scale;
  const py = point.lat;
  let best = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[j].lng * scale;
    const ay = ring[j].lat;
    const bx = ring[i].lng * scale;
    const by = ring[i].lat;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)
          );
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

// Makes `total` fixed pseudo-random pins inside the ring, `inset` degrees from the edge.
function buildDemoPins({
  ring = DEMO_AREA_RING,
  total = 192,
  seed = 1720,
  inset = 0.006,
} = {}) {
  const random = makeRandom(seed);
  const lats = ring.map((p) => p.lat);
  const lngs = ring.map((p) => p.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const fits = (point, margin) =>
    insideRing(point, ring) && distanceToEdge(point, ring) >= margin;

  const randomInside = (margin) => {
    for (let tries = 0; tries < 10000; tries++) {
      const point = {
        lat: minLat + random() * (maxLat - minLat),
        lng: minLng + random() * (maxLng - minLng),
      };
      if (fits(point, margin)) return point;
    }
    throw new Error('Could not place a pin inside the area');
  };

  const centres = Array.from({ length: 4 }, () => randomInside(inset * 2));
  const pins = [];
  let attempts = 0;
  while (pins.length < total) {
    if (++attempts > total * 1000) {
      throw new Error('Could not place a pin inside the area');
    }
    let point;
    if (random() < 0.7) {
      const centre = centres[Math.floor(random() * centres.length)];
      point = {
        lat: centre.lat + (random() - 0.5) * 0.03,
        lng: centre.lng + (random() - 0.5) * 0.05,
      };
    } else {
      point = randomInside(inset);
    }
    if (!fits(point, inset)) continue;
    pins.push({
      lat: Math.round(point.lat * 1e5) / 1e5,
      lng: Math.round(point.lng * 1e5) / 1e5,
    });
  }
  return pins;
}

module.exports = {
  DEMO_AREA_RING,
  insideRing,
  distanceToEdge,
  buildDemoPins,
};

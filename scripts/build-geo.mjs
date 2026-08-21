// One-time script: derives static map geometry (state/world SVG paths + state
// centroids) from the raw GeoJSON in geo-source/. Never runs at request time —
// output is committed to src/data/geo-data.json and imported directly.
//
// Run with: node scripts/build-geo.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const usStates = JSON.parse(fs.readFileSync(path.join(root, 'geo-source/us-states.json'), 'utf8'));
const world = JSON.parse(fs.readFileSync(path.join(root, 'geo-source/world.json'), 'utf8'));

// ---------- projection helpers ----------
function makeProjector(lonMin, lonMax, latMin, latMax, width, height, padding) {
  const w = width - padding * 2;
  const h = height - padding * 2;
  const lonSpan = lonMax - lonMin;
  const latSpan = latMax - latMin;
  const scale = Math.min(w / lonSpan, h / latSpan);
  const usedW = lonSpan * scale;
  const usedH = latSpan * scale;
  const offsetX = padding + (w - usedW) / 2;
  const offsetY = padding + (h - usedH) / 2;
  return function project(lon, lat) {
    const x = offsetX + (lon - lonMin) * scale;
    const y = offsetY + (latMax - lat) * scale;
    return [x, y];
  };
}

function ringToPath(ring, project) {
  return ring
    .map(([lon, lat], i) => {
      const [x, y] = project(lon, lat);
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join('') + 'Z';
}

function geomToPath(geometry, project) {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map((ring) => ringToPath(ring, project)).join(' ');
  }
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((poly) => poly.map((ring) => ringToPath(ring, project)).join(' '))
      .join(' ');
  }
  return '';
}

// ---------- US panel ----------
const usProject = makeProjector(-125, -66.5, 24, 49.5, 960, 600, 10);
const hiProject = makeProjector(-160.5, -154.5, 18.7, 22.5, 150, 110, 8);
const akProject = makeProjector(-190, -129, 51, 72, 170, 70, 6);

const CONTIGUOUS_EXCLUDE = new Set(['Alaska', 'Hawaii', 'Puerto Rico']);

const US_STATE_ABBR = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
  'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
  'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
  'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
  'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR',
  'Pennsylvania': 'PA', 'Puerto Rico': 'PR', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT',
  'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY',
};

// Signed-area centroid (shoelace formula) of a single ring. Called on raw
// lon/lat rings, then the resulting single point is projected - projection
// is affine so centroid-then-project == project-then-centroid.
function ringCentroid(ring) {
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[(i + 1) % ring.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area = area / 2;
  if (Math.abs(area) < 1e-12) {
    const n = ring.length;
    return {
      x: ring.reduce((s, p) => s + p[0], 0) / n,
      y: ring.reduce((s, p) => s + p[1], 0) / n,
      area: 0,
    };
  }
  return { x: cx / (6 * area), y: cy / (6 * area), area: Math.abs(area) };
}

// A state can be a MultiPolygon (islands, detached bits) - use the centroid
// of the largest-area exterior ring so the marker lands on the "mainland"
// part of the state rather than getting dragged toward a small island.
function geometryCentroid(geometry) {
  let rings = [];
  if (geometry.type === 'Polygon') rings = [geometry.coordinates[0]];
  else if (geometry.type === 'MultiPolygon') rings = geometry.coordinates.map((poly) => poly[0]);
  let best = null;
  for (const ring of rings) {
    const c = ringCentroid(ring);
    if (!best || c.area > best.area) best = c;
  }
  return best;
}

let usPaths = [];
let hiPaths = [];
let akPaths = [];
let stateCentroids = {};
for (const f of usStates.features) {
  const name = f.properties.name;
  const abbr = US_STATE_ABBR[name];
  const centroid = geometryCentroid(f.geometry);
  if (name === 'Hawaii') {
    const d = geomToPath(f.geometry, hiProject);
    if (d) hiPaths.push({ name, d });
    if (centroid && abbr) {
      const [x, y] = hiProject(centroid.x, centroid.y);
      stateCentroids[abbr] = { x: +x.toFixed(1), y: +y.toFixed(1), hawaii: true };
    }
    continue;
  }
  if (name === 'Alaska') {
    const d = geomToPath(f.geometry, akProject);
    if (d) akPaths.push({ name, d });
    if (centroid && abbr) {
      const [x, y] = akProject(centroid.x, centroid.y);
      stateCentroids[abbr] = { x: +x.toFixed(1), y: +y.toFixed(1), alaska: true };
    }
    continue;
  }
  if (CONTIGUOUS_EXCLUDE.has(name)) continue;
  const d = geomToPath(f.geometry, usProject);
  if (d) usPaths.push({ name, d });
  if (centroid && abbr) {
    const [x, y] = usProject(centroid.x, centroid.y);
    stateCentroids[abbr] = { x: +x.toFixed(1), y: +y.toFixed(1) };
  }
}

// ---------- World panel ----------
const worldProject = makeProjector(-170, 190, -56, 78, 960, 520, 10);
let worldPaths = [];
let countryCentroids = {};
for (const f of world.features) {
  const d = geomToPath(f.geometry, worldProject);
  if (d) worldPaths.push({ name: f.properties.name || '', d });
  const name = f.properties.name;
  const centroid = geometryCentroid(f.geometry);
  if (name && centroid) {
    const [x, y] = worldProject(centroid.x, centroid.y);
    countryCentroids[name] = { x: +x.toFixed(1), y: +y.toFixed(1) };
  }
}

const out = { usPaths, hiPaths, akPaths, worldPaths, stateCentroids, countryCentroids };
const outPath = path.join(root, 'src/data/geo-data.json');
fs.writeFileSync(outPath, JSON.stringify(out));
console.log('US state paths:', usPaths.length, 'HI paths:', hiPaths.length, 'AK paths:', akPaths.length, 'World paths:', worldPaths.length);
console.log('Country centroids:', Object.keys(countryCentroids).length);
console.log('geo-data.json size (bytes):', fs.statSync(outPath).size);

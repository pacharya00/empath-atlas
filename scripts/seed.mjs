// One-time script: seeds the Supabase `sites` table with the original 59 US +
// 8 international records ported verbatim from the old build.js. Guards
// against double-inserting if the table already has rows.
//
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment
// (loaded from .env.local). Run with: node scripts/seed.mjs

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Minimal .env.local loader (no extra dependency needed for a one-off script).
const envPath = path.join(root, '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] ?? m[2].trim();
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (check .env.local).');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const usSites = [
  { name: 'Lowell General Hospital', city: 'Lowell', state: 'MA', lat: 42.6479, lon: -71.3421, type: 'empath' },
  { name: 'Sentara Health', city: 'Virginia (site TBD)', state: 'VA', lat: 36.8508, lon: -76.2859, type: 'empath', approx: true },
  { name: 'Centra Health', city: 'Lynchburg', state: 'VA', lat: 37.4171, lon: -79.1715, type: 'empath', note: 'Opened Sept 2023' },
  { name: 'Inova Health', city: 'Fairfax', state: 'VA', lat: 38.1882, lon: -77.2232, type: 'empath' },
  { name: 'Valley Health', city: 'Winchester', state: 'VA', lat: 39.1945, lon: -78.1931, type: 'empath' },
  { name: 'South Seminole Hospital', city: 'Orlando', state: 'FL', lat: 28.6990, lon: -81.3527, type: 'empath' },
  { name: 'JPS Health Network', city: 'Fort Worth', state: 'TX', lat: 32.7274, lon: -97.3272, type: 'empath' },
  { name: 'McNabb Center', city: 'Knoxville', state: 'TN', lat: 36.0132, lon: -83.9779, type: 'empath' },
  { name: 'University of Iowa', city: 'Iowa City', state: 'IA', lat: 41.6580, lon: -91.5480, type: 'empath' },
  { name: 'University of Nebraska', city: 'Omaha', state: 'NE', lat: 41.2536, lon: -95.9721, type: 'empath' },
  { name: 'Kootenai Health', city: "Coeur d'Alene", state: 'ID', lat: 47.6954, lon: -116.7938, type: 'empath' },
  { name: 'University of Washington Northwest', city: 'Seattle', state: 'WA', lat: 47.7147, lon: -122.3371, type: 'empath' },
  { name: 'Unity Center', city: 'Portland', state: 'OR', lat: 45.5320, lon: -122.6642, type: 'empath' },
  { name: 'Mercy Redding', city: 'Redding', state: 'CA', lat: 40.5885, lon: -122.3789, type: 'empath' },
  { name: 'San Jose Hospital', city: 'San Jose', state: 'CA', lat: 37.3621, lon: -121.8494, type: 'empath' },
  { name: 'Santa Clara County Hospital', city: 'San Jose', state: 'CA', lat: 37.3135, lon: -121.9353, type: 'empath' },
  { name: 'San Francisco General Hospital', city: 'San Francisco', state: 'CA', lat: 37.7556, lon: -122.4037, type: 'empath' },
  { name: 'Alameda County Hospital', city: 'Alameda', state: 'CA', lat: 37.7627, lon: -122.2542, type: 'empath' },
  { name: 'Henry Mayo Newhall Hospital', city: 'Valencia', state: 'CA', lat: 34.3975, lon: -118.5535, type: 'empath' },
  { name: 'College Hospital', city: 'Long Beach', state: 'CA', lat: 33.8015, lon: -118.1922, type: 'empath' },
  { name: 'Pacifica Hospital', city: 'Los Angeles', state: 'CA', lat: 34.2401, lon: -118.3963, type: 'empath' },
  { name: 'Loma Linda University Medical Center', city: 'Loma Linda', state: 'CA', lat: 34.0495, lon: -117.2642, type: 'empath' },
  { name: 'Sharp Chula Vista Medical Center', city: 'Chula Vista', state: 'CA', lat: 32.6197, lon: -117.0228, type: 'empath' },
  { name: 'MUSC Health Leatherman Behavioral Care Pavilion', city: 'Florence', state: 'SC', lat: 34.1979, lon: -79.7629, type: 'empath', note: 'Adult and adolescent EmPATH units' },
  { name: "McLeod Children's Hospital", city: 'Florence', state: 'SC', lat: 34.1968, lon: -79.7598, type: 'empath', note: 'Pediatric EmPATH unit' },
  { name: 'Stamford Health', city: 'Stamford', state: 'CT', lat: 41.0534, lon: -73.5387, type: 'empath', note: 'Pediatric EmPATH unit' },
  { name: 'Emplify Health', city: 'La Crosse', state: 'WI', lat: 43.8014, lon: -91.2396, type: 'empath' },
  { name: 'M Health Fairview Southdale', city: 'Edina', state: 'MN', lat: 44.8868, lon: -93.3265, type: 'empath', note: 'Opened March 2021' },
  { name: 'MLK Community Healthcare', city: 'Los Angeles', state: 'CA', lat: 33.9233, lon: -118.2427, type: 'empath' },
  { name: 'MaineHealth Maine Medical Center', city: 'Portland', state: 'ME', lat: 43.6591, lon: -70.2568, type: 'empath' },
  { name: 'Trident Medical Center', city: 'Summerville', state: 'SC', lat: 33.0185, lon: -80.1756, type: 'empath' },
  { name: "MUSC Health Shawn Jenkins Children's Hospital", city: 'Charleston', state: 'SC', lat: 32.7876, lon: -79.9403, type: 'empath' },
  { name: 'Beaufort Memorial Hospital', city: 'Beaufort', state: 'SC', lat: 32.4316, lon: -80.6698, type: 'empath' },
  { name: 'Lexington Medical Center', city: 'West Columbia', state: 'SC', lat: 33.9946, lon: -81.0637, type: 'empath' },
  { name: 'MUSC Health University Medical Center', city: 'Charleston', state: 'SC', lat: 32.7852, lon: -79.9435, type: 'empath' },
  { name: 'MUSC Health Orangeburg Medical Center', city: 'Orangeburg', state: 'SC', lat: 33.4919, lon: -80.8557, type: 'empath' },
  { name: 'Prisma Health Tuomey Hospital', city: 'Sumter', state: 'SC', lat: 33.9204, lon: -80.3414, type: 'empath' },
  { name: 'MUSC Health Kershaw Medical Center', city: 'Camden', state: 'SC', lat: 34.2493, lon: -80.6073, type: 'empath' },
  { name: 'Sutter Health Coast Hospital', city: 'Crescent City', state: 'CA', lat: 41.7558, lon: -124.2026, type: 'empath' },
  { name: 'UK HealthCare', city: 'Lexington', state: 'KY', lat: 38.0311, lon: -84.5094, type: 'empath', note: 'Opened July 2024' },
  { name: 'Griffin Hospital', city: 'Derby', state: 'CT', lat: 41.3187, lon: -73.0692, type: 'empath' },
  { name: 'Covenant Health', city: 'Knoxville', state: 'TN', lat: 35.9606, lon: -83.9207, type: 'empath' },
  { name: 'St. Clair Health', city: 'Pittsburgh', state: 'PA', lat: 40.3763, lon: -80.0509, type: 'empath' },
  { name: 'Jefferson Cherry Hill Hospital', city: 'Cherry Hill', state: 'NJ', lat: 39.9348, lon: -75.0307, type: 'empath' },
  { name: 'Bergen New Bridge Medical Center', city: 'Paramus', state: 'NJ', lat: 40.9445, lon: -74.0754, type: 'empath' },
  { name: 'Sheridan Memorial Hospital', city: 'Sheridan', state: 'WY', lat: 44.8087, lon: -106.9758, type: 'empath' },
  { name: 'Arrowhead Regional Medical Center', city: 'San Bernardino County', state: 'CA', lat: 34.0672, lon: -117.3320, type: 'empath' },
  { name: 'Dignity Health Mercy San Juan Medical Center', city: 'Carmichael', state: 'CA', lat: 38.6695, lon: -121.3132, type: 'empath', note: 'Opened Sept 2019' },

  { name: 'Overlook Medical Center (Atlantic Health)', city: 'Summit', state: 'NJ', lat: 40.7120, lon: -74.3540, type: 'empath-like' },
  { name: 'Providence / Cook County Health', city: 'Chicago', state: 'IL', lat: 41.8736, lon: -87.6744, type: 'empath-like' },
  { name: 'Truman Medical Center', city: 'Kansas City', state: 'MO', lat: 39.0852, lon: -94.5753, type: 'empath-like' },
  { name: 'Huntsman Mental Health Institute', city: 'Salt Lake City', state: 'UT', lat: 40.7581, lon: -111.8233, type: 'empath-like' },
  { name: 'Billings Clinic', city: 'Billings', state: 'MT', lat: 45.7895, lon: -108.5130, type: 'empath-like' },
  { name: 'Bozeman Health', city: 'Bozeman', state: 'MT', lat: 45.6696, lon: -111.0209, type: 'empath-like' },
  { name: "Queen's Medical Center", city: 'Honolulu', state: 'HI', lat: 21.3081, lon: -157.8539, type: 'empath-like', hawaii: true },
  { name: 'Yale New Haven Health', city: 'New Haven', state: 'CT', lat: 41.3083, lon: -72.9279, type: 'empath-like' },
  { name: 'AnMed Health Medical Center', city: 'Anderson', state: 'SC', lat: 34.5034, lon: -82.6501, type: 'empath-like' },
  { name: 'UPMC', city: 'Pittsburgh', state: 'PA', lat: 40.4425, lon: -79.9602, type: 'empath-like' },
  { name: 'UPMC Altoona', city: 'Altoona', state: 'PA', lat: 40.5223, lon: -78.3984, type: 'empath-like' },
].map((s) => ({ ...s, region: 'us', status: 'live' }));

const intlSites = [
  { name: 'Scotland units', country: 'United Kingdom', lat: 55.9533, lon: -3.1883, note: 'Country-level placeholder — exact site(s) TBD' },
  { name: 'Canada units', country: 'Canada', lat: 45.4215, lon: -75.6972, note: 'Country-level placeholder — exact site(s) TBD' },
  { name: 'Singapore units', country: 'Singapore', lat: 1.3521, lon: 103.8198, note: 'Country-level placeholder — exact site(s) TBD' },
  { name: 'Australia units', country: 'Australia', lat: -33.8688, lon: 151.2093, note: 'Country-level placeholder — exact site(s) TBD' },
  { name: 'Hospital General de Culiacán', country: 'Mexico', lat: 24.8091, lon: -107.3940, note: 'Sinaloa — EmPATH unit' },
  { name: 'West Middlesex Hospital (Lakeside Mental Health Unit)', country: 'United Kingdom', lat: 51.4816, lon: -0.3320, note: 'Isleworth — EmPATH-like unit' },
  { name: 'Chase Farm Hospital', country: 'United Kingdom', lat: 51.6536, lon: -0.1054, note: 'Enfield — EmPATH-like unit' },
  { name: 'Italy units', country: 'Italy', lat: 41.8719, lon: 12.5674, note: 'Country-level placeholder — exact site(s) TBD' },
].map((s) => ({ ...s, region: 'intl', status: 'live' }));

const allRows = [...usSites, ...intlSites];

const { count, error: countError } = await supabase
  .from('sites')
  .select('*', { count: 'exact', head: true });

if (countError) {
  console.error('Could not read `sites` table — has it been created yet?', countError.message);
  process.exit(1);
}

if (count > 0) {
  console.log(`sites table already has ${count} row(s) — skipping seed to avoid duplicates.`);
  process.exit(0);
}

const { error: insertError } = await supabase.from('sites').insert(allRows);
if (insertError) {
  console.error('Seed insert failed:', insertError.message);
  process.exit(1);
}

console.log(`Seeded ${allRows.length} rows (${usSites.length} us, ${intlSites.length} intl).`);

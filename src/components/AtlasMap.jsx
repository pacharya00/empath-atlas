'use client';

import { useEffect } from 'react';
import geoData from '@/data/geo-data.json';

const STAR_PATH = "M0,-6.5 L1.7,-2.1 L6.4,-2 L2.7,1.1 L4,5.9 L0,3.1 L-4,5.9 L-2.7,1.1 L-6.4,-2 L-1.7,-2.1 Z";

const typeMeta = {
  'empath': { label: 'EmPATH Unit', color: 'var(--accent)' },
  'empath-like': { label: 'Unit based on the EmPATH model', color: 'var(--status-prospect)' },
};

const EXPORT_ICON = `<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 1.5v8M5 6.7 8 9.7l3-3"/><path d="M2.5 11v2.2c0 .7.6 1.3 1.3 1.3h8.4c.7 0 1.3-.6 1.3-1.3V11"/></svg>`;

// Mirrors scripts/build-geo.mjs's makeProjector() exactly (plain linear
// fit-to-box, no geo library) so sites coming from the database — which only
// carry lat/lon — land in the same place the static geometry was built at.
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
  function project(lon, lat) {
    return [offsetX + (lon - lonMin) * scale, offsetY + (latMax - lat) * scale];
  }
  project.invert = function (x, y) {
    return [lonMin + (x - offsetX) / scale, latMax - (y - offsetY) / scale];
  };
  return project;
}
const usProject = makeProjector(-125, -66.5, 24, 49.5, 960, 600, 10);
const hiProject = makeProjector(-160.5, -154.5, 18.7, 22.5, 150, 110, 8);
const akProject = makeProjector(-190, -129, 51, 72, 170, 70, 6);
const worldProject = makeProjector(-170, 190, -56, 78, 960, 520, 10);

function siteFromRow(row) {
  const region = (row.region || 'us').toLowerCase();
  const lat = row.lat != null && row.lat !== '' ? parseFloat(row.lat) : null;
  const lon = row.lon != null && row.lon !== '' ? parseFloat(row.lon) : null;
  if (region === 'intl') {
    let x = null, y = null;
    if (lat != null && lon != null) {
      const p = worldProject(lon, lat);
      x = +p[0].toFixed(1); y = +p[1].toFixed(1);
    }
    return {
      _dbId: row.id, region: 'intl', name: row.name || '', city: row.city || '', country: row.country || '',
      type: row.type || 'empath', status: row.status || 'live', note: row.note || '', lat, lon, x, y,
    };
  }
  const hawaii = !!row.hawaii || (row.state || '').toUpperCase() === 'HI';
  const alaska = (row.state || '').toUpperCase() === 'AK';
  let x = null, y = null;
  if (lat != null && lon != null) {
    const projector = hawaii ? hiProject : alaska ? akProject : usProject;
    const p = projector(lon, lat);
    x = +p[0].toFixed(1); y = +p[1].toFixed(1);
  }
  return {
    _dbId: row.id, region: 'us', name: row.name || '', city: row.city || '', state: row.state || '',
    type: row.type || 'empath', status: row.status || 'live', note: row.note || '',
    lat, lon, x, y, hawaii, alaska,
  };
}

function splitRows(rows) {
  const sites = [];
  const intlSites = [];
  rows.forEach((row) => {
    const region = (row.region || 'us').toLowerCase();
    const site = siteFromRow(row);
    site._id = 'site-db-' + site._dbId;
    if (region === 'intl') {
      intlSites.push(site);
    } else {
      sites.push(site);
    }
  });
  return { sites, intlSites };
}

export default function AtlasMap({ initialSites }) {
  useEffect(() => {
    const addUnitBtn = document.getElementById('addUnitBtn');
    if (!addUnitBtn || addUnitBtn.dataset.wired) return;
    addUnitBtn.dataset.wired = '1';

    const modalOverlay = document.getElementById('modalOverlay');
    const modalPanel = document.getElementById('modalPanel');

    const DATA = {
      usPaths: geoData.usPaths,
      hiPaths: geoData.hiPaths,
      akPaths: geoData.akPaths,
      worldPaths: geoData.worldPaths,
      stateCentroids: geoData.stateCentroids,
      countryCentroids: geoData.countryCentroids,
      ...splitRows(initialSites || []),
    };

    const OTHER_COUNTRIES = geoData.worldPaths
      .map(p => p.name)
      .filter(n => n && n !== 'USA')
      .sort((a, b) => a.localeCompare(b));

    const state = {
      region: 'us',
      types: new Set(['empath', 'empath-like']),
      query: '',
      hoveredId: null,
    };

    let draft = null;

    // ---------- Data source (Supabase via our own API routes) ----------
    async function loadSites() {
      try {
        const res = await fetch('/api/sites');
        if (!res.ok) throw new Error(`Request failed (${res.status})`);
        const json = await res.json();
        const { sites, intlSites } = splitRows(json.sites || []);
        DATA.sites = sites;
        DATA.intlSites = intlSites;
        setLiveStatus(true);
        renderStats();
        renderChips();
        renderMap();
        renderList();
      } catch (err) {
        setLiveStatus(false);
        console.warn('Could not load sites from the database — showing the last loaded snapshot.', err);
      }
    }

    async function saveSite(fields) {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      return json.site;
    }

    async function promoteSite(site) {
      const res = await fetch(`/api/sites/${site._dbId}`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
      site.status = 'live';
      renderMap();
      renderList();
    }

    function setLiveStatus(ok) {
      const el = document.getElementById('liveStatus');
      if (!el) return;
      el.textContent = ok ? ' · live' : ' · offline (showing snapshot)';
      el.title = ok
        ? 'Loaded live from the shared database.'
        : "Couldn't reach the database — showing the last loaded snapshot.";
    }

    function siteColor(s) {
      if (s.status === 'in-development') return 'var(--status-dev)';
      return s.type === 'empath' ? 'var(--accent)' : 'var(--status-prospect)';
    }

    function matches(s) {
      if (!s || !state.types.has(s.type)) return false;
      if (state.query) {
        const q = state.query.toLowerCase();
        const locality = s.region === 'intl' ? s.country : s.state;
        const hay = (s.name + ' ' + (s.city || '') + ' ' + (locality || '')).toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }

    function renderStats() {
      document.getElementById('statRow').innerHTML = `
        <div class="stat"><span class="num">${DATA.sites.length}</span><span class="lbl">U.S. sites</span></div>
        <div class="stat"><span class="num">${DATA.intlSites.length}</span><span class="lbl">International sites</span></div>
      `;
    }

    function renderChips() {
      const typeCounts = { empath: 0, 'empath-like': 0 };
      DATA.sites.concat(DATA.intlSites).forEach(s => typeCounts[s.type]++);
      const typeWrap = document.getElementById('typeChips');
      typeWrap.innerHTML = Object.entries(typeMeta).map(([key, m]) => `
        <label class="chip">
          <input type="checkbox" data-kind="type" value="${key}" checked>
          <span class="swatch" style="background:${m.color}"></span>
          ${m.label}
          <span class="count">${typeCounts[key]}</span>
        </label>
      `).join('');

      document.querySelectorAll('input[data-kind]').forEach(el => {
        el.addEventListener('change', () => {
          if (el.checked) state.types.add(el.value); else state.types.delete(el.value);
          renderMap();
          renderList();
        });
      });
    }

    function buildUsSvg() {
      const stateShapes = DATA.usPaths.map(p => `<path class="state-shape" d="${p.d}"></path>`).join('');
      const hiShapes = DATA.hiPaths.map(p => `<path class="state-shape" d="${p.d}" transform="translate(790,470)"></path>`).join('');
      const akShapes = DATA.akPaths.map(p => `<path class="state-shape" d="${p.d}" transform="translate(10,480)"></path>`).join('');
      const stars = DATA.sites.filter(s => !s.hawaii && !s.alaska).map(s => siteMarkup(s, s.x, s.y)).join('');
      const hiStars = DATA.sites.filter(s => s.hawaii).map(s => siteMarkup(s, s.x + 790, s.y + 470)).join('');
      const akStars = DATA.sites.filter(s => s.alaska).map(s => siteMarkup(s, s.x + 10, s.y + 480)).join('');
      return `<svg viewBox="0 0 960 600" xmlns="http://www.w3.org/2000/svg" aria-label="Map of the United States">
        <rect class="hi-box" x="786" y="466" width="158" height="118" rx="6"></rect>
        <text x="795" y="480" font-size="10" fill="var(--ink-faint)" font-family="Public Sans">Hawai&#8216;i</text>
        <rect class="hi-box" x="10" y="480" width="170" height="70" rx="6"></rect>
        <text x="19" y="494" font-size="10" fill="var(--ink-faint)" font-family="Public Sans">Alaska</text>
        ${stateShapes}
        ${hiShapes}
        ${akShapes}
        ${stars}
        ${hiStars}
        ${akStars}
      </svg>`;
    }

    function buildWorldSvg() {
      const shapes = DATA.worldPaths.map(p => `<path class="world-shape" d="${p.d}"></path>`).join('');
      const stars = DATA.intlSites.map(s => siteMarkup(s, s.x, s.y)).join('');
      return `<svg viewBox="0 0 960 520" xmlns="http://www.w3.org/2000/svg" aria-label="World map of international EmPATH activity">
        ${shapes}
        ${stars}
      </svg>`;
    }

    function siteMarkup(s, x, y) {
      const color = siteColor(s);
      const customRing = s.custom ? `<circle class="custom-ring" r="9.5"></circle>` : '';
      return `<g class="site-mark${s.custom ? ' custom' : ''}" data-id="${s._id}" transform="translate(${x},${y})" tabindex="0" role="button" aria-label="${escAttr(s.name)}">
        <circle class="halo" r="10" stroke="${color}"></circle>
        ${customRing}
        <path class="star" d="${STAR_PATH}" fill="${color}"></path>
      </g>`;
    }

    function escAttr(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    }

    function renderMap() {
      const mapPanel = document.getElementById('mapPanel');
      mapPanel.innerHTML = state.region === 'us' ? buildUsSvg() : buildWorldSvg();

      const legendItems = `<div class="legend-row"><svg class="legend-star" viewBox="-7 -7 14 14"><path d="${STAR_PATH}" fill="var(--accent)"></path></svg> EmPATH Unit</div>
           <div class="legend-row"><svg class="legend-star" viewBox="-7 -7 14 14"><path d="${STAR_PATH}" fill="var(--status-prospect)"></path></svg> ${typeMeta['empath-like'].label}</div>
           <div class="legend-row"><svg class="legend-star" viewBox="-7 -7 14 14"><path d="${STAR_PATH}" fill="var(--status-dev)"></path></svg> In development</div>`;
      const legend = document.createElement('div');
      legend.className = 'legend';
      legend.innerHTML = legendItems;
      mapPanel.appendChild(legend);

      const roster = state.region === 'us' ? DATA.sites : DATA.intlSites;
      mapPanel.querySelectorAll('.site-mark').forEach(el => {
        const site = roster.find(s => s._id === el.dataset.id);
        if (!matches(site)) el.classList.add('dimmed');
        attachSiteEvents(el, site);
      });
    }

    function attachSiteEvents(el, site) {
      const tooltip = document.getElementById('tooltip');
      const show = (evt) => {
        document.querySelectorAll('.site-mark.hovered, .list-panel tr.hovered').forEach(n => n.classList.remove('hovered'));
        el.classList.add('hovered');
        const row = document.querySelector(`tr[data-id="${site._id}"]`);
        if (row) row.classList.add('hovered');
        tooltip.innerHTML = `<span class="t-name">${site.name}</span><span class="t-meta">${locationLabel(site)} &middot; ${typeMeta[site.type].label}</span>${site.status === 'in-development' ? `<span class="t-note">In development</span>` : ''}${site.note ? `<span class="t-note">${site.note}</span>` : ''}${site.custom ? `<span class="t-note">Just added — saved to the shared roster</span>` : ''}`;
        positionTooltip(evt, el);
        tooltip.classList.add('visible');
      };
      const hide = () => {
        el.classList.remove('hovered');
        document.querySelectorAll('.list-panel tr.hovered').forEach(n => n.classList.remove('hovered'));
        tooltip.classList.remove('visible');
      };
      el.addEventListener('mouseenter', show);
      el.addEventListener('mousemove', (e) => positionTooltip(e, el));
      el.addEventListener('mouseleave', hide);
      el.addEventListener('focus', show);
      el.addEventListener('blur', hide);
    }

    function positionTooltip(evt, el) {
      const tooltip = document.getElementById('tooltip');
      const wrap = document.querySelector('.wrap').getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const cx = evt.clientX !== undefined ? evt.clientX : rect.left + rect.width / 2;
      const cy = evt.clientY !== undefined ? evt.clientY : rect.top;
      tooltip.style.left = (cx - wrap.left + document.querySelector('.wrap').scrollLeft) + 'px';
      tooltip.style.top = (cy - wrap.top) + 'px';
    }

    function csvEscape(value) {
      const str = String(value == null ? '' : value);
      return '"' + str.replace(/"/g, '""') + '"';
    }

    function downloadCSV(filename, header, rows) {
      const lines = [header, ...rows].map(r => r.map(csvEscape).join(','));
      const csv = lines.join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }

    function sortedRoster() {
      const roster = state.region === 'us' ? DATA.sites : DATA.intlSites;
      return roster.filter(matches).sort((a, b) => {
        const la = a.region === 'intl' ? a.country : a.state;
        const lb = b.region === 'intl' ? b.country : b.state;
        return (la || '').localeCompare(lb || '') || a.name.localeCompare(b.name);
      });
    }

    function locationLabel(s) {
      return s.region === 'intl'
        ? (s.city ? `${s.city}, ${s.country}` : s.country)
        : `${s.city}, ${s.state}`;
    }

    function exportCurrentList() {
      const rows = sortedRoster();
      if (state.region !== 'us') {
        downloadCSV(
          'empath-atlas-international.csv',
          ['Site', 'City', 'Country', 'Type', 'Notes'],
          rows.map(s => [s.name, s.city || '', s.country, typeMeta[s.type].label, s.note || ''])
        );
        return;
      }
      downloadCSV(
        'empath-atlas-sites.csv',
        ['Site', 'City', 'State', 'Type', 'Notes'],
        rows.map(s => [s.name, s.city, s.state, typeMeta[s.type].label, s.note || ''])
      );
    }

    function renderList() {
      const listPanel = document.getElementById('listPanel');
      const rows = sortedRoster();
      const noun = rows.length === 1 ? 'site' : 'sites';

      listPanel.innerHTML = `
        <div class="list-header">
          <span class="list-title"><span class="n">${rows.length}</span> ${noun} shown</span>
          <div class="list-actions">
            <button class="export-btn" id="exportBtn">${EXPORT_ICON} Export CSV</button>
            <a class="export-btn" id="exportAllBtn" href="/api/export" download>${EXPORT_ICON} Export full list</a>
          </div>
        </div>
        <div class="list-scroll" id="listScroll"></div>
      `;
      document.getElementById('exportBtn').addEventListener('click', exportCurrentList);

      const listScroll = document.getElementById('listScroll');

      if (!rows.length) {
        listScroll.innerHTML = `<div class="empty-note">No sites match the current filters.</div>`;
        return;
      }
      listScroll.innerHTML = `
        <table>
          <thead><tr><th>Site</th><th>Location</th><th>Type</th><th>Status</th></tr></thead>
          <tbody>
            ${rows.map(s => `
              <tr data-id="${s._id}">
                <td>${s.name}</td>
                <td>${locationLabel(s)}</td>
                <td class="type-tag">${typeMeta[s.type].label}</td>
                <td class="status-cell">${s.status === 'in-development'
                  ? `<span class="status-tag dev">In development</span><button type="button" class="promote-btn" data-id="${s._id}" title="Mark as live">&#10003; Mark live</button>`
                  : `<span class="status-tag live">Live</span>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      listScroll.querySelectorAll('tbody tr').forEach(tr => {
        tr.addEventListener('mouseenter', () => {
          document.querySelectorAll('.site-mark.hovered').forEach(n => n.classList.remove('hovered'));
          const mark = document.querySelector(`.site-mark[data-id="${tr.dataset.id}"]`);
          if (mark) mark.classList.add('hovered');
        });
        tr.addEventListener('mouseleave', () => {
          const mark = document.querySelector(`.site-mark[data-id="${tr.dataset.id}"]`);
          if (mark) mark.classList.remove('hovered');
        });
      });

      listScroll.querySelectorAll('.promote-btn').forEach(btn => {
        btn.addEventListener('click', async (evt) => {
          evt.stopPropagation();
          const roster = state.region === 'us' ? DATA.sites : DATA.intlSites;
          const site = roster.find(s => s._id === btn.dataset.id);
          if (!site) return;
          btn.disabled = true;
          btn.textContent = 'Marking live…';
          try {
            await promoteSite(site);
          } catch (err) {
            console.warn('Failed to mark site live', err);
            btn.disabled = false;
            btn.textContent = '✓ Mark live';
          }
        });
      });
    }

    // ---------- Add a site ----------
    function resetDraft() {
      draft = { name: '', city: '', state: '', region: 'us', country: '', type: 'empath', status: 'live', note: '', lat: '', lon: '', x: null, y: null };
    }

    function updateChipCounts() {
      const typeCounts = { empath: 0, 'empath-like': 0 };
      DATA.sites.concat(DATA.intlSites).forEach(s => typeCounts[s.type]++);
      document.querySelectorAll('#typeChips .chip').forEach(chip => {
        const val = chip.querySelector('input').value;
        chip.querySelector('.count').textContent = typeCounts[val];
      });
    }

    function closeModal() {
      modalOverlay.hidden = true;
    }

    function captureDraftFields() {
      draft.name = document.getElementById('f-name').value.trim();
      draft.city = document.getElementById('f-city').value.trim();
      const stateEl = document.getElementById('f-state');
      if (stateEl) draft.state = stateEl.value.trim().toUpperCase();
      draft.type = document.getElementById('f-type').value;
      const inDevEl = document.getElementById('f-in-dev');
      draft.status = inDevEl && inDevEl.checked ? 'in-development' : 'live';
      draft.note = document.getElementById('f-note').value.trim();
      draft.lat = document.getElementById('f-lat').value.trim();
      draft.lon = document.getElementById('f-lon').value.trim();
    }

    function openFormModal() {
      if (!draft) resetDraft();
      if (state.region !== draft.region) {
        state.region = draft.region;
        document.querySelectorAll('#regionToggle button').forEach(b => b.classList.toggle('active', b.dataset.region === draft.region));
        renderMap();
        renderList();
      }
      const isUs = draft.region === 'us';
      const countryOptions = `<option value="__US__" ${isUs ? 'selected' : ''}>United States</option>` +
        OTHER_COUNTRIES.map(c => `<option value="${escAttr(c)}" ${!isUs && draft.country === c ? 'selected' : ''}>${escAttr(c)}</option>`).join('');

      modalPanel.innerHTML = `
        <h3>Add a site</h3>
        <p class="modal-sub">This saves straight to the shared roster — everyone who opens this map will see it.</p>
        <div class="pin-status" id="pinStatus"></div>
        <form id="addUnitForm">
          <div class="field-row">
            <label for="f-country">Country</label>
            <select id="f-country">${countryOptions}</select>
          </div>
          <div class="field-row">
            <label for="f-name">Facility / site name</label>
            <input type="text" id="f-name" required value="${escAttr(draft.name)}">
          </div>
          ${isUs ? `
          <div class="field-row split">
            <div>
              <label for="f-city">City</label>
              <input type="text" id="f-city" required value="${escAttr(draft.city)}">
            </div>
            <div>
              <label for="f-state">State</label>
              <input type="text" id="f-state" required maxlength="2" placeholder="e.g. CA" value="${escAttr(draft.state)}">
            </div>
          </div>` : `
          <div class="field-row">
            <label for="f-city">City (optional)</label>
            <input type="text" id="f-city" value="${escAttr(draft.city)}">
          </div>`}
          <div class="field-row">
            <label for="f-type">Site type</label>
            <select id="f-type">
              <option value="empath" ${draft.type === 'empath' ? 'selected' : ''}>${typeMeta.empath.label}</option>
              <option value="empath-like" ${draft.type === 'empath-like' ? 'selected' : ''}>${typeMeta['empath-like'].label}</option>
            </select>
          </div>
          <div class="field-row checkbox-row">
            <label><input type="checkbox" id="f-in-dev" ${draft.status === 'in-development' ? 'checked' : ''}> This site is still in development</label>
          </div>
          <div class="field-row split">
            <div>
              <label for="f-lat">Latitude (optional)</label>
              <input type="text" id="f-lat" placeholder="e.g. 42.3601" value="${escAttr(draft.lat)}">
            </div>
            <div>
              <label for="f-lon">Longitude (optional)</label>
              <input type="text" id="f-lon" placeholder="e.g. -71.0589" value="${escAttr(draft.lon)}">
            </div>
          </div>
          <p style="margin:-7px 0 13px;font-size:11.5px;color:var(--ink-faint);">Know the exact coordinates (e.g. from Google Maps)? Add them so this can be placed on the permanent map precisely — otherwise the team will look them up.</p>
          <div class="field-row">
            <label for="f-note">Note (optional)</label>
            <textarea id="f-note">${escAttr(draft.note)}</textarea>
          </div>
          <p class="form-error" id="formError"></p>
          <div class="modal-actions">
            <button type="button" class="btn" id="cancelModalBtn">Cancel</button>
            <button type="submit" class="btn primary" id="submitDraftBtn">Add to map</button>
          </div>
        </form>
      `;
      modalOverlay.hidden = false;
      renderPinStatus();

      document.getElementById('f-country').addEventListener('change', () => {
        captureDraftFields();
        const val = document.getElementById('f-country').value;
        draft.region = val === '__US__' ? 'us' : 'intl';
        draft.country = val === '__US__' ? '' : val;
        draft.x = null;
        draft.y = null;
        state.region = draft.region;
        document.querySelectorAll('#regionToggle button').forEach(b => b.classList.toggle('active', b.dataset.region === draft.region));
        renderMap();
        renderList();
        openFormModal();
      });
      if (isUs) {
        document.getElementById('f-state').addEventListener('input', () => {
          draft.state = document.getElementById('f-state').value.trim().toUpperCase();
          renderPinStatus();
        });
      }
      document.getElementById('f-in-dev').addEventListener('change', () => {
        draft.status = document.getElementById('f-in-dev').checked ? 'in-development' : 'live';
      });
      document.getElementById('cancelModalBtn').addEventListener('click', () => { closeModal(); draft = null; });
      document.getElementById('addUnitForm').addEventListener('submit', onSubmitDraft);
    }

    // A pin is auto-placed at the entered state/country's centroid unless the
    // user clicks through to drop it manually — "Add a site" should never
    // require a click just to get a star on the map.
    function pinStatusInfo() {
      if (draft.x != null) {
        return { cls: 'set', text: 'Custom location set on the map.', btn: 'Move pin' };
      }
      if (draft.region === 'intl') {
        const country = draft.country;
        if (!country) {
          return { cls: '', text: 'Select a country to auto-place the pin at its center.', btn: 'Place on map instead' };
        }
        if (DATA.countryCentroids && DATA.countryCentroids[country]) {
          return { cls: 'set', text: `Will auto-place at the center of ${country}.`, btn: 'Place more precisely' };
        }
        return { cls: 'warn', text: `Can't find "${country}" on the map.`, btn: 'Place it manually' };
      }
      const code = draft.state;
      if (!code) {
        return { cls: '', text: 'Enter a state to auto-place the pin at its center.', btn: 'Place on map instead' };
      }
      if (DATA.stateCentroids && DATA.stateCentroids[code]) {
        return { cls: 'set', text: `Will auto-place at the center of ${code}.`, btn: 'Place more precisely' };
      }
      return { cls: 'warn', text: `Can't find "${code}" on the map — check the state code.`, btn: 'Place it manually' };
    }

    function renderPinStatus() {
      const el = document.getElementById('pinStatus');
      if (!el) return;
      const info = pinStatusInfo();
      el.className = `pin-status ${info.cls}`;
      el.innerHTML = `<span>${escAttr(info.text)}</span><button type="button" class="btn" id="setLocationBtn" style="margin-left:auto">${escAttr(info.btn)}</button>`;
      document.getElementById('setLocationBtn').addEventListener('click', () => {
        captureDraftFields();
        beginPlacement();
      });
    }

    function beginPlacement() {
      modalOverlay.hidden = true;
      const mapPanel = document.getElementById('mapPanel');
      mapPanel.classList.add('placing');
      const banner = document.createElement('div');
      banner.className = 'placing-banner';
      banner.innerHTML = `<span>Click the map to place the pin</span><button type="button" id="cancelPlacingBtn">Cancel</button>`;
      mapPanel.appendChild(banner);

      const svg = mapPanel.querySelector('svg');

      function endPlacement() {
        svg.removeEventListener('click', onClick);
        banner.removeEventListener('click', onBannerClick);
        mapPanel.classList.remove('placing');
        banner.remove();
        openFormModal();
      }

      function onClick(evt) {
        const pt = svg.createSVGPoint();
        pt.x = evt.clientX;
        pt.y = evt.clientY;
        const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
        draft.x = +loc.x.toFixed(1);
        draft.y = +loc.y.toFixed(1);
        endPlacement();
      }

      function onBannerClick(evt) {
        if (evt.target.id === 'cancelPlacingBtn') endPlacement();
      }

      svg.addEventListener('click', onClick);
      banner.addEventListener('click', onBannerClick);
    }

    function normalizeForDedupe(s) {
      return String(s || '').trim().toLowerCase();
    }

    // Same name + state (US) or name + country (intl) already on the map
    // (roster sites or earlier custom additions this session) counts as a
    // duplicate; same name in a different state/country does not (e.g.
    // multi-state/multi-country health systems reusing a brand name).
    function findDuplicateSite(draftSite) {
      const name = normalizeForDedupe(draftSite.name);
      if (draftSite.region === 'intl') {
        const co = normalizeForDedupe(draftSite.country);
        return DATA.intlSites.find(s => normalizeForDedupe(s.name) === name && normalizeForDedupe(s.country) === co) || null;
      }
      const st = normalizeForDedupe(draftSite.state);
      return DATA.sites.find(s => normalizeForDedupe(s.name) === name && normalizeForDedupe(s.state) === st) || null;
    }

    async function onSubmitDraft(e) {
      e.preventDefault();
      captureDraftFields();
      const errEl = document.getElementById('formError');
      const isUs = draft.region === 'us';

      if (isUs) {
        if (!draft.name || !draft.city || !draft.state) {
          errEl.textContent = 'Name, city, and state are required.';
          errEl.style.display = 'block';
          return;
        }
      } else if (!draft.name || !draft.country) {
        errEl.textContent = 'Name and country are required.';
        errEl.style.display = 'block';
        return;
      }

      const dup = findDuplicateSite(draft);
      if (dup) {
        errEl.textContent = isUs
          ? `"${draft.name}" is already on the map (${dup.city}, ${dup.state}).`
          : `"${draft.name}" is already on the map (${locationLabel(dup)}).`;
        errEl.style.display = 'block';
        return;
      }

      let x = draft.x, y = draft.y, hawaii = false, alaska = false;
      if (x == null || y == null) {
        if (isUs) {
          const centroid = DATA.stateCentroids && DATA.stateCentroids[draft.state];
          if (!centroid) {
            errEl.textContent = `Can't find "${draft.state}" on the map — check the state code, or use "Place it manually" above.`;
            errEl.style.display = 'block';
            return;
          }
          x = centroid.x;
          y = centroid.y;
          hawaii = !!centroid.hawaii;
          alaska = !!centroid.alaska;
        } else {
          const centroid = DATA.countryCentroids && DATA.countryCentroids[draft.country];
          if (!centroid) {
            errEl.textContent = `Can't find "${draft.country}" on the map — use "Place it manually" above.`;
            errEl.style.display = 'block';
            return;
          }
          x = centroid.x;
          y = centroid.y;
        }
      }
      errEl.style.display = 'none';
      let latNum = draft.lat !== '' && !isNaN(parseFloat(draft.lat)) ? parseFloat(draft.lat) : null;
      let lonNum = draft.lon !== '' && !isNaN(parseFloat(draft.lon)) ? parseFloat(draft.lon) : null;
      if (latNum == null || lonNum == null) {
        // No coordinates typed in — back them out of the auto-placed pin so
        // the saved row still carries a lat/lon and lands in the same spot
        // next time anyone loads the map.
        const projector = isUs ? (hawaii ? hiProject : alaska ? akProject : usProject) : worldProject;
        const inv = projector.invert(x, y);
        if (lonNum == null) lonNum = +inv[0].toFixed(4);
        if (latNum == null) latNum = +inv[1].toFixed(4);
      }

      const submitBtn = document.getElementById('submitDraftBtn');
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
      try {
        const payload = isUs
          ? { region: 'us', name: draft.name, city: draft.city, state: draft.state, type: draft.type, status: draft.status, note: draft.note, lat: latNum, lon: lonNum }
          : { region: 'intl', name: draft.name, city: draft.city, country: draft.country, type: draft.type, status: draft.status, note: draft.note, lat: latNum, lon: lonNum };
        const created = await saveSite(payload);
        const newSite = siteFromRow(created);
        newSite._id = 'site-db-' + newSite._dbId;
        newSite.custom = true;
        if (newSite.region === 'intl') {
          DATA.intlSites.push(newSite);
        } else {
          DATA.sites.push(newSite);
        }

        renderStats();
        updateChipCounts();
        renderMap();
        renderList();
        draft = null;
        openConfirmModal(newSite);
      } catch (err) {
        console.warn('Failed to save site', err);
        errEl.textContent = "Couldn't save to the shared roster — check your connection and try again. Your entries above are still filled in.";
        errEl.style.display = 'block';
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Add to map';
      }
    }

    function copyTextareaToClipboard(textareaId, btn, defaultLabel) {
      const ta = document.getElementById(textareaId);
      ta.select();
      const flash = () => { btn.textContent = 'Copied!'; setTimeout(() => { btn.textContent = defaultLabel; }, 1500); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(ta.value).then(flash).catch(() => { document.execCommand('copy'); flash(); });
      } else {
        document.execCommand('copy');
        flash();
      }
    }

    function openConfirmModal(site) {
      const summary = [
        `Site: ${site.name}`,
        `Location: ${locationLabel(site)}`,
        `Type: ${typeMeta[site.type].label}`,
        site.note ? `Note: ${site.note}` : null,
      ].filter(Boolean).join('\n');

      modalPanel.innerHTML = `
        <h3>Added to the shared map</h3>
        <p class="modal-sub">Saved to the shared roster — everyone who opens this map will see it, right away.</p>
        <div class="confirm-block">
          <textarea readonly id="summaryText">${summary}</textarea>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" id="copySummaryBtn">Copy summary</button>
          <button type="button" class="btn primary" id="doneConfirmBtn">Done</button>
        </div>
      `;
      modalOverlay.hidden = false;
      document.getElementById('doneConfirmBtn').addEventListener('click', closeModal);
      document.getElementById('copySummaryBtn').addEventListener('click', (evt) => {
        copyTextareaToClipboard('summaryText', evt.target, 'Copy summary');
      });
    }

    addUnitBtn.addEventListener('click', () => { resetDraft(); openFormModal(); });
    modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
    const onKeyDown = (e) => { if (e.key === 'Escape' && !modalOverlay.hidden) closeModal(); };
    document.addEventListener('keydown', onKeyDown);

    document.getElementById('regionToggle').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      state.region = btn.dataset.region;
      document.querySelectorAll('#regionToggle button').forEach(b => b.classList.toggle('active', b === btn));
      renderMap();
      renderList();
    });

    document.getElementById('searchBox').addEventListener('input', (e) => {
      state.query = e.target.value.trim();
      renderMap();
      renderList();
    });

    document.getElementById('resetBtn').addEventListener('click', () => {
      state.types = new Set(['empath', 'empath-like']);
      state.query = '';
      document.getElementById('searchBox').value = '';
      document.querySelectorAll('input[data-kind]').forEach(el => el.checked = true);
      renderMap();
      renderList();
    });

    renderStats();
    renderChips();
    renderMap();
    renderList();
    loadSites();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [initialSites]);

  return null;
}

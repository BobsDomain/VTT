// Side panels that pop out (1.20.1, request #4): every section of the right-hand panel gets ⧉ (float it over the map)
// and ⠿ (drag to reorder it in the sidebar). A floating window can be moved, resized, docked back with ⇲, or dropped
// back onto the sidebar where you want it. Layout is remembered on this PC, separately for the DM and for players.
// The sections themselves are moved, not copied, so everything in them keeps working.
// 1.24.3 (#24): ✕ hides a panel completely; 🗂 Panels on the bar left of the map brings hidden ones back.
const PANELS = [
  ['initSec', 'Initiative'], ['startSec', 'Combat'], ['editSec', 'Selected token'], ['partySec', 'Party'], ['handoutSec', 'Handouts'],
  ['itemSec', 'Items'], ['charSec', 'My character'], ['diceSec', 'Dice'], ['macroSec', 'My quick rolls'], ['addSec', 'Add tokens'], ['chatSec', 'Chat and rolls']
];
const NAME = Object.fromEntries(PANELS);
let key = '', layout = { order: [], float: {}, hidden: [] }, zTop = 30, started = false, isDM = false;
const $ = (id) => document.getElementById(id);
const scroll = () => document.querySelector('aside .scroll');
const load = () => { try { const v = JSON.parse(localStorage.getItem(key) || 'null'); if (v && typeof v === 'object') layout = { hidden: Array.isArray(v.hidden) ? v.hidden : [], order: Array.isArray(v.order) ? v.order : [], float: v.float && typeof v.float === 'object' ? v.float : {} }; } catch { /* no storage */ } };
const store = () => { try { localStorage.setItem(key, JSON.stringify(layout)); } catch { /* no storage */ } };
const docked = () => [...scroll().children].filter((e) => e.tagName === 'SECTION' && e.id);

// is this section meant to be showing right now (combat on, a token selected, the DM's own panels)?
const showing = (sec) => !sec.hidden && !sec.classList.contains('userhidden') && getComputedStyle(sec).display !== 'none';
const wins = new Map(); // section id → its floating window
function syncWin(id) {
  const w = wins.get(id), sec = $(id); if (!w || !sec) return;
  w.hidden = !showing(sec);
  const t = sec.id === 'editSec' ? ($('editTitle') || {}).textContent : '';
  w.querySelector('.fwbar b').textContent = t || NAME[id] || id;
}
const watcher = new MutationObserver((list) => { for (const m of list) if (wins.has(m.target.id)) syncWin(m.target.id); });

function buttons(sec) {
  if (sec.querySelector(':scope > .panbtns')) return;
  const box = document.createElement('div'); box.className = 'panbtns';
  if (sec.id !== 'chatSec') {
    const grip = document.createElement('button'); grip.className = 'grip'; grip.textContent = '⠿'; grip.title = 'Drag to move this panel up or down the sidebar';
    grip.onmousedown = () => { sec.draggable = true; }; grip.onmouseup = () => { sec.draggable = false; };
    box.append(grip);
  }
  const pop = document.createElement('button'); pop.textContent = '⧉'; pop.title = 'Pop out into its own window over the map';
  pop.onclick = (e) => { e.stopPropagation(); const r = sec.getBoundingClientRect(); floatOut(sec.id, { x: Math.max(8, r.left - 340), y: Math.max(60, r.top), w: 300, h: Math.min(520, Math.max(160, r.height + 40)) }); };
  box.append(pop, hideButton(sec.id));
  sec.prepend(box);
}

// ----- hiding a panel completely (#24) -----
function hideButton(id) {
  const b = document.createElement('button'); b.className = 'panhide'; b.textContent = '✕'; b.title = 'Hide this panel (🗂 Panels, on the bar left of the map, brings it back)';
  b.onclick = (e) => { e.stopPropagation(); setHidden(id, true); };
  return b;
}
function setHidden(id, on) {
  layout.hidden = layout.hidden.filter((x) => x !== id); if (on) layout.hidden.push(id);
  store(); applyHidden(); renderMenu();
}
function applyHidden() {
  for (const [id] of PANELS) { const s = $(id); if (s) s.classList.toggle('userhidden', layout.hidden.includes(id)); if (wins.has(id)) syncWin(id); }
  const n = layout.hidden.filter((id) => mine(id)).length, badge = $('panelsBadge'), btn = $('panelsBtn');
  if (badge) badge.textContent = n ? String(n) : '';
  if (btn) btn.classList.toggle('has', n > 0);
}
// the panels this person has: the DM's own ones, or a player's
const mine = (id) => { const s = $(id); if (!s) return false; if (isDM) return id !== 'charSec' && id !== 'macroSec'; return !s.classList.contains('dm-only'); };
function renderMenu() {
  const box = $('panelsList'); if (!box) return; box.innerHTML = '';
  for (const [id, name] of PANELS) {
    if (!mine(id)) continue;
    const row = document.createElement('label'); row.className = 'check';
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !layout.hidden.includes(id); cb.onchange = () => setHidden(id, !cb.checked);
    row.append(cb, document.createTextNode(' ' + name)); box.append(row);
  }
}
function wireMenu() {
  const btn = $('panelsBtn'), pop = $('panelsPop'); if (!btn || !pop) return;
  btn.onclick = (e) => { e.stopPropagation(); renderMenu(); pop.hidden = !pop.hidden; if (!pop.hidden) { const r = btn.getBoundingClientRect(); pop.style.left = (r.right + 8) + 'px'; pop.style.top = Math.max(8, Math.min(r.top, window.innerHeight - pop.offsetHeight - 8)) + 'px'; } };
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && e.target !== btn && !btn.contains(e.target)) pop.hidden = true; });
  const all = $('panelsShowAll'); if (all) all.onclick = () => { layout.hidden = []; store(); applyHidden(); renderMenu(); };
}

// ----- reordering in the sidebar by dragging ⠿ -----
function wireDrag(sec) {
  sec.addEventListener('dragstart', (e) => { if (!sec.draggable) return; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', 'panel:' + sec.id); sec.classList.add('dragging'); });
  sec.addEventListener('dragend', () => { sec.draggable = false; sec.classList.remove('dragging'); clearMarks(); });
}
const clearMarks = () => document.querySelectorAll('.dropbefore, .dropafter').forEach((x) => x.classList.remove('dropbefore', 'dropafter'));
function dropSpot(y) { // the docked section to go before, by height
  for (const s of docked()) { if (s.classList.contains('dragging') || !showing(s)) continue; const r = s.getBoundingClientRect(); if (y < r.top + r.height / 2) return s; }
  return null;
}
function wireSidebar() {
  const sc = scroll();
  sc.addEventListener('dragover', (e) => {
    if (![...e.dataTransfer.types].includes('text/plain')) return;
    e.preventDefault(); clearMarks();
    const before = dropSpot(e.clientY), list = docked().filter((s) => showing(s) && !s.classList.contains('dragging'));
    if (before) before.classList.add('dropbefore'); else if (list.length) list[list.length - 1].classList.add('dropafter');
  });
  sc.addEventListener('drop', (e) => {
    const v = e.dataTransfer.getData('text/plain'); if (!v.startsWith('panel:')) return;
    e.preventDefault(); clearMarks();
    const sec = $(v.slice(6)); if (!sec) return;
    const before = dropSpot(e.clientY); if (before && before !== sec) sc.insertBefore(sec, before); else if (!before) sc.append(sec);
    saveOrder();
  });
}
const saveOrder = () => { layout.order = docked().map((s) => s.id); store(); };

// ----- floating windows -----
function floatOut(id, pos, quiet) {
  const sec = $(id); if (!sec || wins.has(id)) return;
  const p = { ...pos }, vw = window.innerWidth, vh = window.innerHeight;
  p.w = Math.min(Math.max(220, p.w || 300), vw - 16); p.h = Math.min(Math.max(90, p.h || 300), vh - 16);
  p.x = Math.min(Math.max(0, p.x || 40), vw - 120); p.y = Math.max(0, Math.min(p.y || 80, vh - p.h - 8)); // all of it on screen
  const w = document.createElement('div'); w.className = 'floatwin'; w.dataset.panel = id;
  Object.assign(w.style, { left: p.x + 'px', top: p.y + 'px', width: p.w + 'px', height: p.h + 'px', zIndex: ++zTop });
  const bar = document.createElement('div'); bar.className = 'fwbar';
  const title = document.createElement('b'); title.textContent = NAME[id] || id;
  const dock = document.createElement('button'); dock.textContent = '⇲'; dock.title = 'Put it back in the sidebar (or drag this bar onto the sidebar)';
  dock.onclick = () => dockIn(id);
  bar.append(title, dock, hideButton(id));
  const body = document.createElement('div'); body.className = 'fwbody';
  if (id === 'chatSec') sec.dataset.home = 'aside'; // the chat lives below the scrolling panels
  body.append(sec); w.append(bar, body); $('floats').append(w);
  wins.set(id, w); watcher.observe(sec, { attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
  if ($('editTitle') && id === 'editSec') watcher.observe($('editTitle'), { childList: true });
  syncWin(id);
  w.addEventListener('pointerdown', () => { w.style.zIndex = ++zTop; });
  // move by the title bar; let go over the sidebar to dock it there
  bar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const sx = e.clientX, sy = e.clientY, ox = w.offsetLeft, oy = w.offsetTop, aside = document.querySelector('aside');
    bar.setPointerCapture(e.pointerId);
    const move = (ev) => {
      w.style.left = Math.min(Math.max(0, ox + ev.clientX - sx), window.innerWidth - 80) + 'px';
      w.style.top = Math.min(Math.max(0, oy + ev.clientY - sy), window.innerHeight - 30) + 'px';
      const r = aside.getBoundingClientRect(); aside.classList.toggle('dockhere', ev.clientX >= r.left && id !== 'chatSec');
    };
    const up = (ev) => {
      bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', up);
      const r = aside.getBoundingClientRect(), over = ev.clientX >= r.left && id !== 'chatSec'; aside.classList.remove('dockhere');
      if (over) return dockIn(id, dropSpot(ev.clientY));
      remember(id);
    };
    bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', up);
  });
  new ResizeObserver(() => { if (wins.get(id) === w && !w.hidden) remember(id); }).observe(w);
  if (!quiet) remember(id);
}
function remember(id) {
  const w = wins.get(id); if (!w) return;
  layout.float[id] = { x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight };
  store();
}
function dockIn(id, before) {
  const w = wins.get(id), sec = $(id); if (!w || !sec) return;
  wins.delete(id); delete layout.float[id];
  if (id === 'chatSec') document.querySelector('aside').append(sec);
  else {
    // where it belongs: the spot it was dropped on, or back in its saved place in the order
    const sc = scroll(), order = layout.order.length ? layout.order : PANELS.map((p) => p[0]);
    if (!before) { const after = order.slice(order.indexOf(id) + 1); before = docked().find((s) => after.includes(s.id)) || null; }
    if (before) sc.insertBefore(sec, before); else sc.append(sec);
    saveOrder();
  }
  w.remove(); store();
}

// put everything where it was last time
export function initPanels(dm) {
  if (started || !scroll() || !$('floats')) return;
  isDM = !!dm; started = true; key = 'tt-panels-' + (isDM ? 'dm' : 'player'); load();
  for (const [id] of PANELS) { const s = $(id); if (s) { buttons(s); if (id !== 'chatSec') wireDrag(s); } }
  wireSidebar();
  const sc = scroll();
  for (const id of layout.order) { const s = $(id); if (s && s.parentElement === sc) sc.append(s); }
  for (const [id, p] of Object.entries(layout.float)) floatOut(id, p, true);
  wireMenu(); applyHidden();
  // a tidy-up when the window size changes: keep floating windows on screen
  window.addEventListener('resize', () => { for (const [id, w] of wins) { w.style.left = Math.min(w.offsetLeft, window.innerWidth - 120) + 'px'; w.style.top = Math.min(w.offsetTop, window.innerHeight - 60) + 'px'; remember(id); } });
}
// everything back in the sidebar, in the usual order
export function resetPanels() {
  for (const id of [...wins.keys()]) dockIn(id);
  layout = { order: [], float: {}, hidden: [] }; store(); applyHidden(); renderMenu();
  const sc = scroll(); for (const [id] of PANELS) { const s = $(id); if (s && s.parentElement === sc) sc.append(s); }
}

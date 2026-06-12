'use strict';

/* Poetry Feed — a static, GitHub-Pages-ready swipe feed of Hebrew poetry.
   No framework, no build step. Content: assets produced by scripts/build_corpus.py
   from the Project Ben-Yehuda public-domain dump. */

const DATA_URL = 'poems.json';
const STORE_KEY = 'poetryfeed/v1';
const BATCH = 6; // poems appended per chunk
const MAX_SECTIONS = 42; // sliding-window cap before pruning the top

const LANG_HE = {
  de: 'גרמנית', ru: 'רוסית', en: 'אנגלית', fr: 'צרפתית', la: 'לטינית',
  yi: 'יידיש', grc: 'יוונית עתיקה', pl: 'פולנית', ar: 'ערבית', da: 'דנית',
  no: 'נורווגית', it: 'איטלקית', es: 'ספרדית', hu: 'הונגרית',
};

let POEMS = [];
let byId = new Map();
let deck = []; // shuffled, filtered
let tailIndex = 0; // next deck index to render
let state = loadState();
let io = null;

const $ = (sel) => document.querySelector(sel);
const feed = $('#feed');

init();

async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    POEMS = await res.json();
  } catch (e) {
    showError(e);
    return;
  }
  byId = new Map(POEMS.map((p) => [p.id, p]));

  applySettingsToUI();
  buildDeck();
  io = new IntersectionObserver(onIntersect, { root: feed, threshold: [0.6] });
  renderInitial();
  wireEvents();

  $('#loading').hidden = true;
  feed.hidden = false;
  $('#topbar').hidden = false;
}

/* ---------- state ---------- */
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return {
      saved: new Set(s.saved || []),
      seen: new Set(s.seen || []),
      settings: {
        nikkud: s.settings && typeof s.settings.nikkud === 'boolean' ? s.settings.nikkud : true,
        filter: (s.settings && s.settings.filter) || 'all',
      },
    };
  } catch {
    return { saved: new Set(), seen: new Set(), settings: { nikkud: true, filter: 'all' } };
  }
}

let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        saved: [...state.saved],
        seen: [...state.seen].slice(-5000),
        settings: state.settings,
      }),
    );
  }, 500);
}

/* ---------- deck ---------- */
function pool() {
  const f = state.settings.filter;
  if (f === 'original') return POEMS.filter((p) => !p.is_translation);
  if (f === 'translated') return POEMS.filter((p) => p.is_translation);
  return POEMS;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function buildDeck() {
  const p = pool();
  const unseen = shuffle(p.filter((x) => !state.seen.has(x.id)));
  const seen = shuffle(p.filter((x) => state.seen.has(x.id)));
  deck = unseen.concat(seen);
  tailIndex = 0;
}
function extendDeck() {
  const more = shuffle(pool().slice());
  if (more.length > 1 && deck.length && more[0].id === deck[deck.length - 1].id) {
    [more[0], more[1]] = [more[1], more[0]];
  }
  deck = deck.concat(more);
}

/* ---------- rendering ---------- */
function bodyText(p) {
  return (state.settings.nikkud ? p.body_nikkud : p.body_plain) || p.body_plain;
}
function lenClass(n) {
  if (n <= 6) return 'len-s';
  if (n <= 12) return 'len-m';
  if (n <= 20) return 'len-l';
  return 'len-xl';
}
function transLabel(p) {
  const from = p.original_language && LANG_HE[p.original_language]
    ? 'מתורגם מ' + LANG_HE[p.original_language]
    : 'מתורגם';
  return from + (p.translator ? ' · תרגום: ' + p.translator : '');
}

function poemSection(p) {
  const sec = document.createElement('section');
  sec.className = 'poem ' + lenClass(p.length_lines);
  sec.dataset.id = p.id;
  const saved = state.saved.has(p.id);
  sec.innerHTML =
    '<div class="poem-main">' +
    '<div class="poem-title"></div>' +
    '<div class="poem-body"></div>' +
    '<div class="poem-byline"><div class="poem-author"></div>' +
    (p.is_translation ? '<div class="poem-trans"></div>' : '') +
    '</div></div>' +
    '<div class="poem-actions">' +
    '<button class="act act-heart' + (saved ? ' on' : '') + '" data-act="save">' + (saved ? '♥' : '♡') + '</button>' +
    '<button class="act" data-act="share">שיתוף</button>' +
    '<button class="act" data-act="source">מקור</button>' +
    '</div>';
  sec.querySelector('.poem-title').textContent = p.title;
  sec.querySelector('.poem-body').textContent = bodyText(p);
  sec.querySelector('.poem-author').textContent = p.author;
  if (p.is_translation) sec.querySelector('.poem-trans').textContent = transLabel(p);
  return sec;
}

function appendBatch() {
  const frag = document.createDocumentFragment();
  const fresh = [];
  for (let k = 0; k < BATCH; k++) {
    if (tailIndex >= deck.length) extendDeck();
    if (tailIndex >= deck.length) break; // empty pool — nothing to render
    const sec = poemSection(deck[tailIndex++]);
    fresh.push(sec);
    frag.appendChild(sec);
  }
  feed.appendChild(frag);
  fresh.forEach((s) => io.observe(s));
  pruneTop();
}

function pruneTop() {
  const extra = feed.children.length - MAX_SECTIONS;
  if (extra <= 0) return;
  const h = feed.clientHeight; // every section is exactly one viewport tall
  for (let i = 0; i < extra; i++) {
    const first = feed.firstElementChild;
    io.unobserve(first);
    feed.removeChild(first);
  }
  // Keep the current poem aligned: we removed `extra` viewport-tall sections.
  feed.scrollTop -= extra * h;
}

function renderInitial() {
  io.disconnect();
  feed.innerHTML = '';
  tailIndex = 0;
  appendBatch();
  appendBatch();
  feed.scrollTop = 0;
}

function onIntersect(entries) {
  for (const e of entries) {
    if (!e.isIntersecting || e.intersectionRatio < 0.6) continue;
    const sec = e.target;
    markSeen(sec.dataset.id);
    let after = 0;
    let n = sec;
    while (n.nextElementSibling) { after++; n = n.nextElementSibling; }
    if (after < 3) appendBatch();
  }
}

function markSeen(id) {
  if (!state.seen.has(id)) {
    state.seen.add(id);
    persist();
  }
}

/* ---------- actions ---------- */
function setHeart(id, on) {
  document.querySelectorAll('.poem').forEach((sec) => {
    if (sec.dataset.id === id) {
      const h = sec.querySelector('.act-heart');
      h.classList.toggle('on', on);
      h.textContent = on ? '♥' : '♡';
    }
  });
}
function toggleSave(p) {
  if (state.saved.has(p.id)) state.saved.delete(p.id);
  else state.saved.add(p.id);
  setHeart(p.id, state.saved.has(p.id));
  persist();
}
async function sharePoem(p) {
  const text = p.title + '\n' + p.author + '\n\n' + p.body_plain +
    '\n\n— מתוך מיזם בן-יהודה\n' + p.source_url;
  if (navigator.share) {
    try { await navigator.share({ title: p.title, text }); } catch {}
  } else {
    try { await navigator.clipboard.writeText(text); toast('השיר הועתק'); }
    catch { window.open(p.source_url, '_blank', 'noopener'); }
  }
}

/* ---------- panels ---------- */
function openPanel(sel) { $(sel).hidden = false; }
function closePanels() {
  ['#settings-panel', '#saved-panel', '#reader'].forEach((s) => ($(s).hidden = true));
}

function renderSaved() {
  const ul = $('#saved-list');
  ul.innerHTML = '';
  const items = [...state.saved].map((id) => byId.get(id)).filter(Boolean).reverse();
  $('#saved-empty').hidden = items.length > 0;
  items.forEach((p) => {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    li.innerHTML = '<button class="s-remove" data-remove aria-label="הסרה">✕</button>' +
      '<div class="s-title"></div><div class="s-author"></div>';
    li.querySelector('.s-title').textContent = p.title;
    li.querySelector('.s-author').textContent = p.author + (p.is_translation ? ' · מתורגם' : '');
    ul.appendChild(li);
  });
}

function openReader(p) {
  const el = $('#reader-body');
  el.dataset.id = p.id;
  el.innerHTML = '<div class="poem-title"></div><div class="poem-body"></div>' +
    '<div class="poem-byline"><div class="poem-author"></div>' +
    (p.is_translation ? '<div class="poem-trans"></div>' : '') +
    '</div><div class="poem-actions">' +
    '<button class="act" data-r="share">שיתוף</button>' +
    '<button class="act" data-r="source">מקור</button></div>';
  el.querySelector('.poem-title').textContent = p.title;
  el.querySelector('.poem-body').textContent = bodyText(p);
  el.querySelector('.poem-author').textContent = p.author;
  if (p.is_translation) el.querySelector('.poem-trans').textContent = transLabel(p);
  el.querySelector('[data-r="share"]').onclick = () => sharePoem(p);
  el.querySelector('[data-r="source"]').onclick = () => window.open(p.source_url, '_blank', 'noopener');
  openPanel('#reader');
}

/* ---------- settings UI ---------- */
function applySettingsToUI() {
  $('#nikkud-toggle').checked = state.settings.nikkud;
  updateSegUI();
}
function updateSegUI() {
  document.querySelectorAll('#filter-segment .seg-btn').forEach((b) => {
    b.classList.toggle('on', b.dataset.filter === state.settings.filter);
  });
}

/* ---------- events ---------- */
function wireEvents() {
  feed.addEventListener('click', (e) => {
    const btn = e.target.closest('.act');
    if (!btn) return;
    const sec = e.target.closest('.poem');
    const p = byId.get(sec.dataset.id);
    if (!p) return;
    const act = btn.dataset.act;
    if (act === 'save') toggleSave(p);
    else if (act === 'share') sharePoem(p);
    else if (act === 'source') window.open(p.source_url, '_blank', 'noopener');
  });

  $('#nikkud-toggle').addEventListener('change', (e) => {
    state.settings.nikkud = e.target.checked;
    persist();
    document.querySelectorAll('.poem').forEach((sec) => {
      const p = byId.get(sec.dataset.id);
      if (p) sec.querySelector('.poem-body').textContent = bodyText(p);
    });
    const readerBody = $('#reader-body');
    const rp = readerBody && byId.get(readerBody.dataset.id);
    if (rp && !$('#reader').hidden) {
      readerBody.querySelector('.poem-body').textContent = bodyText(rp);
    }
  });

  $('#filter-segment').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    state.settings.filter = b.dataset.filter;
    persist();
    updateSegUI();
    buildDeck();
    renderInitial();
  });

  $('#open-settings').addEventListener('click', () => {
    $('#corpus-count').textContent =
      POEMS.length.toLocaleString('he') + ' שירים · ' +
      POEMS.filter((p) => p.is_translation).length + ' מתורגמים';
    openPanel('#settings-panel');
  });
  $('#open-saved').addEventListener('click', () => {
    renderSaved();
    openPanel('#saved-panel');
  });

  $('#saved-list').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const p = byId.get(li.dataset.id);
    if (!p) return;
    if (e.target.closest('[data-remove]')) {
      state.saved.delete(p.id);
      setHeart(p.id, false);
      persist();
      renderSaved();
    } else {
      openReader(p);
    }
  });

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanels));
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.addEventListener('click', (e) => {
      if (e.target === panel) closePanels();
    });
  });
}

/* ---------- misc ---------- */
let toastTimer = null;
function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText =
      'position:fixed;bottom:84px;left:50%;transform:translateX(-50%);background:var(--ink);' +
      'color:var(--bg);padding:9px 16px;border-radius:999px;font-size:0.9rem;z-index:40;' +
      'opacity:0;transition:opacity .2s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.opacity = '0'), 1600);
}

function showError(e) {
  const l = $('#loading');
  l.innerHTML =
    '<p style="font-size:1.1rem">לא הצלחנו לטעון את השירים</p>' +
    '<p style="font-size:0.85rem;color:var(--ink-faint)">' + (e && e.message ? e.message : '') + '</p>';
}

'use strict';

/* Poetry Feed — Tinder-style swipe deck with an on-device learner.
   Swipe right = like (train +), left = dislike (train −). The recommender
   (recommender.js) ranks unseen poems by predicted taste, with some
   exploration. All state — likes, dislikes, model weights — lives in
   localStorage. No server. */

const DATA_URL = 'poems.json';
const STORE_KEY = 'poetryfeed/v2';
const EPSILON = 0.2; // exploration rate
const CAND = 250; // candidates scored per pick

const LANG_HE = {
  de: 'גרמנית', ru: 'רוסית', en: 'אנגלית', fr: 'צרפתית', la: 'לטינית',
  yi: 'יידיש', grc: 'יוונית עתיקה', pl: 'פולנית', ar: 'ערבית', da: 'דנית',
  no: 'נורווגית', it: 'איטלקית', es: 'ספרדית', hu: 'הונגרית',
};

let POEMS = [];
let byId = new Map();
let model = null;
let queue = []; // upcoming poems (front = queue[0])
let lastAction = null; // single-level undo
let state = loadState();

const $ = (s) => document.querySelector(s);
const stack = $('#stack');

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
  model = new Recommender(state.weights);

  applySettingsToUI();
  fillQueue();
  render();
  wireEvents();

  $('#loading').hidden = true;
  $('#stage').hidden = false;
}

/* ---------- state ---------- */
function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY)) || {};
    return {
      liked: new Set(s.liked || []),
      disliked: new Set(s.disliked || []),
      seen: new Set(s.seen || []),
      weights: s.weights || {},
      settings: {
        nikkud: s.settings && typeof s.settings.nikkud === 'boolean' ? s.settings.nikkud : true,
        filter: (s.settings && s.settings.filter) || 'all',
      },
    };
  } catch {
    return { liked: new Set(), disliked: new Set(), seen: new Set(), weights: {}, settings: { nikkud: true, filter: 'all' } };
  }
}
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify({
      liked: [...state.liked],
      disliked: [...state.disliked],
      seen: [...state.seen].slice(-6000),
      weights: model.w,
      settings: state.settings,
    }));
  }, 400);
}

/* ---------- recommender pick ---------- */
function matchesFilter(p) {
  const f = state.settings.filter;
  if (f === 'original') return !p.is_translation;
  if (f === 'translated') return p.is_translation;
  return true;
}
function pickNext(exclude) {
  let pool = POEMS.filter((p) => matchesFilter(p) && !state.seen.has(p.id) && !exclude.has(p.id));
  if (!pool.length) pool = POEMS.filter((p) => matchesFilter(p) && !exclude.has(p.id)); // seen them all → reuse
  if (!pool.length) return null;

  if (Math.random() < EPSILON) return pool[(Math.random() * pool.length) | 0];

  // score a random candidate sample, keep the best few, pick among them
  const n = Math.min(CAND, pool.length);
  let best = null;
  let bestScore = -Infinity;
  const top = [];
  for (let i = 0; i < n; i++) {
    const p = pool[(Math.random() * pool.length) | 0];
    const s = model.prob(recFeatures(p));
    if (s > bestScore) { bestScore = s; best = p; }
    top.push([s, p]);
  }
  top.sort((a, b) => b[0] - a[0]);
  const k = Math.min(3, top.length);
  return top[(Math.random() * k) | 0][1] || best;
}
function queuedIds() {
  return new Set(queue.map((p) => p.id));
}
function fillQueue() {
  while (queue.length < 3) {
    const p = pickNext(queuedIds());
    if (!p) break;
    queue.push(p);
  }
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
    ? 'מתורגם מ' + LANG_HE[p.original_language] : 'מתורגם';
  return from + (p.translator ? ' · תרגום: ' + p.translator : '');
}
function makeCard(p, depthClass) {
  const card = document.createElement('article');
  card.className = 'card ' + lenClass(p.length_lines) + (depthClass ? ' ' + depthClass : '');
  card.dataset.id = p.id;
  card.innerHTML =
    '<div class="ov ov-like">אהבתי</div><div class="ov ov-nope">לא</div>' +
    '<div class="card-main"><div class="poem-title"></div><div class="poem-body"></div>' +
    '<div class="poem-byline"><div class="poem-author"></div>' +
    (p.is_translation ? '<div class="poem-trans"></div>' : '') +
    '</div></div>' +
    '<div class="card-foot"><button data-act="share">שיתוף</button><button data-act="source">מקור</button></div>';
  card.querySelector('.poem-title').textContent = p.title;
  card.querySelector('.poem-body').textContent = bodyText(p);
  card.querySelector('.poem-author').textContent = p.author;
  if (p.is_translation) card.querySelector('.poem-trans').textContent = transLabel(p);
  return card;
}
function render() {
  stack.innerHTML = '';
  if (!queue.length) {
    stack.innerHTML = '<div class="empty" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center">אין שירים בסינון הזה.</div>';
    return;
  }
  // back-to-front so the front card is last in the DOM (on top)
  const depth = ['behind2', 'behind', ''];
  for (let i = Math.min(queue.length, 3) - 1; i >= 0; i--) {
    stack.appendChild(makeCard(queue[i], depth[2 - i]));
  }
  attachGestures(stack.lastElementChild);
}

/* ---------- swipe gestures ---------- */
function attachGestures(card) {
  if (!card) return;
  const body = card.querySelector('.poem-body');
  const likeOv = card.querySelector('.ov-like');
  const nopeOv = card.querySelector('.ov-nope');
  let startX = 0, startY = 0, lastY = 0, dx = 0, dy = 0, decided = false, horizontal = false, active = false;
  const width = () => stack.clientWidth || 360;
  const THRESH = () => width() * 0.25;

  card.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.card-foot')) return; // let share/source buttons work
    active = true; decided = false; horizontal = false;
    startX = e.clientX; startY = e.clientY; lastY = e.clientY; dx = 0; dy = 0;
    card.classList.remove('snap');
    // Capture so a horizontal swipe is recognised wherever it starts on the card
    // (the body's scroll can't steal it — touch-action is none; we scroll in JS).
    try { card.setPointerCapture(e.pointerId); } catch {}
  });
  card.addEventListener('pointermove', (e) => {
    if (!active) return;
    dx = e.clientX - startX; dy = e.clientY - startY;
    if (!decided) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      decided = true;
      horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (horizontal) {
      card.style.transform = `translate(${dx}px, ${dy * 0.12}px) rotate(${dx * 0.05}deg)`;
      const t = THRESH();
      likeOv.style.opacity = dx > 0 ? Math.min(dx / t, 1) : 0;
      nopeOv.style.opacity = dx < 0 ? Math.min(-dx / t, 1) : 0;
    } else if (body) {
      body.scrollTop -= e.clientY - lastY; // vertical → scroll the poem ourselves
    }
    lastY = e.clientY;
  });
  const end = () => {
    if (!active) return;
    active = false;
    if (horizontal && Math.abs(dx) > THRESH()) {
      commit(dx > 0 ? 'like' : 'nope');
    } else {
      card.classList.add('snap');
      card.style.transform = '';
      likeOv.style.opacity = 0; nopeOv.style.opacity = 0;
    }
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
}

/* ---------- commit / like / dislike ---------- */
function commit(kind) {
  const p = queue[0];
  if (!p) return;
  const front = stack.lastElementChild;
  if (front) front.classList.add(kind === 'like' ? 'gone-r' : 'gone-l');

  const y = kind === 'like' ? 1 : 0;
  const deltas = model.update(recFeatures(p), y);
  state.seen.add(p.id);
  if (y === 1) state.liked.add(p.id); else state.disliked.add(p.id);
  lastAction = { id: p.id, y, deltas };

  queue.shift();
  fillQueue();
  persist();
  // let the fling animation play before re-stacking
  setTimeout(render, 180);
}
function undo() {
  if (!lastAction) return;
  const p = byId.get(lastAction.id);
  model.undo(lastAction.deltas);
  state.seen.delete(lastAction.id);
  if (lastAction.y === 1) state.liked.delete(lastAction.id);
  else state.disliked.delete(lastAction.id);
  queue.unshift(p);
  lastAction = null;
  persist();
  render();
}

/* ---------- actions on a poem ---------- */
async function sharePoem(p) {
  const text = p.title + '\n' + p.author + '\n\n' + p.body_plain +
    '\n\n— מתוך מיזם בן-יהודה\n' + p.source_url;
  if (navigator.share) { try { await navigator.share({ title: p.title, text }); } catch {} }
  else { try { await navigator.clipboard.writeText(text); toast('השיר הועתק'); } catch { window.open(p.source_url, '_blank', 'noopener'); } }
}

/* ---------- panels ---------- */
function openPanel(s) { $(s).hidden = false; }
function closePanels() { ['#settings-panel', '#liked-panel', '#reader'].forEach((s) => ($(s).hidden = true)); }

function renderLiked() {
  const ul = $('#liked-list');
  ul.innerHTML = '';
  const items = [...state.liked].map((id) => byId.get(id)).filter(Boolean).reverse();
  $('#liked-empty').hidden = items.length > 0;
  items.forEach((p) => {
    const li = document.createElement('li');
    li.dataset.id = p.id;
    li.innerHTML = '<button class="s-remove" data-remove aria-label="הסרה">✕</button><div class="s-title"></div><div class="s-author"></div>';
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
    (p.is_translation ? '<div class="poem-trans"></div>' : '') + '</div>' +
    '<div class="card-foot"><button data-r="share">שיתוף</button><button data-r="source">מקור</button></div>';
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
  updateLearned();
}
function updateSegUI() {
  document.querySelectorAll('#filter-segment .seg-btn').forEach((b) => {
    b.classList.toggle('on', b.dataset.filter === state.settings.filter);
  });
}
function updateLearned() {
  const tastes = model ? model.topTastes(5) : [];
  const n = state.liked.size + state.disliked.size;
  const el = $('#learned');
  if (n < 4) el.textContent = 'עוד מעט… החליקו על כמה שירים ואלמד מה אתם אוהבים.';
  else if (!tastes.length) el.textContent = 'לומד… (' + n + ' החלקות)';
  else el.textContent = 'נראה שאתם נמשכים אל: ' + tastes.join(' · ') + '.';
}

/* ---------- events ---------- */
function wireEvents() {
  // per-card foot buttons (share/source)
  stack.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const p = byId.get(e.target.closest('.card').dataset.id);
    if (!p) return;
    if (b.dataset.act === 'share') sharePoem(p);
    else window.open(p.source_url, '_blank', 'noopener');
  });

  // Keyboard shortcuts for desktop (the on-screen buttons are gone):
  // → like, ← dislike, Backspace/u undo.
  document.addEventListener('keydown', (e) => {
    if (!$('#settings-panel').hidden || !$('#liked-panel').hidden || !$('#reader').hidden) return;
    if (e.key === 'ArrowRight') commit('like');
    else if (e.key === 'ArrowLeft') commit('nope');
    else if (e.key === 'Backspace' || e.key === 'u') undo();
  });

  $('#nikkud-toggle').addEventListener('change', (e) => {
    state.settings.nikkud = e.target.checked;
    persist();
    document.querySelectorAll('.card').forEach((card) => {
      const p = byId.get(card.dataset.id);
      if (p) card.querySelector('.poem-body').textContent = bodyText(p);
    });
    const rb = $('#reader-body');
    const rp = rb && byId.get(rb.dataset.id);
    if (rp && !$('#reader').hidden) rb.querySelector('.poem-body').textContent = bodyText(rp);
  });

  $('#filter-segment').addEventListener('click', (e) => {
    const b = e.target.closest('.seg-btn');
    if (!b) return;
    state.settings.filter = b.dataset.filter;
    persist();
    updateSegUI();
    queue = [];
    fillQueue();
    render();
  });

  $('#reset-learning').addEventListener('click', () => {
    model.w = {};
    state.weights = {};
    state.disliked.clear();
    state.seen = new Set([...state.liked]); // keep likes out of the deck, forget the rest
    queue = [];
    fillQueue();
    render();
    updateLearned();
    persist();
    toast('הלמידה אופסה');
  });

  $('#menu-btn').addEventListener('click', () => {
    $('#corpus-count').textContent =
      POEMS.length.toLocaleString('he') + ' שירים · ' +
      POEMS.filter((p) => p.is_translation).length + ' מתורגמים';
    $('#liked-count').textContent = state.liked.size ? state.liked.size : '';
    updateLearned();
    openPanel('#settings-panel');
  });
  $('#open-liked-row').addEventListener('click', () => {
    closePanels();
    renderLiked();
    openPanel('#liked-panel');
  });

  $('#liked-list').addEventListener('click', (e) => {
    const li = e.target.closest('li');
    if (!li) return;
    const p = byId.get(li.dataset.id);
    if (!p) return;
    if (e.target.closest('[data-remove]')) {
      state.liked.delete(p.id);
      persist();
      renderLiked();
    } else {
      openReader(p);
    }
  });

  document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closePanels));
  document.querySelectorAll('.panel').forEach((panel) => {
    panel.addEventListener('click', (e) => { if (e.target === panel) closePanels(); });
  });
}

/* ---------- misc ---------- */
let toastTimer = null;
function toast(msg) {
  let t = $('#toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:96px;left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:9px 16px;border-radius:999px;font-size:0.9rem;z-index:40;opacity:0;transition:opacity .2s;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.style.opacity = '0'), 1600);
}
function showError(e) {
  const l = $('#loading');
  l.innerHTML = '<p style="font-size:1.1rem">לא הצלחנו לטעון את השירים</p>' +
    '<p style="font-size:0.85rem;color:var(--ink-faint)">' + (e && e.message ? e.message : '') + '</p>';
}

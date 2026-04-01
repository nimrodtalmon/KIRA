const JSONBIN_KEY = '$2a$10$eKgPQ6fKBpLt5wHSNa5tgePaFxQ./EjLU9qCUX3yOYQsl8tbtet4S';
const JSONBIN_BASE = 'https://api.jsonbin.io/v3';
const HEADERS = { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_KEY };

const form = document.getElementById('add-form');
const titleInput = document.getElementById('title-input');
const statusInput = document.getElementById('status-input');
const chapterInput = document.getElementById('chapter-input');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const filterBtns = document.querySelectorAll('.filter');
const syncEl = document.getElementById('sync-status');

let items = [];
let activeFilter = 'all';
let binId = localStorage.getItem('mangalist_bin_id');

async function getBinId() {
  if (binId) return binId;
  setStatus('Setting up...');
  const res = await fetch(`${JSONBIN_BASE}/b`, {
    method: 'POST',
    headers: { ...HEADERS, 'X-Bin-Name': 'mangalist', 'X-Bin-Private': 'false' },
    body: JSON.stringify({ items: [] }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || res.status);
  binId = data.metadata.id;
  localStorage.setItem('mangalist_bin_id', binId);
  return binId;
}

async function load() {
  setStatus('Loading...');
  try {
    const id = await getBinId();
    const res = await fetch(`${JSONBIN_BASE}/b/${id}/latest`, { headers: HEADERS });
    const data = await res.json();
    items = data.record.items;
    setStatus('');
  } catch (e) {
    binId = null;
    localStorage.removeItem('mangalist_bin_id');
    setStatus('Failed to load: ' + e.message);
  }
  render();
}

async function save() {
  setStatus('Saving...');
  try {
    const id = await getBinId();
    await fetch(`${JSONBIN_BASE}/b/${id}`, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify({ items }),
    });
    setStatus('Saved ✓');
    setTimeout(() => setStatus(''), 1500);
  } catch (e) {
    setStatus('Save failed: ' + e.message);
  }
}

function setStatus(msg) { syncEl.textContent = msg; }

function render() {
  const filtered = activeFilter === 'all' ? items : items.filter(i => i.status === activeFilter);
  listEl.innerHTML = '';
  filtered.forEach(item => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="title">${escHtml(item.title)}</span>
      <span class="badge badge-${item.status}">${statusLabel(item.status)}</span>
      <span class="chapter">Vol. <input type="number" min="0" value="${item.chapter}" data-id="${item.id}" /></span>
      <button class="delete-btn" data-id="${item.id}" title="Remove">✕</button>
    `;
    listEl.appendChild(li);
  });
  emptyEl.style.display = filtered.length === 0 ? 'block' : 'none';
}

function statusLabel(s) {
  return { reading: 'Reading', completed: 'Completed', plan: 'Plan to read', dropped: 'Dropped' }[s];
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

form.addEventListener('submit', e => {
  e.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;
  items.unshift({ id: Date.now(), title, status: statusInput.value, chapter: parseInt(chapterInput.value) || 0 });
  save();
  render();
  titleInput.value = '';
  chapterInput.value = '';
  titleInput.focus();
});

listEl.addEventListener('change', e => {
  if (e.target.matches('input[type=number]')) {
    const id = parseInt(e.target.dataset.id);
    const item = items.find(i => i.id === id);
    if (item) { item.chapter = parseInt(e.target.value) || 0; save(); }
  }
});

listEl.addEventListener('click', e => {
  if (e.target.matches('.delete-btn')) {
    const id = parseInt(e.target.dataset.id);
    items = items.filter(i => i.id !== id);
    save();
    render();
  }
});

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    render();
  });
});

load();

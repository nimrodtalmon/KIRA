const GIST_ID = '2cca47e7844e628738a9fdc4d196fd2a';
const GIST_FILE = 'mangalist.json';
const API = `https://api.github.com/gists/${GIST_ID}`;

const form = document.getElementById('add-form');
const titleInput = document.getElementById('title-input');
const statusInput = document.getElementById('status-input');
const chapterInput = document.getElementById('chapter-input');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const filterBtns = document.querySelectorAll('.filter');
const syncEl = document.getElementById('sync-status');
const setupEl = document.getElementById('setup');
const patInput = document.getElementById('pat-input');
const savePatBtn = document.getElementById('save-pat');
const appEl = document.getElementById('app');

let items = [];
let activeFilter = 'all';

function getHeaders() {
  const pat = localStorage.getItem('mangalist_pat');
  return { 'Authorization': `Bearer ${pat}`, 'Content-Type': 'application/json' };
}

async function load() {
  setStatus('Loading...');
  try {
    const res = await fetch(API, { headers: getHeaders() });
    if (res.status === 401) { showSetup(); return; }
    const data = await res.json();
    items = JSON.parse(data.files[GIST_FILE].content || '[]');
    setStatus('');
  } catch {
    setStatus('Failed to load');
  }
  render();
}

async function save() {
  setStatus('Saving...');
  try {
    await fetch(API, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(items) } } }),
    });
    setStatus('Saved ✓');
    setTimeout(() => setStatus(''), 1500);
  } catch {
    setStatus('Save failed');
  }
}

function setStatus(msg) { syncEl.textContent = msg; }

function showSetup() {
  setupEl.style.display = 'block';
  appEl.style.display = 'none';
}

function showApp() {
  setupEl.style.display = 'none';
  appEl.style.display = 'block';
}

savePatBtn.addEventListener('click', () => {
  const val = patInput.value.trim();
  if (!val) return;
  localStorage.setItem('mangalist_pat', val);
  showApp();
  load();
});

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

// Start
if (localStorage.getItem('mangalist_pat')) {
  showApp();
  load();
} else {
  showSetup();
}

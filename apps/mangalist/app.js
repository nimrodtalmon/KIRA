const form = document.getElementById('add-form');
const titleInput = document.getElementById('title-input');
const statusInput = document.getElementById('status-input');
const chapterInput = document.getElementById('chapter-input');
const listEl = document.getElementById('list');
const emptyEl = document.getElementById('empty');
const filterBtns = document.querySelectorAll('.filter');

let items = JSON.parse(localStorage.getItem('mangalist') || '[]');
let activeFilter = 'all';

function save() {
  localStorage.setItem('mangalist', JSON.stringify(items));
}

function render() {
  const filtered = activeFilter === 'all' ? items : items.filter(i => i.status === activeFilter);
  listEl.innerHTML = '';

  filtered.forEach(item => {
    const li = document.createElement('li');

    li.innerHTML = `
      <span class="title">${escHtml(item.title)}</span>
      <span class="badge badge-${item.status}">${statusLabel(item.status)}</span>
      <span class="chapter">Ch. <input type="number" min="0" value="${item.chapter}" data-id="${item.id}" /></span>
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
  items.unshift({
    id: Date.now(),
    title,
    status: statusInput.value,
    chapter: parseInt(chapterInput.value) || 0,
  });
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

render();

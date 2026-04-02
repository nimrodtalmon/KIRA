const DB = 'https://kira-27aed-default-rtdb.europe-west1.firebasedatabase.app/bored.json';

const screenList = document.getElementById('screen-list');
const screenBored = document.getElementById('screen-bored');
const addForm = document.getElementById('add-form');
const activityInput = document.getElementById('activity-input');
const activityList = document.getElementById('activity-list');
const emptyMsg = document.getElementById('empty-msg');
const boredBtn = document.getElementById('bored-btn');
const syncEl = document.getElementById('sync-status');
const suggestionText = document.getElementById('suggestion-text');
const suggestionSource = document.getElementById('suggestion-source');
const nextBtn = document.getElementById('next-btn');
const editLink = document.getElementById('edit-link');

let myActivities = [];
let shuffled = [];
let shuffleIndex = 0;

const BUILT_IN = [
  'Go for a walk outside', 'Draw something — anything', 'Call a friend you haven\'t spoken to in a while',
  'Cook something you\'ve never made before', 'Write down 10 things you\'re grateful for',
  'Do 20 push-ups', 'Watch a documentary', 'Learn 5 words in a new language',
  'Rearrange your room', 'Read a few pages of a book', 'Watch a YouTube video on a topic you know nothing about',
  'Stretch for 10 minutes', 'Write a short poem', 'Take a long shower and think about life',
  'Make a to-do list for the week', 'Try to draw your own face from memory',
  'Listen to an album you\'ve never heard', 'Write a letter to your future self',
  'Go outside and photograph something interesting', 'Try a 5-minute meditation',
  'Make a playlist for a specific mood', 'Learn a card trick',
  'Write down your top 5 favorite movies and why', 'Doodle for 10 minutes with no goal',
  'Do a puzzle', 'Reorganize your phone apps', 'Look up a random Wikipedia article',
  'Make the best sandwich you can with what you have', 'Plan a dream trip somewhere',
  'Try to juggle something', 'Watch a TED talk', 'Teach yourself a simple magic trick',
  'Write a fake review for your bedroom', 'Think of a business idea',
  'Make a paper airplane and see how far it flies', 'Look up how something you use every day works',
  'Write a story that\'s exactly 6 words long', 'Try to solve a riddle',
  'Do 10 minutes of yoga', 'Learn to draw a specific animal',
  'Write down your earliest memory', 'Create a bucket list',
  'Try to whistle a song', 'Count how many push-ups you can do',
  'Look out the window and invent stories about people you see',
  'Research a historical event you barely know about', 'Try to solve a Sudoku',
  'Write down 3 goals for the next month', 'Make a collage from old magazines or printed images',
  'Learn the lyrics to a song you half know', 'Do a random act of kindness',
  'Stare at the ceiling and just think', 'Write a review of your own life so far',
  'Invent a new game with rules', 'Try to balance something weird on your finger',
  'Look up optical illusions', 'Try a new hairstyle', 'Write a script for a 1-minute movie',
  'Make up a superhero with a ridiculous power', 'Read about a person you admire',
  'Try to name all the countries you can think of', 'Organize your photos',
  'Come up with 10 band name ideas', 'Write down your perfect day from start to finish',
  'Learn one origami fold', 'Make a ranked list of your favorite foods',
  'Do a breathing exercise', 'Invent a word and write its definition',
  'Draw a map of your neighborhood from memory', 'Think of someone who made a difference in your life and text them',
  'Try to memorize a poem', 'Brainstorm 10 app ideas', 'Watch the sunset or sunrise',
  'Clean out one drawer', 'Write a fake newspaper headline about your day',
  'Try a new type of food you\'ve been curious about', 'Rate every room in your home',
  'Challenge yourself to do something in complete silence for 15 minutes',
  'Think of 10 questions you\'d ask your hero', 'Learn a simple piano melody on YouTube',
  'Make a top 10 list of anything', 'Write down your fears and then laugh at them',
  'Try to solve a math problem you half-remember from school',
  'Build something with whatever is around you', 'Plan your ideal week',
  'Find a new podcast to try', 'Write a thank-you note (you can send it or not)',
  'Make up a conspiracy theory about something harmless', 'Research your family name',
  'Do a balance challenge — stand on one foot as long as possible',
  'Write a menu for a restaurant you\'d want to open',
  'Imagine your life as a movie — what genre is it?',
  'Try drawing with your non-dominant hand', 'Look up the night sky and find a constellation',
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setStatus(msg) { syncEl.textContent = msg; }

async function load() {
  setStatus('Loading...');
  try {
    const res = await fetch(DB);
    const data = await res.json();
    myActivities = data || [];
    setStatus('');
  } catch (e) {
    setStatus('Failed to load: ' + e.message);
  }
  renderList();
}

async function save() {
  setStatus('Saving...');
  try {
    await fetch(DB, { method: 'PUT', body: JSON.stringify(myActivities) });
    setStatus('Saved ✓');
    setTimeout(() => setStatus(''), 1500);
  } catch (e) {
    setStatus('Save failed: ' + e.message);
  }
}

function renderList() {
  activityList.innerHTML = '';
  myActivities.forEach((activity, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escHtml(activity)}</span><button class="delete-btn" data-i="${i}">✕</button>`;
    activityList.appendChild(li);
  });
  emptyMsg.style.display = myActivities.length === 0 ? 'block' : 'none';
}

function buildShuffle() {
  const mine = myActivities.map(a => ({ text: a, source: 'from your list' }));
  const builtin = BUILT_IN.map(a => ({ text: a, source: 'random idea' }));
  shuffled = shuffle([...mine, ...builtin]);
  shuffleIndex = 0;
}

function showSuggestion() {
  if (shuffled.length === 0) buildShuffle();
  if (shuffleIndex >= shuffled.length) {
    shuffleIndex = 0;
    shuffled = shuffle(shuffled);
  }
  const s = shuffled[shuffleIndex++];
  suggestionText.textContent = s.text;
  suggestionSource.textContent = s.source;
}

function showScreen(name) {
  if (name === 'bored') {
    buildShuffle();
    showSuggestion();
    screenList.style.display = 'none';
    screenBored.style.display = 'flex';
  } else {
    screenList.style.display = 'block';
    screenBored.style.display = 'none';
  }
}

addForm.addEventListener('submit', e => {
  e.preventDefault();
  const val = activityInput.value.trim();
  if (!val) return;
  myActivities.push(val);
  save();
  renderList();
  activityInput.value = '';
  activityInput.focus();
});

activityList.addEventListener('click', e => {
  if (e.target.matches('.delete-btn')) {
    const i = parseInt(e.target.dataset.i);
    myActivities.splice(i, 1);
    save();
    renderList();
  }
});

boredBtn.addEventListener('click', () => showScreen('bored'));
nextBtn.addEventListener('click', showSuggestion);
editLink.addEventListener('click', e => { e.preventDefault(); showScreen('list'); });

load();

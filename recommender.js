'use strict';

/* On-device recommender for Poetry Feed.
   A content-based online learner: each poem becomes a sparse set of features,
   and an online logistic-regression model updates its weights on every
   swipe (right = like = 1, left = dislike = 0). Ranking unseen poems by the
   model's predicted probability is how the feed "learns what you like".
   Everything lives in the browser — no server. State persists in localStorage. */

const REC_STOP = new Set([
  'של', 'את', 'על', 'אל', 'לא', 'כי', 'הוא', 'היא', 'אני', 'אתה', 'גם', 'עם',
  'כל', 'מה', 'זה', 'זאת', 'אך', 'או', 'אם', 'כמו', 'כן', 'יש', 'אין', 'הם',
  'הן', 'אשר', 'עד', 'בין', 'אבל', 'רק', 'אף', 'הלא', 'לי', 'לו', 'לה', 'לך',
  'בו', 'בה', 'כך', 'שם', 'פה', 'הנה', 'כבר', 'עוד', 'מן', 'אז', 'מי', 'הזה',
  'אנו', 'אתם', 'הייתי', 'היה', 'היו', 'אל', 'כל', 'ולא', 'ואת', 'וכל',
]);

const REC_WBUCKETS = 1024; // hashed content-word feature space

function recTokenize(text) {
  const toks = (text || '').split(/[^֐-׿]+/);
  const out = [];
  const seen = new Set();
  for (let t of toks) {
    // strip a leading vav ("and-") so וכוס ~ כוס for the lexical signal
    if (t.length > 3 && t[0] === 'ו') t = t.slice(1);
    if (t.length < 2 || REC_STOP.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 36) break;
  }
  return out;
}

function recHash(s, n) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % n;
}

function recLenBucket(n) {
  return n <= 4 ? 'xs' : n <= 8 ? 's' : n <= 14 ? 'm' : n <= 20 ? 'l' : 'xl';
}

// Build (and memoize) the sparse feature list for a poem.
function recFeatures(p) {
  if (p._feat) return p._feat;
  const f = ['bias', 'auth:' + p.author, 'lang:' + (p.original_language || 'he'),
    p.is_translation ? 'trans' : 'orig', 'len:' + recLenBucket(p.length_lines)];
  for (const w of recTokenize(p.body_plain)) f.push('w:' + recHash(w, REC_WBUCKETS));
  p._feat = f;
  return f;
}

class Recommender {
  constructor(weights) {
    this.w = weights || {};
  }
  rawScore(feats) {
    let s = 0;
    for (const f of feats) {
      const v = this.w[f];
      if (v) s += v;
    }
    return s;
  }
  prob(feats) {
    return 1 / (1 + Math.exp(-this.rawScore(feats)));
  }
  // Online logistic-regression step with light L2 decay. Returns the applied
  // per-feature deltas so a single swipe can be undone exactly.
  update(feats, y, lr = 0.18, l2 = 0.0008) {
    const p = this.prob(feats);
    const err = y - p;
    const deltas = [];
    for (const f of feats) {
      const cur = this.w[f] || 0;
      const d = lr * err - l2 * cur;
      this.w[f] = cur + d;
      deltas.push([f, d]);
    }
    return deltas;
  }
  undo(deltas) {
    for (const [f, d] of deltas) {
      const v = (this.w[f] || 0) - d;
      if (Math.abs(v) < 1e-9) delete this.w[f];
      else this.w[f] = v;
    }
  }
  // Human-readable "what I've learned": strongest author / language / kind weights.
  topTastes(limit = 5) {
    const LANG = {
      de: 'גרמנית', ru: 'רוסית', en: 'אנגלית', fr: 'צרפתית', la: 'לטינית',
      yi: 'יידיש', grc: 'יוונית', pl: 'פולנית', ar: 'ערבית', da: 'דנית',
      no: 'נורווגית', it: 'איטלקית', es: 'ספרדית', hu: 'הונגרית',
    };
    const labelled = [];
    for (const k in this.w) {
      const v = this.w[k];
      if (v <= 0.05) continue;
      if (k.startsWith('auth:')) labelled.push([v, k.slice(5)]);
      else if (k.startsWith('lang:') && k !== 'lang:he') {
        const code = k.slice(5);
        labelled.push([v, 'שירה מ' + (LANG[code] || code)]);
      } else if (k === 'trans') labelled.push([v, 'שירה מתורגמת']);
    }
    labelled.sort((a, b) => b[0] - a[0]);
    return labelled.slice(0, limit).map((x) => x[1]);
  }
}

// こくごで遊ぼう — アプリ本体
'use strict';
const VERSION = '1.0.0';
const $ = s => document.querySelector(s);
const app = $('#app');
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`; };

// ================= セーブデータ =================
const KEY = 'kokugo-asobou-v1';
const DEFAULT = () => ({
  name: '', xp: 0, stars: 0, rounds: 0, owned: [], wearing: {},
  col: { h: {}, k: {}, j: {} }, traced: { h: {}, k: {}, j: {} },
  creatures: {}, stats: {}, miss: {}, best: {},
  days: { last: '', streak: 0, total: 0 },
  settings: { voice: true, sound: true, slow: false },
});
let S;
try { S = Object.assign(DEFAULT(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { S = DEFAULT(); }
for (const k of ['col', 'traced']) for (const t of ['h', 'k', 'j']) S[k][t] = S[k][t] || {};
S.settings = Object.assign(DEFAULT().settings, S.settings);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };

// ================= おと・こえ =================
let AC = null;
function tone(seq) {
  if (!S.settings.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    let t = AC.currentTime;
    for (const [f, d, type = 'sine', v = .18] of seq) {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.value = f; o.connect(g); g.connect(AC.destination);
      g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d);
      o.start(t); o.stop(t + d); t += d * .8;
    }
  } catch (e) {}
}
const SFX = {
  ok: () => tone([[784, .12], [1047, .22]]),
  ng: () => tone([[300, .18, 'triangle'], [240, .25, 'triangle']]),
  tap: () => tone([[660, .05, 'sine', .08]]),
  fan: () => tone([[523, .12], [659, .12], [784, .12], [1047, .35]]),
  lvl: () => tone([[523, .1], [659, .1], [784, .1], [1047, .1], [1319, .4]]),
};
let jaVoice = null;
function loadVoices() {
  if (!window.speechSynthesis) return;
  const v = speechSynthesis.getVoices().filter(x => /^ja/i.test(x.lang));
  jaVoice = v.find(x => /Kyoko|O-ren|Otoya|Nanami|Google/i.test(x.name)) || v[0] || null;
}
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
const canSpeak = () => !!window.speechSynthesis && S.settings.voice;
function say(text) {
  if (!canSpeak() || !text) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP'; if (jaVoice) u.voice = jaVoice;
    u.rate = S.settings.slow ? .75 : .95; u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch (e) {}
}

// ================= エフェクト =================
function confetti(n = 40) {
  const cols = ['#ff8fab', '#6ec6ff', '#7bd389', '#ffd166', '#b892ff', '#ffa95e'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('div');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = pick(cols);
    c.style.animationDuration = (1.6 + Math.random() * 1.6) + 's';
    c.style.animationDelay = Math.random() * .4 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3800);
  }
}
function toast(html, ms = 1800) {
  const t = document.createElement('div'); t.className = 'toast'; t.innerHTML = html;
  document.body.appendChild(t); setTimeout(() => t.remove(), ms);
}

// ================= キャラ =================
const stageIndex = xp => { let i = 0; STAGES.forEach((s, k) => { if (xp >= s.xp) i = k; }); return i; };
const SLOT = { ribbon: 'head', cap: 'head', tophat: 'head', crown: 'head', grad: 'head', glasses: 'face', scarf: 'neck',
  flower: 'side', star: 'side', rainbow: 'side', rocket: 'side', music: 'side' };
function petHTML(cls = '') {
  const st = STAGES[stageIndex(S.xp)];
  const acc = Object.entries(S.wearing).filter(([, id]) => id).map(([slot, id]) => {
    const it = SHOP.find(x => x[0] === id); return it ? `<span class="acc ${slot}">${it[1]}</span>` : '';
  }).join('');
  return `<div class="pet ${cls}" id="pet"><span class="body">${st.e}</span>${acc}</div>`;
}
function xpInfo() {
  const i = stageIndex(S.xp), cur = STAGES[i], nxt = STAGES[i + 1];
  if (!nxt) return { pct: 100, text: 'さいこうの すがた！ すごい！' };
  return { pct: Math.round((S.xp - cur.xp) / (nxt.xp - cur.xp) * 100), text: `つぎの すがたまで あと ${nxt.xp - S.xp}` };
}
const PET_LINES = ['いっしょに がんばろう！', 'もじって おもしろいね！', 'きょうも あそぼう！', 'ごはん おいしかった〜', 'もっと ことばを しりたいな', 'なでなで うれしい！'];
function petTalk() {
  const p = $('#pet'); if (!p) return;
  p.classList.remove('jump'); void p.offsetWidth; p.classList.add('jump');
  const line = pick(PET_LINES);
  const b = document.createElement('div'); b.className = 'bubble'; b.textContent = line;
  p.appendChild(b); setTimeout(() => b.remove(), 1800);
  say(line); SFX.tap();
}

// ================= もんだい づくり =================
const missW = key => 1 + 3 * (S.miss[key] || 0);
function wpick(items, keyFn) {
  const w = items.map(it => missW(keyFn(it)));
  let r = Math.random() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) { r -= w[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
function fillChoices(correct, preferred, pool, n) {
  const out = [correct];
  for (const x of shuffle(preferred)) if (out.length < n && !out.includes(x)) out.push(x);
  for (const x of shuffle(pool)) if (out.length < n && !out.includes(x)) out.push(x);
  return shuffle(out);
}
const firstWord = c => HIRA_WORDS.find(w => w[0][0] === c);
const BIG = { 'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ', 'っ': 'つ', 'ぁ': 'あ', 'ぃ': 'い', 'ぅ': 'う', 'ぇ': 'え', 'ぉ': 'お' };

const G = {
  // --- ひらがな ---
  hiraListen() {
    const t = wpick(HIRA, c => 'h:' + c);
    const w = firstWord(t);
    const sayText = t === 'を' ? 'ほんを よむ の、を' : t === 'ん' ? 'みかん の、ん' : w ? `${w[0]} の、${t}` : t;
    return { key: 'h:' + t, emoji: '👂', text: 'きこえた もじは どれ？', sub: '🔊を おすと もういちど きけるよ', say: sayText,
      choices: fillChoices(t, (HIRA_LOOKALIKE[t] || []).filter(c => HIRA.includes(c)), HIRA, 4), answer: t, collect: [['h', t]],
      explain: `「${t}」だよ。${w ? `「${w[0]}」の「${t}」` : ''}` };
  },
  hiraFirst() {
    const w = wpick(HIRA_WORDS.filter(w => HIRA.includes(w[0][0])), w => 'h:' + w[0][0]);
    const t = w[0][0];
    return { key: 'h:' + t, emoji: w[1], big: canSpeak() ? '' : `<span class="blank">?</span>${esc(w[0].slice(1))}`, bigCls: 'mid',
      text: 'はじめの もじは どれ？', say: `${w[0]}。 ${w[0]}の はじめの もじは どれかな？`,
      choices: fillChoices(t, (HIRA_LOOKALIKE[t] || []).filter(c => HIRA.includes(c)), HIRA, 4), answer: t, collect: [['h', t]],
      explain: `「${w[0]}」は「${t}」から はじまるよ`, after: w[0] };
  },
  hiraBlank() {
    const cands = HIRA_WORDS.filter(w => w[0].length >= 2 && w[0].length <= 4);
    const w = pick(cands);
    const idx = [...w[0]].map((c, i) => i).filter(i => HIRA.includes(w[0][i]));
    const i = pick(idx), t = w[0][i];
    const shown = [...w[0]].map((c, k) => k === i ? '<span class="blank">?</span>' : esc(c)).join('');
    const words = new Set(HIRA_WORDS.map(x => x[0]));
    const okc = c => !words.has(w[0].slice(0, i) + c + w[0].slice(i + 1));
    return { key: 'h:' + t, emoji: w[1], big: shown, bigCls: 'mid', text: '？に はいる もじは どれ？', say: w[0],
      choices: fillChoices(t, (HIRA_LOOKALIKE[t] || []).filter(c => HIRA.includes(c) && okc(c)), HIRA.filter(okc), 4), answer: t, collect: [['h', t]],
      explain: `「${w[0]}」だよ`, after: w[0] };
  },
  spell() {
    const r = wpick(SPELL_RULES, r => 'sp:' + r[0]);
    const tip = /[っ]/.test(r[0]) ? 'つまる おとは ちいさい「っ」で かくよ' : /[ゃゅょ]/.test(r[0]) ? '「きゃ・きゅ・きょ」のような おとは ちいさい「ゃ・ゅ・ょ」で かくよ' : 'のばす おとに きを つけよう';
    return { key: 'sp:' + r[0], emoji: r[2], text: 'ただしい かきかたは どっち？', say: r[0],
      choices: shuffle([r[0], r[1]]), answer: r[0], explain: `「${r[0]}」と かくよ。${tip}`, wide: true };
  },
  // --- カタカナ ---
  kataMatch() {
    const i = HIRA.indexOf(wpick(HIRA, c => 'k:' + KATA[HIRA.indexOf(c)]));
    const h = HIRA[i], k = KATA[i];
    const pref = [KATA_LOOKALIKE[k]].filter(x => x && KATA.includes(x));
    // にた かたち: ひらがな と カタカナで にている もの
    return { key: 'k:' + k, big: esc(h), text: 'カタカナで かくと どれ？', say: 'この ひらがなを、カタカナで かくと どれかな？',
      choices: fillChoices(k, pref, KATA, 4), answer: k, collect: [['k', k]], explain: `「${h}」は カタカナで「${k}」だよ` };
  },
  kataWord() {
    const w = wpick(KATA_WORDS, w => 'kw:' + w[0]);
    const word = w[0], wrongs = new Set();
    let tries = 0;
    while (wrongs.size < 3 && tries++ < 40) {
      let v;
      if (word.includes('ー') && Math.random() < .3) v = word.replace('ー', '');
      else {
        const pos = [...word].map((c, i) => i).filter(i => KATA_LOOKALIKE[word[i]]);
        if (!pos.length) break;
        const p = pick(pos); v = word.slice(0, p) + KATA_LOOKALIKE[word[p]] + word.slice(p + 1);
      }
      if (v && v !== word) wrongs.add(v);
    }
    const choices = shuffle([word, ...wrongs]);
    return { key: 'kw:' + word, emoji: w[1], text: 'ただしく かけているのは どれ？', say: word, choices, answer: word,
      collect: [...word].filter(c => KATA.includes(c)).map(c => ['k', c]), explain: `「${word}」と かくよ`, wide: true };
  },
  kataWhich() {
    const r = wpick(KATA_OR_HIRA, r => 'kh:' + r[0]);
    return { key: 'kh:' + r[0], emoji: '🤔', text: 'ただしい かきかたは どっち？', say: r[0], choices: shuffle([r[0], r[1]]), answer: r[0],
      explain: r[2] ? `がいこくから きた ことばは カタカナで かくよ。「${r[0]}」` : `「${r[0]}」は ひらがなで かくよ`, wide: true };
  },
  // --- かんじ ---
  kanjiRead() {
    const K = wpick(KANJI, k => 'j:' + k.k);
    const big = esc(K.w).replace(K.k, `<span class="hl">${K.k}</span>`);
    const alt = KANJI_ALT[K.k] || [];
    const others = KANJI.filter(x => x.r !== K.r && !alt.includes(x.r)).map(x => x.r);
    const near = others.filter(r => Math.abs(r.length - K.r.length) <= 1);
    return { key: 'j:' + K.k, emoji: K.e, big, text: K.w === K.k ? 'なんと よむかな？' : 'この ことばの よみかたは？', say: K.w === K.k ? 'この かんじ、なんて よむかな？' : 'この ことば、なんて よむかな？',
      choices: fillChoices(K.r, near, others, 4), answer: K.r, collect: [['j', K.k]], explain: `「${K.w}」は「${K.r}」と よむよ`, after: K.r, wide: true };
  },
  kanjiPick() {
    const K = wpick(KANJI, k => 'j:' + k.k);
    const set = KANJI.map(x => x.k);
    const same = KANJI.filter(x => x.r === K.r || (KANJI_ALT[x.k] || []).includes(K.r) || (x.w === x.k && (KANJI_ALT[K.k] || []).includes(x.r))).map(x => x.k);
    const pref = (KANJI_LOOKALIKE[K.k] || []).filter(c => set.includes(c) && !same.includes(c));
    const pool = set.filter(c => !same.includes(c));
    const big = K.w === K.k ? esc(K.r) : esc(K.w).replace(K.k, '<span class="blank">?</span>');
    return { key: 'j:' + K.k, emoji: K.e, big, bigCls: 'mid', text: K.w === K.k ? 'この ことばの かんじは どれ？' : '？に はいる かんじは どれ？',
      sub: K.w === K.k ? '' : `（${K.r}）`, say: K.r, choices: fillChoices(K.k, pref, pool, 4), answer: K.k, collect: [['j', K.k]],
      explain: `「${K.r}」は「${K.w}」と かくよ` };
  },
  // --- ことば ---
  opposite() {
    const p = wpick(OPPOSITES, p => 'op:' + p[0]);
    const [a, b] = Math.random() < .5 ? p : [p[1], p[0]];
    const pool = OPPOSITES.filter(x => x !== p).flat();
    return { key: 'op:' + p[0], emoji: '🔄', big: esc(a), bigCls: 'mid', text: 'はんたいの いみの ことばは？', say: `${a} の はんたいは なにかな？`,
      choices: fillChoices(b, [], pool, 4), answer: b, explain: `「${a}」の はんたいは「${b}」だよ`, wide: true };
  },
  oddOne() {
    const names = Object.keys(CATEGORIES);
    const A = pick(names);
    const NG = { 'どうぶつ': 'うみの いきもの', 'うみの いきもの': 'どうぶつ', 'くだもの': 'やさい', 'やさい': 'くだもの' };
    const B = pick(names.filter(n => n !== A && NG[A] !== n));
    const three = shuffle(CATEGORIES[A]).slice(0, 3), odd = pick(CATEGORIES[B]);
    const items = shuffle([...three, odd]);
    return { key: 'od:' + A, emoji: '🧺', text: 'なかまはずれは どれ？', say: 'なかまはずれは どれかな？',
      choices: items.map(x => x[0]), labels: Object.fromEntries(items.map(x => [x[0], x[1]])), answer: odd[0],
      explain: `「${odd[0]}」いがいは みんな「${A}」の なかまだよ。「${odd[0]}」は「${B}」` };
  },
  shiritori() {
    for (let t = 0; t < 30; t++) {
      const A = pick(HIRA_WORDS);
      let c = A[0][A[0].length - 1];
      if (c === 'ん') continue;
      c = BIG[c] || c;
      const nexts = HIRA_WORDS.filter(w => w !== A && w[0][0] === c);
      if (!nexts.length) continue;
      const ans = pick(nexts);
      const base = ch => ch.normalize('NFD').replace(/[\u3099\u309A]/g, '');
      const others = shuffle(HIRA_WORDS.filter(w => base(w[0][0]) !== base(c) && w !== A)).slice(0, 3);
      const items = shuffle([ans, ...others]);
      return { key: 'sh:' + c, emoji: A[1], big: esc(A[0]), bigCls: 'mid', text: 'しりとり！ つぎに つづく ことばは？',
        say: `${A[0]}。 しりとりで、つぎに つづく ことばは どれかな？`, choices: items.map(x => x[0]),
        labels: Object.fromEntries(items.map(x => [x[0], x[1]])), answer: ans[0],
        explain: `「${A[0]}」の さいごの もじは「${c}」。だから「${ans[0]}」だよ` };
    }
    return G.opposite();
  },
  // --- ぶんしょう ---
  particle() {
    const p = wpick(PARTICLES, p => 'pa:' + p.join(''));
    const tip = { 'は': '「わ」と よむけど、くっつきの ことばは「は」と かくよ', 'を': '「お」と よむけど、くっつきの ことばは「を」と かくよ', 'へ': '「え」と よむけど、くっつきの ことばは「へ」と かくよ' }[p[2]];
    return { key: 'pa:' + p.join(''), emoji: '📝', big: `${esc(p[0])}<span class="blank">?</span> ${esc(p[1])}`, bigCls: 'sent',
      text: '？に はいるのは どっち？', say: `${p[0]}${p[2]} ${p[1]}`, choices: shuffle([p[2], p[3]]), answer: p[2], explain: tip };
  },
  wordBlank() {
    const w = wpick(WORD_BLANK, w => 'wb:' + w[0]);
    const full = w[0].replace('□', w[1]);
    return { key: 'wb:' + w[0], emoji: w[3], big: esc(w[0]).replace('□', '<span class="blank">?</span>'), bigCls: 'mid',
      text: '？に はいるのは どっち？', say: full, choices: shuffle([w[1], w[2]]), answer: w[1],
      explain: `「${full}」と かくよ。ことばの なかの おとは、きこえた とおりに「${w[1]}」と かこう` };
  },
  order() {
    const s = wpick(SENTENCES, s => 'or:' + s[0] + s[1]);
    let sh; do { sh = shuffle(s); } while (sh.join() === s.join());
    return { kind: 'order', key: 'or:' + s[0] + s[1], emoji: '🧩', text: 'ただしい じゅんばんに ならべよう', sub: '「だれが（なにが）」→「なにを・どこに」→「どうする」',
      say: 'ことばを ならべて、ぶんを つくろう', chunks: sh, answer: s, explain: `「${s.join(' ')}」だよ` };
  },
};

const WORLDS = {
  hira: { name: 'ひらがな', icon: '🌸', color: 'var(--pink)', modes: [
    { id: 'hiraListen', name: 'きいて えらぼう', icon: '👂', desc: 'きこえた もじを さがそう', voice: true },
    { id: 'hiraFirst', name: 'はじめの もじ', icon: '🍎', desc: 'ことばの さいしょの もじは？' },
    { id: 'hiraBlank', name: 'ぬけた もじ', icon: '🧩', desc: 'あいている ところに いれよう' },
    { id: 'spell', name: '「っ」「ゃ」と のばす おと', icon: '📏', desc: 'きって・でんしゃ・おかあさん' } ] },
  kata: { name: 'カタカナ', icon: '🚀', color: 'var(--blue)', modes: [
    { id: 'kataMatch', name: 'ひらがな → カタカナ', icon: '🔁', desc: 'おなじ おとの カタカナは？' },
    { id: 'kataWord', name: 'カタカナの ことば', icon: '🍌', desc: 'ただしく かけているのは？' },
    { id: 'kataWhich', name: 'ひらがな？ カタカナ？', icon: '🤔', desc: 'どっちで かくかな' } ] },
  kanji: { name: 'かんじ', icon: '🏯', color: 'var(--purple)', modes: [
    { id: 'kanjiRead', name: 'かんじを よもう', icon: '📖', desc: '1ねんせいの かんじ 80じ' },
    { id: 'kanjiPick', name: 'かんじを えらぼう', icon: '🔍', desc: 'にている かんじに ちゅうい！' } ] },
  kotoba: { name: 'ことば', icon: '🎈', color: 'var(--orange)', modes: [
    { id: 'opposite', name: 'はんたいことば', icon: '🔄', desc: 'おおきい ↔ ちいさい' },
    { id: 'oddOne', name: 'なかまはずれ', icon: '🧺', desc: 'なかまじゃ ない ものは？' },
    { id: 'shiritori', name: 'しりとり', icon: '🐍', desc: 'つぎに つづく ことばは？' } ] },
  bun: { name: 'ぶんしょう', icon: '📝', color: 'var(--green)', modes: [
    { id: 'particle', name: 'は・を・へ', icon: '✏️', desc: 'くっつきの ことば' },
    { id: 'wordBlank', name: 'わ・お・え', icon: '🙋', desc: 'ことばの なかの おと' },
    { id: 'order', name: 'ぶんを つくろう', icon: '🧩', desc: 'ことばを ならべかえ' } ] },
};
const TRACE_SETS = { h: { name: 'ひらがな', list: HIRA }, k: { name: 'カタカナ', list: KATA }, j: { name: 'かんじ', list: KANJI.map(x => x.k) } };

// ================= がめん =================
let R = null; // いまの ラウンド

function checkDaily() {
  const t = today();
  if (S.days.last === t) return false;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const ys = `${y.getFullYear()}-${y.getMonth()+1}-${y.getDate()}`;
  S.days.streak = S.days.last === ys ? S.days.streak + 1 : 1;
  S.days.last = t; S.days.total++;
  S.stars += 10; save();
  return true;
}

function home() {
  R = null;
  if (!S.name) return nameSetup();
  const xi = xpInfo(), st = STAGES[stageIndex(S.xp)];
  const colN = Object.keys(S.col.h).length + Object.keys(S.col.k).length + Object.keys(S.col.j).length;
  const tile = (id, w) => `<button class="tile" style="background:${w.color}" data-go="${id}"><span class="ic">${w.icon}</span>${w.name}
    ${S.best[id] ? `<span class="badge">⭐${S.best[id]}</span>` : ''}</button>`;
  app.innerHTML = `<div class="screen">
    <div class="topbar"><span class="pill">⭐ ${S.stars}</span><span class="pill">📅 ${S.days.streak}にち れんぞく</span><span class="spacer"></span>
      <button class="iconbtn" data-go="zukan" aria-label="ずかん">📖</button></div>
    <div class="pet-wrap">${petHTML()}
      <div class="petname">${esc(S.name)}</div><div class="stage">${st.n}</div>
      <div class="xpbar"><i style="width:${xi.pct}%"></i></div><div class="xptext">${xi.text}</div></div>
    <div class="grid">
      ${Object.entries(WORLDS).map(([id, w]) => tile(id, w)).join('')}
      <button class="tile" style="background:#ff7aa2" data-go="trace"><span class="ic">✍️</span>なぞりがき</button>
    </div>
    <div class="subrow">
      <button class="btn" data-go="zukan">📖 ずかん <small style="color:var(--sub)">${colN + Object.keys(S.creatures).length}</small></button>
      <button class="btn primary" data-go="shop">🛍️ おみせ</button>
    </div>
    <button class="parentlink" id="parent">おうちの かたへ（ながおし）</button>
  </div>`;
  $('#pet').onclick = petTalk;
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    SFX.tap(); const g = b.dataset.go;
    if (WORLDS[g]) world(g); else if (g === 'trace') traceMenu(); else if (g === 'zukan') zukan('life'); else if (g === 'shop') shop();
  });
  longPress($('#parent'), parent);
  if (checkDaily()) setTimeout(() => {
    confetti(30); SFX.fan();
    toast(`📅 きょうの スタンプ！<br>⭐ +10<br><small>${S.days.streak}にち れんぞく</small>`, 2400);
    say(`おかえり！ きょうも いっしょに あそぼう`);
    setTimeout(home, 2500);
  }, 300);
}

function longPress(el, fn) {
  let t;
  const start = e => { e.preventDefault(); t = setTimeout(fn, 1500); el.style.opacity = .5; };
  const end = () => { clearTimeout(t); el.style.opacity = 1; };
  el.addEventListener('touchstart', start, { passive: false }); el.addEventListener('mousedown', start);
  ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach(ev => el.addEventListener(ev, end));
  el.onclick = () => toast('ボタンを ながく おしてね', 1200);
}

function nameSetup() {
  const opts = ['ことりん', 'ぴよまる', 'もじっち', 'ぽこ'];
  app.innerHTML = `<div class="screen" style="text-align:center">
    <h2>はじめまして！</h2>
    <div class="pet-wrap">${petHTML()}</div>
    <p style="font-size:18px;font-weight:700;line-height:1.7">たまごから うまれる おともだちに<br>なまえを つけてね</p>
    <div class="grid">${opts.map(o => `<button class="btn" data-n="${o}">${o}</button>`).join('')}</div>
    <input class="name" id="nm" maxlength="8" placeholder="じぶんで つける">
    <button class="btn go wide" id="ok">けってい！</button></div>`;
  say('はじめまして！ たまごの おともだちに、なまえを つけてね');
  app.querySelectorAll('[data-n]').forEach(b => b.onclick = () => { $('#nm').value = b.dataset.n; SFX.tap(); });
  $('#ok').onclick = () => {
    const v = $('#nm').value.trim(); if (!v) { toast('なまえを えらんでね'); return; }
    S.name = v; save(); SFX.fan(); confetti(); say(`よろしくね、${v}！`); home();
  };
}

function world(id) {
  const w = WORLDS[id];
  const modes = w.modes.filter(m => !m.voice || canSpeak());
  app.innerHTML = `<div class="screen">
    <div class="topbar"><button class="iconbtn" id="back">◀</button><span class="spacer"></span><span class="pill">⭐ ${S.stars}</span></div>
    <h2>${w.icon} ${w.name}</h2>
    <div class="modes">
      <button class="mode mix" data-m="mix"><span class="ic">🎲</span><div><b>ぜんぶ まぜて チャレンジ</b><span>いろんな もんだいが でるよ</span></div></button>
      ${modes.map(m => `<button class="mode" data-m="${m.id}"><span class="ic">${m.icon}</span><div><b>${m.name}</b><span>${m.desc}</span></div></button>`).join('')}
    </div></div>`;
  say(w.name);
  $('#back').onclick = () => { SFX.tap(); home(); };
  app.querySelectorAll('[data-m]').forEach(b => b.onclick = () => {
    SFX.tap(); const m = b.dataset.m;
    startRound(id, m === 'mix' ? modes.map(x => x.id) : [m]);
  });
}

function startRound(worldId, gens) {
  const qs = [], keys = new Set();
  let guard = 0;
  while (qs.length < 10 && guard++ < 200) {
    const q = G[pick(gens)]();
    if (keys.has(q.key + (q.answer || '')) && guard < 150) continue;
    keys.add(q.key + (q.answer || '')); qs.push(q);
  }
  R = { world: worldId, gens, qs, i: 0, ok: 0, combo: 0, maxCombo: 0, res: [], xp: 0, stars: 0, retry: [] };
  showQ();
}

function progressHTML() {
  const n = R.qs.length;
  return `<div class="progress">${Array.from({ length: n }, (_, k) =>
    `<i class="${k < R.res.length ? (R.res[k] ? 'ok' : 'ng') : k === R.i ? 'now' : ''}"></i>`).join('')}</div>`;
}

function showQ() {
  const q = R.qs[R.i];
  const isRetry = R.i >= 10;
  const head = `<div class="topbar"><button class="iconbtn" id="quit">✕</button>${progressHTML()}<span class="combo">${R.combo >= 2 ? '🔥' + R.combo : ''}</span></div>`;
  const card = `<div class="qcard" id="qcard"><button class="speak" id="spk" aria-label="よみあげ">🔊</button>
    ${isRetry ? '<div class="qsub">🔁 もういちど チャレンジ</div>' : ''}
    ${q.emoji ? `<div class="qemoji">${q.emoji}</div>` : ''}
    ${q.big ? `<div class="qbig ${q.bigCls || ''}">${q.big}</div>` : ''}
    <div class="qtext">${q.text}</div>${q.sub ? `<div class="qsub">${q.sub}</div>` : ''}</div>`;
  let body;
  if (q.kind === 'order') {
    body = `<div class="answerline" id="line"></div><div class="chips" id="chips">${q.chunks.map((c, k) => `<button class="chip" data-k="${k}">${esc(c)}</button>`).join('')}</div>
      <div id="fb"></div>`;
  } else {
    const long = Math.max(...q.choices.map(c => c.length));
    const cls = q.labels ? 'long' : long >= 5 ? 'xlong' : long >= 3 || q.wide ? 'long' : '';
    body = `<div class="choices">${q.choices.map(c => `<button class="choice ${cls}" data-v="${esc(c)}">${q.labels ? `<span class="ce">${q.labels[c]}</span>` : ''}${esc(c)}</button>`).join('')}</div><div id="fb"></div>`;
  }
  app.innerHTML = `<div class="screen">${head}${card}${body}</div>`;
  $('#quit').onclick = () => { if (confirm('とちゅうで やめる？')) home(); };
  $('#spk').onclick = () => say(q.say);
  setTimeout(() => say(q.say), 250);
  if (q.kind === 'order') bindOrder(q); else app.querySelectorAll('.choice').forEach(b => b.onclick = () => answer(q, b.dataset.v, b));
}

function bindOrder(q) {
  const placed = [];
  const render = () => {
    $('#line').innerHTML = placed.map((k, i) => `<button class="chip placed" data-i="${i}">${esc(q.chunks[k])}</button>`).join('');
    app.querySelectorAll('#chips .chip').forEach(b => b.classList.toggle('used', placed.includes(+b.dataset.k)));
    $('#line').querySelectorAll('.chip').forEach(b => b.onclick = () => { placed.splice(+b.dataset.i, 1); SFX.tap(); render(); });
    if (placed.length === q.chunks.length) {
      const got = placed.map(k => q.chunks[k]);
      const okOrder = got.join('|') === q.answer.join('|') || (got.length === 3 && got[2] === q.answer[2] && got[0] === q.answer[1] && got[1] === q.answer[0]);
      answer(q, got.join('|'), null, okOrder);
    }
  };
  app.querySelectorAll('#chips .chip').forEach(b => b.onclick = () => { if (!placed.includes(+b.dataset.k)) { placed.push(+b.dataset.k); SFX.tap(); render(); } });
}

const reshuf = a => { let s; do { s = shuffle(a); } while (s.join() === a.join()); return s; };
const PRAISE = ['せいかい！', 'すごい！', 'やったね！', 'ばっちり！', 'てんさい！', 'いいね！'];
function answer(q, val, btn, forced) {
  if (R.locked) return; R.locked = true;
  const ok = forced !== undefined ? forced : val === q.answer;
  const isRetry = R.i >= 10;
  const stat = S.stats[R.world] = S.stats[R.world] || { ok: 0, ng: 0 };
  app.querySelectorAll('.choice').forEach(b => {
    if (b.dataset.v === q.answer) b.classList.add('correct');
    else if (b === btn) b.classList.add('wrong'); else b.classList.add('dim');
  });
  const card = $('#qcard'); const st = document.createElement('div');
  st.className = 'stamp' + (ok ? '' : ' ng'); st.textContent = ok ? '⭕' : '✖'; card.appendChild(st);
  if (ok) {
    SFX.ok(); R.combo++; R.maxCombo = Math.max(R.maxCombo, R.combo);
    if (!isRetry) { R.ok++; R.res.push(true); stat.ok++; R.xp += 3 + (R.combo % 3 === 0 ? 2 : 0); R.stars += 1; }
    else { R.xp += 1; }
    if (S.miss[q.key]) S.miss[q.key] = Math.max(0, S.miss[q.key] - 1);
    (q.collect || []).forEach(([t, c]) => { S.col[t][c] = (S.col[t][c] || 0) + 1; });
    if (R.combo >= 3 && R.combo % 3 === 0) { confetti(18); }
    const pr = pick(PRAISE);
    say(q.after ? `${q.after}。${pr}` : pr);
    save();
    setTimeout(next, q.after ? 1500 : 1100);
  } else {
    SFX.ng(); R.combo = 0;
    if (!isRetry) { R.res.push(false); stat.ng++; R.retry.push(q.key); R.qs.push(Object.assign({}, q, { choices: q.choices ? shuffle(q.choices) : undefined, chunks: q.chunks ? reshuf(q.answer) : undefined })); }
    S.miss[q.key] = (S.miss[q.key] || 0) + 1; save();
    $('#fb').innerHTML = `<div class="feedback"><div class="t">おしい！</div><div class="e">${q.explain || ''}</div>
      <button class="btn go wide" id="nx">つぎへ ▶</button></div>`;
    say('おしい！ ' + (q.explain || '').replace(/[「」]/g, ' '));
    $('#nx').onclick = () => { SFX.tap(); next(); };
  }
}
function next() {
  R.locked = false; R.i++;
  if (R.i < R.qs.length) showQ(); else finish();
}

function finish() {
  const before = stageIndex(S.xp);
  const perfect = R.ok === 10;
  let bonus = perfect ? 5 : 0;
  S.xp += R.xp; S.stars += R.stars + bonus; S.rounds++;
  if (R.gens.length > 1 || true) S.best[R.world] = Math.max(S.best[R.world] || 0, R.ok);
  save();
  const after = stageIndex(S.xp);
  const pulls = perfect ? 2 : 1;
  resultScreen({ title: `${R.ok} / 10`, msg: perfect ? 'パーフェクト！ すごすぎる！' : R.ok >= 8 ? 'よく できました！' : R.ok >= 5 ? 'がんばったね！' : 'つぎは もっと できるよ！',
    gains: [`✨ +${R.xp} けいけんち`, `⭐ +${R.stars + bonus}`, R.maxCombo >= 3 ? `🔥 ${R.maxCombo}れんぞく` : ''], before, after, pulls,
    again: () => startRound(R.world, R.gens) });
}

function resultScreen(o) {
  const xi = xpInfo();
  app.innerHTML = `<div class="screen result">
    <div class="pet-wrap">${petHTML()}</div>
    <div class="score">${o.title}</div><div class="msg">${o.msg}</div>
    <div class="gains">${o.gains.filter(Boolean).map(g => `<span class="gain">${g}</span>`).join('')}</div>
    <div class="pet-wrap"><div class="xpbar"><i style="width:${xi.pct}%"></i></div><div class="xptext">${xi.text}</div></div>
    <div class="stack">
      <button class="btn primary wide" id="gacha">🎁 ごほうびガチャ × ${o.pulls}</button>
      <button class="btn go wide hidden" id="again">🔁 もういちど</button>
      <button class="btn wide hidden" id="home">🏠 ホームへ</button>
    </div></div>`;
  SFX.fan(); if (o.pulls > 1) confetti(60);
  say(o.msg);
  let left = o.pulls;
  const doneAll = () => { $('#gacha').classList.add('hidden'); $('#again').classList.remove('hidden'); $('#home').classList.remove('hidden'); };
  $('#gacha').onclick = () => gacha(() => { left--; if (left > 0) $('#gacha').textContent = `🎁 ごほうびガチャ × ${left}`; else doneAll(); });
  $('#again').onclick = () => { SFX.tap(); o.again(); };
  $('#home').onclick = () => { SFX.tap(); home(); };
  if (o.after > o.before) setTimeout(() => levelUp(o.after), 700);
}

function levelUp(i) {
  const st = STAGES[i];
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="panel"><div class="rare">✨ しんか！ ✨</div><div class="reveal">${st.e}</div>
    <div style="font-size:22px;font-weight:800">${esc(S.name)}が<br>「${st.n}」に なった！</div>
    <button class="btn go wide" style="margin-top:16px">やったー！</button></div>`;
  document.body.appendChild(ov); SFX.lvl(); confetti(80);
  say(`すごい！ ${S.name}が、${st.n}に なったよ！`);
  ov.querySelector('button').onclick = () => { ov.remove(); const p = $('#pet'); if (p) p.outerHTML = petHTML(); };
}

function gacha(done) {
  const r = Math.random();
  const rare = r < .06 ? 3 : r < .32 ? 2 : 1;
  const c = pick(CREATURES.filter(x => x[2] === rare));
  const isNew = !S.creatures[c[0]];
  S.creatures[c[0]] = (S.creatures[c[0]] || 0) + 1; save();
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="panel"><div style="font-size:18px;font-weight:800;margin-bottom:6px">タップして あけよう！</div>
    <div class="capsule" id="cap">🥚</div></div>`;
  document.body.appendChild(ov); SFX.tap();
  ov.querySelector('#cap').onclick = () => {
    const stars = '★'.repeat(rare) + '☆'.repeat(3 - rare);
    ov.querySelector('.panel').innerHTML = `<div class="rare" style="color:${rare === 3 ? '#e0a800' : rare === 2 ? '#3a9be0' : '#999'}">${stars}</div>
      <div class="reveal">${c[0]}</div><div style="font-size:24px;font-weight:800">${c[1]}${isNew ? '<span class="new">NEW!</span>' : ''}</div>
      <div style="color:var(--sub);margin-top:4px">${isNew ? 'ずかんに とうろく したよ' : `${S.creatures[c[0]]}かいめ`}</div>
      <button class="btn go wide" style="margin-top:16px">OK</button>`;
    if (rare === 3) { SFX.lvl(); confetti(80); } else SFX.fan();
    say(`${c[1]}${isNew ? '、 ゲット！' : ''}`);
    ov.querySelector('button').onclick = () => { ov.remove(); done(); };
  };
}

// ================= なぞりがき =================
const TRACE_FONT = (px) => `700 ${px}px ${getComputedStyle(document.documentElement).getPropertyValue('--kfont')}`;
function traceMenu() {
  const cnt = t => Object.keys(S.traced[t]).length;
  app.innerHTML = `<div class="screen">
    <div class="topbar"><button class="iconbtn" id="back">◀</button><span class="spacer"></span><span class="pill">⭐ ${S.stars}</span></div>
    <h2>✍️ なぞりがき</h2>
    <div class="modes">${Object.entries(TRACE_SETS).map(([t, s]) => `<button class="mode" data-t="${t}"><span class="ic">${t === 'h' ? 'あ' : t === 'k' ? 'ア' : '山'}</span>
      <div><b>${s.name}</b><span>${cnt(t)} / ${s.list.length} もじ れんしゅう ずみ</span></div></button>`).join('')}</div>
    <p style="text-align:center;color:var(--sub);font-size:14px;line-height:1.6;margin-top:16px">うすい もじの うえを ゆびで なぞろう。<br>5もじ かけたら ごほうびガチャ！</p></div>`;
  say('なぞりがき。 ゆびで もじを なぞろう');
  $('#back').onclick = () => { SFX.tap(); home(); };
  app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { SFX.tap(); startTrace(b.dataset.t); });
}
function startTrace(t) {
  const list = TRACE_SETS[t].list;
  const picked = [];
  while (picked.length < 5) {
    const c = wpick(list.filter(x => !picked.includes(x)), x => 'tr:' + x);
    // まだ かいて いない もじを すこし でやすく
    if (S.traced[t][c] && Math.random() < .5 && Object.keys(S.traced[t]).length < list.length) continue;
    picked.push(c);
  }
  R = { trace: t, list: picked, i: 0, stars: 0, xp: 0, total: 0 };
  showTrace();
}
function traceSay(t, c) {
  if (t === 'j') { const K = KANJI.find(x => x.k === c); return `${K.w}、 ${K.r}の かんじ`; }
  const h = t === 'k' ? HIRA[KATA.indexOf(c)] : c;
  const w = firstWord(h);
  return t === 'k' ? `カタカナの、${h}` : (w ? `${w[0]}の、${h}` : h);
}
function showTrace() {
  const t = R.trace, c = R.list[R.i];
  const K = t === 'j' ? KANJI.find(x => x.k === c) : null;
  app.innerHTML = `<div class="screen">
    <div class="topbar"><button class="iconbtn" id="quit">✕</button><div class="progress">${R.list.map((_, k) => `<i class="${k < R.i ? 'ok' : k === R.i ? 'now' : ''}"></i>`).join('')}</div><span class="combo"></span></div>
    <div class="traceinfo"><div class="r">${K ? `${K.e} ${esc(K.w)}（${K.r}）` : t === 'k' ? `ひらがなの「${HIRA[KATA.indexOf(c)]}」` : (firstWord(c) ? `${firstWord(c)[1]} ${firstWord(c)[0]} の「${c}」` : `「${c}」`)}</div></div>
    <div class="tracebox" id="tb"><canvas id="cg"></canvas><canvas id="cu"></canvas></div>
    <div id="fb"></div>
    <div class="tracebtns" id="tbtns"><button class="btn" id="spk">🔊</button><button class="btn" id="clr">けす</button><button class="btn go" id="done">できた！</button></div></div>`;
  const tb = $('#tb'), cg = $('#cg'), cu = $('#cu');
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const W = tb.clientWidth;
  [cg, cu].forEach(cv => { cv.width = W * dpr; cv.height = W * dpr; cv.getContext('2d').scale(dpr, dpr); });
  const g = cg.getContext('2d');
  g.strokeStyle = '#f3d9b1'; g.lineWidth = 1.5; g.setLineDash([6, 6]);
  g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, W); g.moveTo(0, W / 2); g.lineTo(W, W / 2); g.stroke(); g.setLineDash([]);
  drawGlyph(g, c, W, '#e6e1f0');
  const u = cu.getContext('2d');
  u.lineCap = 'round'; u.lineJoin = 'round'; u.strokeStyle = '#3d3a4b'; u.lineWidth = W * .055;
  const strokes = []; let cur = null;
  const pos = e => { const r = cu.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return [(p.clientX - r.left) / r.width, (p.clientY - r.top) / r.height]; };
  const down = e => { e.preventDefault(); cur = [pos(e)]; strokes.push(cur); const [x, y] = cur[0]; u.beginPath(); u.arc(x * W, y * W, u.lineWidth / 2, 0, 7); u.fillStyle = u.strokeStyle; u.fill(); };
  const move = e => { if (!cur) return; e.preventDefault(); const p = pos(e), l = cur[cur.length - 1]; cur.push(p); u.beginPath(); u.moveTo(l[0] * W, l[1] * W); u.lineTo(p[0] * W, p[1] * W); u.stroke(); };
  const up = () => { cur = null; };
  cu.addEventListener('touchstart', down, { passive: false }); cu.addEventListener('touchmove', move, { passive: false }); cu.addEventListener('touchend', up);
  cu.addEventListener('mousedown', down); cu.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  $('#quit').onclick = () => { if (confirm('とちゅうで やめる？')) home(); };
  $('#spk').onclick = () => say(traceSay(t, c));
  $('#clr').onclick = () => { strokes.length = 0; u.clearRect(0, 0, W, W); SFX.tap(); };
  $('#done').onclick = () => {
    if (!strokes.length) { toast('ゆびで なぞってね'); return; }
    const sc = judgeTrace(c, strokes);
    const n = sc.cov >= .78 && sc.prec >= .8 ? 3 : sc.cov >= .64 && sc.prec >= .7 ? 2 : sc.cov >= .5 && sc.prec >= .6 ? 1 : 0;
    $('#tbtns').classList.add('hidden');
    if (n > 0) {
      SFX.ok(); if (n === 3) confetti(25);
      R.stars += n; R.xp += 3 + n; R.total += n;
      S.traced[t][c] = Math.max(S.traced[t][c] || 0, n); S.col[t][c] = (S.col[t][c] || 0) + 1;
      if (S.miss['tr:' + c]) S.miss['tr:' + c]--; save();
      const m = n === 3 ? 'じょうず！ はなまる！' : n === 2 ? 'いいね！' : 'かけたね！';
      $('#fb').innerHTML = `<div class="feedback"><div class="stars">${'⭐'.repeat(n)}${'☆'.repeat(3 - n)}</div><div class="t">${m}</div>
        <div class="stack" style="margin-top:8px"><button class="btn go wide" id="nx">つぎへ ▶</button>${n < 3 ? '<button class="btn wide" id="re">もういちど かく</button>' : ''}</div></div>`;
      say(m);
      $('#nx').onclick = () => { SFX.tap(); R.i++; R.i < R.list.length ? showTrace() : finishTrace(); };
      if ($('#re')) $('#re').onclick = () => { R.stars -= n; R.xp -= 3 + n; R.total -= n; showTrace(); };
    } else {
      SFX.ng(); S.miss['tr:' + c] = (S.miss['tr:' + c] || 0) + 1; save();
      const tip = sc.prec < .6 ? 'うすい もじから はみださないように かいてみよう' : 'うすい もじの ぜんぶを なぞってみよう';
      $('#fb').innerHTML = `<div class="feedback"><div class="t">おしい！</div><div class="e">${tip}</div><button class="btn go wide" id="re">もういちど</button></div>`;
      say('おしい！ ' + tip);
      $('#re').onclick = () => { SFX.tap(); showTrace(); };
    }
  };
  setTimeout(() => say(traceSay(t, c)), 250);
}
function drawGlyph(ctx, c, W, color, fat = 0) {
  ctx.save(); ctx.fillStyle = color; ctx.strokeStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = TRACE_FONT(W * .78);
  const m = ctx.measureText(c);
  const asc = m.actualBoundingBoxAscent || W * .39, desc = m.actualBoundingBoxDescent || W * .39;
  const y = W / 2 + (asc - desc) / 2;
  ctx.fillText(c, W / 2, y);
  if (fat) { ctx.lineWidth = fat; ctx.lineJoin = 'round'; ctx.strokeText(c, W / 2, y); }
  ctx.restore();
}
function judgeTrace(c, strokes) {
  const N = 120;
  const mk = () => { const cv = document.createElement('canvas'); cv.width = cv.height = N; return cv.getContext('2d', { willReadFrequently: true }); };
  const gC = mk(), fC = mk(), uC = mk();
  drawGlyph(gC, c, N, '#000');
  drawGlyph(fC, c, N, '#000', N * .09);
  uC.lineCap = 'round'; uC.lineJoin = 'round'; uC.lineWidth = N * .085; uC.strokeStyle = '#000'; uC.fillStyle = '#000';
  for (const s of strokes) {
    uC.beginPath(); uC.arc(s[0][0] * N, s[0][1] * N, uC.lineWidth / 2, 0, 7); uC.fill();
    uC.beginPath(); uC.moveTo(s[0][0] * N, s[0][1] * N); for (const p of s) uC.lineTo(p[0] * N, p[1] * N); uC.stroke();
  }
  const a = gC.getImageData(0, 0, N, N).data, f = fC.getImageData(0, 0, N, N).data, b = uC.getImageData(0, 0, N, N).data;
  let g = 0, gu = 0, u = 0, uf = 0;
  for (let i = 3; i < a.length; i += 4) {
    const isG = a[i] > 100, isU = b[i] > 100, isF = f[i] > 100;
    if (isG) { g++; if (isU) gu++; }
    if (isU) { u++; if (isF) uf++; }
  }
  return { cov: g ? gu / g : 0, prec: u ? uf / u : 0 };
}
function finishTrace() {
  const before = stageIndex(S.xp);
  S.xp += R.xp; S.stars += R.stars; S.rounds++; save();
  const t = R.trace;
  resultScreen({ title: `⭐ ${R.total} / 15`, msg: R.total >= 13 ? 'もじの めいじん！' : R.total >= 9 ? 'じょうずに かけたね！' : 'たくさん かけたね！',
    gains: [`✨ +${R.xp} けいけんち`, `⭐ +${R.stars}`], before, after: stageIndex(S.xp), pulls: R.total >= 13 ? 2 : 1, again: () => startTrace(t) });
}

// ================= ずかん =================
function zukan(tab) {
  const tabs = { life: '🐾 いきもの', h: 'ひらがな', k: 'カタカナ', j: 'かんじ' };
  let inner = '', count = '';
  if (tab === 'life') {
    const have = CREATURES.filter(c => S.creatures[c[0]]).length;
    count = `${have} / ${CREATURES.length} しゅるい`;
    inner = `<div class="zgrid">${CREATURES.map(c => S.creatures[c[0]]
      ? `<div class="zcell r${c[2]}" data-c="${c[0]}" style="font-size:32px">${c[0]}<span class="cnt">×${S.creatures[c[0]]}</span></div>`
      : `<div class="zcell no">？</div>`).join('')}</div>`;
  } else {
    const list = TRACE_SETS[tab].list;
    const have = list.filter(c => S.col[tab][c]).length;
    count = `${have} / ${list.length} もじ ゲット　<small style="color:var(--sub)">✍️＝なぞりがき ずみ</small>`;
    inner = `<div class="zgrid ${tab === 'j' ? 'k' : ''}">${list.map(c => S.col[tab][c]
      ? `<div class="zcell" data-z="${c}">${c}${S.traced[tab][c] ? '<span class="tr">✍️</span>' : ''}</div>` : `<div class="zcell no">${tab === 'j' ? '？' : c}</div>`).join('')}</div>`;
  }
  app.innerHTML = `<div class="screen">
    <div class="topbar"><button class="iconbtn" id="back">◀</button><span class="spacer"></span><h2 style="margin:0">📖 ずかん</h2><span class="spacer"></span><span style="width:44px"></span></div>
    <div class="tabs">${Object.entries(tabs).map(([k, v]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${v}</button>`).join('')}</div>
    <div class="zcount">${count}</div>${inner}</div>`;
  $('#back').onclick = () => { SFX.tap(); home(); };
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { SFX.tap(); zukan(b.dataset.tab); });
  app.querySelectorAll('[data-c]').forEach(b => b.onclick = () => { const c = CREATURES.find(x => x[0] === b.dataset.c); say(c[1]); toast(`${c[0]} ${c[1]}`, 1000); });
  app.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { say(traceSay(tab, b.dataset.z)); });
}

// ================= おみせ =================
function shop() {
  const items = SHOP.map(([id, e, n, p]) => {
    const own = S.owned.includes(id), wear = S.wearing[SLOT[id]] === id;
    return `<button class="item ${own ? 'owned' : ''} ${wear ? 'wearing' : ''}" data-id="${id}"><div class="ie">${e}</div><div class="in">${n}</div>
      <div class="ip">${wear ? 'つけてる' : own ? 'もってる' : `⭐${p}`}</div></button>`;
  }).join('');
  app.innerHTML = `<div class="screen">
    <div class="topbar"><button class="iconbtn" id="back">◀</button><span class="spacer"></span><span class="pill">⭐ ${S.stars}</span></div>
    <h2>🛍️ おみせ</h2>
    <div class="pet-wrap">${petHTML('small')}<div class="petname">${esc(S.name)}</div></div>
    <p style="text-align:center;color:var(--sub);font-size:14px;margin:0 0 10px">⭐で かって、${esc(S.name)}に つけてあげよう</p>
    <div class="shop">${items}</div></div>`;
  $('#back').onclick = () => { SFX.tap(); home(); };
  app.querySelectorAll('[data-id]').forEach(b => b.onclick = () => {
    const [id, e, n, p] = SHOP.find(x => x[0] === b.dataset.id);
    const slot = SLOT[id];
    if (S.owned.includes(id)) { S.wearing[slot] = S.wearing[slot] === id ? null : id; SFX.tap(); save(); shop(); return; }
    if (S.stars < p) { SFX.ng(); toast(`⭐が あと ${p - S.stars} たりないよ`); say(`ほしが あと ${p - S.stars} こ たりないよ`); return; }
    if (!confirm(`${n}を ⭐${p}で かう？`)) return;
    S.stars -= p; S.owned.push(id); S.wearing[slot] = id; save();
    SFX.fan(); confetti(30); say(`${n}を かったよ！ にあうね！`); shop();
  });
}

// ================= おうちの かたへ =================
const keyLabel = k => {
  const [t, v] = [k.slice(0, k.indexOf(':')), k.slice(k.indexOf(':') + 1)];
  return ({ h: 'ひらがな', k: 'カタカナ', j: '漢字', sp: '表記（っ・ゃ・のばす音）', kw: 'カタカナ語', kh: 'ひらがな/カタカナの使い分け', op: '反対語', od: 'なかま分け',
    sh: 'しりとり', pa: '助詞 は・を・へ', wb: 'わ・お・え', or: '語順', tr: 'なぞり書き' }[t] || t) + '：' + v.slice(0, 14);
};
function parent() {
  const wn = Object.fromEntries(Object.entries(WORLDS).map(([k, v]) => [k, v.name]));
  const stats = Object.entries(WORLDS).map(([k]) => { const s = S.stats[k] || { ok: 0, ng: 0 }; const n = s.ok + s.ng;
    return `<div>${wn[k]}　<b>${n ? Math.round(s.ok / n * 100) + '%' : '—'}</b> <small style="color:var(--sub)">（${n}問）</small></div><div class="bar"><i style="width:${n ? s.ok / n * 100 : 0}%"></i></div>`; }).join('');
  const weak = Object.entries(S.miss).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const tog = (k, l) => `<div class="row"><span>${l}</span><button class="toggle ${S.settings[k] ? 'on' : ''}" data-s="${k}">${S.settings[k] ? 'オン' : 'オフ'}</button></div>`;
  app.innerHTML = `<div class="screen">
    <div class="topbar"><button class="iconbtn" id="back">◀</button><span class="spacer"></span><b>おうちの方へ</b><span class="spacer"></span><span style="width:44px"></span></div>
    <div class="pcard"><h3>📊 がんばりの記録</h3>
      遊んだ回数：<b>${S.rounds}</b>回　／　遊んだ日数：<b>${S.days.total}</b>日（連続 ${S.days.streak}日）<br>
      覚えた文字：ひらがな ${Object.keys(S.col.h).length}/46、カタカナ ${Object.keys(S.col.k).length}/46、漢字 ${Object.keys(S.col.j).length}/80<br>
      なぞり書き：ひらがな ${Object.keys(S.traced.h).length}、カタカナ ${Object.keys(S.traced.k).length}、漢字 ${Object.keys(S.traced.j).length}</div>
    <div class="pcard"><h3>✅ 分野ごとの正答率</h3>${stats}</div>
    <div class="pcard"><h3>🔁 つまずいている所</h3>${weak.length ? weak.map(([k, v]) => `<div>・${esc(keyLabel(k))}（${v}）</div>`).join('') + '<small style="color:var(--sub)">間違えた問題は自動で多めに出題され、正解すると減っていきます。</small>' : 'まだありません'}</div>
    <div class="pcard"><h3>⚙️ 設定</h3>${tog('voice', '読み上げ（音声）')}${tog('slow', 'ゆっくり読み上げ')}${tog('sound', '効果音')}</div>
    <div class="pcard"><h3>📱 ホーム画面に追加するには</h3>
      iPhone・iPad：Safariで開き、下の共有ボタン（□に↑）→「ホーム画面に追加」。<br>
      読み上げが聞こえないときは、本体の消音スイッチ（マナーモード）を切ってください。<br>
      データはこの端末の中だけに保存されます（送信はしていません）。</div>
    <div class="pcard"><h3>🧑‍🏫 学習内容</h3>小学1年生の国語：ひらがな・カタカナ（46字ずつ）、1年生で習う漢字80字、反対語・なかま分け・しりとり、助詞「は・を・へ」、語順。<br><small style="color:var(--sub)">バージョン ${VERSION}</small></div>
    <button class="btn wide danger" id="reset">データをすべて消す</button></div>`;
  $('#back').onclick = home;
  app.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const k = b.dataset.s; S.settings[k] = !S.settings[k]; save(); parent(); if (k !== 'sound') say('こんにちは'); });
  $('#reset').onclick = () => {
    if (confirm('育てたキャラ・図鑑・記録がすべて消えます。よろしいですか？') && confirm('本当に消しますか？（元に戻せません）')) {
      localStorage.removeItem(KEY); S = DEFAULT(); save(); home();
    }
  };
}

// ================= きどう =================
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('gesturestart', e => e.preventDefault());
window.KOKUGO = { G, S: () => S, judgeTrace, WORLDS };
home();

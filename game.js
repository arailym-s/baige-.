'use strict';
/* =========================================================
   BAIGE BEYOND BORDERS  -  teacher-controlled digital race
   Modules (in this file): config · state · audio · art · track ·
   screens · movement · cards · victory
   NO educational questions live here: they stay on paper cards.
   ========================================================= */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- CONFIG: board layout (edit here or in Settings) ----------
   Order follows the PHYSICAL board clockwise from START/FINISH.
   Index 0 = START/FINISH. Check it against your printed board!  */
const DEFAULT_TRACK = 'start,tulpar,saigulik,qulager,taiburyl,culture,fwd,saigulik,taiburyl,qulager,culture,tulpar,secret,saigulik,taiburyl,qulager,culture,tulpar,saigulik,back,qulager,taiburyl,secret,tulpar,qulager,back,taiburyl'.split(',');

/* tile / card types: n=tile label, bg/bd=colours, ic=icon, t=card title, h=horse shown */
const T = {
  start:    { n: 'START FINISH', bg: '#fff', bd: '#c1121f', ic: '🏁', t: 'START / FINISH' },
  tulpar:   { n: 'Tulpar', bg: '#f9e2d0', bd: '#b3361b', ic: '♞', t: 'TULPAR CHALLENGE!', h: 3 },
  saigulik: { n: 'Saigulik', bg: '#e2f5e0', bd: '#1d7a46', ic: '♞', t: 'SAIGULIK CHALLENGE!', h: 1 },
  qulager:  { n: 'Qulager', bg: '#dfe9ff', bd: '#1f3f99', ic: '♞', t: 'QULAGER CHALLENGE!', h: 2 },
  taiburyl: { n: 'Taiburyl', bg: '#f1e4ff', bd: '#7b3fb0', ic: '♞', t: 'TAIBURYL CHALLENGE!', h: 0 },
  culture:  { n: 'Kazakh Culture', bg: '#fff3c4', bd: '#a8710a', ic: '⛺', t: 'KAZAKH CULTURE CHALLENGE!' },
  secret:   { n: 'Secret Box', bg: '#ffe9a8', bd: '#d49412', ic: '?', t: 'SECRET BOX!' },
  fwd:      { n: 'Move Forward', bg: '#d6ecff', bd: '#1f4fd8', ic: '»', t: 'MOVE FORWARD' },
  back:     { n: 'Move Backward', bg: '#ecdcff', bd: '#6a2bb0', ic: '«', t: 'MOVE BACKWARD' }
};
const CARD_BTNS = { main: ['tulpar', 'saigulik', 'qulager', 'taiburyl'], special: ['secret', 'culture', 'fwd', 'back'] };

/* six distinct Tulpars: c=coat m=mane a=ornament t=team colour */
const HORSES = [
  { n: 'Golden Tulpar',   c: '#e8b93c', m: '#fbe08a', a: '#1e4fa8', t: '#f2b705', w: 1 },
  { n: 'Silver Tulpar',   c: '#eef1f4', m: '#c3ccd4', a: '#19b5b0', t: '#2bb5c9', w: 1 },
  { n: 'Midnight Tulpar', c: '#25262b', m: '#111',    a: '#e0a82e', t: '#8a5cf6' },
  { n: 'Fire Tulpar',     c: '#a8431f', m: '#5c1e0c', a: '#d62828', t: '#e5383b' },
  { n: 'Sky Tulpar',      c: '#d3e8f6', m: '#ffffff', a: '#3fa0e6', t: '#4895ef', w: 1 },
  { n: 'Emerald Tulpar',  c: '#5a3320', m: '#2b160c', a: '#1f9d55', t: '#2fb36d' }
];

/* ---------- state (single source of truth) ---------- */
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
let C = Object.assign({ speed: 450, vol: .5, music: true, muted: false, exact: false,
  reduced: matchMedia('(prefers-reduced-motion:reduce)').matches, track: DEFAULT_TRACK.slice() }, load('baigeC', {}));
let S = load('baigeS', { phase: 'menu', teams: [], turn: 0, hist: [], paused: false, won: null, track: C.track.slice() });
let D = { n: 3, names: [1, 2, 3, 4, 5, 6].map(i => 'Team ' + i), hs: [0, 1, 2, 3, 4, 5] }; // setup draft
let N = 1, busy = false;
const saveS = () => localStorage.setItem('baigeS', JSON.stringify(S));
const saveC = () => localStorage.setItem('baigeC', JSON.stringify(C));
const L = () => S.track.length;                    // finish = position L (same tile as START)

/* ---------- audio (synthesised, no files) ---------- */
let ac;
function tone(f, d = .15, ty = 'sine', v = .15, when = 0) {
  if (C.muted || !C.vol || !navigator.userActivation?.hasBeenActive) return;
  ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + when;
  o.type = ty; o.frequency.value = f;
  g.gain.setValueAtTime(v * C.vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + .02);
}
const arp = (fs, ty = 'triangle', d = .22, gap = .09) => fs.forEach((f, i) => tone(f, d, ty, .16, i * gap));
const SFX = {
  click: () => tone(520, .08, 'triangle'), pick: () => arp([440, 660], 'triangle', .12),
  step: () => tone(110 + Math.random() * 20, .06, 'square', .07), dice: () => tone(200 + Math.random() * 400, .05, 'square', .08),
  fwd: () => arp([523, 659, 784, 1046]), back: () => arp([392, 330, 262], 'sawtooth', .2, .1),
  reveal: () => arp([392, 523, 659, 784, 988], 'sine', .35, .1), count: () => tone(660, .2, 'triangle'),
  go: () => arp([784, 988, 1175], 'triangle', .5, .06), sprint: () => arp([659, 784, 659, 784], 'square', .1, .1),
  win: () => arp([523, 659, 784, 1046, 784, 1046, 1318], 'triangle', .35, .13)
};
const sfx = k => SFX[k] && SFX[k]();
const PENT = [293.66, 329.63, 392, 440, 493.88, 587.33];
let mi = 2;
setInterval(() => { if (!C.music || S.phase === 'menu' && !navigator.userActivation?.hasBeenActive) return;
  mi = Math.max(0, Math.min(5, mi + [-1, 0, 1][Math.random() * 3 | 0]));
  tone(PENT[mi], .6, 'triangle', document.body.classList.contains('sprint') ? .09 : .05); }, 480);

/* ---------- art (SVG horses & scene) ---------- */
function horseSVG(h) {
  return `<svg class="horse" viewBox="0 0 125 90" style="--coat:${h.c};--mane:${h.m};--acc:${h.a}">
<g class="tail"><path d="M28 38C8 38 -2 58 8 76C14 62 22 56 32 50Z" fill="var(--mane)"/></g>
<g class="leg l1"><rect x="26" y="54" width="8" height="30" rx="4"/><rect class="hoof" x="25" y="80" width="10" height="6" rx="2"/></g>
<g class="leg l3"><rect x="68" y="54" width="8" height="30" rx="4"/><rect class="hoof" x="67" y="80" width="10" height="6" rx="2"/></g>
<g class="body"><ellipse cx="54" cy="46" rx="31" ry="16" fill="var(--coat)"/>
${h.w ? '<path class="wing" d="M44 36C36 16 18 12 8 14C20 18 26 28 34 40Z" fill="#fff" stroke="var(--acc)" stroke-width="1.5"/>' : ''}
<rect x="42" y="33" width="24" height="15" rx="5" fill="var(--acc)" stroke="#ffd54a" stroke-width="2"/><circle cx="54" cy="41" r="3" fill="#ffd54a"/></g>
<g class="head"><path d="M74 38L90 12L106 22L92 52Z" fill="var(--coat)"/>
<ellipse cx="107" cy="31" rx="14" ry="7.5" transform="rotate(38 107 31)" fill="var(--coat)"/>
<path d="M92 11L96 1L101 13Z" fill="var(--coat)"/><circle cx="108" cy="27" r="2.4" fill="#111"/><circle cx="108.7" cy="26.3" r=".8" fill="#fff"/>
<path d="M90 12C74 8 66 26 72 42C78 30 84 24 94 20Z" fill="var(--mane)"/>
<path d="M99 22L113 36" stroke="var(--acc)" stroke-width="3" fill="none"/></g>
<g class="leg l2"><rect x="36" y="54" width="8" height="30" rx="4"/><rect class="hoof" x="35" y="80" width="10" height="6" rx="2"/></g>
<g class="leg l4"><rect x="78" y="54" width="8" height="30" rx="4"/><rect class="hoof" x="77" y="80" width="10" height="6" rx="2"/></g></svg>`;
}
const yurt = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 44V20Q0 -4 36 -4T72 20V44Z" fill="#f8f4e8" stroke="#bfa877" stroke-width="2"/><path d="M0 30H72" stroke="#c4421b" stroke-width="3" stroke-dasharray="6 3"/><rect x="28" y="22" width="16" height="22" rx="3" fill="#8b4a1c"/><path d="M36 -4V-10" stroke="#8b4a1c" stroke-width="3"/></g>`;
function scene() {
  let tufts = '', sp = '';
  for (let i = 0; i < 26; i++) { const x = 15 + i * 31 + (i * 37 % 13), y = 345 + (i * 53 % 140); tufts += `<path class="tuft" d="M${x} ${y}l-4-16 6 12 2-18 3 18 6-12-4 16z" fill="#8a7a1c"/>`; }
  for (let i = 0; i < 22; i++) sp += `<circle class="sp" style="animation-delay:${(i % 7) * -.13}s" cx="${210 + i * 18}" cy="338" r="5" fill="hsl(${i * 47},70%,45%)"/>`;
  return `<svg class="scene" viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f98e6"/><stop offset="1" stop-color="#d7efff"/></linearGradient><linearGradient id="gr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3c457"/><stop offset="1" stop-color="#a98b27"/></linearGradient></defs>
<rect width="800" height="500" fill="url(#sk)"/><circle cx="650" cy="90" r="44" fill="#fff6b8"/>
<path d="M0 320L110 180 190 260 320 110 450 280 560 170 680 270 760 200 800 250V340H0Z" fill="#7d93b8"/>
<path d="M320 110L288 160 316 150 334 168 352 146ZM110 180L90 208 112 200 126 210ZM560 170L540 200 560 194 574 204Z" fill="#fff"/>
<path d="M0 330Q200 295 400 322T800 312V500H0Z" fill="url(#gr)"/>${tufts}
<path d="M-20 420Q250 340 420 400T820 360" stroke="#b97b3c" stroke-width="46" fill="none" opacity=".85"/>
${yurt(70, 300, 1.4)}${yurt(640, 296, 1.5)}${yurt(560, 310, 1)}
<g stroke="#5a3a1a" stroke-width="3"><path d="M200 330V290"/><path d="M600 330V285"/></g>
<path class="flag" d="M200 290l34 8-34 10z" fill="#d62828"/><path class="flag" d="M600 285l34 8-34 10z" fill="#d62828"/>${sp}</svg>
<i class="cloud"></i><i class="cloud b"></i><i class="cloud c"></i>`;
}

/* ---------- track geometry: tiles on a rounded-square ring ---------- */
function tilePos(i, n) {
  const a = 8, s = 84, d = (s * 4 / n) * i;
  if (d < s) return [a + d, a, 0];
  if (d < 2 * s) return [a + s, a + d - s, 1];
  if (d < 3 * s) return [a + s - (d - 2 * s), a + s, 2];
  return [a, a + s - (d - 3 * s), 3];
}

/* ---------- UI helpers ---------- */
const app = h => { $('#app').innerHTML = h; };
const ov = h => { $('#ov').innerHTML = h; };
const closeOv = () => { $('#ov').innerHTML = ''; };
let tt; const toast = m => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 2600); };
function applyCfg() {
  document.body.classList.toggle('calm', C.reduced);
  $('#mute').classList.toggle('off', C.muted);
  document.body.style.setProperty('--spd', C.speed + 'ms');
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-x]') || e.target.id === 'ov' && $('#ov .card')) closeOv();
  if (e.target.closest('button')) sfx('click');
});
$('#mute').onclick = () => { C.muted = !C.muted; saveC(); applyCfg(); };

/* ---------- screens ---------- */
function menu() {
  S.phase = S.teams.length && S.phase === 'game' ? 'game' : 'menu';
  const resume = S.phase === 'game' && S.teams.length;
  app(`<section class="menu">${scene()}<div class="hero"><h1>BAIGE<br>BEYOND BORDERS</h1><div class="sub">Learn English, Discover Kazakh Culture</div>
<div class="btns">${resume ? '<button class="btn gold" id="cont">CONTINUE RACE</button>' : ''}<button class="btn" id="go">START GAME</button><button class="btn" id="how">HOW TO PLAY</button><button class="btn" id="set">SETTINGS</button></div></div>
${[0, 3, 1, 2].map((h, i) => `<div class="runner r${i}">${horseSVG(HORSES[h])}</div>`).join('')}</section>`);
  if (resume) $('#cont').onclick = () => gameScreen();
  $('#go').onclick = setup; $('#how').onclick = how; $('#set').onclick = settings;
}
function how() {
  app(`<section class="menu">${scene()}<div class="sheet text"><h2>How to play</h2><ol>
<li>Put every horse pawn on the START/FINISH square of the physical board.</li>
<li>The active team rolls the real die and moves its pawn on the board.</li>
<li>Draw the card that matches the square and follow its instructions on paper.</li>
<li>The teacher decides the result, then taps <b>Move Forward</b> or <b>Move Backward</b> to make the Tulpar gallop the same number of spaces.</li>
<li>Tap <b>Next Team</b>. The first team back at START/FINISH after the full circle wins. Tap <b>Confirm Winner</b>.</li></ol>
<p>This site never asks questions and never checks answers. All questions stay on your printed cards. Mistake? Use <b>Undo</b> or <b>Set position</b>.</p>
<div class="row"><button class="btn" id="b">Back</button></div></div></section>`);
  $('#b').onclick = menu;
}
function settings() {
  app(`<section class="menu">${scene()}<div class="sheet"><h2>Settings</h2>
<label>Animation speed<input type="range" id="sp" min="200" max="900" step="50" value="${1100 - C.speed}"></label>
<label>Sound volume<input type="range" id="vo" min="0" max="1" step=".05" value="${C.vol}"></label>
<label>Background music (dombra-style)<input type="checkbox" id="mu" ${C.music ? 'checked' : ''}></label>
<label>Reduced motion mode<input type="checkbox" id="rm" ${C.reduced ? 'checked' : ''}></label>
<label>Exact roll needed to finish (no overshoot)<input type="checkbox" id="ex" ${C.exact ? 'checked' : ''}></label>
<label style="display:block">Track layout, clockwise from START (comma separated). Types: ${Object.keys(T).join(', ')}.
<textarea id="tr">${C.track.join(', ')}</textarea></label>
<div class="row"><button class="btn" id="rt">Reset track</button><button class="btn go" id="sv">Save</button><button class="btn" id="b">Back</button></div></div></section>`);
  $('#rt').onclick = () => { $('#tr').value = DEFAULT_TRACK.join(', '); };
  $('#b').onclick = menu;
  $('#sv').onclick = () => {
    const tr = $('#tr').value.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (tr.length < 8 || tr[0] !== 'start' || tr.some(k => !T[k])) return toast('Track must start with "start", have 8+ spaces and use known types.');
    C.speed = 1100 - +$('#sp').value; C.vol = +$('#vo').value; C.music = $('#mu').checked; C.reduced = $('#rm').checked; C.exact = $('#ex').checked; C.track = tr;
    saveC(); applyCfg(); sfx('pick'); toast('Saved. Track changes apply to the next new game.');
  };
}
function setup() {
  const used = i => D.hs.slice(0, D.n).filter((_, k) => k !== i);
  const rows = [...Array(D.n)].map((_, i) => { const h = HORSES[D.hs[i]];
    return `<div class="trow" style="--tc:${h.t}"><span class="num">${i + 1}</span><input data-nm="${i}" value="${esc(D.names[i])}" maxlength="18" aria-label="Team ${i + 1} name">
<button data-hp="${i}" data-s="-1" aria-label="Previous horse">◀</button><div class="prev" id="pv${i}">${horseSVG(h)}</div><button data-hp="${i}" data-s="1" aria-label="Next horse">▶</button><b>${h.n}</b></div>`; }).join('');
  app(`<section class="setup">${scene()}<div class="sheet"><h2>Choose your teams</h2>
<div class="cnt">${[2, 3, 4, 5, 6].map(n => `<button class="nb big ${n === D.n ? 'on' : ''}" data-c="${n}">${n}</button>`).join('')}<span>teams, one Tulpar each</span></div>
${rows}<div class="row"><button class="btn" id="sh">Shuffle turn order</button><button class="btn" id="b">Back</button></div>
<button class="btn gold huge" id="st">LET THE BAIGE BEGIN!</button></div></section>`);
  $$('[data-nm]').forEach(i => i.oninput = () => { D.names[+i.dataset.nm] = i.value; });
  $$('[data-c]').forEach(b => b.onclick = () => { D.n = +b.dataset.c; for (let i = 0; i < 6; i++) while (D.hs.slice(0, D.n).indexOf(D.hs[i]) !== i && i < D.n) D.hs[i] = (D.hs[i] + 1) % 6; setup(); });
  $$('[data-hp]').forEach(b => b.onclick = () => { const i = +b.dataset.hp; let h = D.hs[i];
    do { h = (h + +b.dataset.s + 6) % 6; } while (used(i).includes(h));
    D.hs[i] = h; sfx('pick'); setup(); const p = $('#pv' + i); p.classList.add('gal'); setTimeout(() => p.classList.remove('gal'), 900); });
  $('#sh').onclick = () => { const idx = [...Array(D.n).keys()].sort(() => Math.random() - .5);
    const nn = idx.map(i => D.names[i]), hh = idx.map(i => D.hs[i]); nn.forEach((v, i) => D.names[i] = v); hh.forEach((v, i) => D.hs[i] = v); setup(); };
  $('#b').onclick = menu;
  $('#st').onclick = () => {
    S = { phase: 'game', teams: [...Array(D.n)].map((_, i) => ({ name: D.names[i].trim() || 'Team ' + (i + 1), h: D.hs[i], pos: 0 })), turn: 0, hist: [], paused: false, won: null, track: C.track.slice() };
    if (new Set(S.teams.map(t => t.h)).size !== S.teams.length) return toast('Every team needs a different horse.');
    saveS(); gameScreen(true);
  };
}

/* ---------- main game screen ---------- */
function gameScreen(intro) {
  const n = L();
  const tiles = S.track.map((k, i) => { const t = T[k], [x, y] = tilePos(i, n);
    return `<div class="tile" id="t${i}" style="left:${x}%;top:${y}%;--bg:${t.bg};--bd:${t.bd}"><u>${i ? i : ''}</u><i>${t.ic}</i><span>${t.n}</span></div>`; }).join('');
  const riders = S.teams.map((t, i) => `<div class="rider" id="h${i}" style="--tc:${HORSES[t.h].t}">${horseSVG(HORSES[t.h])}<em style="background:${HORSES[t.h].t}">${esc(t.name)}</em></div>`).join('');
  app(`<section class="game"><div class="board" id="board">${tiles}<div class="center">${scene()}<div class="ban">BAIGE BEYOND BORDERS</div><div class="ctitle"><small>NOW RACING</small><b id="now"></b></div></div>${riders}</div>
<aside><div class="sb"><h3>Race standings</h3><div id="sb"></div></div>
<div class="panel" id="pn"><header><b>Teacher controls</b><button id="pt" aria-label="Collapse">▾</button></header><div id="pb">
<div class="row"><button class="btn" id="nx">Next team ▶</button><button id="dice">🎲 Roll <b id="dv">–</b></button></div>
<div class="row"><span>Spaces</span>${[1, 2, 3, 4, 5, 6].map(k => `<button class="nb" data-n="${k}">${k}</button>`).join('')}<input id="cn" type="number" min="0" max="60" aria-label="Custom spaces"></div>
<div class="row"><button class="btn go" id="fw">Move forward ▶▶</button><button class="btn bad" id="bk">◀◀ Move back</button></div>
<div class="row"><input id="ex" type="number" min="0" placeholder="Exact space"><button id="exb">Set position</button></div>
<div class="row l"><span>Main:</span>${CARD_BTNS.main.map(k => `<button data-card="${k}">${T[k].n}</button>`).join('')}</div>
<div class="row l"><span>Special:</span>${CARD_BTNS.special.map(k => `<button data-card="${k}">${T[k].n}</button>`).join('')}</div>
<div class="row"><button id="un">↶ Undo</button><button id="ps">⏸ Pause</button><button class="btn gold" id="wn">🏆 Confirm winner</button><button id="rs">Reset game</button></div>
<b>Movement history</b><ol class="hl" id="hl" reversed></ol></div></div></aside></section>`);
  applyCfg();
  S.teams.forEach((_, i) => place(i)); syncN(); upd(); bindPanel();
  if (intro) ceremony();
}
function place(i, hit) {
  const t = S.teams[i], el = $('#h' + i), p = t.pos % L(), [x, y, side] = tilePos(p, L());
  const ox = (i - (S.teams.length - 1) / 2) * 2.6, oy = (i % 2 ? 1 : -1) * 1.6;
  el.style.left = x + ox + '%'; el.style.top = y + oy + '%';
  el.classList.toggle('flip', (side === 2) !== el.classList.contains('back'));
  if (hit) { const tl = $('#t' + p); tl.classList.remove('hit'); void tl.offsetWidth; tl.classList.add('hit'); }
}
function upd() {
  const n = L(), max = Math.max(...S.teams.map(t => t.pos)), lead = max > 0 && S.teams.filter(t => t.pos === max).length === 1;
  $('#sb').innerHTML = S.teams.map((t, i) => { const h = HORSES[t.h];
    return `<div class="srow ${i === S.turn ? 'on' : ''}" data-t="${i}" style="--tc:${h.t}"><div>${horseSVG(h)}</div><div><b>${esc(t.name)}${lead && t.pos === max ? '<span class="tag">LEADING</span>' : ''}${i === S.turn ? '<span class="tag">YOUR TURN</span>' : ''}</b><small>${t.pos >= n ? 'At the finish!' : (n - t.pos) + ' to finish'}</small></div><div class="pos">${t.pos >= n ? '🏁' : t.pos}</div></div>`; }).join('');
  $$('.srow').forEach(r => r.onclick = () => { if (busy) return; S.turn = +r.dataset.t; saveS(); upd(); });
  $('#now').textContent = S.teams[S.turn].name;
  $$('.rider').forEach((r, i) => r.classList.toggle('active', i === S.turn));
  $('#hl').innerHTML = S.hist.slice(-8).map(h => `<li>${esc(S.teams[h.i].name)}: ${h.from} → ${h.to} (${h.to - h.from > 0 ? '+' : ''}${h.to - h.from})</li>`).join('') || '<li>No moves yet</li>';
  const wasSprint = document.body.classList.contains('sprint'), sp = max >= n - 4 && max > 0;
  document.body.classList.toggle('sprint', sp); if (sp && !wasSprint) sfx('sprint');
  document.body.classList.toggle('paused', S.paused); $('#ps').textContent = S.paused ? '▶ Resume' : '⏸ Pause';
}
function syncN() { $$('.nb[data-n]').forEach(b => b.classList.toggle('on', +b.dataset.n === N)); const c = $('#cn'); if (c) c.value = N; }
const lock = b => $$('#pn button').forEach(x => { if (x.id !== 'pt') x.disabled = b; });

/* ---------- movement: the ONLY code that changes positions ---------- */
function dust(i) {
  const el = $('#h' + i), d = document.createElement('i'); d.className = 'dust';
  d.style.left = el.style.left; d.style.top = `calc(${el.style.top} + 1%)`; $('#board').appendChild(d); setTimeout(() => d.remove(), 750);
}
async function move(i, delta, fromCard) {
  if (busy) return;
  if (S.paused) return toast('Game is paused.');
  if (S.won !== null) return toast('Race is over. Use Play again.');
  const n = L(), t = S.teams[i], from = t.pos;
  if (C.exact && from + delta > n) return toast('Exact roll needed to finish.');
  const to = Math.max(0, Math.min(n, from + delta));
  if (to === from) return toast('No movement.');
  busy = true; lock(true);
  S.hist.push({ i, from, to, turn: S.turn });
  const el = $('#h' + i), dir = Math.sign(to - from);
  $('#now').textContent = `${t.name}: ${dir > 0 ? 'forward' : 'back'} ${Math.abs(to - from)}`;
  el.classList.add('go'); el.classList.toggle('back', dir < 0); sfx(dir > 0 ? 'fwd' : 'back');
  for (let p = from; p !== to;) { p += dir; t.pos = p; place(i); dust(i); sfx('step'); await sleep(C.speed); }
  el.classList.remove('go', 'back'); place(i, true); saveS(); upd(); busy = false; lock(false);
  if (to >= n) toast('🏁 Finish reached! Tap "Confirm winner" when the physical board agrees.');
  else if (!fromCard && to > 0) { await sleep(450); openCard(S.track[to]); }
}
function undo() {
  if (busy) return; const h = S.hist.pop(); if (!h) return toast('Nothing to undo.');
  S.teams[h.i].pos = h.from; S.turn = h.turn; S.won = null; place(h.i, true); saveS(); upd(); toast('Last move undone.'); closeOv();
}
function bindPanel() {
  $('#nx').onclick = () => { if (busy) return; S.turn = (S.turn + 1) % S.teams.length; saveS(); upd(); };
  $('#dice').onclick = async () => { if (busy) return; busy = true; let v; for (let k = 0; k < 9; k++) { v = 1 + Math.random() * 6 | 0; $('#dv').textContent = v; sfx('dice'); await sleep(70 + k * 12); } N = v; syncN(); busy = false; };
  $$('.nb[data-n]').forEach(b => b.onclick = () => { N = +b.dataset.n; syncN(); });
  $('#cn').oninput = e => { N = Math.max(0, +e.target.value || 0); $$('.nb[data-n]').forEach(b => b.classList.toggle('on', +b.dataset.n === N)); };
  $('#fw').onclick = () => move(S.turn, N); $('#bk').onclick = () => move(S.turn, -N);
  $('#exb').onclick = () => { const v = $('#ex').value; if (v === '') return; const to = Math.max(0, Math.min(L(), +v)); move(S.turn, to - S.teams[S.turn].pos, true); $('#ex').value = ''; };
  $$('[data-card]').forEach(b => b.onclick = () => { if (!busy) openCard(b.dataset.card); });
  $('#un').onclick = undo;
  $('#ps').onclick = () => { S.paused = !S.paused; saveS(); upd(); };
  $('#wn').onclick = win;
  $('#rs').onclick = () => { if (busy || !confirm('Reset the race? All horses return to START.')) return; resetRace(); };
  $('#pt').onclick = () => { $('#pn').classList.toggle('shut'); $('#pt').textContent = $('#pn').classList.contains('shut') ? '▸' : '▾'; };
}
function resetRace() { S.teams.forEach(t => t.pos = 0); S.turn = 0; S.hist = []; S.won = null; S.paused = false; saveS(); gameScreen(false); }

/* ---------- ceremony ---------- */
async function ceremony() {
  let skip = false; ov(`<div class="cd"><div id="cdv"></div><div class="row"><button class="btn" id="sk">Skip ▶▶</button></div></div>`);
  $('#sk').onclick = () => { skip = true; };
  const show = html => { const c = $('#cdv'); if (c) c.innerHTML = html; };
  for (const t of S.teams) { if (skip) break; show(`<div class="gal">${horseSVG(HORSES[t.h])}</div><div class="nm" style="color:${HORSES[t.h].t}">${esc(t.name)}</div>`); sfx('pick'); await sleep(1000); }
  for (const w of ['3', '2', '1']) { if (skip) break; show(`<b>${w}</b>`); sfx('count'); await sleep(850); }
  if (!skip) { show('<b>BAIGE BEGINS!</b>'); sfx('go'); $$('.rider').forEach(r => r.classList.add('go')); await sleep(1100); }
  $$('.rider').forEach(r => r.classList.remove('go')); closeOv();
}

/* ---------- card animations (no educational content) ---------- */
function openCard(k) {
  if (!T[k] || k === 'start') return; const t = T[k], team = S.teams[S.turn];
  const horse = t.h !== undefined ? `<div class="gal">${horseSVG(HORSES[t.h])}</div>` : '';
  const art = k === 'secret' ? `<div class="chest" id="chest"><div class="glow"></div><div class="lid"></div><div class="base">?</div></div>`
    : k === 'culture' ? `<svg viewBox="0 0 150 90">${yurt(30, 22, 1.2)}<path d="M8 82H142" stroke="#a8710a" stroke-width="4" stroke-dasharray="8 4"/></svg>`
    : k === 'fwd' ? '<div class="arr">»»</div>' : k === 'back' ? '<div class="arr">««</div>' : horse;
  const msg = k === 'secret' ? 'Tap the box to open it!' : (k === 'fwd' || k === 'back') ? '' : `Use the physical ${t.n} card.`;
  ov(`<div class="card ${k === 'back' ? 'back' : ''} ${k === 'secret' ? 'closed' : ''}" style="--bg:${t.bg};--bd:${t.bd}"><button class="x" data-x aria-label="Close">✕</button>
<h2 id="ch">${t.t}</h2><div class="art" id="art"><img src="assets/cards/${k}.png" alt="" onload="this.parentNode.classList.add('hasimg')" onerror="this.remove()">${art}</div>
<p id="cm">${msg}</p><div class="ctl"><div>Team: <b>${esc(team.name)}</b></div>
<div class="nrow">${[1, 2, 3, 4, 5, 6].map(x => `<button class="nb" data-n="${x}">${x}</button>`).join('')}<input id="cn2" type="number" min="0" max="60" value="${N}"></div>
<div class="row"><button class="btn go" data-d="1">Forward ▶▶</button><button class="btn bad" data-d="-1">◀◀ Back</button><button class="btn" data-d="0">No movement</button></div></div></div>`);
  sfx('reveal');
  const card = $('#ov .card'), label = () => { if (k === 'fwd' || k === 'back') $('#cm').textContent = `${k === 'fwd' ? 'MOVE FORWARD' : 'MOVE BACKWARD'} ${N} SPACE${N === 1 ? '' : 'S'}!`; };
  const sync = () => { $$('.nb', card).forEach(b => b.classList.toggle('on', +b.dataset.n === N)); $('#cn2').value = N; label(); }; sync();
  $$('.nb', card).forEach(b => b.onclick = () => { N = +b.dataset.n; sync(); syncN(); });
  $('#cn2').oninput = e => { N = Math.max(0, +e.target.value || 0); $$('.nb', card).forEach(b => b.classList.toggle('on', +b.dataset.n === N)); label(); syncN(); };
  $$('[data-d]', card).forEach(b => b.onclick = () => { const d = +b.dataset.d; closeOv(); if (d) move(S.turn, d * N, true); });
  const ch = $('#chest'); if (ch) ch.onclick = () => { card.classList.remove('closed'); card.classList.add('open'); $('#cm').textContent = 'Use the physical Secret Box card, then enter the result.'; sfx('reveal'); };
}

/* ---------- victory ---------- */
async function win() {
  if (busy || S.paused) return; const n = L();
  let i = S.teams[S.turn].pos >= n ? S.turn : S.teams.findIndex(t => t.pos >= n);
  if (i < 0) { i = S.turn; if (!confirm(`No horse has reached the finish yet. Crown ${S.teams[i].name} anyway?`)) return; await move(i, n - S.teams[i].pos, true); }
  S.won = i; saveS(); sfx('win'); const t = S.teams[i];
  const conf = [...Array(90)].map(() => `<i class="conf" style="left:${Math.random() * 100}%;background:hsl(${Math.random() * 60 + 20},95%,55%);animation-duration:${2 + Math.random() * 3}s;animation-delay:${Math.random() * 1.5}s"></i>`).join('');
  ov(`${conf}<div class="win"><div class="slow"><div class="gal" style="width:min(60vw,300px);margin:auto">${horseSVG(HORSES[t.h])}</div></div><div class="trophy">🏆</div><div class="nm">${esc(t.name)}</div><h2>CONGRATULATIONS, CHAMPIONS!</h2>
<div class="row"><button class="btn gold" id="pa">PLAY AGAIN</button><button class="btn" id="ng">NEW GAME</button><button class="btn" data-x>Skip</button></div></div>`);
  $('#pa').onclick = () => { closeOv(); resetRace(); }; $('#ng').onclick = () => { closeOv(); S = { phase: 'menu', teams: [], turn: 0, hist: [], paused: false, won: null, track: C.track.slice() }; saveS(); setup(); };
}

/* ---------- boot ---------- */
applyCfg();
S.phase === 'game' && S.teams.length ? gameScreen(false) : menu();

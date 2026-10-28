'use strict';
// Симулятор Схем — конструктор интегральных схем SS13 (integrated electronics MOLOT-BlueMoon-Station).
// Компоненты — блоки на поле, провода — связи пинов. Код справа — то же, что сохраняет анализатор схем
// и принимает принтер («Load program»): {"assembly":…,"components":[…],"wires":[…]}.

const CAT = Object.fromEntries(IC_CATALOG.map((c) => [c.name, c]));
const CATS = [
  ['Input', 'Ввод', '#2fb5a5'], ['Output', 'Вывод', '#d65a9c'], ['Arithmetic', 'Арифметика', '#4f8fe6'],
  ['Trig', 'Тригонометрия', '#4fb3e6'], ['Logic', 'Логика', '#e2b33a'], ['Memory', 'Память', '#9a6ad6'],
  ['Data Transfer', 'Передача данных', '#8a94a6'], ['Converter', 'Конвертеры', '#3fa66b'], ['Text', 'Текст', '#5cc08a'],
  ['Lists', 'Списки', '#b07ad6'], ['Time', 'Время', '#e07a3f'], ['Manipulation', 'Манипуляция', '#d68a3a'],
  ['Smart', 'Умные', '#c9a227'], ['Reagent', 'Реагенты', '#6fbf4a'], ['Atmospherics', 'Атмосфера', '#5aa6c8'],
  ['Power - Passive', 'Питание: пассивное', '#e6d34f'], ['Power - Active', 'Питание: активное', '#e6b84f'],
  ['Weaponized', 'Оружие', '#d63c45'],
];
for (const c of IC_CATALOG) if (!CATS.some((x) => x[0] === c.category)) CATS.push([c.category, c.category, '#8a94a6']);
const CAT_RU = Object.fromEntries(CATS.map((c) => [c[0], c[1]]));
const CAT_COLOR = Object.fromEntries(CATS.map((c) => [c[0], c[2]]));

const PIN = {
  number: ['число', '#6aa6ff'], string: ['текст', '#6fd38a'], char: ['символ', '#9be3a9'], boolean: ['да/нет', '#f0a54a'],
  list: ['список', '#c08cff'], ref: ['ссылка', '#ff7ab0'], selfref: ['ссылка на себя', '#ff7ab0'], index: ['индекс', '#7fd6e6'],
  dir: ['направление', '#e6d36a'], color: ['цвет', '#ff9b6a'], any: ['любой', '#b4bcc8'],
  pulse_in: ['импульс', '#ffb84a'], pulse_out: ['импульс', '#ffb84a'],
};
const DIRS = [[1, 'север'], [2, 'юг'], [4, 'восток'], [8, 'запад'], [5, 'северо-восток'], [9, 'северо-запад'], [6, 'юго-восток'], [10, 'юго-запад']];

// Корпуса: лимиты из assemblies.dm (IC_MAX_SIZE_BASE 25, IC_COMPLEXITY_BASE 75)
const ASM_GROUPS = [
  ['Обычный корпус (assembly)', 'type-? electronic assembly', 'abcdefg', 1],
  ['Маленький (device)', 'type-? electronic device', 'abcdef', 0.5],
  ['Средний (mechanism)', 'type-? electronic mechanism', 'abcdefg', 2],
  ['Большой (machine)', 'type-? electronic machine', 'abcdef', 4],
  ['Дрон (drone) — может ездить', 'type-? electronic drone', 'abcdef', 3, true],
];
const ASM = {};
for (const [, tpl, letters, k, drone] of ASM_GROUPS) for (const l of letters) ASM[tpl.replace('?', l)] = { space: 25 * k, cx: 75 * k, drone: !!drone };
const WALL = [['tiny wall-mounted electronic assembly', 0.5], ['light wall-mounted electronic assembly', 1],
  ['wall-mounted electronic assembly', 2], ['heavy wall-mounted electronic assembly', 4]];
for (const [n, k] of WALL) ASM[n] = { space: 25 * k, cx: 75 * k };
const METAL_PER_W = 200; // SScircuit.cost_multiplier: MINERAL_MATERIAL_AMOUNT / 10

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem('circuits.' + k)); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('circuits.' + k, JSON.stringify(v)); } catch (e) { /* приватный режим */ } },
};
const capture = (el, e) => { try { el.setPointerCapture(e.pointerId); } catch (err) { /* указатель уже отпущен */ } };
const board = $('board'), world = $('world'), svg = $('wires');
const narrow = matchMedia('(max-width: 900px)');

// ---------- Состояние и история ----------
const blank = () => ({ asm: 'type-a electronic assembly', name: '', nodes: [], wires: [], next: 1 });
let S = valid(store.get('state')) || blank();
let view = store.get('view') || { x: 40, y: 40, s: 1 };
let sel = null;              // { node: id } | { wire: index }
let past = [], future = [], last = JSON.stringify(S);
let sim = null;

function valid(s) { return s && Array.isArray(s.nodes) && Array.isArray(s.wires) ? s : null; }
function commit() {
  const now = JSON.stringify(S);
  if (now === last) { refresh(); return; }
  past.push(last); if (past.length > 150) past.shift();
  future = []; last = now;
  store.set('state', S);
  if (sim) restartSim();
  refresh();
}
function restore(json) {
  S = JSON.parse(json); last = json; store.set('state', S);
  if (sel && sel.node && !node(sel.node)) sel = null;
  if (sel && sel.wire !== undefined) sel = null;
  if (sim) restartSim();
  renderAll();
}
function undo() { if (!past.length) return; future.push(last); restore(past.pop()); }
function redo() { if (!future.length) return; past.push(last); restore(future.pop()); }

const node = (id) => S.nodes.find((n) => n.id === id);
const pinDef = (n, k, i) => { const d = CAT[n.type]; return (k === 'I' ? d.inputs : k === 'O' ? d.outputs : d.activators)[i - 1]; };
const isSource = (n, k, i) => k === 'O' || (k === 'A' && pinDef(n, k, i)[1] === 'pulse_out');
const wiresOf = (id, k, i) => S.wires.filter((w) => (w.a[0] === id && w.a[1] === k && w.a[2] === i) || (w.b[0] === id && w.b[1] === k && w.b[2] === i));

// ---------- Вид: сдвиг и масштаб ----------
function applyView() {
  world.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.s})`;
  $('zLvl').textContent = Math.round(view.s * 100) + '%';
  store.set('view', view);
}
function zoomAt(f, cx, cy) {
  const s = Math.min(2, Math.max(0.25, view.s * f));
  const r = board.getBoundingClientRect();
  const px = cx - r.left, py = cy - r.top;
  view.x = px - ((px - view.x) * s) / view.s;
  view.y = py - ((py - view.y) * s) / view.s;
  view.s = s; applyView();
}
function toWorld(cx, cy) { const r = board.getBoundingClientRect(); return { x: (cx - r.left - view.x) / view.s, y: (cy - r.top - view.y) / view.s }; }
function fit() {
  if (!S.nodes.length) { view = { x: 40, y: 40, s: 1 }; applyView(); return; }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const n of S.nodes) {
    const el = els.get(n.id), w = el ? el.offsetWidth : 180, h = el ? el.offsetHeight : 100;
    x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + w); y1 = Math.max(y1, n.y + h);
  }
  const W = board.clientWidth || 600, H = board.clientHeight || 400, pad = 40;
  view.s = Math.min(1.2, Math.max(0.25, Math.min((W - pad * 2) / (x1 - x0), (H - pad * 2) / (y1 - y0))));
  view.x = (W - (x1 - x0) * view.s) / 2 - x0 * view.s;
  view.y = (H - (y1 - y0) * view.s) / 2 - y0 * view.s;
  applyView();
}

// ---------- Палитра ----------
function renderPalette() {
  const q = $('q').value.trim().toLowerCase(), basic = $('onlyDefault').checked;
  const open = store.get('open') || ['Input', 'Output', 'Arithmetic', 'Logic'];
  $('cats').innerHTML = CATS.map(([cat, ru, color]) => {
    const items = IC_CATALOG.filter((c) => c.category === cat && (!basic || !c.research) &&
      (!q || c.name.toLowerCase().includes(q) || (c.desc || '').toLowerCase().includes(q) || ru.toLowerCase().includes(q)));
    if (!items.length) return '';
    return `<details class="cat" data-cat="${esc(cat)}" style="--c:${color}" ${q || open.includes(cat) ? 'open' : ''}>
      <summary><i></i>${esc(ru)}<small>${items.length}</small></summary>
      ${items.map((c) => `<div class="item" data-type="${esc(c.name)}" title="${esc(plain(c.desc))}">
        <span class="nm">${esc(c.name)}</span>${c.research ? '<span class="r" title="Нужен улучшенный принтер">R</span>' : ''}<span class="bd">${fmtNum(c.complexity)}</span></div>`).join('')}
    </details>`;
  }).join('') || '<div class="muted" style="padding:10px">Ничего не найдено</div>';
}
$('cats').addEventListener('toggle', (e) => {
  if ($('q').value) return;
  store.set('open', [...document.querySelectorAll('.cat[open]')].map((d) => d.dataset.cat));
}, true);
$('q').addEventListener('input', renderPalette);
$('onlyDefault').addEventListener('change', renderPalette);

// Перетаскивание из палитры (pointer events — работает и на телефоне); клик — добавить в центр
$('cats').addEventListener('pointerdown', (e) => {
  const item = e.target.closest('.item'); if (!item || e.button > 0) return;
  const type = item.dataset.type, x0 = e.clientX, y0 = e.clientY;
  let ghost = null;
  const move = (ev) => {
    if (!ghost && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
    if (!ghost) { ghost = document.createElement('div'); ghost.className = 'ghost'; ghost.textContent = type; document.body.appendChild(ghost); }
    ghost.style.left = ev.clientX + 8 + 'px'; ghost.style.top = ev.clientY + 6 + 'px';
  };
  const up = (ev) => {
    removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
    if (ghost) {
      ghost.remove();
      const over = document.elementFromPoint(ev.clientX, ev.clientY);
      if (over && board.contains(over)) { const p = toWorld(ev.clientX, ev.clientY); addNode(type, p.x - 20, p.y - 14); }
    } else if (ev.type === 'pointerup') {
      const r = board.getBoundingClientRect();
      const p = r.width ? toWorld(r.left + r.width / 2, r.top + r.height / 3) : toWorld(innerWidth / 2, innerHeight / 3);
      const k = S.nodes.length % 6;
      addNode(type, p.x - 90 + k * 22, p.y - 40 + k * 22);
      if (narrow.matches) setTab('board');
    }
  };
  addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
});

function addNode(type, x, y) {
  const n = { id: S.next++, type, x: Math.round(x), y: Math.round(y), vals: {} };
  S.nodes.push(n); sel = { node: n.id }; commit();
}
function removeNode(id) {
  S.nodes = S.nodes.filter((n) => n.id !== id);
  S.wires = S.wires.filter((w) => w.a[0] !== id && w.b[0] !== id);
  if (sel && sel.node === id) sel = null;
  commit();
}
function duplicate(id) {
  const n = node(id); if (!n) return;
  const c = JSON.parse(JSON.stringify(n)); c.id = S.next++; c.x += 30; c.y += 30;
  S.nodes.push(c); sel = { node: c.id }; commit();
}

// ---------- Блоки на поле ----------
const els = new Map();
function renderAll() {
  for (const el of els.values()) el.remove();
  els.clear();
  for (const n of S.nodes) world.appendChild(renderNode(n));
  refresh();
}
function refresh() {
  // Узлы, которых нет (после отмены / импорта), и новые
  const ids = new Set(S.nodes.map((n) => n.id));
  for (const [id, el] of els) if (!ids.has(id)) { el.remove(); els.delete(id); }
  for (const n of S.nodes) {
    const el = els.get(n.id);
    if (!el) world.appendChild(renderNode(n));
    else if (el.dataset.sig !== sig(n)) el.replaceWith(renderNode(n));
    else { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  }
  for (const [id, el] of els) el.classList.toggle('sel', !!sel && sel.node === id);
  $('empty').style.display = S.nodes.length ? 'none' : '';
  $('undoBtn').disabled = !past.length; $('redoBtn').disabled = !future.length;
  drawWires(); renderInspector(); renderCode();
}
// Подпись узла: если поменялась — узел перерисовывается целиком
function sig(n) {
  const wired = S.wires.filter((w) => w.b[0] === n.id && w.b[1] === 'I').map((w) => w.b[2]).sort().join(',');
  return JSON.stringify([n.type, n.label || '', n.vals, n.special, wired, !!sim]);
}

function renderNode(n) {
  const d = CAT[n.type];
  const el = document.createElement('div');
  el.className = 'node'; el.dataset.id = n.id; el.dataset.sig = sig(n);
  el.style.cssText = `left:${n.x}px;top:${n.y}px;--c:${CAT_COLOR[d.category]}`;
  const pin = (k, i, p) => {
    const t = p[1], pulse = t === 'pulse_in' || t === 'pulse_out', src = k === 'O' || t === 'pulse_out';
    let extra = '';
    if (k === 'I') extra = wiresOf(n.id, 'I', i).length && !sim ? '' : `<span class="pv" data-v="${i}"></span>`;
    if (k === 'O' && sim) extra = `<span class="pv live" data-o="${i}"></span>`;
    if (t === 'pulse_in') extra = `<button class="fire" title="Подать импульс">▶</button>`;
    return `<div class="pin" data-k="${k}" data-i="${i}" title="${esc(p[0])} — ${PIN[t][0]}${src ? ', выход' : ', вход'}">` +
      `<i class="dot${pulse ? ' pulse' : ''}" style="--t:${PIN[t][1]}"></i><span class="pn">${esc(p[0])}</span>${extra}</div>`;
  };
  const acts = d.activators.map((p, i) => [p, i + 1]);
  const pIn = acts.filter(([p]) => p[1] === 'pulse_in'), pOut = acts.filter(([p]) => p[1] === 'pulse_out');
  const hasData = d.inputs.length || d.outputs.length;
  el.innerHTML =
    `<div class="nh"><div class="nt">${esc(n.label || d.name)}${n.label ? `<small>${esc(d.name)}</small>` : ''}</div>` +
    `${d.research ? '<span class="r" title="Нужен улучшенный принтер">R</span>' : ''}` +
    `<button class="ni" title="Свойства блока">ⓘ</button><button class="nx" title="Удалить (Delete)">×</button></div>` +
    `<div class="nb">` +
    (hasData ? `<div class="col in">${d.inputs.map((p, i) => pin('I', i + 1, p)).join('')}</div><div class="col out">${d.outputs.map((p, i) => pin('O', i + 1, p)).join('')}</div>` : '') +
    (acts.length ? (hasData ? '<div class="sep"></div>' : '') +
      `<div class="col in">${pIn.map(([p, i]) => pin('A', i, p)).join('')}</div><div class="col out">${pOut.map(([p, i]) => pin('A', i, p)).join('')}</div>` : '') +
    `</div><div class="nsim">${sim ? simControls(n) : ''}</div>`;
  els.set(n.id, el);
  paint(n, el);
  return el;
}

function fmtVal(v, type) {
  if (v === null || v === undefined) return 'null';
  if (type === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (type === 'dir') { const d = DIRS.find((x) => x[0] === v); return d ? d[1] : String(v); }
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === 'object') return v.ref || 'ref';
  if (typeof v === 'string') return `"${v}"`;
  return fmtNum(v);
}
function fmtNum(v) { return typeof v === 'number' ? String(Number(v.toFixed(4))) : String(v); }

// Значения на пинах: заданные константы, а в симуляции — живые значения
function paint(n, el = els.get(n.id)) {
  if (!el) return;
  const d = CAT[n.type], rt = sim && sim.get(n.id);
  el.querySelectorAll('.pv[data-v]').forEach((pv) => {
    const i = +pv.dataset.v, t = d.inputs[i - 1][1];
    const has = n.vals && i in n.vals;
    const v = rt ? rt.ins[i - 1] : has ? n.vals[i] : ICSim.pinDefault(d.inputs[i - 1]);
    pv.textContent = t === 'ref' || t === 'selfref' ? (rt && v ? fmtVal(v, t) : '—') : fmtVal(v, t);
    pv.title = String(pv.textContent);
    pv.classList.toggle('set', !!has || !!rt);
    pv.classList.toggle('ph', !has && !rt);
    pv.classList.toggle('live', !!rt);
  });
  if (rt) {
    el.querySelectorAll('.pv[data-o]').forEach((pv) => { const i = +pv.dataset.o; pv.textContent = fmtVal(rt.outs[i - 1], d.outputs[i - 1][1]); pv.title = pv.textContent; });
    const scr = el.querySelector('[data-live="screen"]'); if (scr) scr.textContent = rt.view.screen || '';
    const bulb = el.querySelector('[data-live="bulb"]');
    if (bulb) { bulb.querySelector('i').style.background = rt.view.light ? rt.view.color || '#fff' : '#333'; bulb.querySelector('span').textContent = rt.view.light ? 'горит' : 'не горит'; }
    const tick = el.querySelector('[data-live="tick"]'); if (tick) tick.textContent = rt.view.ticking ? '⏱ тикает' : '⏸ остановлен';
    const tog = el.querySelector('[data-live="toggle"]'); if (tog) tog.textContent = rt.outs[0] ? 'Выключить' : 'Включить';
    const selOpts = el.querySelector('select[data-act="input"]');
    if (selOpts && n.type === 'selection circuit') {
      const opts = rt.ins.filter((v) => typeof v === 'string' && v);
      if (selOpts.dataset.opts !== JSON.stringify(opts)) { selOpts.dataset.opts = JSON.stringify(opts); selOpts.innerHTML = opts.map((o) => `<option>${esc(o)}</option>`).join(''); }
    }
    if (selOpts && n.type === 'list selection circuit') {
      const opts = (Array.isArray(rt.ins[0]) ? rt.ins[0] : []).filter((v) => typeof v === 'string');
      if (selOpts.dataset.opts !== JSON.stringify(opts)) { selOpts.dataset.opts = JSON.stringify(opts); selOpts.innerHTML = opts.map((o) => `<option>${esc(o)}</option>`).join(''); }
    }
  }
}

// Управление блоком в симуляции: кнопки, панели ввода, экран, лампа
function simControls(n) {
  const t = n.type;
  if (t === 'button') return '<button class="btn" data-act="input">Нажать</button>';
  if (t === 'toggle button') return '<button class="btn" data-act="input" data-live="toggle">Включить</button>';
  if (t === 'number pad') return '<div class="row"><input class="inp" type="number" step="any" placeholder="число"><button class="btn" data-act="input">Ввести</button></div>';
  if (t === 'text pad') return '<div class="row"><input class="inp" placeholder="текст"><button class="btn" data-act="input">Ввести</button></div>';
  if (t === 'color pad') return '<div class="row"><input class="inp" type="color" value="#2fb5a5"><button class="btn" data-act="input">Ввести</button></div>';
  if (t === 'selection circuit' || t === 'list selection circuit') return '<div class="row"><select class="inp" data-act="input"></select><button class="btn" data-act="input">Выбрать</button></div>';
  if (/screen$/.test(t)) return '<div class="screen" data-live="screen"></div>';
  if (/light|light-emitting/.test(t)) return '<div class="bulb" data-live="bulb"><i></i><span></span></div>';
  if (/ticker/.test(t)) return '<div class="nosim" data-live="tick"></div>';
  if (!ICSim.supported(t)) return '<div class="nosim">не моделируется — нужен мир игры</div>';
  return '';
}

// ---------- Провода ----------
let tmpWire = null; // { from: {x, y}, to: {x, y}, src: bool }
function pinPoint(id, k, i) {
  const el = els.get(id); if (!el) return null;
  const dot = el.querySelector(`.pin[data-k="${k}"][data-i="${i}"] .dot`); if (!dot) return null;
  const r = dot.getBoundingClientRect(), w = world.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - w.left) / view.s, y: (r.top + r.height / 2 - w.top) / view.s };
}
const curve = (a, b) => {
  const dx = Math.max(30, Math.abs(b.x - a.x) * 0.5);
  return `M${a.x} ${a.y} C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
};
function wireColor(w) {
  const a = node(w.a[0]); if (!a) return '#888';
  const t = pinDef(a, w.a[1], w.a[2])[1];
  if (t === 'any') { const b = node(w.b[0]); return PIN[b ? pinDef(b, w.b[1], w.b[2])[1] : 'any'][1]; }
  return PIN[t][1];
}
let flashing = new Set();
function drawWires() {
  let html = '';
  S.wires.forEach((w, wi) => {
    const a = pinPoint(...w.a), b = pinPoint(...w.b); if (!a || !b) return;
    const d = curve(a, b), on = sel && sel.wire === wi;
    html += `<path d="${d}" stroke="${wireColor(w)}" class="${w.a[1] === 'A' ? 'pulse' : ''}${on ? ' sel' : ''}${flashing.has(wi) ? ' flash' : ''}"/>` +
      `<path class="hit" data-w="${wi}" d="${d}"/>`;
  });
  if (tmpWire) html += `<path class="tmp" d="${tmpWire.src ? curve(tmpWire.from, tmpWire.to) : curve(tmpWire.to, tmpWire.from)}"/>`;
  svg.innerHTML = html;
  // Кнопка удаления выбранного провода — посередине
  let del = world.querySelector('.wdel');
  if (sel && sel.wire !== undefined && S.wires[sel.wire]) {
    const w = S.wires[sel.wire], a = pinPoint(...w.a), b = pinPoint(...w.b);
    if (a && b) {
      if (!del) { del = document.createElement('button'); del.className = 'wdel'; del.title = 'Удалить провод (Delete)'; del.textContent = '×'; world.appendChild(del); }
      del.style.left = (a.x + b.x) / 2 + 'px'; del.style.top = (a.y + b.y) / 2 + 'px';
    }
  } else if (del) del.remove();
}
// Следующий кадр; таймер — на случай, когда кадры не идут (Пульт свёрнут, вкладка в фоне)
function soon(fn) {
  let done = false;
  const run = () => { if (!done) { done = true; fn(); } };
  requestAnimationFrame(run); setTimeout(run, 80);
}
let wireFrame = false;
const redrawSoon = () => { if (!wireFrame) { wireFrame = true; soon(() => { wireFrame = false; drawWires(); }); } };

function connect(p, q) {
  // p, q: { id, k, i }. Источник — выход данных или исходящий импульс; приёмник — вход данных или входящий импульс
  if (p.id === q.id && p.k === q.k && p.i === q.i) return false;
  const np = node(p.id), nq = node(q.id);
  const sp = isSource(np, p.k, p.i), sq = isSource(nq, q.k, q.i);
  if (sp === sq) return false;
  const pulseP = p.k === 'A', pulseQ = q.k === 'A';
  if (pulseP !== pulseQ) return false;
  const [s, t] = sp ? [p, q] : [q, p];
  const w = { a: [s.id, s.k, s.i], b: [t.id, t.k, t.i] };
  if (S.wires.some((x) => x.a.join() === w.a.join() && x.b.join() === w.b.join())) return false;
  S.wires.push(w); return true;
}
function canConnect(p, q) {
  if (!q || (p.id === q.id && p.k === q.k && p.i === q.i)) return false;
  const np = node(p.id), nq = node(q.id);
  return isSource(np, p.k, p.i) !== isSource(nq, q.k, q.i) && (p.k === 'A') === (q.k === 'A');
}
const pinOf = (el) => { const pin = el && el.closest && el.closest('.pin'); const nd = pin && pin.closest('.node'); return pin && nd ? { id: +nd.dataset.id, k: pin.dataset.k, i: +pin.dataset.i, el: pin } : null; };

// ---------- Мышь и касания на поле ----------
const pts = new Map(); // активные указатели для щипка
board.addEventListener('pointerdown', (e) => {
  if (e.button === 2) return;
  const t = e.target;
  if (t.closest('.zoom, .wdel, .fire, .nsim, .nh button')) return;
  const dot = t.closest('.dot');
  if (dot) { e.preventDefault(); return startWire(e, pinOf(dot)); }
  if (t.closest('.pv') && !t.closest('.pv.live')) return;
  const nd = t.closest('.node');
  if (nd) { e.preventDefault(); return startMove(e, +nd.dataset.id, !!t.closest('.nh')); }
  const hit = t.closest('path.hit');
  if (hit) { sel = { wire: +hit.dataset.w }; refresh(); return; }
  startPan(e);
});
board.addEventListener('click', (e) => {
  const t = e.target;
  if (t.closest('.wdel')) { if (sel && sel.wire !== undefined) { S.wires.splice(sel.wire, 1); sel = null; commit(); } return; }
  const nd = t.closest('.node'); if (!nd) return;
  const id = +nd.dataset.id;
  if (t.closest('.nx')) return removeNode(id);
  if (t.closest('.ni')) { sel = { node: id }; refresh(); if (narrow.matches) setTab('side'); return; }
  if (t.closest('.fire') && sim) { const p = pinOf(t); sim.fire(id, p.i); return; }
  const act = t.closest('[data-act="input"]');
  if (act && sim && act.tagName === 'BUTTON') {
    const box = act.closest('.nsim'), field = box.querySelector('input, select');
    sim.input(id, field ? field.value : undefined);
    return;
  }
  const pv = t.closest('.pv[data-v]');
  if (pv && !sim) { sel = { node: id }; refresh(); openValuePop(node(id), +pv.dataset.v, pv); }
});
board.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && sim && e.target.closest('.nsim')) { const b = e.target.closest('.nsim').querySelector('button[data-act]'); if (b) b.click(); }
});
board.addEventListener('contextmenu', (e) => {
  const p = pinOf(e.target);
  if (p) { e.preventDefault(); const ws = wiresOf(p.id, p.k, p.i); if (ws.length) { S.wires = S.wires.filter((w) => !ws.includes(w)); commit(); } }
});
board.addEventListener('wheel', (e) => {
  if (e.target.closest('.nsim')) return;
  e.preventDefault();
  if (e.ctrlKey || !e.shiftKey && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX, e.clientY);
  else { view.x -= e.deltaX || e.deltaY; applyView(); }
}, { passive: false });

function startPan(e) {
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  capture(board, e);
  board.classList.add('panning');
  let moved = false, pinch = null;
  const move = (ev) => {
    if (!pts.has(ev.pointerId)) return;
    const prev = pts.get(ev.pointerId);
    pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      if (pinch) { zoomAt(dist / pinch.dist, mx, my); view.x += mx - pinch.mx; view.y += my - pinch.my; applyView(); }
      pinch = { dist, mx, my }; moved = true; return;
    }
    pinch = null;
    const dx = ev.clientX - prev.x, dy = ev.clientY - prev.y;
    if (Math.abs(dx) + Math.abs(dy) > 0) moved = true;
    view.x += dx; view.y += dy; applyView();
  };
  const up = (ev) => {
    pts.delete(ev.pointerId);
    if (pts.size) return;
    board.classList.remove('panning');
    board.removeEventListener('pointermove', move); board.removeEventListener('pointerup', up); board.removeEventListener('pointercancel', up);
    if (!moved && sel) { sel = null; refresh(); }
  };
  if (pts.size === 1) { board.addEventListener('pointermove', move); board.addEventListener('pointerup', up); board.addEventListener('pointercancel', up); }
}

function startMove(e, id, byHead) {
  const n = node(id), el = els.get(id); if (!n || !el) return;
  if (!sel || sel.node !== id) { sel = { node: id }; refresh(); }
  if (!byHead && e.pointerType !== 'mouse') return; // на телефоне блок двигается только за шапку — иначе нельзя прокрутить поле
  const x0 = e.clientX, y0 = e.clientY, nx = n.x, ny = n.y;
  let moved = false;
  capture(el, e);
  const move = (ev) => {
    const dx = (ev.clientX - x0) / view.s, dy = (ev.clientY - y0) / view.s;
    if (!moved && Math.hypot(dx, dy) < 3) return;
    moved = true;
    n.x = Math.round(nx + dx); n.y = Math.round(ny + dy);
    el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
    redrawSoon();
  };
  const up = () => {
    el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    if (moved) commit();
  };
  el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

function startWire(e, p) {
  if (!p) return;
  const np = node(p.id), from = pinPoint(p.id, p.k, p.i);
  tmpWire = { from, to: from, src: isSource(np, p.k, p.i) };
  let hot = null;
  capture(board, e);
  const move = (ev) => {
    tmpWire.to = toWorld(ev.clientX, ev.clientY);
    const q = pinOf(document.elementFromPoint(ev.clientX, ev.clientY));
    const ok = q && canConnect(p, q) ? q.el : null;
    if (hot !== ok) { if (hot) hot.classList.remove('hot'); hot = ok; if (hot) hot.classList.add('hot'); }
    redrawSoon();
  };
  const up = (ev) => {
    board.removeEventListener('pointermove', move); board.removeEventListener('pointerup', up); board.removeEventListener('pointercancel', up);
    if (hot) hot.classList.remove('hot');
    tmpWire = null;
    const q = ev.type === 'pointerup' ? pinOf(document.elementFromPoint(ev.clientX, ev.clientY)) : null;
    if (q && connect(p, q)) commit(); else drawWires();
  };
  board.addEventListener('pointermove', move); board.addEventListener('pointerup', up); board.addEventListener('pointercancel', up);
}

// ---------- Значения входов ----------
// Редактор значения по типу пина; onSet(value | undefined) — undefined снимает значение (остаётся значение по умолчанию)
function valueEditor(n, i, onDone) {
  const p = CAT[n.type].inputs[i - 1], t = p[1];
  const has = n.vals && i in n.vals, v = has ? n.vals[i] : ICSim.pinDefault(p);
  const wrap = document.createElement('div');
  const set = (val) => {
    if (val === undefined) delete n.vals[i]; else n.vals[i] = val;
    commit(); if (onDone) onDone();
  };
  if (t === 'ref' || t === 'selfref') { wrap.innerHTML = '<span class="wired">задаётся только проводом</span>'; return wrap; }
  if (t === 'boolean') {
    wrap.innerHTML = `<label><input type="checkbox" ${v ? 'checked' : ''}> ${v ? 'TRUE' : 'FALSE'}</label>`;
    wrap.querySelector('input').addEventListener('change', (e) => set(e.target.checked ? 1 : 0));
    return wrap;
  }
  if (t === 'dir') {
    wrap.innerHTML = `<select class="inp"><option value="">null</option>${DIRS.map(([k, ru]) => `<option value="${k}" ${v === k ? 'selected' : ''}>${ru} (${k})</option>`).join('')}</select>`;
    wrap.querySelector('select').addEventListener('change', (e) => set(e.target.value ? +e.target.value : undefined));
    return wrap;
  }
  if (t === 'color') {
    wrap.className = 'row'; wrap.style.cssText = 'display:flex;gap:4px';
    wrap.innerHTML = `<input type="color" value="${typeof v === 'string' ? v.toLowerCase() : '#ffffff'}"><input class="inp" maxlength="7" placeholder="#RRGGBB" value="${esc(v || '')}"><button class="btn" title="Сбросить">✕</button>`;
    const [pick, txt, clr] = wrap.children;
    pick.addEventListener('change', () => set(pick.value.toUpperCase()));
    txt.addEventListener('change', () => { const s = txt.value.trim(); if (!s) set(undefined); else if (/^#[0-9a-f]{6}$/i.test(s)) set(s.toUpperCase()); else txt.value = v || ''; });
    clr.addEventListener('click', () => set(undefined));
    return wrap;
  }
  if (t === 'list') {
    wrap.innerHTML = `<textarea class="inp" rows="3" placeholder="по одному элементу в строке">${esc(Array.isArray(v) ? v.map((x) => (x === null ? 'null' : String(x))).join('\n') : '')}</textarea>`;
    wrap.querySelector('textarea').addEventListener('change', (e) => {
      const lines = e.target.value.split('\n').filter((s) => s !== '');
      set(lines.length ? lines.map(parseAny) : undefined);
    });
    return wrap;
  }
  const numeric = t === 'number' || t === 'index';
  wrap.innerHTML = `<input class="inp" ${numeric ? 'type="number" step="any"' : ''} ${t === 'char' ? 'maxlength="1"' : ''} placeholder="${t === 'any' ? 'число или текст' : 'null'}">`;
  const inp = wrap.firstChild;
  inp.value = v === null || v === undefined ? '' : t === 'any' && typeof v === 'string' && /^-?[\d.]+$/.test(v) ? `"${v}"` : String(v);
  inp.addEventListener('change', () => {
    const s = inp.value;
    if (s === '') return set(undefined);
    if (numeric) { const x = Number(s); if (!Number.isNaN(x)) set(t === 'index' ? Math.max(0, Math.min(500, Math.round(x))) : x); return; }
    set(t === 'any' ? parseAny(s) : s);
  });
  return wrap;
}
// «Любой» пин: число, если похоже на число; "в кавычках" — всегда текст; null — пусто
function parseAny(s) {
  const q = s.match(/^"(.*)"$/s); if (q) return q[1];
  if (s === 'null') return null;
  return /^\s*-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?\s*$/i.test(s) ? Number(s) : s;
}

let pop = null;
function closePop() { if (pop) { pop.remove(); pop = null; } }
function openValuePop(n, i, anchor) {
  closePop();
  const p = CAT[n.type].inputs[i - 1];
  pop = document.createElement('div'); pop.className = 'pop';
  pop.innerHTML = `<div><b>${esc(p[0])}</b> <span class="muted">${PIN[p[1]][0]}</span></div>`;
  pop.appendChild(valueEditor(n, i, closePop));
  const clear = document.createElement('button'); clear.className = 'btn'; clear.textContent = 'Сбросить значение';
  clear.addEventListener('click', () => { delete n.vals[i]; commit(); closePop(); });
  pop.appendChild(clear);
  document.body.appendChild(pop);
  const r = anchor.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(innerWidth - pop.offsetWidth - 8, r.left)) + 'px';
  pop.style.top = (r.bottom + pop.offsetHeight + 8 > innerHeight ? Math.max(8, r.top - pop.offsetHeight - 6) : r.bottom + 6) + 'px';
  const f = pop.querySelector('input:not([type=checkbox]):not([type=color]), textarea, select'); if (f) f.focus();
}
addEventListener('pointerdown', (e) => { if (pop && !pop.contains(e.target)) closePop(); }, true);

// ---------- Свойства блока ----------
function plain(html) { return String(html || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
function renderInspector() {
  const box = $('insp');
  const n = sel && sel.node ? node(sel.node) : null;
  if (!n) {
    box.innerHTML = `<div class="hint">
      <b style="color:var(--fg)">Как собрать схему</b><br>
      1. Перетащите блоки из списка на поле (или нажмите на блок в списке).<br>
      2. Тяните провод от кружка выхода к кружку входа: кружки — данные, ромбы — импульсы.<br>
      3. Нажмите на значение входа, чтобы задать константу.<br>
      4. Скопируйте код ниже, в принтере схем — «Load program», вставьте и печатайте.<br><br>
      <kbd>Delete</kbd> удалить · <kbd>Ctrl+D</kbd> копия блока · <kbd>Ctrl+Z</kbd> / <kbd>Ctrl+Y</kbd> отмена · ПКМ по пину — отсоединить · колесо — масштаб
    </div>`;
    return;
  }
  const d = CAT[n.type];
  const where = (w) => { const o = node(w.a[0]); return o ? `${o.label || o.type} → ${pinDef(o, w.a[1], w.a[2])[0]}` : '?'; };
  box.style.setProperty('--c', CAT_COLOR[d.category]);
  box.innerHTML = `
    <h3><i></i>${esc(d.name)}</h3>
    <div class="meta"><span>${esc(CAT_RU[d.category])}</span><span>сложность ${fmtNum(d.complexity)}</span><span>место ${fmtNum(d.size)}</span>
      ${d.power ? `<span>энергия ${d.power}/имп.</span>` : ''}${d.cooldown > 1 ? `<span>перезарядка ${d.cooldown / 10} с</span>` : ''}
      ${d.research ? '<span class="r">нужен улучшенный принтер</span>' : ''}${d.actions && d.actions.includes('movement') ? '<span class="a">только в дроне</span>' : ''}
      ${d.limit ? `<span>не больше ${d.limit} на сборку</span>` : ''}${ICSim.supported(d.name) ? '' : '<span>не моделируется</span>'}</div>
    ${d.desc ? `<div class="desc">${esc(plain(d.desc))}</div>` : ''}
    ${d.extended ? `<div class="ext">${esc(plain(d.extended))}</div>` : ''}
    <label class="muted">Подпись блока <input class="inp" id="lbl" maxlength="42" placeholder="${esc(d.name)}" value="${esc(n.label || '')}" style="width:100%"></label>
    <table id="ins"></table>
    <div class="acts"><button class="btn" id="dupBtn">Копия</button><button class="btn" id="unwireBtn">Отсоединить провода</button><button class="btn" id="delBtn">Удалить</button></div>`;
  const tbl = box.querySelector('#ins');
  const rows = [];
  d.inputs.forEach((p, i) => rows.push([p, i + 1]));
  if (n.type === 'constant chip') rows.push(null);
  if (!rows.length) tbl.remove();
  for (const r of rows) {
    const tr = document.createElement('tr');
    if (!r) {
      tr.innerHTML = '<td>значение чипа<span class="t">число/текст</span></td><td></td>';
      const inp = document.createElement('input'); inp.className = 'inp'; inp.placeholder = 'null';
      inp.value = n.special === undefined || n.special === null ? '' : typeof n.special === 'string' && /^-?[\d.]+$/.test(n.special) ? `"${n.special}"` : String(n.special);
      inp.addEventListener('change', () => { if (inp.value === '') delete n.special; else { const v = parseAny(inp.value); if (v === null) delete n.special; else n.special = v; } commit(); });
      tr.lastChild.appendChild(inp); tbl.appendChild(tr); continue;
    }
    const [p, i] = r, ws = wiresOf(n.id, 'I', i);
    tr.innerHTML = `<td>${esc(p[0])}<span class="t">${PIN[p[1]][0]}</span></td><td></td>`;
    if (ws.length) tr.lastChild.innerHTML = `<span class="wired">← ${esc(ws.map(where).join(', '))}</span>`;
    else tr.lastChild.appendChild(valueEditor(n, i));
    tbl.appendChild(tr);
  }
  box.querySelector('#lbl').addEventListener('change', (e) => {
    const v = e.target.value.replace(/[<>"\\]/g, '').trim();
    if (v && v !== d.name) n.label = v; else delete n.label;
    commit();
  });
  box.querySelector('#dupBtn').addEventListener('click', () => duplicate(n.id));
  box.querySelector('#delBtn').addEventListener('click', () => removeNode(n.id));
  box.querySelector('#unwireBtn').addEventListener('click', () => { S.wires = S.wires.filter((w) => w.a[0] !== n.id && w.b[0] !== n.id); commit(); });
}

// ---------- Код для принтера ----------
function program() {
  const index = new Map(S.nodes.map((n, i) => [n.id, i + 1]));
  // Координаты для холста TGUI в игре — вокруг нуля, как у автораскладки
  const xs = S.nodes.map((n) => n.x), ys = S.nodes.map((n) => n.y);
  const cx = xs.length ? Math.round((Math.min(...xs) + Math.max(...xs)) / 2) : 0;
  const cy = ys.length ? Math.round((Math.min(...ys) + Math.max(...ys)) / 2) : 0;
  const components = S.nodes.map((n) => {
    const d = CAT[n.type], c = { type: d.name };
    if (n.label && n.label !== d.name) c.name = n.label;
    const inputs = Object.keys(n.vals || {}).map(Number).sort((a, b) => a - b)
      .filter((i) => d.inputs[i - 1] && n.vals[i] !== null && JSON.stringify(n.vals[i]) !== JSON.stringify(ICSim.pinDefault(d.inputs[i - 1])))
      .map((i) => [i, 0, n.vals[i]]);
    if (inputs.length) c.inputs = inputs;
    if (n.type === 'constant chip' && n.special !== undefined && n.special !== null) c.special = n.special;
    c.ui_x = Math.max(-25000, Math.min(25000, n.x - cx));
    c.ui_y = Math.max(-25000, Math.min(25000, n.y - cy));
    return c;
  });
  // Провода в порядке, в котором их пишет save(): по компоненту, затем входы → выходы → импульсы
  const ORD = { I: 0, O: 1, A: 2 };
  const key = (p) => [index.get(p[0]), ORD[p[1]], p[2]];
  const cmp = (a, b) => { for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]; return 0; };
  const wires = S.wires.filter((w) => index.has(w.a[0]) && index.has(w.b[0])).map((w) => {
    const a = [index.get(w.a[0]), w.a[1], w.a[2]], b = [index.get(w.b[0]), w.b[1], w.b[2]];
    return cmp(key(w.a), key(w.b)) <= 0 ? [a, b] : [b, a];
  }).sort((x, y) => cmp([x[0][0], ORD[x[0][1]], x[0][2]], [y[0][0], ORD[y[0][1]], y[0][2]]) || cmp([x[1][0], ORD[x[1][1]], x[1][2]], [y[1][0], ORD[y[1][1]], y[1][2]]));
  const assembly = { type: S.asm };
  if (S.name) assembly.name = S.name;
  const out = { assembly, components };
  if (wires.length) out.wires = wires;
  return out;
}

function check() {
  const a = ASM[S.asm] || { space: 25, cx: 75 };
  let cx = 0, space = 0, metal = 0;
  const research = new Set(), moving = new Set(), counts = {};
  for (const n of S.nodes) {
    const d = CAT[n.type];
    cx += d.complexity; space += d.size; metal += d.w * METAL_PER_W;
    if (d.research) research.add(d.name);
    if (d.actions && d.actions.includes('movement')) moving.add(d.name);
    counts[d.name] = (counts[d.name] || 0) + 1;
  }
  const errors = [], warns = [];
  if (!S.nodes.length) errors.push('Добавьте хотя бы один блок — пустую схему принтер не принимает.');
  if (cx > a.cx) errors.push(`Сложность ${fmtNum(cx)} больше лимита корпуса ${a.cx} («Complexity overflow»). Возьмите корпус побольше или уберите блоки.`);
  if (space > a.space) errors.push(`Место ${fmtNum(space)} больше лимита корпуса ${a.space} («Used space overflow»).`);
  if (moving.size && !a.drone) errors.push(`${[...moving].join(', ')} — только для корпуса-дрона: принтер откажется печатать.`);
  for (const [name, k] of Object.entries(counts)) { const lim = CAT[name].limit; if (lim && k > lim) errors.push(`«${name}» — не больше ${lim} на сборку.`); }
  if (research.size) warns.push(`Нужен улучшенный принтер (диск улучшения от РнД): ${[...research].join(', ')}.`);
  const unwiredPulse = S.nodes.filter((n) => CAT[n.type].activators.some((p) => p[1] === 'pulse_in') && !S.wires.some((w) => w.b[0] === n.id && w.b[1] === 'A'));
  if (S.nodes.length && unwiredPulse.length) warns.push(`Без входящего импульса (не сработают сами): ${[...new Set(unwiredPulse.map((n) => n.label || n.type))].join(', ')}.`);
  return { cx, space, metal, a, errors, warns };
}

function renderCode() {
  const c = check();
  const meter = (id, label, v, max) => { const m = $(id); m.innerHTML = `${label} <b>${fmtNum(v)}/${max}</b>`; m.classList.toggle('over', v > max); };
  meter('mCx', 'Сложность', c.cx, c.a.cx);
  meter('mSp', 'Место', c.space, c.a.space);
  $('mMt').innerHTML = `Металл <b>${c.metal.toLocaleString('ru')}</b>`;
  $('mMt').title = `Металл на печать компонентов: ${c.metal} см³ = ${(c.metal / 2000).toLocaleString('ru')} листа (корпус — отдельно)`;
  $('code').value = S.nodes.length ? JSON.stringify(program(), null, $('pretty').checked ? 1 : 0) : '';
  $('status').innerHTML =
    c.errors.map((e) => `<div class="e">✕ ${esc(e)}</div>`).join('') +
    c.warns.map((e) => `<div class="w">! ${esc(e)}</div>`).join('') +
    (!c.errors.length ? `<div class="k">✓ Принтер примет: ${S.nodes.length} ${plural(S.nodes.length, 'блок', 'блока', 'блоков')}, ${S.wires.length} ${plural(S.wires.length, 'провод', 'провода', 'проводов')}. Принтер схем → «Load program» → вставить код.</div>` : '');
}
const plural = (n, a, b, c) => (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? b : c);
$('pretty').addEventListener('change', renderCode);

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}
$('copyBtn').addEventListener('click', async () => {
  const text = $('code').value; if (!text) return toast('Схема пустая');
  try { await navigator.clipboard.writeText(text); }
  catch (e) { const ta = $('code'); ta.focus(); ta.select(); document.execCommand('copy'); }
  toast('Код скопирован — вставьте его в принтер схем');
});

// ---------- Вставка кода ----------
function decodeHtml(s) { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; }
function importProgram(text) {
  let o;
  try { o = JSON.parse(text.trim()); } catch (e) { throw new Error('Не получилось прочитать код: это не JSON. Скопируйте его целиком, от { до }.'); }
  if (!o || typeof o !== 'object' || !o.assembly || !Array.isArray(o.components) || !o.components.length) throw new Error('В коде нет корпуса (assembly) или списка компонентов (components).');
  const errs = [];
  const st = blank();
  st.asm = ASM[o.assembly.type] ? o.assembly.type : 'type-a electronic assembly';
  if (!ASM[o.assembly.type]) errs.push(`Корпус «${o.assembly.type}» неизвестен — поставлен type-a.`);
  if (o.assembly.name) st.name = decodeHtml(String(o.assembly.name)).slice(0, 42);
  const unknown = [];
  let placed = 0;
  o.components.forEach((c, i) => {
    const d = c && CAT[c.type];
    if (!d) { unknown.push(c && c.type); return; }
    const n = { id: st.next++, type: d.name, x: 0, y: 0, vals: {} };
    if (c.name && c.name !== d.name) n.label = decodeHtml(String(c.name)).slice(0, 42);
    if (Array.isArray(c.inputs)) for (const inp of c.inputs) if (Array.isArray(inp) && d.inputs[inp[0] - 1]) n.vals[inp[0]] = inp[2];
    if (c.special !== undefined && c.special !== null) n.special = c.special;
    if (typeof c.ui_x === 'number' && typeof c.ui_y === 'number' && (c.ui_x || c.ui_y)) { n.x = c.ui_x; n.y = c.ui_y; placed++; }
    n.at = i + 1;
    st.nodes.push(n);
  });
  if (unknown.length) throw new Error(`В каталоге нет компонентов: ${unknown.map((u) => `«${u}»`).join(', ')}.\nКод, скорее всего, с другого сервера или из другой версии сборки.`);
  const byIndex = new Map(st.nodes.map((n) => [n.at, n]));
  for (const w of Array.isArray(o.wires) ? o.wires : []) {
    const [p, q] = w || [];
    const np = p && byIndex.get(p[0]), nq = q && byIndex.get(q[0]);
    if (!np || !nq || !pinDef(np, p[1], p[2]) || !pinDef(nq, q[1], q[2])) { errs.push('Пропущен провод с неверными пинами.'); continue; }
    const ps = { id: np.id, k: p[1], i: p[2] }, qs = { id: nq.id, k: q[1], i: q[2] };
    const sp = isSource(np, p[1], p[2]);
    const [s, t] = sp ? [ps, qs] : [qs, ps];
    st.wires.push({ a: [s.id, s.k, s.i], b: [t.id, t.k, t.i] });
  }
  st.nodes.forEach((n) => delete n.at);
  if (placed < st.nodes.length) autoLayout(st);
  return { st, errs };
}

// Раскладка без координат: колонка = длина пути от истока, как ie_tgui_apply_auto_layout в игре
function autoLayout(st) {
  const incoming = new Map(st.nodes.map((n) => [n.id, new Set()]));
  for (const w of st.wires) if (w.a[0] !== w.b[0]) incoming.get(w.b[0]).add(w.a[0]);
  const depth = new Map(), state = new Map();
  const visit = (id) => {
    if (state.get(id) === 2) return depth.get(id);
    if (state.get(id) === 1) return 0;
    state.set(id, 1);
    let best = 0; for (const p of incoming.get(id)) best = Math.max(best, visit(p) + 1);
    depth.set(id, best); state.set(id, 2); return best;
  };
  const cols = [];
  for (const n of st.nodes) { const d = visit(n.id); (cols[d] ||= []).push(n); }
  cols.forEach((col, d) => {
    let y = 0;
    for (const n of col || []) {
      const def = CAT[n.type], rows = Math.max(def.inputs.length, def.outputs.length) + Math.ceil(def.activators.length / 2);
      n.x = d * 290; n.y = y; y += 60 + rows * 22 + 30;
    }
  });
}

function openModal(id) { $(id).hidden = false; }
document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => { if (e.target === m || e.target.closest('[data-close]')) m.hidden = true; }));
$('importBtn').addEventListener('click', () => { $('importErr').textContent = ''; $('importText').value = ''; openModal('importModal'); $('importText').focus(); });
$('importGo').addEventListener('click', () => {
  try {
    const { st, errs } = importProgram($('importText').value);
    S = st; sel = null; $('importModal').hidden = true;
    commit(); renderAll(); syncHeader(); soon(fit);
    toast(errs.length ? errs.join(' ') : `Загружено: ${S.nodes.length} ${plural(S.nodes.length, 'блок', 'блока', 'блоков')}`);
  } catch (e) { $('importErr').textContent = e.message; }
});

// ---------- Примеры ----------
const EXAMPLES = [
  { name: 'Счётчик нажатий', desc: 'Кнопка прибавляет 1, экран показывает число. Сумматор берёт прошлый результат со своего же выхода.',
    nodes: [['button', 0, 40], ['addition circuit', 220, 0, { 2: 1 }], ['number to string', 520, 0], ['screen', 820, 40]],
    wires: [[0, 'A', 1, 1, 'A', 1], [1, 'O', 1, 1, 'I', 1], [1, 'O', 1, 2, 'I', 1], [1, 'A', 2, 2, 'A', 1], [2, 'O', 1, 3, 'I', 1], [2, 'A', 2, 3, 'A', 1]] },
  { name: 'Мигалка', desc: 'Тумблер включает тикер, тикер каждые 2 секунды переключает лампу.',
    nodes: [['toggle button', 0, 0], ['fast ticker', 240, 0], ['light', 480, 0]],
    wires: [[0, 'O', 1, 1, 'I', 1], [1, 'A', 1, 2, 'A', 1]] },
  { name: 'Кодовый замок', desc: 'Ввод кода с клавиатуры: 1234 — «Доступ разрешён», иначе — «Неверный код».',
    nodes: [['text pad', 0, 60], ['equal gate', 260, 40, { 2: '1234' }], ['screen', 560, 0, { 1: 'Доступ разрешён' }], ['screen', 560, 170, { 1: 'Неверный код' }]],
    wires: [[0, 'O', 1, 1, 'I', 1], [0, 'A', 1, 1, 'A', 1], [1, 'A', 2, 2, 'A', 1], [1, 'A', 3, 3, 'A', 1]] },
  { name: 'Калькулятор', desc: 'Два цифровых поля и сумма на среднем экране. Считает при вводе второго числа.',
    nodes: [['number pad', 0, 0], ['number pad', 0, 150], ['addition circuit', 260, 30], ['number to string', 560, 30], ['medium screen', 860, 60]],
    wires: [[0, 'O', 1, 2, 'I', 1], [1, 'O', 1, 2, 'I', 2], [1, 'A', 1, 2, 'A', 1], [2, 'O', 1, 3, 'I', 1], [2, 'A', 2, 3, 'A', 1], [3, 'O', 1, 4, 'I', 1], [3, 'A', 2, 4, 'A', 1]] },
];
$('exList').innerHTML = EXAMPLES.map((x, i) => `<button class="ex" data-i="${i}"><b>${esc(x.name)}</b><span>${esc(x.desc)}</span></button>`).join('');
$('exList').addEventListener('click', (e) => {
  const b = e.target.closest('.ex'); if (!b) return;
  const x = EXAMPLES[+b.dataset.i], st = blank();
  x.nodes.forEach(([type, nx, ny, vals]) => st.nodes.push({ id: st.next++, type, x: nx, y: ny, vals: { ...(vals || {}) } }));
  x.wires.forEach(([a, ak, ai, b2, bk, bi]) => st.wires.push({ a: [st.nodes[a].id, ak, ai], b: [st.nodes[b2].id, bk, bi] }));
  S = st; sel = null; $('exModal').hidden = true;
  commit(); renderAll(); syncHeader(); soon(fit);
  toast(`«${x.name}» — включите симуляцию, чтобы попробовать`);
});
$('exBtn').addEventListener('click', () => openModal('exModal'));
$('clearBtn').addEventListener('click', () => {
  if (!S.nodes.length) return;
  S = { ...blank(), asm: S.asm, next: S.next }; sel = null; commit();
  toast('Поле очищено — «Отменить» вернёт схему');
});

// ---------- Корпус ----------
$('asm').innerHTML = ASM_GROUPS.map(([label, tpl, letters, k]) =>
  `<optgroup label="${label} — место ${25 * k}, сложность ${75 * k}">${[...letters].map((l) => `<option>${tpl.replace('?', l)}</option>`).join('')}</optgroup>`).join('') +
  `<optgroup label="Настенный">${WALL.map(([n, k]) => `<option>${n}</option>`).join('')}</optgroup>`;
function syncHeader() { $('asm').value = ASM[S.asm] ? S.asm : 'type-a electronic assembly'; $('asmName').value = S.name || ''; }
$('asm').addEventListener('change', (e) => { S.asm = e.target.value; commit(); });
$('asmName').addEventListener('change', (e) => { S.name = e.target.value.replace(/[<>"\\]/g, '').trim(); commit(); });

// ---------- Симуляция ----------
const logBox = $('simlog');
let touched = new Set(), frame = false, flashTimer = 0;
// Изменения из симуляции отрисовываются пачкой в следующем кадре
const hooks = {
  touch: (id) => { touched.add(id); hooks.update(); },
  busy: (id) => { const el = els.get(id); if (el) { el.classList.add('busy'); clearTimeout(el.busyT); el.busyT = setTimeout(() => el.classList.remove('busy'), 260); } },
  flash: (wi) => { flashing.add(wi); clearTimeout(flashTimer); flashTimer = setTimeout(() => { flashing.clear(); redrawSoon(); }, 220); },
  log: (id, msg) => {
    const n = node(id), row = document.createElement('div');
    row.innerHTML = n ? `<b>${esc(n.label || n.type)}</b>: ${esc(msg)}` : esc(msg);
    logBox.prepend(row); while (logBox.children.length > 80) logBox.lastChild.remove();
  },
  update: () => {
    if (frame) return;
    frame = true;
    soon(() => {
      frame = false;
      for (const id of touched) { const n = node(id); if (n) paint(n); }
      touched.clear(); redrawSoon();
    });
  },
};
function startSim() {
  sim = ICSim.create({ nodes: S.nodes, wires: S.wires }, CAT, hooks);
  document.body.classList.add('sim');
  $('simBtn').classList.add('on'); $('simBtn').textContent = '■ Стоп';
  renderAll();
}
function stopSim() {
  if (sim) sim.stop();
  sim = null; document.body.classList.remove('sim');
  $('simBtn').classList.remove('on'); $('simBtn').textContent = '▶ Симуляция';
  renderAll();
}
function restartSim() { sim.stop(); sim = ICSim.create({ nodes: S.nodes, wires: S.wires }, CAT, hooks); hooks.log(0, 'схема изменена — симуляция начата заново'); renderAll(); }
$('simBtn').addEventListener('click', () => {
  if (sim) return stopSim();
  logBox.innerHTML = '<div>Симуляция: ▶ у входа импульса — подать импульс, кнопки и поля ввода — прямо на блоках. Блоки, которым нужен мир игры (сканеры, манипуляторы, химия, атмос), не моделируются.</div>';
  startSim();
});

// ---------- Кнопки, вкладки, клавиши ----------
$('undoBtn').addEventListener('click', undo);
$('redoBtn').addEventListener('click', redo);
$('zIn').addEventListener('click', () => { const r = board.getBoundingClientRect(); zoomAt(1.2, r.left + r.width / 2, r.top + r.height / 2); });
$('zOut').addEventListener('click', () => { const r = board.getBoundingClientRect(); zoomAt(1 / 1.2, r.left + r.width / 2, r.top + r.height / 2); });
$('zFit').addEventListener('click', fit);
function setTab(t) {
  document.body.dataset.tab = t;
  document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('cur', b.dataset.tab === t));
  if (t === 'board') redrawSoon();
}
document.querySelectorAll('nav.tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
narrow.addEventListener('change', redrawSoon);
addEventListener('resize', redrawSoon);

addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea, select')) { if (e.key === 'Escape') e.target.blur(); return; }
  const ctrl = e.ctrlKey || e.metaKey;
  if (e.key === 'Escape') { closePop(); document.querySelectorAll('.modal').forEach((m) => { m.hidden = true; }); if (sel) { sel = null; refresh(); } }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
    e.preventDefault();
    if (sel.node) removeNode(sel.node);
    else if (sel.wire !== undefined) { S.wires.splice(sel.wire, 1); sel = null; commit(); }
  }
  else if (ctrl && e.code === 'KeyZ') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if (ctrl && e.code === 'KeyY') { e.preventDefault(); redo(); }
  else if (ctrl && e.code === 'KeyD' && sel && sel.node) { e.preventDefault(); duplicate(sel.node); }
});

renderPalette();
syncHeader();
applyView();
renderAll();

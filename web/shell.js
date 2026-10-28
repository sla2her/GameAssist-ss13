'use strict';
// Пульт — оболочка для шести приложений: стартовое радиальное меню, переключение приложений
// и два режима окна (компактный и расширенный). Работает в Пульт.exe, Пульт.apk и в браузере. Приложения открываются в iframe с того же
// адреса, поэтому оболочка может подключить к ним стили компактного режима.

const ICONS = {
  flask: '<path d="M9 3h6M10 3v6.2L4.6 18.4A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.2 15h9.6"/>',
  shield: '<path d="M12 3 20 6v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  scroll: '<path d="M8 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8"/><path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 1 1-4 0v-2h4"/><path d="M10 8h6M10 12h6M10 16h3"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  pot: '<path d="M3 11h18"/><path d="M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6"/><path d="M9 7.5c0-1.2 1-1.3 1-2.5M14 7.5c0-1.2 1-1.3 1-2.5"/>',
  factory: '<path d="M3 21V10l5 3v-3l5 3v-3l5 3V4h3v17z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  shrink: '<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>',
  pin: '<path d="M15 4.5 19.5 9l-3 3-1 4.5-7-7 4.5-1z"/><path d="M8.5 15.5 4 20"/>',
};
const svg = (name, extra = '') =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${ICONS[name]}</svg>`;

// Порядок = номер для Alt+цифра и место в меню по часовой стрелке, начиная сверху.
// css: false — у приложения нет своих стилей компактного режима (вёрстка сама подстраивается).
const APPS = [
  { id: 'alchimik', name: 'Алхимик', sub: 'Симулятор химии', desc: 'Раздатчик, реакции, FermiChem и рецепты',
    src: 'apps/alchimik/index.html', color: '#3fa66b', icon: 'flask', hscroll: '.tabs' },
  { id: 'brig', name: 'Терминал Брига', short: 'Бриг', sub: 'Приговоры и рапорты СБ', desc: 'Космический Закон, ордера, справочник НРП',
    src: 'apps/brig/index.html', color: '#d63c45', icon: 'shield', hscroll: 'nav, .seg, .refnav' },
  { id: 'papirus', name: 'Папирус', sub: 'Оформление бумаг', desc: 'Блоки, шаблоны и готовый код SS13',
    src: 'apps/papirus/index.html', color: '#3a7be0', icon: 'scroll', hscroll: '.rpanel, .tabs, .tplgallery', script: true },
  { id: 'engineer', name: 'Инженер', sub: 'Пошаговые инструкции', desc: 'Двигатель, атмос, электрика — шаг за шагом',
    src: 'apps/engineer/index.html', color: '#e2b33a', icon: 'wrench', hscroll: '.nav', css: false },
  { id: 'kitchen', name: 'Кухня и бар', short: 'Кухня', sub: 'Повар и бармен', desc: 'Рецепты блюд и коктейлей, «Мой бар»',
    src: 'apps/kitchen/index.html', color: '#e07a3f', icon: 'pot', hscroll: '.tabs, .subtabs, .controls .chips' },
  { id: 'himzavod', name: 'Химзавод', sub: 'Плюмбинг и химия', desc: 'Трубы, машины и реакции завода',
    src: 'apps/himzavod/index.html', color: '#9a6ad6', icon: 'factory', hscroll: 'header' },
];
APPS.forEach((a, i) => { a.angle = -90 + (i * 360) / APPS.length; });
const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const home = $('home'), stage = $('stage'), bar = $('bar');
const host = window.chrome && window.chrome.webview;
const send = (msg) => { try { host && host.postMessage(msg); } catch (e) { /* открыто в браузере */ } };
const android = window.PultAndroid; // мост Android-приложения (Пульт.apk), см. android/src
const store = {
  get(k) { try { return localStorage.getItem('pult.' + k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem('pult.' + k, v); } catch (e) { /* приватный режим */ } },
};

let current = null;            // открытое приложение
const frames = {};             // id -> iframe (создаются при первом открытии и дальше живут)
let compact = root.classList.contains('compact');

// ---------- Радиальное меню ----------
const R0 = 44, R1 = 97, GAP = 2.2;
const rad = (a) => (a * Math.PI) / 180;
const pt = (a, r) => `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;

function sectorPath(a0, a1) {
  // Зазор между секторами одинаковой ширины по всей длине, поэтому угол отступа свой для каждого радиуса
  const o1 = GAP / R1, o0 = GAP / R0;
  const A0 = rad(a0), A1 = rad(a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${pt(A0 + o1, R1)} A${R1} ${R1} 0 ${large} 1 ${pt(A1 - o1, R1)} ` +
         `L${pt(A1 - o0, R0)} A${R0} ${R0} 0 ${large} 0 ${pt(A0 + o0, R0)} Z`;
}
function arcPath(a0, a1, r) {
  const o = (GAP + 3) / r;
  return `M${pt(rad(a0) + o, r)} A${r} ${r} 0 0 1 ${pt(rad(a1) - o, r)}`;
}

function buildRadial() {
  const span = 360 / APPS.length;
  const rm = (R0 + R1) / 2;
  let ring = `<svg class="ring" viewBox="-100 -100 200 200" aria-hidden="true"><circle class="track" r="99.5"/>`;
  let labels = '';
  APPS.forEach((a, i) => {
    const a0 = a.angle - span / 2, a1 = a.angle + span / 2;
    const cx = Math.cos(rad(a.angle)), cy = Math.sin(rad(a.angle));
    ring += `<g class="sec" data-id="${a.id}" data-i="${i}" style="--c:${a.color};--dx:${(cx * 4).toFixed(2)}px;--dy:${(cy * 4).toFixed(2)}px">` +
            `<path class="fill" d="${sectorPath(a0, a1)}"/><path class="edge" d="${arcPath(a0, a1, R1 - 2.5)}"/></g>`;
    labels += `<button class="lab" data-id="${a.id}" data-i="${i}" style="--c:${a.color};` +
      `left:${(50 + (cx * rm) / 2).toFixed(2)}%;top:${(50 + (cy * rm) / 2).toFixed(2)}%;` +
      `--px:calc(var(--d) * ${(cx * 0.02).toFixed(4)});--py:calc(var(--d) * ${(cy * 0.02).toFixed(4)})" ` +
      `title="${a.name} — ${a.sub} (Alt+${i + 1})">` +
      `<span class="ico">${svg(a.icon)}</span><b><span class="full">${a.name}</span><span class="short">${a.short || a.name}</span></b><span class="sub">${a.sub}</span>` +
      `<span class="desc">${a.desc}</span><span class="alive">● открыт</span></button>`;
  });
  ring += '</svg>';
  const hub = `<div class="hub" data-i="0"><svg class="logo" viewBox="-12 -12 24 24" aria-hidden="true">${logoArcs(10, 3.2)}</svg>` +
              `<h1>Пульт</h1><button class="modepill" id="hubMode"></button></div>`;
  const el = $('radial');
  el.innerHTML = ring + labels + hub;

  const hot = (id) => el.querySelectorAll('[data-id]').forEach((n) => n.classList.toggle('hot', n.dataset.id === id));
  el.querySelectorAll('[data-id]').forEach((n) => {
    n.addEventListener('pointerenter', () => hot(n.dataset.id));
    n.addEventListener('pointerleave', () => hot(null));
    n.addEventListener('focus', () => hot(n.dataset.id));
    n.addEventListener('blur', () => hot(null));
    n.addEventListener('click', () => open(n.dataset.id));
  });
  $('hubMode').addEventListener('click', () => setMode(!compact));
}

// Значок Пульта: три дуги цветов приложений
function logoArcs(r, w) {
  const span = 360 / APPS.length;
  return APPS.map((a) => {
    const o = 0.9 / APPS.length;
    const A0 = rad(a.angle - span / 2) + o, A1 = rad(a.angle + span / 2) - o;
    return `<path d="M${pt(A0, r)} A${r} ${r} 0 0 1 ${pt(A1, r)}" fill="none" stroke="${a.color}" stroke-width="${w}" stroke-linecap="round"/>`;
  }).join('') + `<circle r="${(r * 0.32).toFixed(2)}" fill="currentColor" opacity=".55"/>`;
}

function introAnim() {
  const el = $('radial');
  el.classList.remove('intro'); void el.offsetWidth; el.classList.add('intro');
  setTimeout(() => el.classList.remove('intro'), 700);
}

// ---------- Меню: стартовый экран и наложение поверх приложения ----------
function showMenu() {
  home.classList.toggle('overlay', !!current);
  home.classList.remove('closed');
  syncMenu();
  introAnim();
  const first = home.querySelector(`.lab[data-id="${current ? current.id : APPS[0].id}"]`);
  if (first) first.focus({ preventScroll: true });
}
function hideMenu() {
  if (!current) return; // без открытого приложения меню — это стартовый экран
  home.classList.add('closed');
  focusApp();
}
const menuOpen = () => !home.classList.contains('closed');
function toggleMenu() { menuOpen() ? hideMenu() : showMenu(); }

home.addEventListener('click', (e) => { if (e.target === home || e.target.classList.contains('homefoot')) hideMenu(); });

function syncMenu() {
  home.querySelectorAll('[data-id]').forEach((n) => {
    n.classList.toggle('cur', !!current && n.dataset.id === current.id);
    n.classList.toggle('alive', !!frames[n.dataset.id]);
  });
}

// ---------- Приложения ----------
function open(id) {
  const app = byId[id];
  if (!app) return;
  let frame = frames[id];
  if (!frame) {
    frame = document.createElement('iframe');
    frame.title = app.name;
    frame.allow = 'clipboard-read; clipboard-write';
    frame.addEventListener('load', () => prepare(app, frame));
    frame.src = app.src;
    frames[id] = frame;
    stage.appendChild(frame);
  }
  current = app;
  Object.values(frames).forEach((f) => f.classList.toggle('on', f === frame));
  bar.hidden = false;
  root.style.setProperty('--app', app.color);
  $('appTitle').innerHTML = `${app.name}<small>${app.sub}</small>`;
  $('switch').querySelectorAll('button').forEach((b) => {
    b.setAttribute('aria-current', b.dataset.id === id ? 'true' : 'false');
    b.classList.toggle('alive', !!frames[b.dataset.id]);
  });
  document.title = app.name + ' — Пульт';
  send('title:' + document.title);
  store.set('last', id);
  if (android) android.setEngineerOpen(id === 'engineer');
  home.classList.add('closed');
  focusApp();
}

function focusApp() {
  const f = current && frames[current.id];
  if (f) setTimeout(() => { try { f.contentWindow.focus(); } catch (e) { /* ещё грузится */ } }, 30);
}

// Подключаем к странице приложения стили компактного режима, клавиши Пульта и прокрутку колесом
function prepare(app, frame) {
  let doc;
  try { doc = frame.contentDocument; } catch (e) { doc = null; }
  if (!doc || !doc.head) { frame.classList.add('ready'); return; }
  doc.documentElement.classList.add('pult-embedded');
  doc.documentElement.classList.toggle('pult-compact', compact);

  const ready = () => frame.classList.add('ready');
  if (app.css === false) ready();
  else {
    const link = doc.createElement('link');
    link.rel = 'stylesheet';
    link.href = new URL('compact/' + app.id + '.css', location.href).href;
    link.onload = link.onerror = ready;
    setTimeout(ready, 600);
    doc.head.appendChild(link);
  }
  if (app.script) {
    const s = doc.createElement('script');
    s.src = new URL('compact/' + app.id + '.js', location.href).href;
    doc.body.appendChild(s);
  }

  if (android) patchForAndroid(frame.contentWindow);
  doc.addEventListener('keydown', onKey, true);
  // В компактном режиме ленты и вкладки не помещаются — крутим их колесом мыши по горизонтали
  doc.addEventListener('wheel', (e) => {
    if (!compact || e.shiftKey || e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    const el = e.target.closest && e.target.closest(app.hscroll);
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    el.scrollLeft += e.deltaY;
    e.preventDefault();
  }, { passive: false });
}

function buildSwitch() {
  $('switch').innerHTML = APPS.map((a, i) =>
    `<button data-id="${a.id}" style="--c:${a.color}" title="${a.name} (Alt+${i + 1})" aria-label="${a.name}">${svg(a.icon)}</button>`).join('');
  $('switch').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) open(b.dataset.id); });
  $('hubBtn').innerHTML = `<svg viewBox="-12 -12 24 24" aria-hidden="true">${logoArcs(9, 3)}</svg>`;
  $('hubBtn').addEventListener('click', toggleMenu);
}

// ---------- Режимы окна ----------
function setMode(isCompact, fromHost) {
  compact = !!isCompact;
  root.classList.toggle('compact', compact);
  Object.values(frames).forEach((f) => {
    try { f.contentDocument.documentElement.classList.toggle('pult-compact', compact); } catch (e) { /* не загрузился */ }
  });
  const label = compact ? 'Компактный' : 'Расширенный';
  const next = compact ? 'Развернуть в расширенный режим' : 'Свернуть в компактный режим';
  $('modeBtn').innerHTML = svg(compact ? 'expand' : 'shrink');
  $('modeBtn').title = next + ' (Alt+M)';
  $('modeBtn').setAttribute('aria-label', next);
  const pill = $('hubMode');
  if (pill) { pill.innerHTML = svg(compact ? 'shrink' : 'expand') + label; pill.title = next + ' (Alt+M)'; }
  store.set('mode', compact ? 'compact' : 'expanded');
  if (!fromHost) send('mode:' + (compact ? 'compact' : 'expanded'));
}

// ---------- Поверх всех окон (только в программе) ----------
function showPin(on) {
  const b = $('pinBtn');
  b.hidden = false;
  b.innerHTML = svg('pin');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.title = on ? 'Открепить: обычное окно (Alt+P)' : 'Поверх всех окон (Alt+P)';
}
$('pinBtn').addEventListener('click', () => send('pin:' + ($('pinBtn').getAttribute('aria-pressed') === 'true' ? '0' : '1')));
$('modeBtn').addEventListener('click', () => setMode(!compact));

// ---------- Клавиши ----------
function onKey(e) {
  if (e.key === 'Escape' && menuOpen() && current) { e.preventDefault(); e.stopPropagation(); hideMenu(); return; }
  if (!e.altKey || e.ctrlKey || e.metaKey) return;
  const k = e.code;
  let handled = true;
  if (/^Digit[1-9]$/.test(k) && APPS[+k.slice(5) - 1]) open(APPS[+k.slice(5) - 1].id);
  else if (k === 'Digit0' || k === 'Backquote') toggleMenu();
  else if (k === 'KeyM') setMode(!compact);
  else if (k === 'KeyP' && !$('pinBtn').hidden) $('pinBtn').click();
  else handled = false;
  if (handled) { e.preventDefault(); e.stopPropagation(); }
}
document.addEventListener('keydown', onKey, true);

// ---------- Хоткеи Инженера ----------
function toEngineer(msg) {
  const f = frames.engineer;
  if (f) f.contentWindow.postMessage(msg, location.origin);
}
function engineerHotkey(action) {
  if (action === 'toggle') return; // окно прячет и показывает сама программа
  if (!current || current.id !== 'engineer') open('engineer');
  toEngineer({ type: 'pult-hotkey', action });
}

// ---------- Связь с окном программы ----------
if (host) {
  host.addEventListener('message', (e) => {
    const d = e.data || {};
    if (typeof d.pinned === 'boolean') showPin(d.pinned);
    if (d.mode === 'compact' || d.mode === 'expanded') setMode(d.mode === 'compact', true);
    if (d.hotkey) engineerHotkey(d.hotkey);
    if (Array.isArray(d.hotkeysFailed)) toEngineer({ type: 'pult-hotkeys-state', failed: d.hotkeysFailed });
  });
  // Инженер сообщает свои клавиши (guides.json), программа занимает их поверх игры и присылает нажатия
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'pult-hotkeys') return;
    send('hotkeys:' + Object.entries(e.data.keys || {}).map(([a, k]) => a + '=' + k).join(';'));
  });
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const theme = () => send('theme:' + (dark.matches ? 'dark' : 'light'));
  dark.addEventListener('change', theme);
  theme();
}

// ---------- Телефон (Пульт.apk) ----------
// В Android WebView нет скачивания blob-файлов и не всегда работает буфер обмена: сохранение и
// копирование в приложениях перенаправляем в мост. Все приложения сохраняют файлы через a.download + a.click().
function patchForAndroid(win) {
  const blobs = new Map();
  const create = win.URL.createObjectURL.bind(win.URL), revoke = win.URL.revokeObjectURL.bind(win.URL);
  win.URL.createObjectURL = (b) => { const u = create(b); blobs.set(u, b); return u; };
  // Химзавод отзывает ссылку сразу после click(), а файл читается асинхронно — откладываем
  win.URL.revokeObjectURL = (u) => setTimeout(() => { blobs.delete(u); revoke(u); }, 10000);
  const click = win.HTMLAnchorElement.prototype.click;
  win.HTMLAnchorElement.prototype.click = function () {
    if (!this.hasAttribute('download')) return click.call(this);
    const name = this.download || 'file', href = this.href, blob = blobs.get(href);
    if (blob) {
      const r = new win.FileReader();
      r.onload = () => { const s = String(r.result); android.saveFile(name, blob.type || 'application/octet-stream', s.slice(s.indexOf(',') + 1)); };
      r.readAsDataURL(blob);
      return;
    }
    const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(href);
    if (m) android.saveFile(name, m[1] || 'application/octet-stream', m[2] ? m[3] : btoa(unescape(encodeURIComponent(decodeURIComponent(m[3])))));
    else click.call(this);
  };
  const clip = {
    writeText: (t) => { android.copy(String(t)); return Promise.resolve(); },
    readText: () => Promise.resolve(android.paste()),
  };
  try { Object.defineProperty(win.navigator, 'clipboard', { value: clip, configurable: true }); } catch (e) { /* старый WebView */ }
}

// Кнопка «Назад»: закрыть меню → открыть меню → выйти из приложения
window.pultBack = () => {
  if (current && menuOpen()) { hideMenu(); return 'ok'; }
  if (current) { showMenu(); return 'ok'; }
  return 'exit';
};
// Кнопки громкости листают шаги Инженера
window.pultEngineer = (action) => engineerHotkey(action);
if (root.classList.contains('phone')) compact = true; // на телефоне расширенный режим не помещается

buildRadial();
buildSwitch();
setMode(compact, true);
send('hello');
showMenu();

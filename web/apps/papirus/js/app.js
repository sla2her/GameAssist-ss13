'use strict';
/* Папирус — быстрое форматирование бумаг для SS13 */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 10);
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const store = {
  get(k, def) {
    try { const v = localStorage.getItem('papirus.' + k); return v ? JSON.parse(v) : def; } catch { return def; }
  },
  set(k, v) {
    try { localStorage.setItem('papirus.' + k, JSON.stringify(v)); } catch { /* приватный режим и т.п. */ }
  },
};

/* ============================================================
   Команды и профили
   ============================================================ */

const COMMANDS = [
  { key: 'bold', name: 'Жирный', pair: true, group: 'Текст' },
  { key: 'italic', name: 'Курсив', pair: true, group: 'Текст' },
  { key: 'underline', name: 'Подчёркнутый', pair: true, group: 'Текст' },
  { key: 'large', name: 'Крупный текст', pair: true, group: 'Текст' },
  { key: 'small', name: 'Мелкий текст', pair: true, group: 'Текст' },
  { key: 'center', name: 'По центру', pair: true, group: 'Выравнивание' },
  { key: 'right', name: 'По правому краю', pair: true, group: 'Выравнивание' },
  { key: 'h1', name: 'Заголовок 1', pair: true, group: 'Заголовки', note: 'пусто → крупный + жирный' },
  { key: 'h2', name: 'Заголовок 2', pair: true, group: 'Заголовки', note: 'пусто → крупный + жирный' },
  { key: 'h3', name: 'Заголовок 3', pair: true, group: 'Заголовки', note: 'пусто → жирный' },
  { key: 'list', name: 'Список (обёртка)', pair: true, group: 'Списки', note: 'пусто → пункты с новой строки' },
  { key: 'item', name: 'Пункт списка', pair: false, group: 'Списки', note: 'пусто → «• »' },
  { key: 'hr', name: 'Горизонтальная линия', pair: false, group: 'Разметка', note: 'пусто → строка из чёрточек' },
  { key: 'br', name: 'Перенос строки', pair: false, group: 'Разметка', note: 'используется, если включено ниже' },
  { key: 'field', name: 'Поле ввода', pair: false, group: 'Вставки', note: 'пусто → ________' },
  { key: 'sign', name: 'Подпись', pair: false, group: 'Вставки', note: 'пусто → имя из «Подстановок»' },
  { key: 'date', name: 'Дата', pair: false, group: 'Вставки', note: 'пусто → сегодняшняя дата текстом' },
  { key: 'time', name: 'Время', pair: false, group: 'Вставки', note: 'пусто → текущее время текстом' },
];

const emptyCmds = () => Object.fromEntries(COMMANDS.map(c => [c.key, ['', '']]));

const PRESETS = {
  classic: {
    name: 'Классика (Paradise, Bay и форки)',
    useBr: false,
    limit: 3072,
    cmds: {
      bold: ['[b]', '[/b]'], italic: ['[i]', '[/i]'], underline: ['[u]', '[/u]'],
      large: ['[large]', '[/large]'], small: ['[small]', '[/small]'],
      center: ['[center]', '[/center]'], right: ['', ''],
      h1: ['[h1]', '[/h1]'], h2: ['[h2]', '[/h2]'], h3: ['[h3]', '[/h3]'],
      list: ['[list]', '[/list]'], item: ['[*]', ''],
      hr: ['[hr]', ''], br: ['[br]', ''],
      field: ['[field]', ''], sign: ['[sign]', ''], date: ['[date]', ''], time: ['[time]', ''],
    },
  },
  tg: {
    name: 'TG (Markdown) — черновик',
    useBr: false,
    limit: 5000,
    cmds: Object.assign(emptyCmds(), {
      bold: ['**', '**'], italic: ['*', '*'],
      h1: ['# ', ''], h2: ['## ', ''], h3: ['### ', ''],
      item: ['- ', ''], hr: ['---', ''],
      field: ['[______]', ''], sign: ['%s', ''],
    }),
  },
  plain: {
    name: 'Без разметки (чистый текст)',
    useBr: false,
    limit: 3072,
    cmds: emptyCmds(),
  },
};

function defaultSettings() {
  return {
    active: 'classic',
    profiles: clone(PRESETS),
    snippets: [{ id: uid(), name: 'Логотип NT', code: '[logo]' }],
    signName: '',
    yearOffset: 540,
    theme: 'system',
    animations: true,
  };
}

// Дополняем сохранённые настройки новыми полями, если они появились в обновлении
let settings = Object.assign(defaultSettings(), store.get('settings', {}));
const saveSettings = () => store.set('settings', settings);
const profile = () => settings.profiles[settings.active] || Object.values(settings.profiles)[0];
const cmd = key => (profile().cmds[key] || ['', '']);

/* ============================================================
   Документ
   ============================================================ */

const B = (type, props = {}) => ({ id: uid(), type, align: 'left', level: 1, html: '', ...props });

const TOKEN_LABEL = { sign: '✍ подпись', date: '📅 дата', time: '🕓 время', field: '▭ поле' };

function chip(token, opts = {}) {
  const label = opts.name || TOKEN_LABEL[token];
  let attrs = `data-token="${token}"`;
  if (opts.code != null) attrs += ` data-code="${esc(opts.code)}"`;
  if (opts.sid) attrs += ` data-sid="${esc(opts.sid)}"`;
  return `<span class="chip chip-${token}" contenteditable="false" ${attrs}>${esc(label)}</span>`;
}

const BUILTIN_TEMPLATES = [
  {
    id: 'tpl-report', name: 'Рапорт', icon: '📝', builtin: true,
    blocks: () => [
      B('p', { align: 'right', html: `Кому: ${chip('field')}<div>От: ${chip('field')}</div>` }),
      B('spacer'),
      B('h', { level: 1, align: 'center', html: 'РАПОРТ' }),
      B('hr'),
      B('p', { html: `Настоящим докладываю, что ${chip('field')}` }),
      B('spacer'),
      B('p', { html: `Дата: ${chip('date')}, время: ${chip('time')}<div>Подпись: ${chip('sign')}</div>` }),
    ],
  },
  {
    id: 'tpl-order', name: 'Приказ', icon: '📜', builtin: true,
    blocks: () => [
      B('h', { level: 2, align: 'center', html: 'NanoTrasen' }),
      B('p', { align: 'center', html: '<span class="sz-small">Космическая станция 13</span>' }),
      B('hr'),
      B('h', { level: 1, align: 'center', html: `ПРИКАЗ № ${chip('field')}` }),
      B('p', { html: '<b>Приказываю:</b>' }),
      B('list', { html: '<div>Первый пункт</div><div>Второй пункт</div>' }),
      B('p', { html: `Ответственный: ${chip('field')}` }),
      B('spacer'),
      B('p', { align: 'right', html: `Капитан станции: ${chip('sign')}<div>${chip('date')} ${chip('time')}</div>` }),
    ],
  },
  {
    id: 'tpl-pass', name: 'Пропуск', icon: '🪪', builtin: true,
    blocks: () => [
      B('h', { level: 2, align: 'center', html: 'ПРОПУСК' }),
      B('hr'),
      B('p', { html: `Выдан: ${chip('field')}<div>Должность: ${chip('field')}</div><div>Доступ в: ${chip('field')}</div><div>Действителен до: ${chip('field')}</div>` }),
      B('hr'),
      B('p', { html: `Выдал: ${chip('field')}<div>Подпись: ${chip('sign')}</div><div>Дата: ${chip('date')}</div>` }),
    ],
  },
];

function tplBlocks(t) {
  const list = typeof t.blocks === 'function' ? t.blocks() : clone(t.blocks);
  return list.map(b => ({ ...b, id: uid() }));
}

let doc = store.get('doc', null) || { title: 'Рапорт', blocks: tplBlocks(BUILTIN_TEMPLATES[0]) };
let userTemplates = store.get('templates', []);
let selectedId = null;

/* ============================================================
   Генерация кода SS13
   ============================================================ */

function wrap(key, s) {
  if (!s) return s;
  const [open, close] = cmd(key);
  return open || close ? open + s + close : s;
}
const hasCmd = key => !!(cmd(key)[0] || cmd(key)[1]);

function pad(n) { return String(n).padStart(2, '0'); }
function literal(token) {
  const d = new Date();
  switch (token) {
    case 'date': return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear() + (+settings.yearOffset || 0)}`;
    case 'time': return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    case 'sign': return settings.signName || '____________';
    case 'field': return '____________';
  }
  return '';
}

function tokenCode(el) {
  const tk = el.dataset.token;
  if (tk === 'custom') {
    const sn = settings.snippets.find(s => s.id === el.dataset.sid);
    return sn ? sn.code : (el.dataset.code || '');
  }
  return cmd(tk)[0] || literal(tk);
}

function inline(node) {
  let out = '';
  [...node.childNodes].forEach((n, i) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.nodeValue.replace(/ /g, ' ').replace(/​/g, '');
      return;
    }
    if (n.nodeType !== Node.ELEMENT_NODE) return;
    const t = n.tagName;
    if (n.dataset.token) { out += tokenCode(n); return; }
    if (t === 'BR') { if (n.nextSibling) out += '\n'; return; }
    if (t === 'DIV' || t === 'P') {
      if (i > 0) out += '\n';
      out += inline(n);
      return;
    }
    let s = inline(n);
    if (t === 'B' || t === 'STRONG') s = wrap('bold', s);
    if (t === 'I' || t === 'EM') s = wrap('italic', s);
    if (t === 'U') s = wrap('underline', s);
    if (n.classList.contains('sz-large')) s = wrap('large', s);
    if (n.classList.contains('sz-small')) s = wrap('small', s);
    out += s;
  });
  return out;
}

function blockCode(b) {
  if (b.type === 'hr') return cmd('hr')[0] || '------------------------------';
  if (b.type === 'spacer') return '';
  const tmp = document.createElement('div');
  tmp.innerHTML = b.html;
  let s = inline(tmp);

  if (b.type === 'h') {
    const k = 'h' + b.level;
    if (hasCmd(k)) s = wrap(k, s);
    else s = b.level < 3 ? wrap('bold', wrap('large', s)) : wrap('bold', s);
  }
  if (b.type === 'list') {
    const items = s.split('\n').filter(l => l.trim());
    const mark = cmd('item')[0] || '• ';
    // С обёрткой пункты идут подряд (как [list][*]..[*]..[/list]), без неё — с новой строки
    s = hasCmd('list') ? wrap('list', items.map(l => mark + l).join('')) : items.map(l => mark + l).join('\n');
  }
  if (b.align === 'center') s = wrap('center', s);
  if (b.align === 'right') s = wrap('right', s);
  return s;
}

function generate() {
  let code = doc.blocks.map(blockCode).join('\n');
  if (profile().useBr) code = code.replace(/\n/g, cmd('br')[0] || '\n');
  return code;
}

/* ============================================================
   История (отмена / повтор)
   ============================================================ */

const hist = { past: [], future: [] };
let committed = JSON.stringify(doc);
let typingTimer = null;

function flushTyping() {
  if (!typingTimer) return;
  clearTimeout(typingTimer);
  typingTimer = null;
  committed = JSON.stringify(doc);
}
function pushHistory() {
  flushTyping();
  hist.past.push(committed);
  if (hist.past.length > 150) hist.past.shift();
  hist.future = [];
}
function noteTyping() {
  if (!typingTimer) { hist.past.push(committed); hist.future = []; }
  else clearTimeout(typingTimer);
  typingTimer = setTimeout(() => { typingTimer = null; committed = JSON.stringify(doc); updateUndo(); }, 700);
}
function undo() {
  flushTyping();
  if (!hist.past.length) return;
  hist.future.push(JSON.stringify(doc));
  doc = JSON.parse(hist.past.pop());
  committed = JSON.stringify(doc);
  renderDoc(true); changed(false);
}
function redo() {
  flushTyping();
  if (!hist.future.length) return;
  hist.past.push(JSON.stringify(doc));
  doc = JSON.parse(hist.future.pop());
  committed = JSON.stringify(doc);
  renderDoc(true); changed(false);
}
function updateUndo() {
  $('#undoBtn').disabled = !hist.past.length && !typingTimer;
  $('#redoBtn').disabled = !hist.future.length;
}

let saveTimer = null;
function changed(commit = true) {
  if (commit && !typingTimer) committed = JSON.stringify(doc);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => store.set('doc', doc), 300);
  updateCode();
  updateUndo();
}

/* ============================================================
   Отрисовка листа
   ============================================================ */

const page = $('#page');
const TYPE_TAG = { p: '¶', h: 'H', list: '☰', hr: '―', spacer: '↵' };
const PLACEHOLDER = { p: 'Введите текст…', h: 'Заголовок', list: 'Пункт списка' };

// animate: true — плавно перевести блоки из текущих позиций в новые;
// Map — то же, но позиции «до» уже сняты заранее (при перетаскивании)
function renderDoc(animate = false) {
  const before = !motionOn() ? null : animate instanceof Map ? animate : animate ? snapshotRects() : null;
  page.innerHTML = '';
  if (!doc.blocks.length) {
    page.innerHTML = '<div class="page-empty">Лист пуст.<br>Перетащите сюда блоки из панели слева<br>или нажмите на блок, чтобы добавить его.</div>';
  }
  doc.blocks.forEach(b => page.appendChild(renderBlock(b)));
  $('#docTitle').value = doc.title || '';
  refreshSelection();
  if (before) playFlip(before);
}

/* ---------- Анимации (FLIP: запомнили позиции → перестроили → доехали) ---------- */

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const motionOn = () => settings.animations !== false && !reducedMotion.matches;
const pageZoom = () => (+$('#zoom').value || 100) / 100;

function snapshotRects() {
  const m = new Map();
  $$('.blk', page).forEach(el => { if (!el.classList.contains('drag-src')) m.set(el.dataset.id, el.getBoundingClientRect()); });
  return m;
}

function playFlip(before, enterNew = true) {
  const z = pageZoom();
  let n = 0;
  $$('.blk', page).forEach(el => {
    if (el.classList.contains('drag-src')) return;
    const old = before.get(el.dataset.id);
    const now = el.getBoundingClientRect();
    if (old) {
      const dy = (old.top - now.top) / z;
      if (Math.abs(dy) > 0.5) {
        el.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
          { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    } else if (enterNew) {
      el.animate([{ opacity: 0, transform: 'translateY(-8px) scale(.98)' }, { opacity: 1, transform: 'none' }],
        { duration: 260, delay: Math.min(n++ * 25, 250), easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
    }
  });
}

function animateRemove(id, then) {
  const el = blockEl(id);
  if (!el || !motionOn()) return then();
  el.style.pointerEvents = 'none';
  el.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(.97)' }], { duration: 140, easing: 'ease-in' })
    .onfinish = then;
}

function renderBlock(b) {
  const el = document.createElement('div');
  el.className = 'blk';
  el.dataset.id = b.id;

  const handle = document.createElement('div');
  handle.className = 'handle';
  handle.textContent = '⠿';
  handle.title = 'Перетащите, чтобы переместить';
  handle.draggable = true;
  handle.addEventListener('dragstart', e => {
    startDrag(e, { kind: 'move', id: b.id, height: el.offsetHeight });
    e.dataTransfer.setDragImage(el, 10, 10);
    // Прячем блок уже после того, как браузер снял с него картинку, а на его месте оставляем заглушку
    setTimeout(() => {
      if (!drag || drag.id !== b.id) return;
      el.classList.add('drag-src');
      // индекс = сколько видимых блоков стоит выше перетаскиваемого
      placePh(visibleBlocks().filter(x => x.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING).length, false);
    }, 0);
  });

  const del = document.createElement('div');
  del.className = 'del';
  del.textContent = '✕';
  del.title = 'Удалить блок';
  del.addEventListener('click', () => deleteBlock(b.id));

  const tag = document.createElement('div');
  tag.className = 'tag';
  tag.textContent = b.type === 'h' ? 'H' + b.level : TYPE_TAG[b.type];

  el.append(handle, tag);

  if (b.type === 'hr') {
    el.insertAdjacentHTML('beforeend', '<div class="hrline"><hr></div>');
  } else if (b.type === 'spacer') {
    el.insertAdjacentHTML('beforeend', '<div class="spacer">пустая строка</div>');
  } else {
    const ed = document.createElement('div');
    ed.className = 'ed' + (b.type === 'h' ? ' h' + b.level : '') + (b.type === 'list' ? ' list' : '');
    ed.contentEditable = 'true';
    ed.spellcheck = true;
    ed.dataset.ph = PLACEHOLDER[b.type] || '';
    ed.style.textAlign = b.align;
    ed.innerHTML = b.html;
    if (b.type === 'list' && !ed.firstElementChild) ed.innerHTML = '<div><br></div>';
    ed.addEventListener('input', () => {
      if (b.type === 'list' && ed.firstChild && ed.firstChild.nodeType === Node.TEXT_NODE) {
        // первый пункт списка тоже держим в <div>, иначе у него нет маркера
        const div = document.createElement('div');
        div.appendChild(ed.firstChild);
        ed.prepend(div);
        placeCaretEnd(div);
      }
      b.html = ed.innerHTML === '<br>' ? '' : ed.innerHTML;
      noteTyping();
      changed();
    });
    ed.addEventListener('focus', () => select(b.id));
    ed.addEventListener('keydown', e => onEditorKey(e, b, ed));
    ed.addEventListener('paste', e => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
    el.appendChild(ed);
  }
  el.appendChild(del);
  el.addEventListener('mousedown', () => select(b.id));
  return el;
}

function onEditorKey(e, b, ed) {
  if (e.key === 'Enter' && (e.ctrlKey || b.type === 'h')) {
    e.preventDefault();
    insertBlocks([B('p')], indexOf(b.id) + 1);
    return;
  }
  if (e.key === 'Backspace' && !ed.textContent && !ed.querySelector('.chip') && doc.blocks.length > 1) {
    e.preventDefault();
    const i = indexOf(b.id);
    deleteBlock(b.id, true);
    const prev = doc.blocks[Math.max(0, i - 1)];
    if (prev) focusBlock(prev.id);
  }
}

const indexOf = id => doc.blocks.findIndex(b => b.id === id);
const selectedBlock = () => doc.blocks.find(b => b.id === selectedId);
const blockEl = id => page.querySelector(`.blk[data-id="${id}"]`);

function select(id) {
  if (selectedId === id) return;
  selectedId = id;
  refreshSelection();
}
function refreshSelection() {
  $$('.blk', page).forEach(el => el.classList.toggle('sel', el.dataset.id === selectedId));
  const b = selectedBlock();
  $$('[data-align]').forEach(btn => btn.classList.toggle('on', !!b && b.align === btn.dataset.align));
  const style = !b ? '' : b.type === 'h' ? 'h' + b.level : b.type;
  $$('[data-style]').forEach(btn => btn.classList.toggle('on', btn.dataset.style === style));
}

function placeCaretEnd(node) {
  const r = document.createRange();
  r.selectNodeContents(node);
  r.collapse(false);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
}
function focusBlock(id) {
  select(id);
  const el = blockEl(id);
  const ed = el && el.querySelector('.ed');
  if (ed) { ed.focus(); placeCaretEnd(ed); }
  if (el) el.scrollIntoView({ block: 'nearest' });
}

/* ---------- Операции с блоками ---------- */

function insertBlocks(blocks, idx, before = true) {
  if (idx == null) {
    const s = indexOf(selectedId);
    idx = s >= 0 ? s + 1 : doc.blocks.length;
  }
  pushHistory();
  doc.blocks.splice(idx, 0, ...blocks);
  renderDoc(before);
  changed();
  const target = blocks.find(b => b.type !== 'hr' && b.type !== 'spacer') || blocks[blocks.length - 1];
  focusBlock(target.id);
}
function deleteBlock(id, instant = false) {
  if (indexOf(id) < 0) return;
  const remove = () => {
    const at = indexOf(id);
    if (at < 0) return;
    pushHistory();
    doc.blocks.splice(at, 1);
    if (selectedId === id) selectedId = null;
    renderDoc(true);
    changed();
  };
  // при удалении с клавиатуры не ждём анимацию — сразу переводим курсор в соседний блок
  if (instant) remove(); else animateRemove(id, remove);
}
// idx — позиция в списке до удаления блока (как у вставки «перед idx»)
function moveBlock(id, idx, before = true) {
  const from = indexOf(id);
  if (from < 0) return;
  moveBlockTo(id, from < idx ? idx - 1 : idx, before);
}
// target — позиция в списке уже без перемещаемого блока
function moveBlockTo(id, target, before = true) {
  const from = indexOf(id);
  if (from < 0) return;
  if (from === target) { renderDoc(before); return; }
  pushHistory();
  const [b] = doc.blocks.splice(from, 1);
  doc.blocks.splice(target, 0, b);
  renderDoc(before);
  changed();
}

/* ============================================================
   Палитра блоков
   ============================================================ */

function paletteGroups() {
  return [
    {
      name: 'Текст', items: [
        { icon: '¶', name: 'Абзац', make: () => [B('p')] },
        { icon: 'H', name: 'Заголовок', make: () => [B('h', { level: 1, align: 'center', html: 'Заголовок' })] },
        { icon: '☰', name: 'Список', make: () => [B('list', { html: '<div>Первый пункт</div><div>Второй пункт</div>' })] },
      ],
    },
    {
      name: 'Разметка', items: [
        { icon: '―', name: 'Линия', make: () => [B('hr')] },
        { icon: '↵', name: 'Пустая строка', make: () => [B('spacer')] },
      ],
    },
    {
      name: 'Поля', items: [
        { icon: '✍', name: 'Подпись', inline: () => chip('sign'), make: () => [B('p', { html: `Подпись: ${chip('sign')}` })] },
        { icon: '🕓', name: 'Дата и время', inline: () => `${chip('date')} ${chip('time')}`, make: () => [B('p', { html: `Дата: ${chip('date')}, время: ${chip('time')}` })] },
        { icon: '📅', name: 'Дата', inline: () => chip('date'), make: () => [B('p', { html: `Дата: ${chip('date')}` })] },
        { icon: '⏱', name: 'Время', inline: () => chip('time'), make: () => [B('p', { html: `Время: ${chip('time')}` })] },
        { icon: '▭', name: 'Поле ввода', inline: () => chip('field'), make: () => [B('p', { html: `Ф.И.О.: ${chip('field')}` })] },
      ],
    },
    {
      name: 'Готовые', items: [
        {
          icon: '🏛', name: 'Шапка NanoTrasen', make: () => [
            B('h', { level: 2, align: 'center', html: 'NanoTrasen' }),
            B('p', { align: 'center', html: '<span class="sz-small">Космическая станция 13</span>' }),
            B('hr'),
          ],
        },
        {
          icon: '🖋', name: 'Блок подписи', make: () => [
            B('spacer'),
            B('p', { html: `Должность: ${chip('field')}<div>Ф.И.О.: ${chip('field')}</div><div>Подпись: ${chip('sign')}</div><div>Дата: ${chip('date')} ${chip('time')}</div>` }),
          ],
        },
      ],
    },
    {
      name: 'Свои блоки', custom: true,
      items: settings.snippets.filter(s => s.name || s.code).map(s => {
        const c = () => chip('custom', { name: s.name || s.code, code: s.code, sid: s.id });
        return { icon: '★', name: s.name || s.code, inline: c, make: () => [B('p', { html: c() })] };
      }),
    },
  ];
}

let drag = null;

function startDrag(e, payload) {
  drag = payload;
  e.dataTransfer.effectAllowed = payload.kind === 'move' ? 'move' : 'copy';
  e.dataTransfer.setData('text/plain', '');
}
// Отмена перетаскивания: убираем заглушку и возвращаем спрятанный блок на место
function endDrag() {
  if (!drag && !ph.isConnected) return;
  drag = null;
  markInline(null);
  $$('.pitem.lifted').forEach(el => el.classList.remove('lifted'));
  const src = $('.blk.drag-src', page);
  const before = motionOn() ? snapshotRects() : null;
  if (src) before && before.set(src.dataset.id, ph.isConnected ? ph.getBoundingClientRect() : src.getBoundingClientRect());
  ph.remove();
  phIndex = -1;
  if (src) src.classList.remove('drag-src');
  if (before) playFlip(before, false);
}

function renderPalette() {
  const groups = paletteGroups();
  const pal = $('#palette');
  pal.innerHTML = '<h3>Блоки</h3><p class="hint">Перетащите на лист. Блоки с меткой «в текст» можно бросить прямо в строку.</p>';
  const ins = $('#insertPanel');
  ins.innerHTML = '';

  groups.forEach(g => {
    pal.insertAdjacentHTML('beforeend', `<h4>${esc(g.name)}</h4>`);
    const rg = document.createElement('div');
    rg.className = 'rgroup insgroup';
    const row = document.createElement('div');
    row.className = 'rrow';

    if (!g.items.length && g.custom) {
      pal.insertAdjacentHTML('beforeend', '<div class="empty">Пока пусто. <button class="link" data-goto-settings>Добавить в настройках</button></div>');
    }
    g.items.forEach(item => {
      const p = document.createElement('div');
      p.className = 'pitem';
      p.draggable = true;
      p.title = 'Перетащите на лист или нажмите, чтобы вставить после выбранного блока';
      p.innerHTML = `<span class="ico">${esc(item.icon)}</span><span>${esc(item.name)}</span>${item.inline ? '<span class="inl">в текст</span>' : ''}`;
      p.addEventListener('dragstart', e => {
        startDrag(e, { kind: 'new', item });
        setTimeout(() => p.classList.add('lifted'), 0);
      });
      p.addEventListener('click', () => insertBlocks(item.make()));
      pal.appendChild(p);

      const btn = document.createElement('button');
      btn.className = 'rb';
      btn.innerHTML = `<span class="ico">${esc(item.icon)}</span>${esc(item.name)}`;
      btn.addEventListener('mousedown', e => e.preventDefault());
      btn.addEventListener('click', () => insertInlineOrBlock(item));
      row.appendChild(btn);
    });
    if (g.items.length) {
      rg.appendChild(row);
      rg.insertAdjacentHTML('beforeend', `<div class="rlabel">${esc(g.name)}</div>`);
      ins.appendChild(rg);
    }
  });
  $$('[data-goto-settings]').forEach(b => b.addEventListener('click', () => showTab('settings')));
}

// Кнопка на вкладке «Вставка»: если курсор стоит в тексте — вставляем в строку, иначе блоком
function insertInlineOrBlock(item) {
  const sel = getSelection();
  const node = sel.rangeCount && sel.getRangeAt(0).startContainer;
  const ed = node && (node.nodeType === 1 ? node : node.parentElement).closest('.ed');
  if (item.inline && ed && page.contains(ed)) insertHtml(ed, sel.getRangeAt(0), item.inline());
  else insertBlocks(item.make());
}

/* ---------- Перетаскивание на лист ---------- */

const canvas = $('#canvas');

function caretFromPoint(x, y) {
  if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
  if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (!p) return null;
    const r = document.createRange();
    r.setStart(p.offsetNode, p.offset);
    r.collapse(true);
    return r;
  }
  return null;
}

function safeRange(ed, r) {
  if (!r || !ed.contains(r.startContainer)) return null;
  const c = (r.startContainer.nodeType === 1 ? r.startContainer : r.startContainer.parentElement).closest('.chip');
  if (c) { r = document.createRange(); r.setStartAfter(c); r.collapse(true); }
  return r;
}

function insertHtml(ed, range, html) {
  range = safeRange(ed, range);
  if (!range) { range = document.createRange(); range.selectNodeContents(ed); range.collapse(false); }
  range.deleteContents();
  const after = document.createRange();
  after.setStart(range.startContainer, range.startOffset);
  after.setEndAfter(ed.lastChild || ed);
  const atEnd = !after.toString().trim() && !after.cloneContents().querySelector('.chip');

  const frag = range.createContextualFragment(html + (atEnd ? ' ' : ''));
  const last = frag.lastChild;
  range.insertNode(frag);
  if (last) {
    const r = document.createRange();
    r.setStartAfter(last);
    r.collapse(true);
    const s = getSelection();
    s.removeAllRanges();
    s.addRange(r);
  }
  ed.dispatchEvent(new Event('input', { bubbles: true }));
}

function markInline(ed) {
  $$('.ed.drop-inline').forEach(x => { if (x !== ed) x.classList.remove('drop-inline'); });
  if (ed) ed.classList.add('drop-inline');
}

// Заглушка: раздвигает блоки там, куда упадёт перетаскиваемый
const ph = document.createElement('div');
ph.className = 'drop-ph';
let phIndex = -1;

const visibleBlocks = () => $$('.blk', page).filter(el => !el.classList.contains('drag-src'));

// Индекс среди видимых блоков; для перемещения это сразу позиция в списке без самого блока
function dropIndex(y) {
  const els = visibleBlocks();
  for (let i = 0; i < els.length; i++) {
    const r = els[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) return i;
  }
  return els.length;
}

function placePh(idx, animate = true) {
  if (phIndex === idx && ph.isConnected) return;
  const before = animate && motionOn() ? snapshotRects() : null;
  ph.style.height = (drag && drag.height ? drag.height : 34) + 'px';
  ph.textContent = drag && drag.kind === 'new' ? drag.item.name : '';
  const els = visibleBlocks();
  if (idx < els.length) page.insertBefore(ph, els[idx]);
  else page.appendChild(ph);
  phIndex = idx;
  if (before) playFlip(before, false);
}

function removePh() {
  if (!ph.isConnected) return;
  const before = motionOn() ? snapshotRects() : null;
  ph.remove();
  phIndex = -1;
  if (before) playFlip(before, false);
}

function inlineTarget(e) {
  if (!drag || drag.kind !== 'new' || !drag.item.inline) return null;
  return e.target.closest ? e.target.closest('.ed') : null;
}

canvas.addEventListener('dragover', e => {
  if (!drag) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = drag.kind === 'move' ? 'move' : 'copy';
  const ed = inlineTarget(e);
  if (ed) {
    removePh();
    markInline(ed);
    const r = safeRange(ed, caretFromPoint(e.clientX, e.clientY));
    if (r) {
      if (document.activeElement !== ed) ed.focus({ preventScroll: true });
      const s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }
  } else {
    markInline(null);
    // над заглушкой индекс не пересчитываем — иначе она «дрожит»
    if (e.target !== ph) placePh(dropIndex(e.clientY));
  }
});

canvas.addEventListener('dragleave', e => {
  if (drag && !canvas.contains(e.relatedTarget)) { markInline(null); if (drag.kind === 'new') removePh(); }
});

canvas.addEventListener('drop', e => {
  if (!drag) return;
  e.preventDefault();
  const d = drag;
  const ed = inlineTarget(e);
  if (ed) {
    endDrag();
    insertHtml(ed, caretFromPoint(e.clientX, e.clientY), d.item.inline());
    return;
  }
  const idx = phIndex >= 0 ? phIndex : dropIndex(e.clientY);
  // позиции «до» снимаем, пока заглушка ещё на месте: новый блок проявится ровно там, где она была
  const before = motionOn() ? snapshotRects() : false;
  if (before && d.kind === 'move' && ph.isConnected) before.set(d.id, ph.getBoundingClientRect());
  drag = null;
  ph.remove();
  phIndex = -1;
  $$('.pitem.lifted').forEach(el => el.classList.remove('lifted'));
  if (d.kind === 'new') insertBlocks(d.item.make(), idx, before);
  else moveBlockTo(d.id, idx, before);
});

document.addEventListener('dragend', endDrag);

/* ============================================================
   Лента: форматирование и стили
   ============================================================ */

$$('.ribbon button, [data-copy]').forEach(b => b.addEventListener('mousedown', e => e.preventDefault()));

document.execCommand('styleWithCSS', false, false);

$$('[data-cmd]').forEach(btn => btn.addEventListener('click', () => {
  document.execCommand(btn.dataset.cmd, false, null);
  if (btn.dataset.cmd === 'removeFormat') unwrapSizes();
  updateFormatState();
}));

function currentEd() {
  const sel = getSelection();
  if (!sel.rangeCount) return null;
  const n = sel.getRangeAt(0).commonAncestorContainer;
  const ed = (n.nodeType === 1 ? n : n.parentElement).closest('.ed');
  return ed && page.contains(ed) ? ed : null;
}

function unwrap(el) {
  while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
  el.remove();
}
function unwrapSizes() {
  const ed = currentEd();
  if (!ed) return;
  const r = getSelection().getRangeAt(0);
  $$('.sz-large, .sz-small', ed).forEach(s => { if (r.intersectsNode(s)) unwrap(s); });
  ed.dispatchEvent(new Event('input', { bubbles: true }));
}

function toggleSize(cls) {
  const ed = currentEd();
  if (!ed) return;
  const sel = getSelection();
  const r = sel.getRangeAt(0);
  const n = r.commonAncestorContainer;
  const existing = (n.nodeType === 1 ? n : n.parentElement).closest('.' + cls);
  if (existing && ed.contains(existing)) {
    unwrap(existing);
  } else {
    if (r.collapsed) { toast('Сначала выделите текст'); return; }
    const span = document.createElement('span');
    span.className = cls;
    span.appendChild(r.extractContents());
    $$('.sz-large, .sz-small', span).forEach(unwrap);
    r.insertNode(span);
    const nr = document.createRange();
    nr.selectNodeContents(span);
    sel.removeAllRanges();
    sel.addRange(nr);
  }
  ed.dispatchEvent(new Event('input', { bubbles: true }));
}
$$('[data-size]').forEach(btn => btn.addEventListener('click', () => toggleSize(btn.dataset.size)));

$$('[data-align]').forEach(btn => btn.addEventListener('click', () => {
  const b = selectedBlock();
  if (!b || b.type === 'hr' || b.type === 'spacer') return toast('Выберите текстовый блок');
  pushHistory();
  b.align = btn.dataset.align;
  const ed = blockEl(b.id).querySelector('.ed');
  ed.style.textAlign = b.align;
  refreshSelection();
  changed();
}));

$$('[data-style]').forEach(btn => btn.addEventListener('click', () => {
  const b = selectedBlock();
  if (!b || b.type === 'hr' || b.type === 'spacer') return toast('Выберите текстовый блок');
  pushHistory();
  const st = btn.dataset.style;
  if (st === 'list' && b.type !== 'list') {
    // превращаем строки абзаца в пункты
    const tmp = document.createElement('div');
    tmp.innerHTML = b.html;
    const lines = inlineHtmlLines(tmp);
    b.html = lines.map(l => `<div>${l || '<br>'}</div>`).join('');
  } else if (b.type === 'list' && st !== 'list') {
    const tmp = document.createElement('div');
    tmp.innerHTML = b.html;
    const lines = inlineHtmlLines(tmp);
    b.html = lines[0] + lines.slice(1).map(l => `<div>${l || '<br>'}</div>`).join('');
  }
  if (st === 'p') b.type = 'p';
  else if (st === 'list') b.type = 'list';
  else { b.type = 'h'; b.level = +st[1]; }
  renderDoc();
  changed();
  focusBlock(b.id);
}));

// Разбивает HTML редактора на строки (по <div> верхнего уровня), сохраняя внутреннее форматирование
function inlineHtmlLines(root) {
  const lines = [''];
  root.childNodes.forEach(n => {
    if (n.nodeType === 1 && (n.tagName === 'DIV' || n.tagName === 'P')) lines.push(n.innerHTML.replace(/^<br>$/, ''));
    else if (n.nodeType === 1 && n.tagName === 'BR') lines.push('');
    else lines[lines.length - 1] += n.nodeType === 1 ? n.outerHTML : esc(n.nodeValue);
  });
  if (lines.length > 1 && lines[0] === '') lines.shift();
  return lines;
}

function updateFormatState() {
  const inEd = !!currentEd();
  ['bold', 'italic', 'underline'].forEach(c => {
    const btn = $(`[data-cmd="${c}"]`);
    let on = false;
    try { on = inEd && document.queryCommandState(c); } catch { /* ignore */ }
    btn.classList.toggle('on', on);
  });
}
document.addEventListener('selectionchange', updateFormatState);

$('#moveUp').addEventListener('click', () => {
  const i = indexOf(selectedId);
  if (i > 0) { moveBlock(selectedId, i - 1); focusBlock(selectedId); }
});
$('#moveDown').addEventListener('click', () => {
  const i = indexOf(selectedId);
  if (i >= 0 && i < doc.blocks.length - 1) { moveBlock(selectedId, i + 2); focusBlock(selectedId); }
});
$('#dupBlock').addEventListener('click', () => {
  const b = selectedBlock();
  if (b) insertBlocks([{ ...clone(b), id: uid() }], indexOf(b.id) + 1);
});
$('#delBlock').addEventListener('click', () => { if (selectedId) deleteBlock(selectedId); });

$('#newDoc').addEventListener('click', () => {
  if (doc.blocks.some(b => b.html || b.type === 'hr') && !confirm('Создать новый документ? Текущий будет заменён (его можно вернуть кнопкой «Отменить»).')) return;
  pushHistory();
  doc = { title: 'Документ', blocks: [B('p')] };
  selectedId = null;
  renderDoc(true);
  changed();
  focusBlock(doc.blocks[0].id);
});

$('#docTitle').addEventListener('input', e => { doc.title = e.target.value; changed(); });

$('#undoBtn').addEventListener('click', undo);
$('#redoBtn').addEventListener('click', redo);

document.addEventListener('keydown', e => {
  const inText = e.target.closest && e.target.closest('.ed, input, textarea, select');
  if (e.ctrlKey && !inText && (e.key === 'z' || e.key === 'я')) { e.preventDefault(); undo(); }
  if (e.ctrlKey && !inText && (e.key === 'y' || e.key === 'н')) { e.preventDefault(); redo(); }
  if (!inText && e.key === 'Delete' && selectedId) deleteBlock(selectedId);
});

/* ============================================================
   Панель кода
   ============================================================ */

function updateCode() {
  const code = generate();
  $('#code').value = code;
  const limit = +profile().limit || 0;
  const over = limit && code.length > limit;
  const counter = $('#counter');
  counter.textContent = limit ? `${code.length} / ${limit} символов` : `${code.length} символов`;
  counter.classList.toggle('over', !!over);

  $('#stBlocks').textContent = `Блоков: ${doc.blocks.length}`;
  const st = $('#stChars');
  st.textContent = limit ? `Символов: ${code.length} из ${limit}` : `Символов: ${code.length}`;
  st.classList.toggle('over', !!over);
  $('#stProfile').textContent = `Профиль: ${profile().name}`;
}

function fillProfileSelect(sel) {
  sel.innerHTML = Object.entries(settings.profiles)
    .map(([id, p]) => `<option value="${esc(id)}"${id === settings.active ? ' selected' : ''}>${esc(p.name)}</option>`)
    .join('');
}

$('#quickProfile').addEventListener('change', e => setActiveProfile(e.target.value));

function setActiveProfile(id) {
  settings.active = id;
  saveSettings();
  fillProfileSelect($('#quickProfile'));
  updateCode();
}

async function copyCode() {
  const code = generate();
  try {
    await navigator.clipboard.writeText(code);
  } catch {
    const ta = $('#code');
    ta.select();
    document.execCommand('copy');
    ta.setSelectionRange(0, 0);
  }
  const limit = +profile().limit || 0;
  toast(limit && code.length > limit
    ? `Скопировано, но код длиннее лимита (${code.length} / ${limit})`
    : 'Код скопирован — вставьте его в бумагу в игре');
}
$$('[data-copy]').forEach(b => b.addEventListener('click', copyCode));

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

const zoom = $('#zoom');
zoom.value = store.get('zoom', 100);
function applyZoom() {
  page.style.zoom = zoom.value / 100;
  $('#zoomVal').textContent = zoom.value + '%';
  store.set('zoom', +zoom.value);
}
zoom.addEventListener('input', applyZoom);

/* ============================================================
   Вкладки
   ============================================================ */

function showTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  const isSettings = name === 'settings';
  $('#ribbon').hidden = isSettings;
  $('#ribbonGrip').hidden = isSettings;
  $('#workspace').hidden = isSettings;
  // свёрнутая лента раскрывается при выборе вкладки, как в Word
  if (!isSettings && ribbonState.collapsed) { ribbonState.collapsed = false; applyRibbon(); saveLayout(); }
  $('#settingsView').hidden = !isSettings;
  $$('.rpanel').forEach(p => { p.hidden = p.dataset.panel !== name; });
  if (isSettings) renderSettings();
  if (name === 'templates') renderTemplates();
}
$$('.tab').forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

/* ============================================================
   Шаблоны и файлы
   ============================================================ */

function renderTemplates() {
  const g = $('#tplGallery');
  g.innerHTML = '';
  [...BUILTIN_TEMPLATES, ...userTemplates].forEach(t => {
    const c = document.createElement('div');
    c.className = 'tplcard';
    c.title = 'Открыть шаблон';
    c.innerHTML = `<span class="ico">${t.icon || '📄'}</span><span class="name">${esc(t.name)}</span>`;
    c.title = t.name;
    c.addEventListener('click', () => openTemplate(t));
    if (!t.builtin) {
      const x = document.createElement('button');
      x.className = 'x';
      x.textContent = '✕';
      x.title = 'Удалить шаблон';
      x.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm(`Удалить шаблон «${t.name}»?`)) return;
        userTemplates = userTemplates.filter(u => u.id !== t.id);
        store.set('templates', userTemplates);
        renderTemplates();
      });
      c.appendChild(x);
    }
    g.appendChild(c);
  });
}

function openTemplate(t) {
  pushHistory();
  doc = { title: t.name, blocks: tplBlocks(t) };
  selectedId = null;
  renderDoc(true);
  changed();
  toast(`Открыт шаблон «${t.name}». Отменить — Ctrl+Z`);
}

// Своё окно ввода вместо prompt(): в собранном приложении prompt() не работает
function ask(title, value = '') {
  return new Promise(resolve => {
    const dlg = $('#askDlg');
    const inp = $('#askInput');
    $('#askTitle').textContent = title;
    inp.value = value;
    dlg.returnValue = '';
    dlg.onclose = () => resolve(dlg.returnValue === 'ok' ? inp.value.trim() || null : null);
    dlg.showModal();
    inp.select();
  });
}
$('#askInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); $('#askDlg').close('ok'); }
});

$('#tplSave').addEventListener('click', async () => {
  const name = await ask('Название шаблона', doc.title || 'Мой шаблон');
  if (!name) return;
  const existing = userTemplates.find(t => t.name === name);
  if (existing) {
    if (!confirm(`Шаблон «${name}» уже есть. Перезаписать?`)) return;
    existing.blocks = clone(doc.blocks);
  } else {
    userTemplates.push({ id: uid(), name, blocks: clone(doc.blocks) });
  }
  store.set('templates', userTemplates);
  renderTemplates();
  toast('Шаблон сохранён');
});

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// raw: true — обработчик получает сами файлы, иначе разобранный JSON первого файла
let fileHandler = null;
function pickFile(handler, { accept = '.json,application/json', multiple = false, raw = false } = {}) {
  fileHandler = { handler, raw };
  const fi = $('#fileInput');
  fi.accept = accept;
  fi.multiple = multiple;
  fi.value = '';
  fi.click();
}
$('#fileInput').addEventListener('change', async e => {
  const files = [...e.target.files];
  if (!files.length || !fileHandler) return;
  const { handler, raw } = fileHandler;
  try {
    if (raw) await handler(files);
    else handler(JSON.parse(await files[0].text()));
  } catch { toast('Не удалось прочитать файл'); }
});

// .txt из Блокнота бывает и в UTF-8, и в Windows-1251 — пробуем по очереди
async function readTextFile(file) {
  const buf = await file.arrayBuffer();
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); }
  catch { return new TextDecoder('windows-1251').decode(buf); }
}
const baseName = file => file.name.replace(/\.[^.]+$/, '');

function addTemplate(name, blocks) {
  let n = name;
  for (let i = 2; userTemplates.some(t => t.name === n); i++) n = `${name} (${i})`;
  userTemplates.push({ id: uid(), name: n, blocks: clone(blocks) });
  store.set('templates', userTemplates);
  renderTemplates();
  return n;
}

async function templatesFromTxt(files) {
  const texts = await Promise.all(files.map(readTextFile));
  if (files.length === 1) {
    const blocks = parseCode(texts[0]);
    if (!blocks.length) return toast('Файл пустой');
    const name = await ask('Название шаблона', baseName(files[0]));
    if (!name) return;
    toast(`Шаблон «${addTemplate(name, blocks)}» добавлен`);
    return;
  }
  let n = 0;
  files.forEach((f, i) => { const blocks = parseCode(texts[i]); if (blocks.length) { addTemplate(baseName(f), blocks); n++; } });
  toast(`Добавлено шаблонов: ${n}`);
}
$('#tplFromTxt').addEventListener('click', () =>
  pickFile(templatesFromTxt, { accept: '.txt,text/plain', multiple: true, raw: true }));

$('#docExport').addEventListener('click', () => download(`${doc.title || 'документ'}.papirus.json`, { papirus: 'doc', ...doc }));
$('#docImport').addEventListener('click', () => pickFile(data => {
  if (!Array.isArray(data.blocks)) return toast('Это не документ Папируса');
  pushHistory();
  doc = { title: data.title || 'Документ', blocks: data.blocks.map(b => ({ ...B(b.type), ...b })) };
  renderDoc(true);
  changed();
  toast('Документ открыт');
}));

/* ============================================================
   Настройки
   ============================================================ */

function renderSettings() {
  const p = profile();
  const v = $('#settingsView');
  let lastGroup = '';
  const rows = COMMANDS.map(c => {
    let head = '';
    if (c.group !== lastGroup) { lastGroup = c.group; head = `<tr class="grp"><td colspan="3">${esc(c.group)}</td></tr>`; }
    const [o, cl] = p.cmds[c.key] || ['', ''];
    return `${head}<tr>
      <td>${esc(c.name)}${c.note ? `<span class="note">${esc(c.note)}</span>` : ''}</td>
      <td><input data-k="${c.key}" data-i="0" value="${esc(o)}" placeholder="${c.pair ? 'открывающий тег' : 'команда'}"></td>
      <td><input data-k="${c.key}" data-i="1" value="${esc(cl)}" ${c.pair ? 'placeholder="закрывающий тег"' : 'disabled'}></td>
    </tr>`;
  }).join('');

  v.innerHTML = `
  <div class="set-wrap">
    <h1>Настройки</h1>

    <section class="card">
      <h2>Оформление</h2>
      <div class="row">
        <span>Тема:</span>
        <span class="seg" id="themeSeg">
          <button data-theme="light">☀ Светлая</button>
          <button data-theme="dark">🌙 Тёмная</button>
          <button data-theme="system">🖥 Как в Windows</button>
        </span>
      </div>
      <div class="row">
        <label><input type="checkbox" id="animToggle" ${settings.animations !== false ? 'checked' : ''}> Плавные анимации</label>
      </div>
      <div class="row">
        <button class="btn" id="layoutReset">Вернуть размеры ленты и панелей</button>
        <span class="muted" style="margin:0">Ленту тянут за полоску под ней, панели — за их границы</span>
      </div>
    </section>

    <section class="card">
      <h2>Профиль команд</h2>
      <p class="muted">На разных билдах SS13 команды бумаги отличаются. Выберите готовый профиль или сделайте копию и пропишите свои команды.
      Пустое поле значит, что команды на сервере нет — Папирус подставит обычный текст.</p>
      <div class="row">
        <select id="profSel"></select>
        <button class="btn" id="profDup">Создать копию</button>
        <button class="btn" id="profRen">Переименовать</button>
        <button class="btn danger" id="profDel">Удалить</button>
      </div>
      <div class="row">
        <label><input type="checkbox" id="profBr" ${p.useBr ? 'checked' : ''}>
          Переносить строки командой «Перенос строки» (если бумага на сервере пишется в одну строку)</label>
      </div>
      <div class="row">
        <label>Лимит символов на листе:<input type="number" id="profLimit" min="0" value="${+p.limit || 0}"></label>
        <span class="muted" style="margin:0">0 — без ограничения</span>
      </div>
      <table class="cmds">
        <thead><tr><th>Команда</th><th>Открывающая / сама команда</th><th>Закрывающая</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </section>

    <section class="card">
      <h2>Свои блоки</h2>
      <p class="muted">Любой кусок кода, который часто нужен: логотип, печать, служебная строка. Появятся в панели блоков, их можно бросать прямо в текст.</p>
      <div id="snips"></div>
      <button class="btn" id="snipAdd">+ Добавить блок</button>
    </section>

    <section class="card">
      <h2>Подстановки</h2>
      <p class="muted">Используются, когда у профиля нет команды для подписи или даты.</p>
      <div class="row"><label>Имя для подписи: <input type="text" id="signName" value="${esc(settings.signName)}" placeholder="например, Джон Доу"></label></div>
      <div class="row"><label>Сдвиг года для даты:<input type="number" id="yearOffset" value="${+settings.yearOffset || 0}"></label>
        <span class="muted" style="margin:0" id="yearPreview"></span></div>
    </section>

    <section class="card">
      <h2>Резервная копия</h2>
      <p class="muted">Сохраните настройки в файл, чтобы перенести их на другой ПК или поделиться профилем с друзьями.</p>
      <div class="row">
        <button class="btn" id="setExport">Сохранить настройки в файл</button>
        <button class="btn" id="setImport">Загрузить из файла</button>
        <button class="btn danger" id="setReset">Вернуть стандартные профили</button>
      </div>
    </section>
  </div>`;

  const markTheme = () => $$('#themeSeg button').forEach(b => b.classList.toggle('on', b.dataset.theme === settings.theme));
  markTheme();
  $$('#themeSeg button').forEach(b => b.addEventListener('click', () => { setTheme(b.dataset.theme); markTheme(); }));
  $('#animToggle').addEventListener('change', e => { settings.animations = e.target.checked; saveSettings(); applyMotion(); });
  $('#layoutReset').addEventListener('click', () => { resetLayout(); toast('Размеры сброшены'); });

  fillProfileSelect($('#profSel'));
  $('#profSel').addEventListener('change', e => { setActiveProfile(e.target.value); renderSettings(); });

  $$('.cmds input', v).forEach(inp => inp.addEventListener('input', () => {
    const k = inp.dataset.k;
    if (!p.cmds[k]) p.cmds[k] = ['', ''];
    p.cmds[k][+inp.dataset.i] = inp.value;
    saveSettings();
    updateCode();
  }));
  $('#profBr').addEventListener('change', e => { p.useBr = e.target.checked; saveSettings(); updateCode(); });
  $('#profLimit').addEventListener('input', e => { p.limit = +e.target.value || 0; saveSettings(); updateCode(); });

  $('#profDup').addEventListener('click', () => {
    const id = uid();
    settings.profiles[id] = { ...clone(p), name: p.name.replace(/ — черновик$/, '') + ' (моя копия)' };
    setActiveProfile(id);
    renderSettings();
    toast('Копия создана — теперь можно править команды');
  });
  $('#profRen').addEventListener('click', async () => {
    const name = await ask('Название профиля', p.name);
    if (!name) return;
    p.name = name;
    saveSettings();
    fillProfileSelect($('#quickProfile'));
    renderSettings();
    updateCode();
  });
  $('#profDel').addEventListener('click', () => {
    if (Object.keys(settings.profiles).length <= 1) return toast('Нельзя удалить последний профиль');
    if (!confirm(`Удалить профиль «${p.name}»?`)) return;
    delete settings.profiles[settings.active];
    setActiveProfile(Object.keys(settings.profiles)[0]);
    renderSettings();
  });

  const renderSnips = () => {
    const box = $('#snips');
    box.innerHTML = settings.snippets.length ? '' : '<p class="muted">Своих блоков пока нет.</p>';
    settings.snippets.forEach(s => {
      const row = document.createElement('div');
      row.className = 'snip';
      row.innerHTML = `<input placeholder="Название" value="${esc(s.name)}"><input class="mono" placeholder="Код, например [logo]" value="${esc(s.code)}"><button class="btn small danger" title="Удалить">✕</button>`;
      const [nameIn, codeIn] = row.querySelectorAll('input');
      nameIn.addEventListener('input', () => { s.name = nameIn.value; saveSettings(); renderPalette(); });
      codeIn.addEventListener('input', () => { s.code = codeIn.value; saveSettings(); renderPalette(); updateCode(); });
      row.querySelector('button').addEventListener('click', () => {
        settings.snippets = settings.snippets.filter(x => x !== s);
        saveSettings(); renderSnips(); renderPalette();
      });
      box.appendChild(row);
    });
  };
  renderSnips();
  $('#snipAdd').addEventListener('click', () => {
    settings.snippets.push({ id: uid(), name: '', code: '' });
    saveSettings(); renderSnips();
    $$('#snips .snip input')[($$('#snips .snip').length - 1) * 2].focus();
  });

  const yearPreview = () => { $('#yearPreview').textContent = 'Сегодня будет: ' + literal('date'); };
  yearPreview();
  $('#signName').addEventListener('input', e => { settings.signName = e.target.value; saveSettings(); updateCode(); });
  $('#yearOffset').addEventListener('input', e => { settings.yearOffset = +e.target.value || 0; saveSettings(); yearPreview(); updateCode(); });

  $('#setExport').addEventListener('click', () => download('papirus-settings.json', { papirus: 'settings', ...settings }));
  $('#setImport').addEventListener('click', () => pickFile(data => {
    if (!data.profiles || typeof data.profiles !== 'object') return toast('Это не файл настроек Папируса');
    delete data.papirus;
    settings = { ...defaultSettings(), ...data };
    if (!settings.profiles[settings.active]) settings.active = Object.keys(settings.profiles)[0];
    saveSettings(); afterSettingsChange(); renderSettings();
    toast('Настройки загружены');
  }));
  $('#setReset').addEventListener('click', () => {
    if (!confirm('Вернуть стандартные профили к исходному виду? Ваши собственные профили останутся.')) return;
    Object.entries(PRESETS).forEach(([id, pr]) => { settings.profiles[id] = clone(pr); });
    saveSettings(); afterSettingsChange(); renderSettings();
  });
}

function afterSettingsChange() {
  fillProfileSelect($('#quickProfile'));
  renderPalette();
  updateCode();
}

/* ============================================================
   Импорт кода SS13 → блоки
   ============================================================ */

const INLINE_KEYS = ['bold', 'italic', 'underline', 'large', 'small'];

// Все команды текущего профиля и свои блоки, длинные — первыми (чтобы «**» не съелось как «*»)
function tokenTable() {
  const t = [];
  COMMANDS.forEach(c => {
    const [o, cl] = cmd(c.key);
    if (!c.pair) { if (o) t.push({ str: o, key: c.key, role: 'single' }); return; }
    if (o && o === cl) { t.push({ str: o, key: c.key, role: 'toggle' }); return; }
    if (o) t.push({ str: o, key: c.key, role: 'open' });
    if (cl) t.push({ str: cl, key: c.key, role: 'close' });
  });
  settings.snippets.forEach(s => { if (s.code) t.push({ str: s.code, key: 'snippet', role: 'single', snippet: s }); });
  t.forEach(x => {
    x.low = x.str.toLowerCase();
    // «# », «- » и подобные markdown-команды действуют только в начале строки
    x.lineStart = /\s$/.test(x.str);
  });
  return t.sort((a, b) => b.str.length - a.str.length);
}

function tokenize(code) {
  const table = tokenTable();
  const low = code.toLowerCase();
  const out = [];
  let text = '';
  const pushText = () => { if (text) out.push({ text }); text = ''; };
  for (let i = 0; i < code.length;) {
    if (code[i] === '\n') { pushText(); out.push({ nl: true }); i++; continue; }
    const atLineStart = i === 0 || code[i - 1] === '\n';
    const m = table.find(x => (!x.lineStart || atLineStart) && low.startsWith(x.low, i));
    if (m) { pushText(); out.push(m); i += m.str.length; } else text += code[i++];
  }
  pushText();
  return out;
}

function parseCode(raw) {
  const code = raw.replace(/\r\n?/g, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/\s+$/, '');
  const fmt = {};
  const lines = [];
  let align = 'left', heading = 0, nextItem = false;
  let cur = null;
  let soft = false; // блок только что закрылся — следующий перевод строки его просто завершает

  const line = () => {
    if (!cur) { cur = { html: '', align, h: heading, item: nextItem }; nextItem = false; }
    soft = false;
    return cur;
  };
  const flushBlock = () => { if (cur) { lines.push(cur); cur = null; soft = true; } };
  const wrapFmt = h => {
    if (fmt.small) h = `<span class="sz-small">${h}</span>`;
    if (fmt.large) h = `<span class="sz-large">${h}</span>`;
    if (fmt.underline) h = `<u>${h}</u>`;
    if (fmt.italic) h = `<i>${h}</i>`;
    if (fmt.bold) h = `<b>${h}</b>`;
    return h;
  };
  const newline = () => {
    if (cur) { lines.push(cur); cur = null; } else if (soft) soft = false; else lines.push({ html: '', align, h: 0 });
    if (heading && !cmd('h' + heading)[1]) heading = 0; // markdown-заголовок заканчивается с концом строки
  };

  for (const tk of tokenize(code)) {
    if (tk.nl) { newline(); continue; }
    if (tk.text != null) { line().html += wrapFmt(esc(tk.text)); continue; }
    const k = tk.key;

    if (INLINE_KEYS.includes(k)) {
      fmt[k] = tk.role === 'toggle' ? !fmt[k] : tk.role === 'open';
    } else if (k === 'center' || k === 'right') {
      align = tk.role === 'close' ? 'left' : k;
      if (cur && tk.role !== 'close') cur.align = align;
    } else if (/^h[123]$/.test(k)) {
      flushBlock();
      heading = tk.role === 'close' ? 0 : +k[1];
    } else if (k === 'list') {
      flushBlock();
    } else if (k === 'item') {
      flushBlock();
      nextItem = true;
    } else if (k === 'hr') {
      flushBlock();
      lines.push({ hr: true });
      soft = true;
    } else if (k === 'br') {
      newline();
    } else if (k === 'snippet') {
      line().html += wrapFmt(chip('custom', { name: tk.snippet.name || tk.snippet.code, code: tk.snippet.code, sid: tk.snippet.id }));
    } else {
      line().html += wrapFmt(chip(k));
    }
  }
  if (cur) lines.push(cur);

  const blocks = [];
  for (const l of lines) {
    const prev = blocks[blocks.length - 1];
    if (l.hr) { blocks.push(B('hr')); continue; }
    const empty = !l.html.includes('chip') && !l.html.replace(/<[^>]+>/g, '').trim();
    if (empty && !l.item) { blocks.push(B('spacer')); continue; }
    const html = tidyHtml(l.html);
    if (l.h) { blocks.push(B('h', { level: l.h, align: l.align, html })); continue; }
    const type = l.item ? 'list' : 'p';
    if (prev && prev.type === type && prev.align === l.align) prev.html += `<div>${html || '<br>'}</div>`;
    else blocks.push(B(type, { align: l.align, html: type === 'list' ? `<div>${html || '<br>'}</div>` : html }));
  }
  return blocks;
}

// Склеивает соседние одинаковые теги: <b>а</b><b>б</b> → <b>аб</b>
function tidyHtml(html) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  (function walk(node) {
    let c = node.firstChild;
    while (c) {
      const next = c.nextSibling;
      if (next && c.nodeType === 1 && next.nodeType === 1 && !c.dataset.token && !next.dataset.token &&
          c.tagName === next.tagName && c.className === next.className) {
        while (next.firstChild) c.appendChild(next.firstChild);
        next.remove();
        continue;
      }
      if (c.nodeType === 1 && !c.dataset.token) walk(c);
      c = c.nextSibling;
    }
  })(tmp);
  return tmp.innerHTML;
}

const importDlg = $('#importDlg');
const importText = $('#importText');

let importName = ''; // имя файла, если код пришёл из .txt — пригодится для названия

function openImport(text = '', name = '') {
  fillProfileSelect($('#importProfile'));
  importText.value = text;
  importName = name;
  importDlg.showModal();
  importText.focus();
  updateImportInfo();
}
function updateImportInfo() {
  const code = importText.value;
  if (!code.trim()) { $('#importInfo').textContent = 'Вставьте код бумаги (Ctrl+V)'; return; }
  const blocks = parseCode(code);
  const chips = blocks.reduce((n, b) => n + (b.html.match(/data-token/g) || []).length, 0);
  $('#importInfo').textContent = `Получится блоков: ${blocks.length}, полей и вставок: ${chips}`;
}
importText.addEventListener('input', updateImportInfo);
$('#importProfile').addEventListener('change', e => { setActiveProfile(e.target.value); updateImportInfo(); });

function doImport(replace) {
  const blocks = parseCode(importText.value);
  if (!blocks.length) return toast('Нечего импортировать');
  pushHistory();
  if (replace) doc = { title: importName || 'Импорт', blocks };
  else doc.blocks.push(...blocks);
  selectedId = null;
  importDlg.close();
  showTab('home');
  renderDoc(true);
  changed();
  toast(`Импортировано блоков: ${blocks.length}. Отменить — Ctrl+Z`);
}
$('#importReplace').addEventListener('click', () => doImport(true));
$('#importAppend').addEventListener('click', () => doImport(false));
$('#importCancel').addEventListener('click', () => importDlg.close());
$$('[data-import]').forEach(b => b.addEventListener('click', () => openImport()));

// В Пульте другое приложение (Терминал Брига) присылает готовый код бумаги — открываем его в окне импорта,
// а заменить документ, добавить в конец или сохранить шаблоном решает пользователь
window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data || e.data.type !== 'pult-import' || typeof e.data.code !== 'string') return;
  if (importDlg.open) importDlg.close();
  showTab('home');
  openImport(e.data.code, String(e.data.title || ''));
});

$('#importOpenTxt').addEventListener('click', () => pickFile(async files => {
  importText.value = await readTextFile(files[0]);
  importName = baseName(files[0]);
  updateImportInfo();
}, { accept: '.txt,text/plain', raw: true }));

$('#importAsTpl').addEventListener('click', async () => {
  const blocks = parseCode(importText.value);
  if (!blocks.length) return toast('Нечего сохранять');
  importDlg.close();
  const name = await ask('Название шаблона', importName || 'Импортированный шаблон');
  if (!name) { importDlg.showModal(); return; }
  toast(`Шаблон «${addTemplate(name, blocks)}» добавлен на вкладку «Шаблоны»`);
});

// .txt, перетащенный в окно из Проводника, открывается в окне импорта
let fileDragDepth = 0;
const hasFiles = e => e.dataTransfer && [...e.dataTransfer.types].includes('Files');
document.addEventListener('dragenter', e => { if (hasFiles(e)) { fileDragDepth++; document.body.classList.add('file-over'); } });
document.addEventListener('dragleave', e => {
  if (hasFiles(e) && --fileDragDepth <= 0) { fileDragDepth = 0; document.body.classList.remove('file-over'); }
});
document.addEventListener('dragover', e => { if (hasFiles(e)) e.preventDefault(); });
document.addEventListener('drop', async e => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  fileDragDepth = 0;
  document.body.classList.remove('file-over');
  const files = [...e.dataTransfer.files].filter(f => /\.txt$/i.test(f.name) || f.type === 'text/plain');
  if (!files.length) return toast('Перетащите .txt-файл с кодом бумаги');
  if (files.length > 1) return templatesFromTxt(files);
  openImport(await readTextFile(files[0]), baseName(files[0]));
});

// Вставка вне текста (Ctrl+V по листу) сразу открывает импорт
document.addEventListener('paste', e => {
  if (importDlg.open || (e.target.closest && e.target.closest('.ed, input, textarea, select'))) return;
  const text = e.clipboardData.getData('text/plain');
  if (!text.trim()) return;
  e.preventDefault();
  openImport(text);
});

/* ============================================================
   Оформление: тема, анимации, размеры ленты и панелей
   ============================================================ */

const darkQuery = matchMedia('(prefers-color-scheme: dark)');

function applyTheme(smooth = false) {
  const t = settings.theme === 'system' ? (darkQuery.matches ? 'dark' : 'light') : settings.theme;
  if (smooth && motionOn()) {
    document.body.classList.add('theming');
    setTimeout(() => document.body.classList.remove('theming'), 300);
  }
  document.documentElement.dataset.theme = t;
  $('#themeBtn').textContent = t === 'dark' ? '☀' : '🌙';
  $('#themeBtn').title = t === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему';
  // В приложении (.exe) подсказываем окну перекрасить системный заголовок
  try { window.chrome.webview.postMessage('theme:' + t); } catch { /* открыто в браузере */ }
}
function setTheme(theme) {
  settings.theme = theme;
  saveSettings();
  applyTheme(true);
}
darkQuery.addEventListener('change', () => { if (settings.theme === 'system') applyTheme(true); });
$('#themeBtn').addEventListener('click', () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));

function applyMotion() {
  document.documentElement.classList.toggle('no-motion', settings.animations === false);
}

// --- Размеры ---
const LAYOUT_DEFAULT = { zoom: 1, collapsed: false, palette: null, code: null };
const ribbon = $('#ribbon');
const grip = $('#ribbonGrip');
let ribbonState = Object.assign({}, LAYOUT_DEFAULT, store.get('layout', {}));
const saveLayout = () => store.set('layout', ribbonState);

function applyRibbon() {
  ribbon.style.setProperty('--rz', ribbonState.zoom);
  ribbon.classList.toggle('collapsed', ribbonState.collapsed);
}
function applyPanels() {
  $('#palette').style.width = ribbonState.palette ? ribbonState.palette + 'px' : '';
  $('#codepanel').style.width = ribbonState.code ? ribbonState.code + 'px' : '';
}
function resetLayout() {
  ribbonState = Object.assign({}, LAYOUT_DEFAULT);
  applyRibbon(); applyPanels(); saveLayout();
}

// Общий помощник: тянем мышью, пока кнопка зажата
function dragResize(handle, axis, onMove) {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    handle.classList.add('active');
    document.body.classList.add('resizing', axis);
    const start = { x: e.clientX, y: e.clientY };
    const ctx = {};
    const move = ev => onMove(ev.clientX - start.x, ev.clientY - start.y, ctx);
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.classList.remove('active');
      document.body.classList.remove('resizing', axis);
      saveLayout();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up, { once: true });
    handle.addEventListener('pointercancel', up, { once: true });
  });
}

// Лента: тянем полоску вниз — крупнее, вверх — мельче, совсем вверх — свернуть
const RIBBON_BASE = 98; // высота ленты при масштабе 1
dragResize(grip, 'ns', (dx, dy, ctx) => {
  if (ctx.z == null) ctx.z = ribbonState.collapsed ? 0.3 : ribbonState.zoom;
  const z = ctx.z + dy / RIBBON_BASE;
  if (z < 0.55) ribbonState.collapsed = true;
  else { ribbonState.collapsed = false; ribbonState.zoom = Math.round(Math.min(1.4, Math.max(0.75, z)) * 100) / 100; }
  applyRibbon();
});
grip.addEventListener('dblclick', () => {
  ribbonState.collapsed = !ribbonState.collapsed;
  applyRibbon(); saveLayout();
});

// Боковые панели
$$('.splitter').forEach(sp => {
  const isPalette = sp.dataset.split === 'palette';
  const panel = isPalette ? $('#palette') : $('#codepanel');
  const [min, max] = isPalette ? [150, 420] : [220, 640];
  dragResize(sp, 'ew', (dx, dy, ctx) => {
    if (ctx.w == null) ctx.w = panel.getBoundingClientRect().width;
    const w = Math.round(Math.min(max, Math.max(min, ctx.w + (isPalette ? dx : -dx))));
    ribbonState[isPalette ? 'palette' : 'code'] = w;
    applyPanels();
  });
  sp.addEventListener('dblclick', () => {
    ribbonState[isPalette ? 'palette' : 'code'] = null;
    applyPanels(); saveLayout();
  });
});

/* ============================================================
   Старт
   ============================================================ */

applyTheme();
applyMotion();
applyRibbon();
applyPanels();
renderPalette();
fillProfileSelect($('#quickProfile'));
renderDoc();
applyZoom();
updateCode();
updateUndo();

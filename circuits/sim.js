'use strict';
// Симулятор интегральных схем: повторяет логику do_work() компонентов из
// code/modules/integrated_electronics (MOLOT-BlueMoon-Station) для всего, что не требует мира игры:
// арифметика, логика, память, передача данных, конвертеры, списки, текст, время, кнопки, экраны, свет.
// Модель как в игре: выход пишет в связанные входы только при push_data(), импульс идёт сразу
// (в глубину), у каждого компонента своя перезарядка cooldown_per_use (в десятых секунды).
(function () {
  const DIRS = [1, 2, 4, 8, 5, 6, 9, 10];
  const MAX_LIST = 500;
  const truthy = (v) => v !== null && v !== undefined && v !== 0 && v !== '' && v !== false;
  const isNum = (v) => typeof v === 'number' && !Number.isNaN(v);
  const isText = (v) => typeof v === 'string';
  const deg = (r) => (r * 180) / Math.PI, rad = (d) => (d * Math.PI) / 180;

  // num2text() BYOND: 6 значащих цифр, большие числа — «1e+006»
  function num2text(n) {
    if (!isNum(n)) return null;
    const p = Number(n.toPrecision(6));
    if (p !== 0 && (Math.abs(p) >= 1e6 || Math.abs(p) < 1e-4)) {
      const [m, e] = p.toExponential().split('e');
      const sign = e[0] === '-' ? '-' : '+';
      return `${Number(Number(m).toPrecision(6))}e${sign}${e.replace(/^[-+]/, '').padStart(3, '0')}`;
    }
    return String(p);
  }
  function text2num(s) {
    if (isNum(s)) return s;
    if (!isText(s)) return null;
    const m = s.match(/^\s*[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?/i);
    return m ? Number(m[0]) : null;
  }
  // "[x]" в DM: null — пустая строка, число — num2text
  const toText = (v) => (v === null || v === undefined ? '' : isNum(v) ? num2text(v) : Array.isArray(v) ? '/list' : String(v));
  const stripTags = (s) => s.replace(/<[^>]*>/g, '');
  const len = (s) => (isText(s) ? [...s].length : 0);
  const chars = (s) => [...s];
  // copytext_char(T, Start, End): с 1, End не включается, 0 — до конца
  function copytext(t, start = 1, end = 0) {
    if (!isText(t)) return '';
    const c = chars(t);
    const s = Math.max(1, Math.round(start)) - 1;
    const e = end > 0 ? Math.round(end) - 1 : c.length;
    return c.slice(s, e).join('');
  }
  function findtext(h, n) {
    if (!isText(h) || !isText(n) || !n) return 0;
    return h.toLowerCase().indexOf(n.toLowerCase()) + 1;
  }
  const same = (a, b) => a === b || (a === null && b === undefined) || (a === undefined && b === null);
  const unique = (l) => l.filter((x, i) => l.findIndex((y) => same(x, y)) === i);
  const rand = (l, h) => { if (l > h) [l, h] = [h, l]; l = Math.ceil(l); h = Math.floor(h); return l + Math.floor(Math.random() * (h - l + 1)); };
  const hex2 = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  function hsv2rgb(h, s, v) {
    h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(255, s)) / 255; v = Math.max(0, Math.min(255, v));
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return '#' + hex2(r + m) + hex2(g + m) + hex2(b + m);
  }

  // Запись в пин с проверкой типа, как write_data_to_pin(): неподходящее значение пин просто не принимает
  function coerce(type, old, v) {
    if (v === undefined) v = null;
    switch (type) {
      case 'number': return v === null || isNum(v) ? v : old;
      case 'string': return v === null ? null : isText(v) ? stripTags(v) : old;
      case 'char': return v === null || (isText(v) && len(v) <= 1) ? v : old;
      case 'boolean': return v === 0 || v === 1 || v === true || v === false ? +v : old;
      case 'index': return v === null ? 0 : isNum(v) ? Math.max(0, Math.min(MAX_LIST, Math.round(v))) : old;
      case 'list': return Array.isArray(v) ? v.slice(0, MAX_LIST) : old;
      case 'color': return v === null ? null : isText(v) && v.length === 7 ? v.toUpperCase() : old;
      case 'dir': return v === null || DIRS.includes(v) ? v : old;
      case 'ref': case 'selfref': return v === null || (v && typeof v === 'object' && v.ref) ? v : old;
      default: return v;
    }
  }
  function pinDefault(pin) {
    if (pin.length > 2) return pin[2];
    return pin[1] === 'boolean' ? 0 : pin[1] === 'index' ? 1 : pin[1] === 'list' ? [] : null;
  }

  // ---------- Поведение компонентов: имя → do_work(ctx, ord) ----------
  const B = {};
  const def = (names, fn) => names.split('|').forEach((n) => { B[n] = fn; });
  const done = (c) => { c.push(); c.pulse(2); };

  // Арифметика
  def('addition circuit', (c) => { let r = 0; c.each((v) => { if (isNum(v)) r += v; }); c.set(1, r); done(c); });
  const fold = (op, skipZero) => (c) => {
    const a = c.in(1); if (!isNum(a)) return;
    let r = a; for (let k = 2; k <= c.nIn; k++) { const v = c.in(k); if (isNum(v) && !(skipZero && v === 0)) r = op(r, v); }
    c.set(1, r); done(c);
  };
  def('subtraction circuit', fold((a, b) => a - b));
  def('multiplication circuit', fold((a, b) => a * b));
  def('division circuit', fold((a, b) => a / b, true));
  def('exponent circuit', (c) => { const a = c.in(1), b = c.in(2); c.set(1, isNum(a) && isNum(b) ? a ** b : 0); done(c); });
  def('sign circuit', (c) => { const a = c.in(1); c.set(1, isNum(a) ? Math.sign(a) : 0); done(c); });
  def('round circuit', (c) => {
    const a = c.in(1), b = c.in(2);
    c.set(1, !isNum(a) ? 0 : isNum(b) && b !== 0 ? b * Math.floor(a / b + 0.5) : Math.floor(a)); done(c);
  });
  def('absolute circuit', (c) => { const a = c.in(1); c.set(1, isNum(a) ? Math.abs(a) : 0); done(c); });
  def('average circuit', (c) => {
    // как в игре: пин A в среднее не входит (цикл с 2)
    let r = 0, n = 0; for (let k = 2; k <= c.nIn; k++) { const v = c.in(k); if (isNum(v)) { r += v; n++; } }
    c.set(1, n ? r / n : 0); done(c);
  });
  def('pi constant circuit', (c) => { c.set(1, Math.PI); done(c); });
  def('random number generator circuit', (c) => { const l = c.in(1), h = c.in(2); c.set(1, isNum(l) && isNum(h) ? rand(l, h) : 0); done(c); });
  def('square root circuit', (c) => { const a = c.in(1); c.set(1, isNum(a) ? Math.sqrt(a) : 0); done(c); });
  def('modulo circuit', (c) => { const a = c.in(1), b = c.in(2); c.set(1, isNum(a) && isNum(b) && Math.trunc(b) !== 0 ? Math.trunc(a) % Math.trunc(b) : 0); done(c); });
  const extreme = (min) => (c) => {
    let r = null; c.each((v) => { if (isNum(v) && (r === null || (min ? v < r : v > r))) r = v; });
    c.set(1, r === null ? 0 : r); done(c);
  };
  def('max circuit', extreme(false));
  def('min circuit', extreme(true));

  // Тригонометрия (в градусах, как в BYOND)
  const trig = (f) => (c) => { const a = c.in(1); c.set(1, a === null ? null : f(isNum(a) ? a : 0)); done(c); };
  def('sin circuit', trig((a) => Math.sin(rad(a))));
  def('cos circuit', trig((a) => Math.cos(rad(a))));
  def('tan circuit', trig((a) => Math.tan(rad(a))));
  def('Arcsine (ASIN) circuit', trig((a) => deg(Math.asin(a))));
  def('Arccosine (ACOS) circuit', trig((a) => deg(Math.acos(a))));
  def('Arctangent (ATG) circuit', trig((a) => deg(Math.atan(a))));
  def('cosecant (CSC) circuit', trig((a) => 1 / Math.sin(rad(a))));
  def('secant (SEC) circuit', trig((a) => 1 / Math.cos(rad(a))));
  def('cotangent (COT) circuit', trig((a) => 1 / Math.tan(rad(a))));

  // Логика. Как в игре: бинарный вентиль сначала шлёт импульс, а потом push_data()
  const comparable = (a, b) => (isNum(a) && isNum(b)) || (isText(a) && isText(b));
  const gate = (f) => (c) => { const r = f(c.in(1), c.in(2)) ? 1 : 0; c.set(1, r); c.pulse(r ? 2 : 3); c.push(); };
  def('equal gate', gate((a, b) => same(a, b)));
  def('not equal gate', gate((a, b) => !same(a, b)));
  def('and gate', gate((a, b) => truthy(a) && truthy(b)));
  def('or gate', gate((a, b) => truthy(a) || truthy(b)));
  def('xor gate', gate((a, b) => truthy(a) !== truthy(b)));
  def('less than gate', gate((a, b) => comparable(a, b) && a < b));
  def('less than or equal gate', gate((a, b) => comparable(a, b) && a <= b));
  def('greater than gate', gate((a, b) => comparable(a, b) && a > b));
  def('greater than or equal gate', gate((a, b) => comparable(a, b) && a >= b));
  def('not gate', (c) => { c.set(1, truthy(c.in(1)) ? 0 : 1); c.push(); c.pulse(2); });
  const latch = (next) => (c) => {
    c.st.q = next(!!c.st.q, truthy(c.in(1)), truthy(c.in(2)));
    c.set(1, c.st.q ? 1 : 0); c.set(2, c.st.q ? 0 : 1); c.pulse(c.st.q ? 2 : 3); c.push();
  };
  def('JK latch', latch((q, j, k) => (j ? (k ? !q : true) : k ? false : q)));
  def('RS latch', latch((q, s, r) => (s ? (r ? q : true) : r ? false : q)));
  def('gated D latch', latch((q, d, e) => (e ? d : q)));

  // Память
  def('memory chip|small memory circuit|medium memory circuit|large memory circuit|large memory stick', (c) => {
    for (let i = 1; i <= c.nIn; i++) c.set(i, c.in(i));
    c.push(); c.pulse(2);
  });
  def('constant chip', (c) => c.push());

  // Передача данных
  def('two multiplexer|four multiplexer|eight multiplexer|sixteen multiplexer', (c) => {
    const i = c.in(1);
    if (isNum(i) && i >= 1 && i < c.nIn) { c.set(1, c.in(Math.floor(i) + 1)); c.push(); }
    c.pulse(2);
  });
  def('two demultiplexer|four demultiplexer|eight demultiplexer|sixteen demultiplexer', (c) => {
    const i = c.in(1);
    if (isNum(i) && i >= 1 && i <= c.nOut) { c.set(Math.floor(i), c.in(2)); c.push(Math.floor(i)); }
    c.pulse(2);
  });
  def('two pulse demultiplexer|four pulse demultiplexer|eight pulse demultiplexer|sixteen pulse demultiplexer', (c) => {
    const i = c.in(1);
    if (isNum(i) && i >= 1 && i <= c.nAct - 1) c.pulse(Math.round(i + 1));
  });
  def('two pulse multiplexer|four pulse multiplexer|eight pulse multiplexer|sixteen pulse multiplexer', (c, ord) => {
    const i = ord - 2;
    if (i >= 0 && i < c.nIn) { c.set(1, c.in(i + 1)); c.push(); }
    c.pulse(1);
  });
  def('wire node', (c) => c.pulse(2));

  // Конвертеры и текст
  def('number to string', (c) => { for (let i = 1; i <= c.nIn; i++) { const v = c.in(i); c.set(i, v === null ? null : num2text(v)); } done(c); });
  def('string to number', (c) => { for (let i = 1; i <= c.nIn; i++) c.set(i, text2num(c.in(i))); done(c); });
  def('lowercase string converter', (c) => { const v = c.in(1); c.set(1, v === null ? null : String(v).toLowerCase()); done(c); });
  def('uppercase string converter', (c) => { const v = c.in(1); c.set(1, v === null ? null : String(v).toUpperCase()); done(c); });
  const concat = (max) => (c) => {
    let r = null;
    for (let k = 1; k <= c.nIn; k++) {
      const v = c.in(k); if (v === null) continue;
      const s = toText(v);
      if (len(r) + len(s) > max) { c.log(`превышен лимит ${max} символов — дальше не склеивает`); break; }
      r = (r || '') + s;
    }
    c.set(1, r); done(c);
  };
  def('small concatenator', concat(256));
  def('concatenator', concat(512));
  def('large concatenator', concat(1024));
  def('separator', (c) => {
    const t = c.in(1), idx = isNum(c.in(2)) ? c.in(2) : 0;
    const split = Math.min(idx + 1, len(t));
    c.set(1, copytext(t, 1, split)); c.set(2, copytext(t, split)); done(c);
  });
  def('indexer', (c) => { const t = c.in(1), i = c.in(2); c.set(1, isNum(i) && i > 0 && i <= len(t) ? chars(t)[Math.floor(i) - 1] : ''); done(c); });
  def('find text', (c) => { const p = findtext(c.in(1), c.in(2)); c.set(1, p); c.push(); c.pulse(2); c.pulse(p ? 3 : 4); });
  def('get length', (c) => { c.set(1, len(c.in(1))); done(c); });
  def('string exploder', (c) => {
    const t = toText(c.in(1)), d = c.in(2);
    c.set(1, d === null ? chars(t) : t.split(String(d))); done(c);
  });
  def('radians to degrees converter', (c) => { const v = c.in(1); c.set(1, isNum(v) ? deg(v) : null); done(c); });
  def('degrees to radians converter', (c) => { const v = c.in(1); c.set(1, isNum(v) ? rad(v) : null); done(c); });
  const coords = (sign) => (c) => {
    const [x1, y1, x2, y2] = [1, 2, 3, 4].map((i) => c.in(i));
    if ([x1, y1, x2, y2].every((v) => v !== null)) { c.set(1, x1 + sign * x2); c.set(2, y1 + sign * y2); }
    done(c);
  };
  def('abs to rel coordinate converter', coords(-1));
  def('rel to abs coordinate converter', coords(1));
  def('rgb to hexadecimal', (c) => { const [r, g, b] = [1, 2, 3].map((i) => c.in(i)); c.set(1, [r, g, b].every(isNum) ? ('#' + hex2(r) + hex2(g) + hex2(b)).toUpperCase() : null); done(c); });
  def('hsv to hexadecimal', (c) => { const [h, s, v] = [1, 2, 3].map((i) => c.in(i)); c.set(1, [h, s, v].every(isNum) ? hsv2rgb(h, s, v).toUpperCase() : null); done(c); });
  def('find-replace circuit', (c) => {
    const h = c.in(1), n = c.in(2), r = c.in(3);
    c.set(1, isText(h) && isText(n) && n ? h.split(n).join(toText(r)) : h); done(c);
  });

  // Списки
  const list = (v) => (Array.isArray(v) ? v : []);
  def('pick circuit', (c) => { const l = list(c.in(1)); if (l.length) { c.set(1, l[Math.floor(Math.random() * l.length)]); c.push(); c.pulse(2); } else c.pulse(3); });
  def('append circuit', (c) => { c.set(1, list(c.in(1)).concat([c.in(2)])); done(c); });
  def('search circuit', (c) => { const i = list(c.in(1)).findIndex((x) => same(x, c.in(2))) + 1; c.set(1, i); c.push(); c.pulse(i ? 2 : 3); });
  def('filter circuit', (c) => {
    const l = list(c.in(1)), s = c.in(2), samples = Array.isArray(s) ? unique(s) : [s];
    const match = l.filter((x) => samples.some((y) => y !== null && (isText(x) ? isText(y) && findtext(x, y) > 0 : same(x, y))));
    const rest = l.filter((x) => !match.includes(x));
    c.set(1, rest); c.set(2, match); c.push(); c.pulse(rest.length !== l.length ? 2 : 3);
  });
  def('list set circuit', (c) => { c.set(1, unique(list(c.in(1)))); done(c); });
  def('at circuit', (c) => {
    const l = list(c.in(1)), i = c.in(2);
    if (!l.length || !isNum(i) || i < 1 || i > l.length) { c.set(1, null); c.push(); c.pulse(3); return; }
    c.set(1, l[i - 1]); c.push(); c.pulse(2);
  });
  def('delete circuit', (c) => { const i = c.in(2); c.set(1, list(c.in(1)).filter((_, j) => j + 1 !== i)); done(c); });
  def('write circuit', (c) => {
    const l = list(c.in(1)), i = c.in(2), item = c.in(3);
    if (!l.length || !isNum(i) || i < 1 || i > l.length) { c.set(1, l); c.push(); c.pulse(3); return; }
    if (!Array.isArray(item)) { const r = l.slice(); r[i - 1] = item; c.set(1, r); c.push(); c.pulse(2); }
  });
  def('len circuit', (c) => { c.set(1, list(c.in(1)).length); done(c); });
  def('join text circuit', (c) => {
    const l = list(c.in(1)), d = c.in(2), s = c.in(3), e = c.in(4);
    let r = null;
    if (l.length && truthy(d) && s !== null && e !== null) r = l.slice(Math.max(1, s) - 1, e > 0 ? e - 1 : undefined).map(toText).join(toText(d));
    c.set(1, r); done(c);
  });
  def('list constructor|medium list constructor|large list constructor', (c) => {
    const r = []; for (let i = 1; i <= c.nIn; i++) { const v = c.in(i); r.push(Array.isArray(v) ? null : v); }
    c.set(1, r); done(c);
  });
  def('list deconstructor|medium list deconstructor|large list deconstructor', (c) => {
    const l = list(c.in(1)), start = isNum(c.in(2)) ? c.in(2) : 0;
    for (let i = 1; i <= c.nOut; i++) { const j = i + start - 1; c.set(i, j < 1 || j > l.length ? null : l[j - 1]); }
    done(c);
  });

  // Время
  const DELAY = { 'two-sec delay circuit': 20, 'five-sec delay circuit': 50, 'one-sec delay circuit': 10, 'half-sec delay circuit': 5, 'tenth-sec delay circuit': 1 };
  def(Object.keys(DELAY).join('|'), (c) => c.after(DELAY[c.name] * 100, () => c.pulse(2)));
  def('custom delay circuit', (c) => {
    const d = c.in(1);
    if (truthy(d) && isNum(d)) c.st.delay = Math.max(1, Math.min(36000, d));
    c.after((c.st.delay || 20) * 100, () => c.pulse(2));
  });
  const TICK = { 'ticker circuit': 40, 'custom ticker': 20, 'fast ticker': 20, 'slow ticker': 60 };
  const tickerData = (c) => {
    if (c.name === 'custom ticker') { const d = c.in(2); if (truthy(d) && isNum(d)) c.st.delay = Math.max(1, Math.min(36000, d)); }
    const on = truthy(c.in(1));
    if (on && !c.st.running) {
      c.st.running = true;
      const tick = () => { if (!c.st.running) return; c.pulse(1, true); c.after((c.st.delay || TICK[c.name]) * 100, tick); };
      tick();
    } else if (!on) c.st.running = false;
    c.view.ticking = c.st.running;
  };
  Object.keys(TICK).forEach((n) => { B[n] = () => {}; B[n].onData = tickerData; });
  const clock = (c) => {
    const t = new Date();
    c.set(1, t.toTimeString().slice(0, 8)); c.set(2, t.getHours()); c.set(3, t.getMinutes()); c.set(4, t.getSeconds());
    c.set(5, Math.round((Date.now() - c.started) / 100)); done(c);
  };
  def('integrated clock (NT Common Time)|integrated clock (Station Time)|integrated clock (Bluespace Absolute Time)', clock);

  // Ввод: кнопки и панели нажимаются прямо на блоке (ctx.input)
  B['button'] = () => {}; B['button'].input = (c) => c.pulse(1, true);
  B['toggle button'] = () => {};
  B['toggle button'].input = (c) => { c.set(1, truthy(c.out(1)) ? 0 : 1); c.push(); c.pulse(1, true); };
  const pad = (parse) => { const f = () => {}; f.input = (c, v) => { v = parse(v); if (v === null) return; c.set(1, v); c.push(); c.pulse(1, true); }; return f; };
  B['number pad'] = pad((v) => text2num(v));
  B['text pad'] = pad((v) => (isText(v) ? v : null));
  B['color pad'] = pad((v) => (isText(v) && v ? v : null));
  B['selection circuit'] = pad((v) => (isText(v) ? v : null));
  B['list selection circuit'] = pad((v) => (isText(v) ? v : null));

  // Вывод
  const screen = (big) => (c) => {
    const v = c.in(1);
    c.view.screen = (v && typeof v === 'object' && v.ref ? v.ref : toText(v)).replace(/&lt;br&gt;|<br>/gi, '\n');
    if (big) c.log(`экран: «${c.view.screen}»`);
  };
  def('screen', screen(false));
  def('medium screen|large screen', screen(true));
  def('light', (c) => { c.view.light = !c.view.light; c.view.color = '#FFFFFF'; });
  B['advanced light'] = (c) => { c.view.light = !c.view.light; B['advanced light'].onData(c); };
  B['advanced light'].onData = (c) => { const col = c.in(1), b = c.in(2); if (col && isNum(b)) { c.view.color = col; c.view.brightness = Math.max(0, Math.min(10, b)); } };
  B['light-emitting diode'] = () => {};
  B['light-emitting diode'].onData = (c) => { c.view.light = truthy(c.in(1)); c.view.color = c.in(2) || '#FF0000'; };
  def('beeper circuit|securitron sound circuit|medbot sound circuit|Female ai vox sound circuit|Male ai vox sound circuit|Military ai vox sound circuit|speaker circuit',
    (c) => c.log(`звук «${toText(c.in(1))}», громкость ${toText(c.in(2)) || '—'}`));
  def('text-to-speech circuit', (c) => { const t = toText(c.in(1)); if (t) c.log(`говорит: «${t}»`); });

  // ---------- Запуск ----------
  // graph: { nodes: [{ id, type, vals: { номер входа: значение }, special }], wires: [{ a: [id, 'O'|'A', n], b: [id, 'I'|'A', n] }] }
  function create(graph, catalog, hooks) {
    const started = Date.now();
    const timers = new Set();
    const nodes = {};
    for (const g of graph.nodes) {
      const d = catalog[g.type]; if (!d) continue;
      const n = {
        id: g.id, def: d, st: {}, view: {}, next: 0,
        ins: d.inputs.map((p, i) => coerce(p[1], pinDefault(p), g.vals && (i + 1) in g.vals ? g.vals[i + 1] : pinDefault(p))),
        outs: d.outputs.map((p) => pinDefault(p)),
        data: d.outputs.map(() => []), pulses: d.activators.map(() => []),
      };
      if (g.type === 'constant chip' && g.special !== undefined) n.outs[0] = g.special;
      nodes[g.id] = n;
    }
    graph.wires.forEach((w, wi) => {
      const a = nodes[w.a[0]], b = nodes[w.b[0]]; if (!a || !b) return;
      (w.a[1] === 'O' ? a.data : a.pulses)[w.a[2] - 1].push([b, w.b[2], wi]);
    });

    let budget = 0;
    function ctx(n) {
      const c = {
        name: n.def.name, st: n.st, view: n.view, started,
        nIn: n.ins.length, nOut: n.outs.length, nAct: n.def.activators.length,
        in: (i) => (n.ins[i - 1] === undefined ? null : n.ins[i - 1]),
        out: (i) => n.outs[i - 1],
        each: (f) => n.ins.forEach((v) => f(v)),
        set: (i, v) => { const p = n.def.outputs[i - 1]; if (p) n.outs[i - 1] = coerce(p[1], n.outs[i - 1], v); },
        push: (only) => push(n, only),
        pulse: (i, fresh) => { if (fresh) budget = 0; pulse(n, i); },
        after: (ms, fn) => { const t = setTimeout(() => { timers.delete(t); budget = 0; fn(); hooks.update(); }, ms); timers.add(t); },
        log: (m) => hooks.log(n.id, m),
      };
      return c;
    }
    function push(n, only) {
      const touched = new Set();
      n.data.forEach((links, o) => {
        if (only && o !== only - 1) return;
        for (const [t, i, wi] of links) {
          const p = t.def.inputs[i - 1]; if (!p) continue;
          t.ins[i - 1] = coerce(p[1], t.ins[i - 1], n.outs[o]);
          touched.add(t); hooks.flash(wi);
        }
      });
      for (const t of touched) { const b = B[t.def.name]; if (b && b.onData) b.onData(ctx(t)); hooks.touch(t.id); }
      hooks.touch(n.id);
    }
    function pulse(n, a) {
      const links = n.pulses[a - 1]; if (!links) return;
      for (const [t, ord, wi] of links) { hooks.flash(wi); work(t, ord); }
    }
    function work(n, ord) {
      if (++budget > 5000) { if (budget === 5001) hooks.log(n.id, 'больше 5000 импульсов подряд — остановлено (в игре сработает перезарядка)'); return; }
      const now = performance.now();
      if (now < n.next) return; // перезарядка cooldown_per_use: повторный импульс в тот же момент теряется, как в игре
      n.next = now + (n.def.cooldown || 1) * 100;
      const b = B[n.def.name];
      hooks.busy(n.id);
      if (!b) { if (!n.st.warned) { n.st.warned = true; hooks.log(n.id, 'не моделируется — нужен мир игры; импульс дальше не идёт'); } return; }
      b(ctx(n), ord);
      hooks.touch(n.id);
    }
    // Начальное состояние: тикеры с включённым «enable ticking» сразу начинают тикать
    for (const n of Object.values(nodes)) { const b = B[n.def.name]; if (b && b.onData) b.onData(ctx(n)); }

    return {
      fire(id, a) { const n = nodes[id]; if (!n) return; budget = 0; n.next = 0; work(n, a); hooks.update(); },
      input(id, v) { const n = nodes[id], b = n && B[n.def.name]; if (!b || !b.input) return; budget = 0; b.input(ctx(n), v); hooks.touch(id); hooks.update(); },
      get: (id) => nodes[id],
      stop() { timers.forEach(clearTimeout); timers.clear(); Object.values(nodes).forEach((n) => { n.st.running = false; }); },
    };
  }

  window.ICSim = {
    create, coerce, pinDefault, num2text,
    supported: (name) => !!B[name],
    interactive: (name) => !!(B[name] && B[name].input),
  };
})();

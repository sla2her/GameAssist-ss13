// Собирает каталог компонентов интегральных схем (catalog.js) из исходников MOLOT-BlueMoon-Station.
// Запуск: node circuits/update-catalog.mjs            — скачать свежие исходники с GitHub
//         node circuits/update-catalog.mjs <папка>    — взять .dm из локальной папки (файлы с любыми именами)
// Разбирает только объявления типов /obj/item/integrated_circuit/... и их переменные, с наследованием.
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'BlueMoon-Labs/MOLOT-BlueMoon-Station';
const DIR = 'code/modules/integrated_electronics';
const FILES = ['passive/power.dm', 'subtypes/access.dm', 'subtypes/arithmetic.dm', 'subtypes/atmospherics.dm',
  'subtypes/converters.dm', 'subtypes/data_transfer.dm', 'subtypes/input.dm', 'subtypes/lists.dm', 'subtypes/logic.dm',
  'subtypes/manipulation.dm', 'subtypes/memory.dm', 'subtypes/output.dm', 'subtypes/power.dm', 'subtypes/reagents.dm',
  'subtypes/smart.dm', 'subtypes/text.dm', 'subtypes/time.dm', 'subtypes/trig.dm', 'subtypes/weaponized.dm'];
const ROOT = '/obj/item/integrated_circuit';

async function sources() {
  const dir = process.argv[2];
  if (dir) return readdirSync(dir).filter(f => f.endsWith('.dm')).map(f => readFileSync(join(dir, f), 'utf8'));
  return Promise.all(FILES.map(async f => {
    const r = await fetch(`https://raw.githubusercontent.com/${REPO}/HEAD/${DIR}/${f}`);
    if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
    return r.text();
  }));
}

// Объявления типов: строка без отступа с путём (без скобок — это не процедура), дальше строки с отступом в 1 таб.
function parseTypes(text, types) {
  const lines = text.replace(/\r/g, '').split('\n');
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const head = line.match(/^(\/obj\/item\/integrated_circuit[\w/]*)\s*(\/\/.*)?$/);
    if (head) { cur = types[head[1].replace(/\/$/, '')] ||= {}; continue; }
    if (!/^\t/.test(line)) { if (line.trim()) cur = null; continue; }
    if (!cur || /^\t\t/.test(line)) continue;
    // Значение может продолжаться: «\» в конце строки или незакрытые скобки list(...)
    let stmt = line.trim();
    while (i + 1 < lines.length && (/\\$/.test(stmt) || depth(stmt) > 0)) {
      stmt = /\\$/.test(stmt) ? stmt.slice(0, -1) + lines[++i].trim() : stmt + ' ' + lines[++i].trim();
    }
    const m = stmt.match(/^(?:var\/(?:[\w]+\/)*)?(\w+)\s*=\s*([\s\S]*)$/);
    if (m) cur[m[1]] = stripComment(m[2]);
  }
}

function depth(s) {
  let d = 0, q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '\\') i++; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === '(') d++; else if (c === ')') d--;
    else if (c === '/' && s[i + 1] === '/') break;
  }
  return d;
}

function stripComment(v) {
  let q = false;
  for (let i = 0; i < v.length; i++) {
    const c = v[i];
    if (q) { if (c === '\\') i++; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === '/' && v[i + 1] === '/') return v.slice(0, i).trim();
  }
  return v.trim();
}

// Значения DM: строки, числа, TRUE/FALSE/null, константы, list(...)
function value(v) {
  v = v.trim();
  if (/^"/.test(v)) return dmString(v);
  if (/^-?[\d.]+$/.test(v)) return Number(v);
  if (v === 'TRUE') return 1;
  if (v === 'FALSE' || v === 'null' || v === 'NONE') return v === 'null' ? null : 0;
  if (/^list\(/.test(v)) return listEntries(v.slice(5, -1)).map(([k, x]) => [k === undefined ? undefined : value(k), value(x)]);
  return v; // константа или выражение — как есть
}

function dmString(v) {
  const end = closingQuote(v);
  return v.slice(1, end).replace(/\\(["\\])/g, '$1').replace(/\\n/g, '\n').replace(/\\(improper|proper|the|The|a|an|s)\b ?/g, '')
    .replace(/\\</g, '<').replace(/\\>/g, '>');
}
function closingQuote(v) { for (let i = 1; i < v.length; i++) { if (v[i] === '\\') i++; else if (v[i] === '"') return i; } return v.length; }

function listEntries(body) {
  const out = []; let d = 0, q = false, start = 0, eq = -1;
  const push = end => {
    const part = body.slice(start, end).trim();
    if (part) out.push(eq >= 0 ? [body.slice(start, eq).trim(), body.slice(eq + 1, end).trim()] : [undefined, part]);
  };
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (q) { if (c === '\\') i++; else if (c === '"') q = false; continue; }
    if (c === '"') q = true; else if (c === '(') d++; else if (c === ')') d--;
    else if (c === '=' && d === 0 && eq < 0 && body[i + 1] !== '=') eq = i;
    else if (c === ',' && d === 0) { push(i); start = i + 1; eq = -1; }
  }
  push(body.length);
  return out;
}

const PIN = { IC_PINTYPE_ANY: 'any', IC_PINTYPE_STRING: 'string', IC_PINTYPE_CHAR: 'char', IC_PINTYPE_COLOR: 'color',
  IC_PINTYPE_NUMBER: 'number', IC_PINTYPE_DIR: 'dir', IC_PINTYPE_BOOLEAN: 'boolean', IC_PINTYPE_REF: 'ref',
  IC_PINTYPE_LIST: 'list', IC_PINTYPE_INDEX: 'index', IC_PINTYPE_SELFREF: 'selfref',
  IC_PINTYPE_PULSE_IN: 'pulse_in', IC_PINTYPE_PULSE_OUT: 'pulse_out' };

// Пины, которые добавляются в Initialize() циклом по number_of_pins (порядок — как в игре)
const DYNAMIC = {
  [`${ROOT}/memory`]: n => ({ inputs: pins('input', n, 'any'), outputs: pins('output', n, 'any'), complexity: n }),
  [`${ROOT}/transfer/multiplexer`]: n => ({ inputs: pins('input', n, 'any'), complexity: n }),
  [`${ROOT}/transfer/demultiplexer`]: n => ({ outputs: pins('output', n, 'any'), complexity: n }),
  [`${ROOT}/transfer/pulsedemultiplexer`]: n => ({ activators: pins('output', n, 'pulse_out'), complexity: n }),
  [`${ROOT}/transfer/pulsemultiplexer`]: n => ({ inputs: pins('input', n, 'any'), activators: pins('input', n, 'pulse_in'), complexity: n }),
  [`${ROOT}/lists/constructor`]: n => ({ inputs: pins('input', n, 'any'), complexity: n / 2 }),
  [`${ROOT}/lists/deconstructor`]: n => ({ outputs: pins('output', n, 'any'), complexity: n / 2 }),
  [`${ROOT}/converter/concatenator`]: n => ({ inputs: pins('input', n, 'string') }),
};
function pins(prefix, n, type) { return Array.from({ length: n }, (_, i) => [`${prefix} ${i + 1}`, type]); }

const FLAGS = { IC_ACTION_MOVEMENT: 'movement', IC_ACTION_COMBAT: 'combat', IC_ACTION_LONG_RANGE: 'long_range' };
const W_CLASS = { WEIGHT_CLASS_TINY: 1, WEIGHT_CLASS_SMALL: 2, WEIGHT_CLASS_NORMAL: 3, WEIGHT_CLASS_BULKY: 4 };

function resolve(types, path) {
  const chain = [];
  for (let p = path; p.startsWith(ROOT); p = p.slice(0, p.lastIndexOf('/'))) { chain.unshift(p); if (p === ROOT) break; }
  const v = {}; let dyn = null;
  for (const p of chain) { Object.assign(v, types[p] || {}); if (DYNAMIC[p]) dyn = DYNAMIC[p]; }
  // list("input") — пин без типа: имя в значении, тип «любой»
  const pinList = key => (value(v[key] || 'list()') || []).map(([k, t]) => k === undefined ? [t, 'any'] : [k, PIN[t] || 'any']);
  const c = {
    name: value(v.name), desc: value(v.desc || '""'), extended: value(v.extended_desc || '""'),
    category: value(v.category_text || '""'),
    inputs: pinList('inputs'), outputs: pinList('outputs'), activators: pinList('activators'),
    complexity: num(v.complexity, 1), size: num(v.size, 1),
    power: num(v.power_draw_per_use, 0), cooldown: deciseconds(v.cooldown_per_use),
    research: !/IC_SPAWN_DEFAULT/.test(v.spawn_flags || ''),
    actions: (v.action_flags || '').split('|').map(s => FLAGS[s.trim()]).filter(Boolean),
    w: W_CLASS[v.w_class] || 1,
  };
  if (dyn) {
    const n = num(v.number_of_pins, 0), d = dyn(n);
    for (const k of ['inputs', 'outputs', 'activators']) if (d[k]) c[k] = c[k].concat(d[k]);
    if (d.complexity !== undefined) c.complexity = d.complexity;
  }
  const defaults = value(v.inputs_default || 'list()') || [];
  for (const [k, x] of defaults) { const pin = c.inputs[Number(k) - 1]; if (pin) pin[2] = x; }
  if (v.limit_per_assembly) c.limit = num(v.limit_per_assembly);
  return c;
}
// cooldown_per_use в десятых секунды: «1», «10», «4 SECONDS»
function deciseconds(x) {
  if (x === undefined) return 1;
  const m = String(x).match(/^([\d.]+)\s*(SECONDS)?$/);
  return m ? Number(m[1]) * (m[2] ? 10 : 1) : 1;
}
function num(x, def) { const n = Number(x); return x === undefined || Number.isNaN(n) ? def : n; }

const types = {};
for (const text of await sources()) parseTypes(text, types);
const catalog = Object.keys(types)
  .filter(p => /IC_SPAWN_(DEFAULT|RESEARCH)/.test(resolveFlags(types, p)))
  .map(p => resolve(types, p))
  .filter(c => typeof c.name === 'string');
function resolveFlags(types, path) {
  for (let p = path; p.startsWith(ROOT); p = p.slice(0, p.lastIndexOf('/'))) if (types[p]?.spawn_flags) return types[p].spawn_flags;
  return '';
}
for (const c of catalog) for (const k of Object.keys(c)) if (c[k] === undefined || c[k] === '' || (Array.isArray(c[k]) && !c[k].length && k === 'actions')) delete c[k];

const out = join(dirname(fileURLToPath(import.meta.url)), 'catalog.js');
writeFileSync(out, '// Сгенерировано update-catalog.mjs из ' + REPO + ' — руками не править\n' +
  'window.IC_CATALOG = ' + JSON.stringify(catalog, null, 0).replace(/\},\{/g, '},\n{') + ';\n');
console.log(`${catalog.length} компонентов → ${out}`);

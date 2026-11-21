'use strict';
/* МОД-костюм: стенд сборки. Данные — mod-data.js (собирает build_mod.py из code/modules/mod BlueMoon).
   Правила установки — как в mod_control.dm: костюм выключен, вместимость (complexity), несовместимые модули,
   чёрный список обшивки, бронеплиты — не больше max_armor_module_count одного типа. Расход — process() раз в секунду. */
(function () {
const MD = window.MOD_DATA;
const host = document.getElementById('v-mod');
if (!MD || !host) return;
const $m = (id) => document.getElementById(id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (x, d = 1) => (Math.round(x * 10 ** d) / 10 ** d).toLocaleString('ru-RU');
const st = { get(k, d) { try { const v = localStorage.getItem('robo.mod.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('robo.mod.' + k, JSON.stringify(v)); } catch (e) { /* без хранилища */ } } };

/* ---------- названия ---------- */
const RU = {
  flashlight: 'Фонарь', longfall: 'Амортизатор падений', mouthhole: 'Питательный клапан', plasma_stabilizer: 'Плазмостабилизатор',
  signlang_radio: 'Жестовый переводчик', storage: 'Отсек хранения', thermal_regulator: 'Терморегулятор', welding: 'Сварочный щиток',
  armor: 'Бронеплита', circuit: 'Адаптер схем', clamp: 'Гидрозахват', 'clamp/loader': 'Гидрозахват погрузчика', drill: 'Бур',
  gps: 'GPS', headprotector: 'Защита головы', magnet: 'Гидромагнит погрузчика', 'mister/cleaner': 'Распылитель уборщика',
  orebag: 'Рудная сумка', pai: 'Слот ПИИ', reagent_scanner: 'Сканер реагентов', 'storage/extended': 'Большой отсек',
  'visor/diaghud': 'Диагностический визор', emp_shield: 'ЭМИ-щит', jetpack: 'Ионный ранец', 'power/diamond': 'Алмазный генератор',
  'power/uranium': 'Ядерный генератор', rad_protection: 'Радзащита', defibrillator: 'Дефибриллятор', status_readout: 'Биомонитор',
  surgical_processor: 'Хирургический процессор', thread_ripper: 'Распарыватель одежды', 'anomaly_locked/antigrav': 'Антигравитация',
  'anomaly_locked/kinesis': 'Кинезис', 'anomaly_locked/teleporter': 'Телепорт', 'constructor/lesser': 'Модуль быстрой стройки',
  magboot: 'Магнитные подошвы', 'mister/atmos': 'Смоляной распылитель', t_ray: 'Т-лучевой сканер', tether: 'Аварийный гарпун',
  'visor/meson': 'Мезонный визор', bikehorn: 'Гудок', microwave_beam: 'Микроволновый луч', 'power/bananium': 'Бананиумный генератор',
  waddle: 'Ковылялка', 'criminalcapture/patienttransport': 'Транспорт пациента', dna_lock: 'ДНК-замок', health_analyzer: 'Анализатор здоровья',
  injector: 'Инъектор', organizer: 'Органайзер органов', quick_carry: 'Быстрая переноска', 'visor/medhud': 'Медицинский визор',
  active_sonar: 'Активный сонар', criminalcapture: 'Захват преступника', 'dispenser/mirage': 'Гранаты-миражи', holster: 'Кобура',
  magnetic_harness: 'Магнитная подвеска', pathfinder: 'Следопыт', projectile_dampener: 'Гаситель снарядов', stealth: 'Маскировка',
  'visor/sechud': 'Визор СБ', backpack_harness: 'Система ремней', 'emp_shield/advanced': 'Продвинутый ЭМИ-щит',
  energy_shield: 'Энергощит', 'jetpack/advanced': 'Продвинутый ранец', 'power/tesla': 'Тесла-генератор',
  'springlock/advanced': 'Электронный экзоскелет', disposal_connector: 'Селектор мусоропровода', joint_torsion: 'Шарнирный генератор',
  mind_swap: 'Нейропереход', 'power/plasma': 'Плазменный генератор', recycler: 'Переработчик', selfcleaner: 'Парфюмер',
  shooting_assistant: 'Ассистент стрельбы', ash_accretion: 'Пепельный покров', sphere_transform: 'Сфера', 'pepper_shoulders/security': 'Перцовые наплечники',
  quick_cuff: 'Быстрые наручники', 'hat_stabilizer/syndicate': 'Держатель шляпы',
};
const nm = (id) => RU[id] || (MD.modules[id] ? MD.modules[id].name.replace(/^MOD /, '').replace(/ module$/i, '') : id);
const THEME_RU = {
  standard: 'Стандартная', 'engineering/default_engineer': 'Инженерная', 'engineering/fire_protected/atmospheric': 'Атмосферная',
  'engineering/fire_protected/advanced': 'Продвинутая (СИ)', 'cargo_default/mining': 'Шахтёрская', 'cargo_default/cargo_worker': 'Погрузочная',
  'station_medbay/medical': 'Медицинская', 'station_medbay/rescue': 'Спасательная (ГВ)', 'station_combat/security': 'Служба безопасности',
  'centcom/safeguard': 'Сейфгард (ГСБ)', research: 'Исследовательская (ДИР)', 'simple_civilian/cosmohonk': 'Космохонк',
  'centcom/magnate': 'Магнат (Капитан)', 'antagonist/mage': 'Зачарованная (маг)', 'antagonist/spider_clan': 'Ниндзя',
  'antagonist/traitor': 'InteQ (агент)', 'antagonist/infiltrator': 'Инфильтратор', lustwish: 'Lustwish',
};
const TYPE = [
  ['Пассивный', '#2fb5a5', 'Работает сам, пока костюм включён.'],
  ['Используемый', '#4f8fe0', 'Одно нажатие кнопки модуля — одно действие.'],
  ['Переключаемый', '#e0a92e', 'Кнопкой включается и выключается; во включённом состоянии тратит заряд каждую секунду.'],
  ['Активный', '#d9534f', 'Выбирается кнопкой и действует по клику на цель. Выбран может быть только один.'],
  ['Броня', '#8c6ad8', 'Пассивная бронеплита: +15 к одному виду защиты на всех частях, +0,25 к замедлению.'],
];
const PART = ['Блок управления', 'Шлем', 'Нагрудник', 'Перчатки', 'Ботинки'];
const PART_STATE = ['control', 'helmet', 'chestplate', 'gauntlets', 'boots'];
// Короткие подсказки «как пользоваться» поверх описания из кода
const TIP = {
  jetpack: 'Летать в космосе без баллона: включить, двигаться — тратит заряд на каждый толчок.',
  'jetpack/advanced': 'Тот же ранец, но быстрее.',
  magboot: 'Держит на корпусе в невесомости и спасает от скольжения, но замедляет.',
  'anomaly_locked/antigrav': 'Нужно ядро гравитационной аномалии. Невесомость вокруг вас — ходить по потолку, не падать в пропасть.',
  'anomaly_locked/teleporter': 'Нужно блюспейс-ядро. Клик по клетке в поле зрения — прыжок туда (перезарядка 5 с).',
  'anomaly_locked/kinesis': 'Нужно ядро гравитационной аномалии. Хватает и швыряет предметы, машины и тела на расстоянии.',
  stealth: 'Почти невидимость. Спадает от столкновений, ударов и атак. Очень прожорлив: 4 ед./с.',
  energy_shield: 'Отражает снаряды за счёт батареи. Нужен полностью развёрнутый костюм и ёмкая батарея.',
  emp_shield: 'Защищает костюм и модули от ЭМИ (иначе сбои, случайные отключения и лишний расход).',
  'emp_shield/advanced': 'Защищает от ЭМИ ещё и импланты с аугментациями носителя.',
  dna_lock: 'Костюм надевает только владелец. Взламывается острым предметом, пилой или сваркой при снятии.',
  pathfinder: 'Имплант-маяк: костюм сам приходит к вам по вызову, надевается и разворачивается.',
  armor: 'Нужна заготовка из мехфаба + 10 листов материала: дюраткань/шкура голиафа — ближний бой, пласталь — пули, титан — лазеры, алмаз — энергия, золото — взрывы, серебро — био, пластитан — радиация, пластитановое стекло — огонь, армированное стекло — кислота, адамантин — магия, абдукторский сплав — ранения.',
  storage: 'Рюкзак в костюме. Не ставится вместе с другим отсеком.',
  'storage/extended': 'Как спортивная сумка. Можно улучшить блюспейс-ядром.',
  quick_carry: 'Быстро поднимать и носить раненых. Несовместим с модулем быстрой стройки.',
  defibrillator: 'Реанимация руками костюма — без отдельного дефибриллятора.',
  injector: 'Выдвижной шприц, пробивает броню.',
  health_analyzer: 'Сканирует здоровье на расстоянии.',
  'criminalcapture/patienttransport': 'Голографический мешок с воздухом — тащить пациента через космос.',
  criminalcapture: 'Голографический мешок для перевозки задержанного.',
  'power/diamond': 'Включить. Алмаз = 6500 заряда раз в 20 с, пока батарея ниже 90%. До 100 листов.',
  'power/uranium': 'Включить. 2 листа урана = 4000 заряда раз в 20 с. Фонит, пока включён — возьмите радзащиту.',
  'power/bananium': 'Только для клоуна. 5 листов бананиума = 4500 заряда раз в 20 с.',
  'power/tesla': 'Без топлива: раз в 30 с берёт 2000 заряда из запитанного помещения (ЛКП).',
  'power/plasma': '3 листа плазмы = 2500 заряда раз в 20 с. ЭМИ ломает модуль и может поджечь носителя.',
  t_ray: 'Видно кабели и трубы под полом.',
  'visor/meson': 'Мезоны: стены и рельеф сквозь препятствия. Визор — только один.',
  'visor/medhud': 'Медицинский HUD. Визор — только один.',
  'visor/sechud': 'HUD СБ: записи и статусы. Визор — только один.',
  'visor/diaghud': 'Диагностический HUD: заряд и целостность техники. Визор — только один.',
  clamp: 'Поднимает ящики и тяжёлых членов экипажа.',
  drill: 'Бур на перчатке: Alt+клик по породе.',
  tether: 'Гарпун-лебёдка: подтягивает вас к цели. Только в невесомости.',
  'constructor/lesser': 'Ускоряет ручную стройку. Несовместим с быстрой переноской.',
  longfall: 'Гасит падение с высоты (тратит 10 заряда за срабатывание).',
  welding: 'Защита глаз при сварке.',
  thermal_regulator: 'Держит температуру тела, которую выберете.',
  mouthhole: 'Есть и пить, не снимая шлем.',
  bikehorn: 'ХОНК.',
  waddle: 'Ковылять и попискивать. Да, это модуль.',
  microwave_beam: 'Готовит еду на расстоянии.',
  holster: 'Быстро убрать и выхватить оружие.',
  magnetic_harness: 'Упавшее оружие само возвращается к вам.',
  projectile_dampener: 'Замедляет и ослабляет снаряды вокруг.',
  active_sonar: 'Импульс показывает всех живых поблизости (перезарядка 15 с).',
  'dispenser/mirage': 'Граната-приманка с вашей голограммой.',
  backpack_harness: 'Можно носить рюкзак на животе вместе с костюмом.',
  'springlock/advanced': 'Быстрое надевание и прибавка к скорости. Влага и удары могут сорвать механизм.',
  pai: 'Вставьте ПИИ — он сможет управлять костюмом.',
  circuit: 'Подключает интегральную схему к костюму.',
  gps: 'Свой GPS-маячок.',
  reagent_scanner: 'Видно состав реагентов в ёмкостях.',
  rad_protection: 'Защита от радиации.',
  status_readout: 'Показывает биометрию носителя.',
};

/* ---------- спрайты ---------- */
(function sheetsCss() {
  let css = '';
  for (const [name, s] of Object.entries(MD.sheets)) css += `.msh-${name.replace(/\W/g, '_')}{background-image:url(${s.png})}\n`;
  const el = document.createElement('style'); el.textContent = css; document.head.appendChild(el);
})();
function spr(sheet, state, scale = 1) {
  const s = MD.sheets[sheet]; const e = s && s.states[state];
  if (!e) return `<span class="mspr ph" style="width:${32 * scale}px;height:${32 * scale}px"></span>`;
  const i = e[0]; const col = i % s.cols; const row = Math.floor(i / s.cols);
  return `<span class="mspr msh-${sheet.replace(/\W/g, '_')}" style="width:${s.fw * scale}px;height:${s.fh * scale}px;background-size:${s.cols * s.fw * scale}px auto;background-position:-${col * s.fw * scale}px -${row * s.fh * scale}px"></span>`;
}
const modSpr = (id, sc = 1) => { const m = MD.modules[id]; return m ? spr(m.sheet, m.state, sc) : ''; };

/* ---------- справочные таблицы ---------- */
const NODE_RU = {
  mod: ['Базовые', 'старт'], mod_advanced: ['Продвинутые', 'Advanced Modular Suits'], mod_engineering: ['Инженерия', 'Engineering Modular Suits'],
  mod_advanced_engineering: ['Инженерия+', 'Advanced Engineering Modular Suits'], mod_medical: ['Медицина', 'Medical Modular Suits'],
  mod_advanced_medical: ['Медицина+', 'Advanced Medical Modular Suits'], mod_security: ['СБ', 'Security Modular Suits'],
  mod_entertainment: ['Хонк', 'Entertainment Modular Suits'], mod_anomaly: ['Аномалии', 'Anomalock Modular Suits'],
  mod_superior: ['Превосходные', 'Superior Modular Suits'],
};
const NODE_ORDER = Object.keys(NODE_RU);
const ARMOR = ['melee', 'bullet', 'laser', 'energy', 'bomb', 'bio', 'rad', 'fire', 'acid', 'magic', 'wound'];
const ARMOR_RU = { melee: 'Ближний бой', bullet: 'Пули', laser: 'Лазеры', energy: 'Энергия', bomb: 'Взрывы', bio: 'Био', rad: 'Радиация',
  fire: 'Огонь', acid: 'Кислота', magic: 'Магия', wound: 'Ранения' };
const ARMOR_MAT = { melee: 'дюраткань / шкура голиафа', bullet: 'пласталь', laser: 'титан', energy: 'алмазы', bomb: 'золото', bio: 'серебро',
  rad: 'пластитан', fire: 'пластитановое стекло', acid: 'армированное стекло', magic: 'адамантин', wound: 'сплав абдукторов' };
const CELLS = [['/', 'Стандартная'], ['/upgraded', 'Улучшенная'], ['/upgraded/plus', 'Улучшенная+'], ['/high', 'Высокоёмкая'], ['/high/plus', 'Высокоёмкая+'],
  ['/super', 'Сверхёмкая'], ['/hyper', 'Гиперёмкая'], ['/bluespace', 'Блюспейс']]
  .map(([p, ru]) => ({ p, ru, max: (MD.cells.find((c) => c.path === p) || {}).max || 0 })).filter((c) => c.max);
const GENS = { 'power/diamond': [6500, 20, 1, 100, 'алмаз'], 'power/uranium': [4000, 20, 2, 100, 'уран'], 'power/bananium': [4500, 20, 5, 50, 'бананиум'],
  'power/plasma': [2500, 20, 3, 50, 'плазма'], 'power/tesla': [2000, 30, 0, 0, 'ЛКП помещения'] };
const PLATINGS = Object.keys(THEME_RU).filter((t) => MD.themes[t]);
const STATION = (id) => !!MD.modules[id] && !!MD.modules[id].design;
const nodeOf = (id) => (MD.modules[id] && MD.modules[id].design && MD.modules[id].design.node) || null;

/* ---------- состояние ---------- */
const DEF_BUILD = { theme: 'standard', cell: '/high', mods: [], on: {}, armor: {} };
let B = Object.assign({}, DEF_BUILD, st.get('build', {}));
let filter = st.get('filter', 'all');
let query = '';
let showAll = !!st.get('all', false);
let uid = Math.max(0, ...B.mods.map((m) => m.u || 0)) + 1;
const theme = () => MD.themes[B.theme] || MD.themes.standard;
const save = () => st.set('build', B);

function installed() {
  // встроенные модули темы ставятся сами и тоже занимают место
  const t = theme();
  const inb = t.inbuilt.filter((id) => MD.modules[id]).map((id) => ({ id, u: 'in:' + id, inbuilt: true }));
  return inb.concat(B.mods);
}
const used = () => installed().reduce((a, x) => a + (MD.modules[x.id] ? MD.modules[x.id].cx : 0), 0);

/* причина, по которой модуль нельзя поставить (как install() в mod_control.dm) */
function blockReason(id, armorType) {
  const m = MD.modules[id]; const t = theme();
  if (!m) return 'нет данных';
  if (t.black.some((b) => id === b || id.startsWith(b + '/'))) return 'запрещён этой обшивкой';
  const list = installed();
  const typeOk = (a, b) => a === b || a.startsWith(b + '/');
  for (const x of list) {
    const o = MD.modules[x.id]; if (!o) continue;
    if (m.inc.some((b) => typeOk(x.id, b)) || o.inc.some((b) => typeOk(id, b))) return 'несовместим: ' + nm(x.id);
  }
  if (m.type === 4) {
    if (!t.armorok) return 'обшивка не принимает бронеплиты';
    if (list.some((x) => x.id === 'stealth/wraith')) return 'несовместим с Wraith';
    if (armorType) {
      const n = B.mods.filter((x) => x.id === id && x.armor === armorType).length;
      if (n >= t.armslots) return `уже ${n} плиты «${ARMOR_RU[armorType]}» (максимум ${t.armslots})`;
    }
  }
  if (used() + m.cx > t.cx) return `не влезает: нужно ${m.cx}, свободно ${t.cx - used()}`;
  return '';
}

/* ---------- расчёты ---------- */
function armorNow() {
  const a = Object.assign({}, theme().armor);
  B.mods.forEach((x) => { if (x.id === 'armor' && x.armor) a[x.armor] = (a[x.armor] || 0) + 15; });
  return a;
}
const slowdown = () => B.mods.filter((x) => x.id === 'armor' && x.armor).length * 0.25 + (theme().slow_on || 0);
function drain(allOn) {
  // костюм + у каждого модуля: включён — active_power_cost, иначе idle_power_cost (module.on_process)
  let d = theme().drain;
  for (const x of installed()) {
    const m = MD.modules[x.id]; if (!m) continue;
    const on = (m.type === 2) && (allOn || B.on[x.u]);
    d += on ? m.act : m.idle;
  }
  return d;
}
const cellMax = () => (CELLS.find((c) => c.p === B.cell) || CELLS[0]).max;
function gen() {
  for (const x of installed()) { const g = GENS[x.id]; if (g && B.on[x.u]) return { id: x.id, g }; }
  return null;
}
const mmss = (s) => !isFinite(s) ? '∞' : s >= 3600 ? `${Math.floor(s / 3600)} ч ${Math.round((s % 3600) / 60)} мин` : s >= 60 ? `${Math.floor(s / 60)} мин ${Math.round(s % 60)} с` : `${Math.round(s)} с`;
function runtime(d) {
  if (d <= 0) return Infinity;
  const G = gen(); let t = cellMax() / d;
  if (G) {
    const [amt, cd, step, cap] = G.g;
    const per = amt / cd; // средняя прибавка в секунду, пока батарея ниже 90%
    if (per >= d) return Infinity;
    // топливо: cap листов по step за генерацию — запас энергии cap/step*amt
    const fuel = step ? (cap / step) * amt : Infinity;
    t = (cellMax() + Math.min(fuel, per * 1e9)) / d;
    if (!step) t = cellMax() / (d - per);
  }
  return t;
}

/* ---------- достижения ---------- */
const ACH = [
  ['Под завязку', 'Вместимость заполнена ровно до конца.', () => used() === theme().cx && used() > 0],
  ['Хонк-комплект', 'Гудок, ковылялка и бананиумный генератор.', () => ['bikehorn', 'waddle', 'power/bananium'].every(has)],
  ['Вечный двигатель', 'Генератор отдаёт больше, чем костюм тратит.', () => gen() && runtime(drain(false)) === Infinity],
  ['Танк', 'Четыре бронеплиты.', () => B.mods.filter((x) => x.id === 'armor').length >= 4],
  ['Призрак станции', 'Маскировка и ЭМИ-щит.', () => has('stealth') && (has('emp_shield') || has('emp_shield/advanced'))],
  ['Космический спасатель', 'Ранец, транспорт пациента и дефибриллятор.', () => ['defibrillator', 'criminalcapture/patienttransport'].every(has) && (has('jetpack') || has('jetpack/advanced'))],
  ['Атомный шахтёр', 'Бур, рудная сумка и ядерный генератор.', () => ['drill', 'orebag', 'power/uranium'].every(has)],
  ['Учёный-безумец', 'Все три модуля на ядрах аномалий.', () => ['anomaly_locked/antigrav', 'anomaly_locked/kinesis', 'anomaly_locked/teleporter'].every(has)],
  ['Голый МОД', 'Ни одного модуля — только броня и надежда.', () => B.mods.length === 0],
];
function has(id) { return installed().some((x) => x.id === id); }

/* ---------- синергии и предупреждения ---------- */
function advice() {
  const out = [];
  const d = drain(false); const da = drain(true); const rt = runtime(da);
  if (has('power/uranium') && !has('rad_protection')) out.push(['warn', 'Ядерный генератор фонит, пока включён. Радзащита — 2 места.']);
  if ((has('energy_shield')) && cellMax() < 20000) out.push(['warn', 'Энергощит сажает батарею мгновенно — ставьте сверхёмкую или блюспейс.']);
  if (has('stealth') && rt < 600) out.push(['warn', `Маскировка со всем включённым — батареи хватит на ${mmss(rt)}.`]);
  if ((has('jetpack') || has('jetpack/advanced')) && has('magboot')) out.push(['ok', 'Ранец + магнитные подошвы: летите к корпусу, примагничиваетесь — классика EVA.']);
  if (has('dna_lock')) out.push(['ok', 'ДНК-замок: костюм наденет только владелец. ЭМИ его ломает — добавьте ЭМИ-щит.']);
  if (!has('emp_shield') && !has('emp_shield/advanced') && B.mods.length >= 4) out.push(['', 'Без ЭМИ-щита импульс вызывает сбои: модули отключаются, расход растёт на 1–20/с.']);
  if (['anomaly_locked/antigrav', 'anomaly_locked/kinesis', 'anomaly_locked/teleporter'].some(has)) out.push(['', 'Модули на ядрах аномалий бесполезны без ядра: попросите исследователей поймать аномалию.']);
  if (B.mods.some((x) => x.id === 'armor' && !x.armor)) out.push(['bad', 'Бронеплита без материала не встанет: выберите материал (10 листов).']);
  if (gen() && GENS[gen().id][2]) out.push(['', `Генератор работает, пока есть топливо (${GENS[gen().id][4]}) и батарея ниже 90%.`]);
  if (!gen() && installed().some((x) => GENS[x.id])) out.push(['', 'Генератор стоит, но выключен — включите его тумблером, иначе он не заряжает.']);
  if (d === 0 && !theme().drain) out.push(['ok', 'Костюм почти ничего не тратит.']);
  return out;
}

/* ---------- готовые сборки ---------- */
const PRESETS = [
  ['Шахтёр', 'cargo_default/mining', '/high', ['drill', 'orebag', 'gps', 'jetpack', 'visor/meson']],
  ['Инженер', 'engineering/default_engineer', '/high', ['magboot', 'jetpack', 'welding', 't_ray', 'visor/meson', 'storage']],
  ['Атмосферник', 'engineering/fire_protected/atmospheric', '/high', ['mister/atmos', 't_ray', 'magboot', 'thermal_regulator', 'welding', 'flashlight']],
  ['Парамедик', 'station_medbay/medical', '/super', ['defibrillator', 'health_analyzer', 'criminalcapture/patienttransport', 'quick_carry', 'jetpack', 'visor/medhud']],
  ['СБ', 'station_combat/security', '/super', ['visor/sechud', 'holster', 'magnetic_harness', 'criminalcapture', 'emp_shield']],
  ['Клоун', 'simple_civilian/cosmohonk', '/high', ['bikehorn', 'waddle', 'power/bananium', 'microwave_beam', 'storage', 'flashlight']],
  ['Исследователь', 'standard', '/bluespace', ['anomaly_locked/antigrav', 'anomaly_locked/teleporter', 'emp_shield', 'gps', 'storage']],
];
function applyPreset(i) {
  const [, th, cell, mods] = PRESETS[i];
  B = { theme: th, cell, mods: [], on: {}, armor: {} };
  for (const id of mods) if (!blockReason(id)) B.mods.push({ id, u: uid++ });
  save(); renderAll(); flash(`Сборка «${PRESETS[i][0]}»`);
}
function randomBuild() {
  const pool = Object.keys(MD.modules).filter((id) => STATION(id) && MD.modules[id].type !== 4);
  B = { theme: PLATINGS.filter((t) => MD.themes[t].design || t === 'standard')[Math.floor(Math.random() * 8)] || 'standard', cell: CELLS[Math.floor(Math.random() * CELLS.length)].p, mods: [], on: {}, armor: {} };
  for (let i = 0; i < 60; i++) { const id = pool[Math.floor(Math.random() * pool.length)]; if (!blockReason(id)) B.mods.push({ id, u: uid++ }); }
  save(); renderAll(); flash('Случайная сборка');
}

/* ---------- код сборки ---------- */
function buildCode() {
  const o = { t: B.theme, c: B.cell, m: B.mods.map((x) => x.armor ? x.id + '@' + x.armor : x.id) };
  try { return 'MOD1:' + btoa(unescape(encodeURIComponent(JSON.stringify(o)))); } catch (e) { return ''; }
}
function loadCode(code) {
  try {
    const o = JSON.parse(decodeURIComponent(escape(atob(code.trim().replace(/^MOD1:/, '')))));
    B = { theme: MD.themes[o.t] ? o.t : 'standard', cell: o.c || '/high', mods: [], on: {}, armor: {} };
    for (const s of o.m || []) { const [id, a] = s.split('@'); if (MD.modules[id] && !blockReason(id, a)) B.mods.push({ id, u: uid++, armor: a || undefined }); }
    save(); renderAll(); flash('Сборка загружена'); return true;
  } catch (e) { flash('Не похоже на код сборки', true); return false; }
}

/* ---------- разметка ---------- */
host.innerHTML = `
<div class="panel mtop">
  <label>Обшивка<select id="mTheme"></select></label>
  <label>Батарея<select id="mCell"></select></label>
  <div class="mpre"><span class="muted">Готовые:</span>${PRESETS.map((p, i) => `<button class="btn sm" data-pre="${i}">${esc(p[0])}</button>`).join('')}
    <button class="btn sm" id="mRand" title="Случайные модули из мехфаба">🎲 Случайно</button><button class="btn sm" id="mClear">Снять всё</button></div>
</div>
<div class="mgrid">
  <div class="panel mcat">
    <div class="mzones" id="mZones"></div>
    <div id="mVariants"></div>
    <input type="search" id="mQ" placeholder="Поиск модуля">
    <div class="mchips" id="mChips"></div>
    <label class="mall"><input type="checkbox" id="mAll"> показывать модули не из мехфаба (антаг, ЦК, особые)</label>
    <div id="mList"></div>
  </div>
  <div class="mmid">
    <div class="panel mstand" id="mStand"></div>
    <div class="panel mstats" id="mStats"></div>
    <div class="panel mprint" id="mPrint"></div>
  </div>
  <div class="mside">
    <div class="panel"><h3 class="mh">Способности <small id="mAbN"></small></h3><div id="mAb"></div></div>
    <div class="panel"><h3 class="mh">Советы стенда</h3><div id="mAdv"></div></div>
    <div class="panel"><h3 class="mh">Достижения стенда</h3><div id="mAch"></div></div>
    <div class="panel mcode"><h3 class="mh">Код сборки</h3><div class="mcrow"><input id="mCode" readonly><button class="btn sm" id="mCopy">Копировать</button></div>
      <div class="mcrow"><input id="mPaste" placeholder="Вставьте код MOD1:…"><button class="btn sm" id="mLoad">Загрузить</button></div></div>
  </div>
</div>
<div class="mtoast" id="mToast" hidden></div>`;

function flash(t, bad) {
  const el = $m('mToast'); el.textContent = t; el.hidden = false; el.classList.toggle('bad', !!bad);
  clearTimeout(flash.t); flash.t = setTimeout(() => { el.hidden = true; }, 1600);
}

function renderTop() {
  const grp = (label, list) => `<optgroup label="${label}">${list.map((t) => `<option value="${t}"${t === B.theme ? ' selected' : ''}>${esc(THEME_RU[t])} — ${MD.themes[t].cx} мест</option>`).join('')}</optgroup>`;
  const printable = PLATINGS.filter((t) => t === 'standard' || MD.themes[t].design);
  $m('mTheme').innerHTML = grp('Печатаются', printable) + grp('Только готовым костюмом', PLATINGS.filter((t) => !printable.includes(t)));
  $m('mCell').innerHTML = CELLS.map((c) => `<option value="${c.p}"${c.p === B.cell ? ' selected' : ''}>${c.ru} — ${c.max.toLocaleString('ru-RU')}</option>`).join('');
}

/* Выбор области костюма: каталог показывает только модули этой части, сверху — эта часть у всех обшивок */
function renderZones() {
  const skin = theme().skin;
  const btn = (i) => `<button data-zone="${i}" aria-pressed="${zone === i}" title="${i === null ? 'Все части' : PART[i]}">${i === null ? '<span class="zall">Все</span>' : spr('mod_clothing.dmi', `${skin}-${PART_STATE[i]}`, 1)}<small>${i === null ? 'части' : PART_SHORT[i]}</small></button>`;
  $m('mZones').innerHTML = [null, 1, 2, 3, 4, 0].map(btn).join('');
  if (zone === null) { $m('mVariants').innerHTML = ''; return; }
  const printable = (t) => t === 'standard' || !!MD.themes[t].design;
  $m('mVariants').innerHTML = `<div class="mvh">${PART_PLURAL[zone]} обшивок <small>щёлкните или перетащите на стенд — сменится обшивка</small></div>
    <div class="mvar">${PLATINGS.map((t) => `<button class="mv${t === B.theme ? ' on' : ''}" data-theme="${t}" title="${esc(THEME_RU[t])}: ${MD.themes[t].cx} мест${printable(t) ? '' : ' · не печатается'}">
      ${spr('mod_clothing.dmi', `${MD.themes[t].skin}-${PART_STATE[zone]}`, 1.5)}<span>${esc(THEME_RU[t].replace(/ \(.+\)$/, ''))}</span><i>${MD.themes[t].cx}</i></button>`).join('')}</div>`;
}
const PART_SHORT = ['блок', 'шлем', 'грудь', 'руки', 'ноги'];
const PART_PLURAL = ['Блоки управления', 'Шлемы', 'Нагрудники', 'Перчатки', 'Ботинки'];
let zone = null;
function setZone(z) {
  zone = z === zone ? null : z;
  renderZones(); renderList(); renderStand();
}
function setTheme(t) {
  if (!MD.themes[t] || t === B.theme) return;
  B.theme = t;
  const keep = B.mods; B.mods = []; const dropped = [];
  for (const x of keep) { if (blockReason(x.id, x.armor)) dropped.push(nm(x.id)); else B.mods.push(x); }
  save(); renderAll();
  flash(`Обшивка: ${THEME_RU[t]}` + (dropped.length ? ` · сняты: ${dropped.join(', ')}` : ''), !!dropped.length);
}

function renderList() {
  const counts = {};
  const all = Object.keys(MD.modules).filter((id) => {
    const m = MD.modules[id];
    if (!showAll && !STATION(id)) return false;
    if (m.name === 'Base prebuild' || /prebuild/.test(id)) return false;
    if (zone !== null && m.part !== zone) return false;
    return true;
  });
  all.forEach((id) => { const n = nodeOf(id) || 'other'; counts[n] = (counts[n] || 0) + 1; });
  const chips = [['all', 'Все', all.length]].concat(NODE_ORDER.filter((n) => counts[n]).map((n) => [n, NODE_RU[n][0], counts[n]]));
  if (counts.other) chips.push(['other', showAll ? 'Прочие' : 'Без узла', counts.other]);
  if (!chips.some((c) => c[0] === filter)) filter = 'all';
  $m('mChips').innerHTML = chips.map(([k, n, c]) => `<button data-f="${k}" aria-pressed="${k === filter}">${n} <small>${c}</small></button>`).join('');
  const q = query.toLowerCase();
  const list = all.filter((id) => (filter === 'all' || (nodeOf(id) || 'other') === filter) &&
    (!q || nm(id).toLowerCase().includes(q) || MD.modules[id].name.toLowerCase().includes(q)))
    .sort((a, b) => nm(a).localeCompare(nm(b), 'ru'));
  $m('mList').innerHTML = list.map((id) => {
    const m = MD.modules[id];
    const here = installed().some((x) => x.id === id);
    const why = m.type === 4 ? blockReason(id, null) : blockReason(id);
    const cls = here ? 'on' : why ? 'no' : '';
    return `<div class="mrow ${cls}" data-id="${esc(id)}" title="${esc(why || (here ? 'Установлен — щёлкните на стенде, чтобы снять' : 'Щёлкните, чтобы установить'))}">
      ${modSpr(id)}<div class="mn"><b>${esc(nm(id))}</b><small>${esc(m.name)}</small>${why && !here ? `<small class="why">${esc(why)}</small>` : ''}</div>
      <span class="mcx" style="--tc:${TYPE[m.type][1]}" title="${TYPE[m.type][0]}">${m.cx}</span>
      <button class="mi" data-info="${esc(id)}" title="Подробнее">i</button></div>`;
  }).join('') || `<p class="muted" style="padding:8px">${zone !== null ? `Для части «${PART[zone]}» модулей нет${showAll ? '' : ' — попробуйте «показывать модули не из мехфаба»'}.` : 'Ничего не найдено.'}</p>`;
}

function renderStand() {
  const t = theme(); const list = installed();
  const skin = t.skin; const cap = t.cx; const u = used();
  const byPart = [[], [], [], [], []];
  list.forEach((x) => { const m = MD.modules[x.id]; byPart[m ? m.part : 0].push(x); });
  const chip = (x) => {
    const m = MD.modules[x.id];
    const label = x.id === 'armor' ? (x.armor ? `${nm(x.id)}: ${ARMOR_RU[x.armor]}` : 'Бронеплита: выберите материал') : nm(x.id);
    return `<button class="mchip${x.inbuilt ? ' inb' : ''}${x.id === 'armor' && !x.armor ? ' warn' : ''}" data-u="${esc(x.u)}" style="--tc:${TYPE[m.type][1]}" title="${x.inbuilt ? 'Встроен в обшивку, снять нельзя' : 'Щёлкните, чтобы снять'}">${modSpr(x.id)}<span>${esc(label)}</span><i>${m.cx}</i></button>`;
  };
  // кольцо вместимости: каждый модуль — дуга своего цвета
  const R = 74; const C = 2 * Math.PI * R; let acc = 0;
  const arcs = list.map((x) => {
    const m = MD.modules[x.id]; if (!m.cx) return '';
    const len = Math.min(m.cx, Math.max(cap - acc, 0)) / cap * C; const off = -acc / cap * C; acc += m.cx;
    return `<circle r="${R}" cx="90" cy="90" fill="none" stroke="${TYPE[m.type][1]}" stroke-width="12" stroke-dasharray="${Math.max(len - 2, 0.5)} ${C}" stroke-dashoffset="${off}" transform="rotate(-90 90 90)"><title>${esc(nm(x.id))}: ${m.cx}</title></circle>`;
  }).join('');
  const zoneBox = (i) => `<div class="mzone z${i}${zone === i ? ' sel' : ''}" data-dz="${i}"><button class="zh" data-zone="${i}" title="Показать в каталоге всё для этой части">${spr('mod_clothing.dmi', `${skin}-${PART_STATE[i]}`, 2)}<b>${PART[i]}</b><small>${byPart[i].length || ''}</small></button><div class="zl">${byPart[i].map(chip).join('') || '<span class="faint">свободно — перетащите сюда модуль</span>'}</div></div>`;
  $m('mStand').innerHTML = `
    <div class="mrig">
      ${zoneBox(1)}${zoneBox(3)}
      <div class="mcore${zone === 0 ? ' sel' : ''}" data-dz="0">
        <svg viewBox="0 0 180 180" class="ring"><circle r="${R}" cx="90" cy="90" fill="none" stroke="var(--line)" stroke-width="12"/>${arcs}</svg>
        <div class="mcu" data-zone="0" title="Блок управления: модули без своей части">${spr('mod_clothing.dmi', `${skin}-control`, 2.5)}<span class="cap ${u > cap ? 'neg' : ''}"><b>${u}</b>/${cap}</span><small>мест</small></div>
        <div class="mback">${byPart[0].map(chip).join('')}</div>
      </div>
      ${zoneBox(2)}${zoneBox(4)}
    </div>
    <div class="mlegend">${TYPE.map((x) => `<span><i style="background:${x[1]}"></i>${x[0]}</span>`).join('')}</div>`;
}

function renderStats() {
  const t = theme(); const a = armorNow(); const base = t.armor;
  const d0 = drain(false); const d1 = drain(true);
  const G = gen();
  const bars = ARMOR.map((k) => {
    const v = a[k] || 0; const add = v - (base[k] || 0);
    return `<div class="abar" title="${ARMOR_RU[k]}: ${v}${add ? ` (обшивка ${base[k]} + плиты ${add})` : ''}"><span>${ARMOR_RU[k]}</span><div><i style="width:${Math.min(v, 100)}%"></i>${add ? `<i class="add" style="width:${Math.min(add, 100)}%;left:${Math.min(base[k] || 0, 100)}%"></i>` : ''}</div><b>${v}</b></div>`;
  }).join('');
  $m('mStats').innerHTML = `
    <div class="kp">
      <div><b>${fmt(d0, 2)}</b><span>расход в покое, ед./с</span></div>
      <div><b>${fmt(d1, 2)}</b><span>всё включено, ед./с</span></div>
      <div><b>${mmss(runtime(d0))}</b><span>батареи хватит (покой)</span></div>
      <div><b>${mmss(runtime(d1))}</b><span>батареи хватит (всё вкл.)</span></div>
      <div><b>+${fmt(slowdown(), 2)}</b><span>замедление</span></div>
      <div><b>${t.siemens === 0 ? 'да' : 'нет'}</b><span>защита от тока</span></div>
    </div>
    <div class="arm"><h4>Броня <small>обшивка «${esc(THEME_RU[B.theme])}»${t.brc ? `, снижение урона +${t.brc}` : ''}${t.fireproof ? ' · огнеупорная' : ''}${t.acidproof ? ' · кислотоупорная' : ''}</small></h4>${bars}</div>
    <div class="drain"><h4>Тест-драйв батареи <small>${G ? 'с генератором ' + esc(nm(G.id)) : 'без генератора'}</small></h4><canvas id="mChart" width="600" height="120"></canvas></div>`;
  drawChart(d0, d1);
}

function drawChart(d0, d1) {
  const cv = $m('mChart'); if (!cv) return;
  const W = cv.width = cv.clientWidth * (window.devicePixelRatio || 1) || 600; const H = cv.height = 120 * (window.devicePixelRatio || 1);
  const x = cv.getContext('2d'); const css = getComputedStyle(document.documentElement);
  const max = cellMax(); const G = gen();
  const sim = (d) => {
    const pts = []; let c = max; let fuel = G && G.g[2] ? G.g[3] : Infinity; let cd = 0;
    const T = Math.min(Math.max(runtime(d1) * 1.15, 120), 4 * 3600);
    const dt = T / 300;
    for (let s = 0; s <= T; s += dt) {
      pts.push([s, c]);
      c -= d * dt;
      if (G) {
        cd -= dt;
        while (cd <= 0 && c / max <= 0.9 && fuel > 0) { c += G.g[0]; if (G.g[2]) fuel -= G.g[2]; cd += G.g[1]; }
        if (cd < 0) cd = 0;
      }
      c = Math.min(Math.max(c, 0), max);
    }
    return { pts, T };
  };
  const a = sim(d0); const b = sim(d1); const T = Math.max(a.T, b.T);
  x.clearRect(0, 0, W, H);
  x.strokeStyle = css.getPropertyValue('--line').trim() || '#ccc'; x.lineWidth = 1;
  for (let i = 0; i <= 4; i++) { const yy = 6 + (H - 22) * i / 4; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); }
  const line = (r, col) => {
    x.strokeStyle = col; x.lineWidth = 2 * (window.devicePixelRatio || 1); x.beginPath();
    r.pts.forEach(([s, c], i) => { const px = s / T * W; const py = 6 + (H - 22) * (1 - c / max); i ? x.lineTo(px, py) : x.moveTo(px, py); });
    x.stroke();
  };
  line(a, css.getPropertyValue('--ok').trim() || 'green');
  line(b, css.getPropertyValue('--bad').trim() || 'red');
  x.fillStyle = css.getPropertyValue('--faint').trim() || '#888'; x.font = `${11 * (window.devicePixelRatio || 1)}px Segoe UI, sans-serif`;
  x.fillText('0', 2, H - 3); x.fillText(mmss(T), W - x.measureText(mmss(T)).width - 2, H - 3);
  x.fillText('— покой', W * 0.36, H - 3); x.fillStyle = css.getPropertyValue('--bad').trim(); x.fillText('— всё включено', W * 0.5, H - 3);
}

function renderAbilities() {
  const list = installed();
  $m('mAbN').textContent = list.length ? `· ${list.length}` : '';
  if (!list.length) { $m('mAb').innerHTML = '<p class="muted mpad">Пока пусто. Добавьте модули из каталога слева — тут появится, что они дают.</p>'; return; }
  $m('mAb').innerHTML = list.map((x) => {
    const m = MD.modules[x.id]; const T = TYPE[m.type];
    const costs = [];
    if (m.idle) costs.push(`в покое ${fmt(m.idle, 2)}/с`);
    if (m.act) costs.push(`включён ${fmt(m.act, 2)}/с`);
    if (m.use) costs.push(`за применение ${fmt(m.use, 2)}`);
    if (m.cd) costs.push(`перезарядка ${fmt(m.cd)} с`);
    const need = [m.part ? `нужен развёрнутый ${PART[m.part].toLowerCase()}` : '', m.full ? 'нужен полностью развёрнутый костюм' : '', m.mincell ? `работает при заряде выше ${m.mincell}%` : ''].filter(Boolean);
    const armorPick = x.id === 'armor' && !x.inbuilt ? `<div class="apick">${ARMOR.map((k) => `<button data-arm="${k}" data-u="${x.u}" aria-pressed="${x.armor === k}" title="${ARMOR_MAT[k]}">${ARMOR_RU[k]}</button>`).join('')}</div>` : '';
    const tog = m.type === 2 ? `<label class="tog"><input type="checkbox" data-on="${esc(x.u)}"${B.on[x.u] ? ' checked' : ''}> вкл.</label>` : '';
    return `<div class="ab" style="--tc:${T[1]}">
      <div class="abh">${modSpr(x.id, 1.5)}<div><b>${esc(nm(x.id))}</b><small>${esc(m.name)}</small></div>${tog}</div>
      <div class="abt"><span class="tg">${T[0]}</span>${x.inbuilt ? '<span class="tg in">встроен</span>' : ''}<span class="tg">места: ${m.cx}</span></div>
      ${TIP[x.id] ? `<div class="tip2">${esc(TIP[x.id])}</div>` : ''}
      <div class="abd">${esc(m.desc)}</div>
      ${costs.length ? `<div class="abc">⚡ ${esc(costs.join(' · '))}</div>` : ''}
      ${need.length ? `<div class="abc">⛭ ${esc(need.join('; '))}</div>` : ''}
      ${armorPick}
    </div>`;
  }).join('');
}

function renderAdvice() {
  const a = advice();
  $m('mAdv').innerHTML = a.length ? a.map(([k, t]) => `<div class="adv ${k}">${esc(t)}</div>`).join('') : '<p class="muted mpad">Всё спокойно.</p>';
  const got = ACH.filter((x) => { try { return x[2](); } catch (e) { return false; } });
  $m('mAch').innerHTML = ACH.map((x) => `<span class="ach${got.includes(x) ? ' got' : ''}" title="${esc(x[1])}">${got.includes(x) ? '★' : '☆'} ${esc(x[0])}</span>`).join('');
  $m('mCode').value = buildCode();
}

function renderPrint() {
  const t = theme(); const mats = {}; let time = 0;
  const add = (m, k = 1) => Object.entries(m || {}).forEach(([n, v]) => { mats[n] = (mats[n] || 0) + v * k; });
  ['mod_shell', 'mod_helmet', 'mod_chestplate', 'mod_gauntlets', 'mod_boots'].forEach((k) => { const c = MD.chassis[k]; if (c) { add(c.mats); time += c.time; } });
  const plating = B.theme === 'standard' ? MD.chassis.mod_plating_standard : t.design;
  if (plating) { add(plating.mats); time += plating.time; }
  const nodes = new Set(); const noDesign = [];
  if (t.design && t.design.node) nodes.add(t.design.node);
  B.mods.forEach((x) => {
    const m = MD.modules[x.id];
    if (m.design) { add(m.design.mats); time += m.design.time; if (m.design.node) nodes.add(m.design.node); } else noDesign.push(nm(x.id));
    if (x.id === 'armor') mats[x.armor ? ARMOR_MAT[x.armor].split(' / ')[0] : 'материал плиты'] = (mats[x.armor ? ARMOR_MAT[x.armor].split(' / ')[0] : 'материал плиты'] || 0) + 10;
  });
  // предки узлов внутри МОД-ветки
  const need = new Set();
  const walk = (n) => { if (!MD.nodes[n] || need.has(n)) return; need.add(n); MD.nodes[n].pre.forEach(walk); };
  nodes.forEach(walk);
  const outside = new Set(); need.forEach((n) => MD.nodes[n].pre.forEach((p) => { if (!MD.nodes[p]) outside.add(p); }));
  const nodeList = [...need].sort((a, b) => NODE_ORDER.indexOf(a) - NODE_ORDER.indexOf(b));
  const pts = nodeList.reduce((s, n) => s + MD.nodes[n].cost, 0);
  const matStr = Object.entries(mats).sort((a, b) => b[1] - a[1]).map(([n, v]) => `<span><b>${fmt(v, 1)}</b> ${esc(n)}</span>`).join('');
  $m('mPrint').innerHTML = `<h3 class="mh">Что печатать <small>мехфаб, листы (1 лист = 2000 ед.)</small></h3>
    <div class="mats">${matStr}</div>
    <div class="pinfo">Печать ≈ ${mmss(time)} · ядро — ящик «MOD core Crate» в карго (3 ядра, 600 кр., доступ робототехники) или крафт: 5 кабеля, 2 прута, стекло, сердце + отвёртка.</div>
    ${nodeList.length ? `<div class="pinfo">Исследования: ${nodeList.map((n) => `<span class="tg2" title="${esc(MD.nodes[n].name)}">${esc(NODE_RU[n] ? NODE_RU[n][0] : n)}${MD.nodes[n].cost ? ' · ' + MD.nodes[n].cost : ''}</span>`).join(' ')} — всего ${pts.toLocaleString('ru-RU')} очков${outside.size ? `; ещё нужны общие узлы: ${[...outside].map(esc).join(', ')}` : ''}.</div>` : '<div class="pinfo">Исследований не нужно — всё со старта.</div>'}
    ${noDesign.length ? `<div class="pinfo warnc">Не печатаются в мехфабе: ${esc(noDesign.join(', '))}.</div>` : ''}
    ${!plating ? `<div class="pinfo warnc">Обшивку «${esc(THEME_RU[B.theme])}» не напечатать — она бывает только у готовых костюмов.</div>` : ''}`;
}

function renderAll() {
  renderTop(); renderZones(); renderList(); renderStand(); renderStats(); renderAbilities(); renderAdvice(); renderPrint();
}

function infoModal(id) {
  const m = MD.modules[id]; const T = TYPE[m.type];
  const why = blockReason(id, m.type === 4 ? null : undefined);
  const node = nodeOf(id);
  const el = document.createElement('div'); el.className = 'mmodal';
  el.innerHTML = `<div class="panel" role="dialog"><button class="btn sm mx" data-x>✕</button>
    <div class="abh">${modSpr(id, 3)}<div><b style="font-size:18px">${esc(nm(id))}</b><small>${esc(m.name)}</small></div></div>
    <div class="abt"><span class="tg" style="--tc:${T[1]}">${T[0]}</span><span class="tg">места: ${m.cx}</span>${node ? `<span class="tg">узел: ${esc(NODE_RU[node] ? NODE_RU[node][1] : node)}</span>` : '<span class="tg">не печатается</span>'}</div>
    <p class="muted">${T[2]}</p>
    ${TIP[id] ? `<div class="tip2">${esc(TIP[id])}</div>` : ''}
    <p>${esc(m.desc)}</p>
    <div class="abc">⚡ покой ${fmt(m.idle, 2)}/с · включён ${fmt(m.act, 2)}/с · применение ${fmt(m.use, 2)} · перезарядка ${fmt(m.cd)} с</div>
    ${m.inc.length ? `<div class="abc">Несовместим с: ${esc(m.inc.map((x) => MD.modules[x] ? nm(x) : x).join(', '))}</div>` : ''}
    ${m.design ? `<div class="abc">Мехфаб: ${Object.entries(m.design.mats).map(([n, v]) => `${fmt(v, 2)} ${n}`).join(', ')} · ${fmt(m.design.time)} с</div>` : ''}
    <div style="margin-top:10px">${installed().some((x) => x.id === id) ? '<span class="muted">Уже на стенде.</span>' : why ? `<span class="neg">${esc(why)}</span>` : `<button class="btn pri" data-add="${esc(id)}">Установить</button>`}</div></div>`;
  el.addEventListener('click', (e) => {
    if (e.target === el || e.target.closest('[data-x]')) el.remove();
    const a = e.target.closest('[data-add]'); if (a) { el.remove(); addModule(a.dataset.add); }
  });
  document.body.appendChild(el);
}

function addModule(id) {
  const m = MD.modules[id];
  if (installed().some((x) => x.id === id) && m.type !== 4) { flash('Уже установлен'); return; }
  const why = blockReason(id, m.type === 4 ? null : undefined);
  if (why) { flash(why, true); return; }
  B.mods.push({ id, u: uid++ });
  save(); renderAll(); flash(`${nm(id)} добавлен`);
}
function removeModule(u) {
  const i = B.mods.findIndex((x) => String(x.u) === String(u));
  if (i < 0) { flash('Встроен в обшивку — снять нельзя', true); return; }
  const id = B.mods[i].id; B.mods.splice(i, 1); delete B.on[u];
  save(); renderAll(); flash(`${nm(id)} снят`);
}

/* ---------- события ---------- */
/* ---------- перетаскивание: схватить модуль (или часть обшивки) и плавно донести до стенда ---------- */
let drag = null; let suppressClick = false;
const ghostEl = document.createElement('div'); ghostEl.className = 'mghost'; ghostEl.hidden = true; document.body.appendChild(ghostEl);
const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

host.addEventListener('pointerdown', (e) => {
  if (e.button !== 0 || e.target.closest('[data-info],input,select,.apick,.tog')) return;
  const row = e.target.closest('.mrow'); const chip = e.target.closest('.mchip'); const mv = e.target.closest('.mv');
  const src = row || chip || mv; if (!src) return;
  if (chip && chip.classList.contains('inb')) return;
  drag = { kind: row ? 'add' : chip ? 'remove' : 'theme', src, id: row && row.dataset.id, u: chip && chip.dataset.u,
    theme: mv && mv.dataset.theme, x0: e.clientX, y0: e.clientY, started: false };
  if (chip) drag.id = (installed().find((x) => String(x.u) === chip.dataset.u) || {}).id;
});
window.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
    startDrag();
  }
  e.preventDefault();
  drag.tx = e.clientX; drag.ty = e.clientY;
  hover(e.clientX, e.clientY);
}, { passive: false });
window.addEventListener('pointerup', (e) => {
  if (!drag) return;
  const d = drag; drag = null;
  if (!d.started) return;
  suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
  drop(d, e.clientX, e.clientY);
});
window.addEventListener('pointercancel', () => { if (drag && drag.started) flyBack(drag); drag = null; });

function startDrag() {
  const d = drag; d.started = true;
  const r = d.src.getBoundingClientRect();
  d.gx = r.left; d.gy = r.top; d.ox = d.x0 - r.left; d.oy = d.y0 - r.top; d.vx = 0;
  d.tx = d.x0; d.ty = d.y0;
  const img = d.kind === 'theme' ? spr('mod_clothing.dmi', `${MD.themes[d.theme].skin}-${PART_STATE[zone === null ? 0 : zone]}`, 2) : modSpr(d.id, 2);
  const label = d.kind === 'theme' ? `Обшивка: ${THEME_RU[d.theme]}` : nm(d.id);
  ghostEl.innerHTML = `${img}<div><b>${esc(label)}</b><small id="mGhostHint"></small></div>`;
  ghostEl.className = 'mghost' + (d.kind === 'remove' ? ' rm' : ''); ghostEl.hidden = false;
  ghostEl.style.transition = 'none'; ghostEl.style.opacity = '1';
  ghostEl.style.transform = `translate(${d.gx}px,${d.gy}px) scale(1.04)`;
  d.src.classList.add('mdragsrc');
  document.documentElement.classList.add('mdragging');
  host.classList.add(d.kind === 'remove' ? 'drag-rm' : 'drag-add');
  if (d.kind === 'add') {
    const m = MD.modules[d.id]; d.why = m.type === 4 ? blockReason(d.id, null) : blockReason(d.id);
    if (installed().some((x) => x.id === d.id) && m.type !== 4) d.why = 'уже стоит на стенде';
    d.part = m.part;
  }
  const loop = () => {
    if (drag !== d) return;
    // догоняем курсор с инерцией и лёгким наклоном по скорости
    const nx = d.gx + (d.tx - d.ox - d.gx) * (reduce ? 1 : 0.32);
    const ny = d.gy + (d.ty - d.oy - d.gy) * (reduce ? 1 : 0.32);
    d.vx = d.vx * 0.7 + (nx - d.gx) * 0.3;
    d.gx = nx; d.gy = ny;
    const tilt = Math.max(-14, Math.min(14, d.vx * 0.9));
    ghostEl.style.transform = `translate(${d.gx}px,${d.gy}px) rotate(${tilt}deg) scale(1.04)`;
    d.raf = requestAnimationFrame(loop);
  };
  d.raf = requestAnimationFrame(loop);
}
const overStand = (x, y) => { const r = $m('mStand').getBoundingClientRect(); return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom; };
function clearHover() { host.querySelectorAll('.dz-ok,.dz-bad,.dz-hot').forEach((el) => el.classList.remove('dz-ok', 'dz-bad', 'dz-hot')); }
function hover(x, y) {
  const d = drag; clearHover();
  const hint = document.getElementById('mGhostHint');
  const inside = overStand(x, y);
  if (d.kind === 'add') {
    const tgt = host.querySelector(`[data-dz="${d.part}"]`);
    if (tgt) tgt.classList.add(d.why ? 'dz-bad' : 'dz-ok');
    if (inside && tgt) tgt.classList.add('dz-hot');
    if (hint) hint.textContent = d.why ? '✕ ' + d.why : `→ ${PART[d.part]}${inside ? ' — отпускайте' : ''}`;
  } else if (d.kind === 'theme') {
    $m('mStand').classList.add(inside ? 'dz-hot' : 'dz-ok');
    if (hint) hint.textContent = inside ? 'отпустите — сменить обшивку' : `${MD.themes[d.theme].cx} мест`;
  } else {
    if (!inside) host.querySelector('.mcat').classList.add('dz-ok');
    if (hint) hint.textContent = inside ? 'вынесите за стенд, чтобы снять' : 'отпустите — снять модуль';
  }
  ghostEl.classList.toggle('bad', d.kind === 'add' && !!d.why);
}
function endVisual(d) {
  cancelAnimationFrame(d.raf); clearHover();
  document.documentElement.classList.remove('mdragging');
  host.classList.remove('drag-add', 'drag-rm');
  $m('mStand').classList.remove('dz-ok', 'dz-hot');
  host.querySelectorAll('.mdragsrc').forEach((el) => el.classList.remove('mdragsrc'));
}
function flyTo(rect, opts = {}) {
  ghostEl.style.transition = reduce ? 'none' : `transform ${opts.t || 0.32}s cubic-bezier(.2,.9,.25,1.15), opacity ${opts.t || 0.32}s ease`;
  requestAnimationFrame(() => {
    ghostEl.style.transform = `translate(${rect.left}px,${rect.top}px) scale(${opts.scale || 1})`;
    if (opts.fade) ghostEl.style.opacity = '0';
  });
  const done = () => { ghostEl.hidden = true; ghostEl.style.opacity = '1'; if (opts.after) opts.after(); };
  if (reduce) done(); else setTimeout(done, (opts.t || 0.32) * 1000 + 20);
}
function flyBack(d) {
  endVisual(d);
  ghostEl.classList.add('shake');
  setTimeout(() => ghostEl.classList.remove('shake'), 300);
  const r = d.src.isConnected ? d.src.getBoundingClientRect() : { left: d.x0 - d.ox, top: d.y0 - d.oy };
  flyTo(r, { fade: true, t: 0.4 });
}
function drop(d, x, y) {
  const inside = overStand(x, y);
  if (d.kind === 'add') {
    if (!inside) { flyBack(d); return; }
    if (d.why) { flash(d.why, true); flyBack(d); return; }
    endVisual(d);
    const newU = uid;
    addModule(d.id);
    const chip = host.querySelector(`.mchip[data-u="${newU}"]`);
    if (chip) {
      chip.style.visibility = 'hidden';
      flyTo(chip.getBoundingClientRect(), { after: () => { chip.style.visibility = ''; chip.classList.add('mpop'); } });
    } else ghostEl.hidden = true;
  } else if (d.kind === 'theme') {
    if (!inside) { flyBack(d); return; }
    endVisual(d);
    const core = host.querySelector('.mcu').getBoundingClientRect();
    flyTo({ left: core.left + core.width / 2 - 30, top: core.top + core.height / 2 - 30 }, { fade: true, scale: 0.4 });
    setTheme(d.theme);
    host.querySelector('.mcu').classList.add('mpop');
  } else {
    if (inside) { flyBack(d); return; }
    endVisual(d);
    const cat = host.querySelector('.mcat').getBoundingClientRect();
    flyTo({ left: cat.left + 20, top: Math.min(Math.max(y - 20, cat.top), cat.bottom - 40) }, { fade: true, scale: 0.6 });
    removeModule(d.u);
  }
}

host.addEventListener('click', (e) => {
  if (suppressClick) { e.preventDefault(); e.stopPropagation(); return; }
  const abd = e.target.closest('.abd'); if (abd) { abd.classList.toggle('open'); return; }
  const zb = e.target.closest('[data-zone]'); if (zb) { setZone(zb.dataset.zone === 'null' ? null : +zb.dataset.zone); return; }
  const tb = e.target.closest('[data-theme]'); if (tb) { setTheme(tb.dataset.theme); return; }
  const info = e.target.closest('[data-info]'); if (info) { e.stopPropagation(); infoModal(info.dataset.info); return; }
  const row = e.target.closest('.mrow'); if (row) { const id = row.dataset.id; if (installed().some((x) => x.id === id) && MD.modules[id].type !== 4) infoModal(id); else addModule(id); return; }
  const chip = e.target.closest('.mchip'); if (chip) { removeModule(chip.dataset.u); return; }
  const f = e.target.closest('[data-f]'); if (f) { filter = f.dataset.f; st.set('filter', filter); renderList(); return; }
  const pre = e.target.closest('[data-pre]'); if (pre) { applyPreset(+pre.dataset.pre); return; }
  const arm = e.target.closest('[data-arm]');
  if (arm) {
    const x = B.mods.find((y) => String(y.u) === arm.dataset.u); if (!x) return;
    const prev = x.armor; x.armor = undefined;
    const why = blockReason('armor', arm.dataset.arm);
    if (why && !/не влезает/.test(why)) { x.armor = prev; flash(why, true); return; }
    x.armor = arm.dataset.arm; save(); renderAll(); return;
  }
  if (e.target.id === 'mRand') randomBuild();
  if (e.target.id === 'mClear') { B.mods = []; B.on = {}; save(); renderAll(); flash('Стенд очищен'); }
  if (e.target.id === 'mCopy') { const v = $m('mCode').value; try { navigator.clipboard.writeText(v).then(() => flash('Код скопирован'), () => {}); } catch (err) { $m('mCode').select(); } }
  if (e.target.id === 'mLoad') loadCode($m('mPaste').value);
});
host.addEventListener('change', (e) => {
  if (e.target.id === 'mTheme') setTheme(e.target.value);
  if (e.target.id === 'mCell') { B.cell = e.target.value; save(); renderStats(); renderAdvice(); }
  if (e.target.id === 'mAll') { showAll = e.target.checked; st.set('all', showAll); renderList(); }
  if (e.target.dataset.on) { B.on[e.target.dataset.on] = e.target.checked; save(); renderStats(); renderAdvice(); }
});
host.addEventListener('input', (e) => { if (e.target.id === 'mQ') { query = e.target.value; renderList(); } });
window.addEventListener('resize', () => { if (!host.hidden) drawChart(drain(false), drain(true)); });

$m('mAll').checked = showAll;
renderAll();
window.MOD_SIM = { render: () => { renderStats(); } };
})();

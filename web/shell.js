'use strict';
// Пульт — оболочка для двадцати одного приложения: стартовое радиальное меню, переключение приложений
// и два режима окна (компактный и расширенный). Работает в Пульт.exe, Пульт.apk и в браузере. Приложения открываются в iframe с того же
// адреса, поэтому оболочка может подключить к ним стили компактного режима.

const ICONS = {
  flask: '<path d="M9 3h6M10 3v6.2L4.6 18.4A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.6-2.6L14 9.2V3"/><path d="M7.2 15h9.6"/>',
  shield: '<path d="M12 3 20 6v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z"/><path d="m8.8 12 2.2 2.2 4.2-4.4"/>',
  scroll: '<path d="M8 21h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8"/><path d="M8 3a2 2 0 0 0-2 2v14a2 2 0 1 1-4 0v-2h4"/><path d="M10 8h6M10 12h6M10 16h3"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z"/>',
  pot: '<path d="M3 11h18"/><path d="M5 11v6a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-6"/><path d="M9 7.5c0-1.2 1-1.3 1-2.5M14 7.5c0-1.2 1-1.3 1-2.5"/>',
  factory: '<path d="M3 21V10l5 3v-3l5 3v-3l5 3V4h3v17z"/><path d="M7 17h2M12 17h2M17 17h1"/>',
  person: '<circle cx="12" cy="7.5" r="4"/><path d="M4.5 21v-1.5a7.5 7.5 0 0 1 15 0V21"/>',
  chip: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/><path d="M10 10h4v4h-4z"/>',
  expand: '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>',
  shrink: '<path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/>',
  pin: '<path d="M15 4.5 19.5 9l-3 3-1 4.5-7-7 4.5-1z"/><path d="M8.5 15.5 4 20"/>',
  cross: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
  atom: '<circle cx="12" cy="12" r="1.2"/><ellipse cx="12" cy="12" rx="10" ry="4"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(120 12 12)"/>',
  cloche: '<path d="M3 18h18"/><path d="M5 18a7 7 0 0 1 14 0"/><path d="M12 11V8M10 8h4"/>',
  badge: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M5.8 16c.6-1.4 1.8-2 3.2-2s2.6.6 3.2 2M14.5 10h4M14.5 13h3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  scales: '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7 2 14a3 3 0 0 0 6 0zM19 7l-3 7a3 3 0 0 0 6 0z"/>',
  drop: '<path d="M12 3s6 6.6 6 11a6 6 0 0 1-12 0c0-4.4 6-11 6-11z"/><path d="M12 20a6 6 0 0 0 6-6H6"/>',
  crown: '<path d="M3 18h18"/><path d="M4 15 3 7l5 3.5L12 5l4 5.5L21 7l-1 8z"/>',
  idcard: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.5-1.3 1.6-2 3-2s2.5.7 3 2M14 9.5h4M14 12.5h4M14 15.5h2.5"/>',
  wind: '<path d="M3 8h10a3 3 0 1 0-3-3"/><path d="M3 12h15a3 3 0 1 1-3 3"/><path d="M3 16h7"/>',
  ai: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4"/><circle cx="9" cy="10.5" r="1.2"/><circle cx="15" cy="10.5" r="1.2"/><path d="M9.5 14h5"/>',
  crate: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/><path d="m7.5 5.2 9 4.6"/>',
  gem: '<path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18M9 3l3 6 3-6M12 9v12"/>',
  pick: '<path d="M4 7c4-4 12-4 16 0"/><path d="M12 4.5 11 20a1 1 0 0 0 2 0z"/>',
  shuttle: '<path d="M12 2c3 2.5 4.5 6 4.5 10v5h-9v-5C7.5 8 9 4.5 12 2z"/><path d="M7.5 13 4 16v3h3.5M16.5 13l3.5 3v3h-3.5"/><path d="M10 20.5h4"/><circle cx="12" cy="9" r="1.5"/>',
  lens: '<circle cx="10" cy="10" r="6.5"/><path d="m15 15 6 6"/><path d="M7.2 8.4a3.2 3.2 0 0 1 2.4-1.6"/>',
  robot: '<rect x="5" y="8" width="14" height="11" rx="2.5"/><path d="M12 4v4M10 4h4"/><circle cx="9.5" cy="13" r="1.3"/><circle cx="14.5" cy="13" r="1.3"/><path d="M10 16.5h4M2.5 12v3M21.5 12v3"/>',
  gear: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  bubble: '<circle cx="17" cy="17" r="4"/><path d="M4 4h9M4 4v9M4 4l8.5 8.5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  fish: '<path d="M2.5 12c2.6-3.6 6-5.5 9.6-5.5 3.4 0 6.1 1.9 7.9 5.5-1.8 3.6-4.5 5.5-7.9 5.5-3.6 0-7-1.9-9.6-5.5z"/><path d="M20 12l2-3v6z"/><circle cx="8" cy="11" r="1"/><path d="M13 9.5c.8.7 1.2 1.5 1.2 2.5s-.4 1.8-1.2 2.5"/>',
  tree: '<rect x="9" y="2.5" width="6" height="4.5" rx="1"/><rect x="2.5" y="17" width="6" height="4.5" rx="1"/><rect x="15.5" y="17" width="6" height="4.5" rx="1"/><path d="M12 7v4M5.5 17v-3h13v3M12 11v3"/>',
  virus: '<circle cx="12" cy="12" r="5.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M5.6 5.6l1.9 1.9M16.5 16.5l1.9 1.9M18.4 5.6l-1.9 1.9M7.5 16.5l-1.9 1.9"/><circle cx="10.2" cy="10.8" r="1"/><circle cx="14" cy="13.4" r="1"/>',
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
  // Инженер — одна страница, ?only= оставляет в ней инструкции или справку «Как дышать 101»
  { id: 'engineer', name: 'Инженер', sub: 'Пошаговые инструкции', desc: 'Двигатель, стройка, цели станции — шаг за шагом',
    src: 'apps/engineer/index.html?only=guides', color: '#e2b33a', icon: 'wrench', hscroll: '.nav', css: false },
  { id: 'kitchen', name: 'Кухня и бар', short: 'Кухня', sub: 'Повар и бармен', desc: 'Рецепты блюд и коктейлей, «Мой бар»',
    src: 'apps/kitchen/index.html', color: '#e07a3f', icon: 'pot', hscroll: '.tabs, .subtabs, .controls .chips' },
  { id: 'himzavod', name: 'Химзавод', sub: 'Плюмбинг и химия', desc: 'Трубы, машины и реакции завода',
    src: 'apps/himzavod/index.html', color: '#9a6ad6', icon: 'factory', hscroll: 'header' },
  { id: 'character', name: 'Персонаж', sub: 'Редактор персонажа', desc: 'Окно настройки персонажа, превью и 60 слотов',
    src: 'apps/character/index.html', color: '#d65a9c', icon: 'person', hscroll: '.CharacterSetup__tabs, .CharacterSetup__header-actions' },
  { id: 'circuits', name: 'Симулятор Схем', short: 'Схемы', sub: 'Конструктор интегралок', desc: 'Блоки, провода, симуляция и код для принтера',
    src: 'apps/circuits/index.html', color: '#2fb5a5', icon: 'chip', hscroll: 'nav.tabs, .tools', css: false },
  { id: 'avd', name: 'Панель АВД', short: 'АВД', sub: 'Нарушения НРП', desc: 'НРП по отделам, рапорты и жалобы',
    src: 'apps/avd/index.html', color: '#b8863b', icon: 'scales', hscroll: 'nav, .roles, .tpls', css: false },
  // Панель Командования — одна страница, ?only= оставляет в ней одну часть
  { id: 'hop', name: 'Глава Персонала', short: 'ГП', sub: 'Допуски и кадры', desc: 'Документы допусков, кто что разрешает, порядок работы',
    src: 'apps/command/index.html?only=hop', color: '#5b7be0', icon: 'idcard', hscroll: '.subnav, .tpls', css: false },
  { id: 'ai', name: 'Панель ИИ', short: 'ИИ', sub: 'Законы и управление', desc: 'Своды законов, клавиши, спорные ситуации',
    src: 'apps/command/index.html?only=ai', color: '#3fb8d6', icon: 'ai', hscroll: '.subnav, .lawsets', css: false },
  { id: 'captain', name: 'Панель Капитана', short: 'Капитан', sub: 'Цели станции', desc: 'Цели станции, смена, объявления, тревоги',
    src: 'apps/command/index.html?only=cap', color: '#c9a227', icon: 'crown', hscroll: '.subnav, .tpls', css: false },
  // В конце списка, чтобы не сдвинуть Alt-клавиши остальных; своей клавиши нет
  { id: 'air', name: 'Как дышать 101', short: 'Атмос', sub: 'Воздух и газы', desc: 'Вернуть воздух в отсек, смешать и сварить газы',
    src: 'apps/engineer/index.html?only=air', color: '#7cc6e8', icon: 'wind', hscroll: '.toc', css: false },
  // Карго — одна страница, ?only= оставляет в ней одну часть; своих клавиш нет
  { id: 'miners', name: 'Майнеры', sub: 'БС- и криптомайнеры', desc: 'Установка, выработка, законность',
    src: 'apps/cargo/index.html?only=miners', color: '#4f8fe0', icon: 'gem', hscroll: '.subnav', css: false },
  { id: 'mine', name: 'Шахта', sub: 'Гайд шахтёра', desc: 'Снаряжение, автомат, фауна Лаваленда',
    src: 'apps/cargo/index.html?only=mine', color: '#b5653a', icon: 'pick', hscroll: '.subnav, .chips', css: false },
  { id: 'cargoev', name: 'Ивенты шаттла', short: 'Ивенты', sub: 'События снабжения', desc: 'Займ шаттла, капсулы, пираты, инспекция',
    src: 'apps/cargo/index.html?only=events', color: '#d9a03a', icon: 'shuttle', hscroll: '.subnav', css: false },
  // Детектив — второе приложение СБ; протокол допроса открывается отдельным окном (см. «Отдельные окна»)
  { id: 'detective', name: 'Детектив', sub: 'Улики и допрос', desc: 'Инструменты, расследование, протокол допроса',
    src: 'apps/detective/index.html', color: '#a0785a', icon: 'lens', hscroll: '.subnav', css: false },
  // Вирусология — второе приложение медотдела после Алхимика и Химзавода; своей клавиши нет
  { id: 'viro', name: 'Вирусология', sub: 'Вирусы и эпидемии', desc: 'Статы, полезные вирусы, лечение, разумный вирус',
    src: 'apps/viro/index.html', color: '#4aa8d8', icon: 'virus', hscroll: 'nav, .subnav, .chips', css: false },
  // Робототехник — второе приложение науки; пошаговая сборка с оверлеем поверх игры (F10), своей клавиши нет
  { id: 'robo', name: 'Робототехник', short: 'Робо', sub: 'Киборги, мехи, МОДы', desc: 'Пошаговая сборка, МОД-стенд, оверлей F10, НРП',
    src: 'apps/robo/index.html', color: '#8c6ad8', icon: 'robot', hscroll: 'nav, .subnav, .mpre', css: false },
  // Рыбалка — третье приложение «Общего»: справочник по рыбе и симулятор мини-игры; своей клавиши нет
  { id: 'fishing', name: 'Рыбалка', sub: 'Рыба и симулятор', desc: 'Места, шансы улова, снасти, мини-игра',
    src: 'apps/fishing/index.html', color: '#2f8fb8', icon: 'fish', hscroll: 'nav, .chips', css: false },
  // R&D — третье приложение науки: дерево исследований, порядок изучения, где взять дизайн; своей клавиши нет
  { id: 'rnd', name: 'R&D', sub: 'Дерево исследований', desc: 'Узлы и что они открывают, порядок изучения, очки',
    src: 'apps/rnd/index.html', color: '#8a54c9', icon: 'tree', hscroll: 'nav, .chips, .map', css: false },
];
// Клавиша приложения: Alt+1…9, дальше — Alt+-, Alt+=, Alt+\
const EXTRA_KEYS = [['Minus', '-'], ['Equal', '='], ['Backslash', '\\']];
const appKey = (i) => (i < 9 ? 'Alt+' + (i + 1) : EXTRA_KEYS[i - 9] ? 'Alt+' + EXTRA_KEYS[i - 9][1] : '');
APPS.forEach((a, i) => { a.angle = -90 + (i * 360) / APPS.length; });
const byId = Object.fromEntries(APPS.map((a) => [a.id, a]));

// Профессии — первый круг меню, по часовой стрелке от верха. Профессия с одним приложением
// открывает его сразу, с несколькими — показывает второй круг с выбором приложения.
const DEPTS = [
  { id: 'gen', name: 'Общее', sub: 'Для любой роли', color: '#5b8def', icon: 'badge', apps: ['papirus', 'character', 'fishing'] },
  { id: 'sec', name: 'Служба безопасности', short: 'СБ', sub: 'Закон, рапорты, детектив', color: '#d63c45', icon: 'shield', apps: ['brig', 'detective'] },
  { id: 'law', name: 'Юридический отдел', short: 'Юр. отдел', sub: 'АВД и Представитель', color: '#b8863b', icon: 'scales', apps: ['avd'] },
  { id: 'cmd', name: 'Командование', sub: 'ГП, ИИ, Капитан', color: '#5b7be0', icon: 'crown', apps: ['hop', 'ai', 'captain'] },
  { id: 'eng', name: 'Инженерия', sub: 'Инструкции и атмос', color: '#e2b33a', icon: 'wrench', apps: ['engineer', 'air'] },
  { id: 'sci', name: 'Наука', sub: 'Схемы, роботы, R&D', color: '#2fb5a5', icon: 'atom', apps: ['circuits', 'robo', 'rnd'] },
  { id: 'med', name: 'Медицина', sub: 'Химия, завод, вирусы', color: '#4aa8d8', icon: 'cross', apps: ['alchimik', 'himzavod', 'viro'] },
  { id: 'srv', name: 'Сервис', sub: 'Повар и бармен', color: '#e07a3f', icon: 'cloche', apps: ['kitchen'] },
  { id: 'sup', name: 'Карго', sub: 'Майнеры, шахта, шаттл', color: '#c08a3e', icon: 'crate', apps: ['miners', 'mine', 'cargoev'] },
];
const byDept = Object.fromEntries(DEPTS.map((d) => [d.id, d]));
const deptOf = {};
DEPTS.forEach((d) => {
  d.desc = d.apps.map((id) => byId[id].name).join(' · ');
  d.title = d.name + ': ' + d.desc;
  d.apps.forEach((id) => { deptOf[id] = d; });
});
APPS.forEach((a, i) => { a.title = `${a.name} — ${a.sub}` + (appKey(i) ? ` (${appKey(i)})` : ''); });

const $ = (id) => document.getElementById(id);
const root = document.documentElement;
const home = $('home'), stage = $('stage'), bar = $('bar');
const host = window.chrome && window.chrome.webview;
const send = (msg) => { try { host && host.postMessage(msg); } catch (e) { /* открыто в браузере */ } };
const android = window.PultAndroid; // мост Android-приложения (Пульт.apk), см. android/src
// Эта же страница — окно оверлея Пульт.exe: только кнопка и радиальное меню, приложения открывает главное окно
const OVERLAY = root.classList.contains('ovl');

// Тактильная отдача на телефоне: лёгкий отклик на нажатия, посильнее — на смену приложения и меню
let lastHaptic = 0;
function haptic(kind) {
  if (!android || !android.haptic) return;
  const t = Date.now();
  if (t - lastHaptic < 50) return; // один отклик на одно нажатие, даже если сработало несколько обработчиков
  lastHaptic = t;
  android.haptic(kind);
}
const CLICKABLE = 'button, a[href], summary, select, label, input[type="checkbox"], input[type="radio"], [role="button"], [role="tab"]';
function tapFeedback(e) {
  const el = e.target;
  if (!el || !el.closest) return;
  if (el.closest(CLICKABLE)) { haptic('tap'); return; }
  // В приложениях кнопками часто служат div со своим обработчиком — узнаём их по курсору-руке
  for (let n = el, i = 0; n && n.nodeType === 1 && i < 6; n = n.parentElement, i++) {
    if (n.ownerDocument.defaultView.getComputedStyle(n).cursor === 'pointer') { haptic('tap'); return; }
  }
}
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

// Круг из секторов: items — {id, name, short, sub, desc, title, color, icon}, hub — разметка центра
function buildRing(el, items, hub, pick) {
  const span = 360 / items.length;
  const base = items.length === 2 ? 180 : -90; // два сектора — слева и справа
  const rm = (R0 + R1) / 2;
  let ring = `<svg class="ring" viewBox="-100 -100 200 200" aria-hidden="true"><circle class="track" r="99.5"/>`;
  let labels = '';
  items.forEach((a, i) => {
    const angle = base + i * span;
    const a0 = angle - span / 2, a1 = angle + span / 2;
    const cx = Math.cos(rad(angle)), cy = Math.sin(rad(angle));
    ring += `<g class="sec" data-id="${a.id}" data-i="${i}" style="--c:${a.color};--dx:${(cx * 4).toFixed(2)}px;--dy:${(cy * 4).toFixed(2)}px">` +
            `<path class="fill" d="${sectorPath(a0, a1)}"/><path class="edge" d="${arcPath(a0, a1, R1 - 2.5)}"/></g>`;
    labels += `<button class="lab" data-id="${a.id}" data-i="${i}" style="--c:${a.color};` +
      `left:${(50 + (cx * rm) / 2).toFixed(2)}%;top:${(50 + (cy * rm) / 2).toFixed(2)}%;` +
      `--px:calc(var(--d) * ${(cx * 0.02).toFixed(4)});--py:calc(var(--d) * ${(cy * 0.02).toFixed(4)})" ` +
      `title="${a.title}">` +
      `<span class="ico">${svg(a.icon)}</span><b><span class="full">${a.name}</span><span class="short">${a.short || a.name}</span></b><span class="sub">${a.sub}</span>` +
      `<span class="desc">${a.desc}</span><span class="alive">● открыт</span></button>`;
  });
  ring += '</svg>';
  el.innerHTML = ring + labels + hub;

  const hot = (id) => el.querySelectorAll('[data-id]').forEach((n) => n.classList.toggle('hot', n.dataset.id === id));
  el.querySelectorAll('[data-id]').forEach((n) => {
    n.addEventListener('pointerenter', () => hot(n.dataset.id));
    n.addEventListener('pointerleave', () => hot(null));
    n.addEventListener('focus', () => hot(n.dataset.id));
    n.addEventListener('blur', () => hot(null));
    n.addEventListener('click', () => pick(n.dataset.id));
  });
}

// Первый круг — профессии
function buildRadial() {
  buildRing($('radial'), DEPTS,
    `<div class="hub" data-i="0"><svg class="logo" viewBox="-12 -12 24 24" aria-hidden="true">${logoArcs(10, 3.2)}</svg>` +
    `<h1>Пульт</h1><button class="modepill" id="hubMode"></button></div>`, openDept);
  if (OVERLAY) {
    // В оверлее центр меню — развернуть Пульт обратно в окно; за сам центр меню можно перетаскивать
    $('hubMode').innerHTML = svg('expand') + 'Развернуть';
    $('hubMode').title = 'Развернуть Пульт в окно';
    $('hubMode').addEventListener('click', () => { send('ovl:restore'); setOvl('button', true); });
    dragHandle($('radial').querySelector('.hub'));
  } else $('hubMode').addEventListener('click', () => setMode(!compact));
}

// Второй круг — приложения профессии поверх размытого первого
let dept = null;
function openDept(id) {
  const d = byDept[id];
  if (!d) return;
  if (d.apps.length === 1) { open(d.apps[0]); return; }
  haptic('tap');
  dept = d;
  const el = $('radial2');
  buildRing(el, d.apps.map((a) => byId[a]),
    `<div class="hub" data-i="0" style="--c:${d.color}"><span class="hubico">${svg(d.icon)}</span>` +
    `<h1>${d.short || d.name}</h1><button class="modepill" id="hubBack">${svg('back')}Назад</button></div>`, open);
  $('hubBack').addEventListener('click', closeDept);
  $('radial').classList.add('behind');
  $('radial').inert = true;
  el.classList.add('on');
  el.inert = false;
  syncMenu();
  introAnim(el);
  const first = el.querySelector(`.lab[data-id="${current && d.apps.includes(current.id) ? current.id : d.apps[0]}"]`);
  if (first) first.focus({ preventScroll: true });
}
function closeDept(quiet) {
  if (!dept) return false;
  const id = dept.id;
  dept = null;
  if (quiet !== true) haptic('tap');
  $('radial2').classList.remove('on');
  $('radial2').inert = true;
  $('radial').classList.remove('behind');
  $('radial').inert = false;
  if (quiet !== true) { const lab = $('radial').querySelector(`.lab[data-id="${id}"]`); if (lab) lab.focus({ preventScroll: true }); }
  return true;
}
// Щелчок мимо секторов второго круга возвращает к профессиям
$('radial2').addEventListener('click', (e) => { if (!e.target.closest('.sec, .lab, .hub')) closeDept(); });

// Значок Пульта: три дуги цветов приложений
function logoArcs(r, w) {
  const span = 360 / APPS.length;
  return APPS.map((a) => {
    const o = 0.9 / APPS.length;
    const A0 = rad(a.angle - span / 2) + o, A1 = rad(a.angle + span / 2) - o;
    return `<path d="M${pt(A0, r)} A${r} ${r} 0 0 1 ${pt(A1, r)}" fill="none" stroke="${a.color}" stroke-width="${w}" stroke-linecap="round"/>`;
  }).join('') + `<circle r="${(r * 0.32).toFixed(2)}" fill="currentColor" opacity=".55"/>`;
}

function introAnim(el = $('radial')) {
  el.classList.remove('intro'); void el.offsetWidth; el.classList.add('intro');
  setTimeout(() => el.classList.remove('intro'), 700);
}

// ---------- Меню: стартовый экран и наложение поверх приложения ----------
function showMenu() {
  if (current) haptic('switch'); // стартовый экран при запуске открывается без вибрации
  home.classList.toggle('overlay', !!current);
  home.classList.remove('closed');
  closeDept(true);
  syncMenu();
  introAnim();
  const first = $('radial').querySelector(`.lab[data-id="${current ? deptOf[current.id].id : DEPTS[0].id}"]`);
  if (first) first.focus({ preventScroll: true });
}
function hideMenu() {
  if (OVERLAY) { setOvl('button'); return; }
  if (!current) return; // без открытого приложения меню — это стартовый экран
  home.classList.add('closed');
  focusApp();
}
const menuOpen = () => !home.classList.contains('closed');
function toggleMenu() { menuOpen() ? hideMenu() : showMenu(); }

home.addEventListener('click', (e) => {
  if (e.target === home || e.target.classList.contains('homefoot') || e.target.classList.contains('rstack')) {
    if (closeDept()) return;
    if (current) haptic('tap');
    hideMenu();
  }
});

// Отметки «открыто сейчас» и «уже запущено»; у профессии — по её приложениям
function syncMenu() {
  home.querySelectorAll('[data-id]').forEach((n) => {
    const ids = byDept[n.dataset.id] ? byDept[n.dataset.id].apps : [n.dataset.id];
    n.classList.toggle('cur', !!current && ids.includes(current.id));
    n.classList.toggle('alive', ids.some((id) => frames[id]));
  });
}

// ---------- Приложения ----------
function open(id) {
  const app = byId[id];
  if (!app) return;
  if (OVERLAY) { send('ovl:open:' + id); setOvl('button', true); return; } // откроет главное окно
  haptic('switch');
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
  syncStep();
}

// Оверлей шага приложения (html.ov-on у Робототехника, Алхимика): в Пульт.exe окно становится
// небольшой полупрозрачной панелью без рамки поверх игры в левом верхнем углу, панель Пульта прячется.
// Панель тянут за полосу шага, размер — уголком справа снизу, прозрачность — Ctrl+колесо.
let stepOn = false, stepDoc = null, stepObs = null;
let stepAlpha = Math.min(1, Math.max(0.2, +(store.get('stepbg') || 0.75)));
function syncStep() {
  let on = false, doc = null;
  const f = current && frames[current.id];
  try { doc = f && f.contentDocument; on = !!doc && doc.documentElement.classList.contains('ov-on'); } catch (e) { /* не загрузился */ }
  if (!host || OVERLAY) on = false;
  if (on === stepOn) return;
  stepOn = on;
  root.classList.toggle('step', on);
  if (on) {
    hideMenu(); toggleSettings(false);
    stepDoc = doc;
    stepObs = new MutationObserver(() => requestAnimationFrame(stepFade));
    stepObs.observe(doc.getElementById('ov') || doc.body, { childList: true, subtree: true });
    // Только полоса шага, прогресс и карточка: подсказка «дальше», следующие шаги и клавиши — в окне приложения
    const css = doc.createElement('style');
    css.id = 'pult-step-css';
    css.textContent = '#ov .ovfoot,#ov .upnext,#ov .ovnext{display:none!important}#ov .ovbody{flex:none!important}';
    doc.head.appendChild(css);
    doc.defaultView.addEventListener('resize', stepFitSoon);
  } else {
    if (stepObs) stepObs.disconnect();
    stepUnfade();
    if (stepDoc) {
      const css = stepDoc.getElementById('pult-step-css');
      if (css) css.remove();
      stepDoc.defaultView.removeEventListener('resize', stepFitSoon);
    }
    stepObs = stepDoc = null;
  }
  send('step:' + (on ? 'on' : 'off'));
  if (on) stepFade();
}

// Подложки панели шага (сам оверлей, его полоса и крупные карточки) — полупрозрачные, текст и кнопки плотные
const stepLayers = [];
function stepUnfade() {
  stepLayers.splice(0).forEach((el) => el.style.removeProperty('background-color'));
  const doc = stepDoc;
  if (doc) {
    doc.documentElement.style.removeProperty('background');
    doc.body.style.removeProperty('background');
    doc.body.style.removeProperty('visibility');
    const ov = doc.getElementById('ov');
    if (ov) ov.style.removeProperty('visibility');
  }
  if (doc && bgAlpha < 1) fadeApp(doc);
}
function stepFade() {
  const doc = stepDoc, ov = doc && doc.getElementById('ov');
  if (!stepOn || !ov) return;
  stepUnfade();
  (bgLayers.get(doc) || []).forEach(([el]) => el.style.removeProperty('background-color'));
  doc.documentElement.style.setProperty('background', 'transparent', 'important');
  doc.body.style.setProperty('background', 'transparent', 'important');
  // Сквозь панель видна игра, а не страница приложения под оверлеем
  doc.body.style.setProperty('visibility', 'hidden', 'important');
  ov.style.setProperty('visibility', 'visible', 'important');
  const win = doc.defaultView, w = ov.clientWidth;
  [ov, ...ov.querySelectorAll('*')].forEach((el) => {
    if (el !== ov && el.getBoundingClientRect().width < w * 0.6) return; // кнопки и мелочь не трогаем
    const m = /rgba?\(([^)]+)\)/.exec(win.getComputedStyle(el).backgroundColor);
    const c = m && m[1].split(',').map(parseFloat);
    if (!c || (c.length > 3 && c[3] === 0)) return;
    const a = (c.length < 4 ? 1 : c[3]) * (el === ov ? stepAlpha : Math.min(1, stepAlpha + 0.1));
    el.style.setProperty('background-color', `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`, 'important');
    stepLayers.push(el);
  });
  stepFitSoon();
}
// Высота панели — по содержимому (ширину задают уголком): программа пересчитывает её в пиксели окна
let stepFitQueued = false;
function stepFitSoon() {
  if (stepFitQueued) return;
  stepFitQueued = true;
  requestAnimationFrame(() => { stepFitQueued = false; stepFit(); });
}
function stepFit() {
  const ov = stepOn && stepDoc && stepDoc.getElementById('ov');
  if (!ov) return;
  let h = 0;
  for (const ch of ov.children) h += ch.offsetHeight;
  if (h > 0) send('step:h:' + Math.ceil(h) + ',' + window.innerHeight);
}
function stepPointer(e) {
  if (!stepOn || e.button !== 0) return;
  const t = e.target;
  if (!t.closest || !t.closest('.ovbar') || t.closest('button, a, input, select, textarea, label')) return;
  e.preventDefault();
  send('step:drag');
}
function stepWheel(e) {
  if (!stepOn || !e.ctrlKey) return;
  e.preventDefault();
  e.stopImmediatePropagation(); // колесо по карточке листает шаги — с Ctrl оно только для прозрачности
  stepAlpha = Math.min(1, Math.max(0.2, Math.round((stepAlpha + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100));
  store.set('stepbg', String(stepAlpha));
  stepFade();
}
$('stepGrip').addEventListener('pointerdown', (e) => { if (e.button === 0) { e.preventDefault(); send('step:size'); } });
$('stepGrip').addEventListener('wheel', stepWheel, { passive: false });

function focusApp() {
  const f = current && frames[current.id];
  if (f) setTimeout(() => { try { f.contentWindow.focus(); } catch (e) { /* ещё грузится */ } }, 30);
}

// Подключаем к странице приложения стили компактного режима, клавиши Пульта и прокрутку колесом
function prepare(app, frame) {
  let doc;
  try { doc = frame.contentDocument; } catch (e) { doc = null; }
  frame.dataset.loaded = '1';
  if (!doc || !doc.head) { frame.classList.add('ready'); return; }
  doc.documentElement.classList.add('pult-embedded');
  doc.documentElement.classList.toggle('pult-compact', compact);
  new MutationObserver(syncStep).observe(doc.documentElement, { attributes: true, attributeFilter: ['class'] });
  doc.addEventListener('pointerdown', stepPointer, true);
  doc.addEventListener('wheel', stepWheel, { capture: true, passive: false });

  const ready = () => { frame.classList.add('ready'); if (bgAlpha < 1) fadeApp(doc); };
  // Вкладки и разделы приложения меняют вёрстку — после щелчка заново находим фоновые слои
  doc.addEventListener('click', () => { if (bgAlpha < 1) setTimeout(() => fadeApp(doc), 60); }, true);
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

  if (android) {
    patchForAndroid(frame.contentWindow);
    doc.addEventListener('click', tapFeedback, true);
  }
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
    `<button data-id="${a.id}" style="--c:${a.color}" title="${a.name}${appKey(i) ? ` (${appKey(i)})` : ''}" aria-label="${a.name}">${svg(a.icon)}</button>`).join('');
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
  $('modeBtn').title = next + keyHint('win', 'mode');
  $('modeBtn').setAttribute('aria-label', next);
  const pill = $('hubMode');
  if (pill) { pill.innerHTML = svg(compact ? 'shrink' : 'expand') + label; pill.title = next + keyHint('win', 'mode'); }
  store.set('mode', compact ? 'compact' : 'expanded');
  if (bgAlpha < 1) setTimeout(fadeAll, 300); // после смены размера окна
  if (!fromHost) { haptic('tap'); send('mode:' + (compact ? 'compact' : 'expanded')); }
}

// ---------- Поверх всех окон (только в программе) ----------
function showPin(on) {
  const b = $('pinBtn');
  b.hidden = false;
  b.innerHTML = svg('pin');
  b.setAttribute('aria-pressed', on ? 'true' : 'false');
  b.title = (on ? 'Открепить: обычное окно' : 'Поверх всех окон') + keyHint('win', 'pin');
}
$('pinBtn').addEventListener('click', () => send('pin:' + ($('pinBtn').getAttribute('aria-pressed') === 'true' ? '0' : '1')));
$('modeBtn').addEventListener('click', () => setMode(!compact));

// ---------- Прозрачный фон (только в программе) ----------
// Ползунок на панели и на стартовом экране меняет непрозрачность только подложек: фона оболочки
// и больших фоновых слоёв приложений. Кнопки, панели и текст остаются плотными.
const OPACITY_MIN = 0;
let bgAlpha = 1;
const opacityInputs = [$('opacity'), $('opacityHome')];

// Фоновые слои приложения — элементы почти во всё окно со своим цветом фона (html, body, обёртки).
// Самый внешний получает выбранную непрозрачность, вложенные под ним — прозрачны, чтобы не складывались.
const bgLayers = new WeakMap(); // документ -> [[элемент, исходный цвет]]
function fadeApp(doc) {
  const win = doc && doc.defaultView;
  if (!win || !doc.body) return;
  (bgLayers.get(doc) || []).forEach(([el]) => el.style.removeProperty('background-color'));
  const layers = [];
  if (bgAlpha < 1) {
    const vw = win.innerWidth, vh = win.innerHeight;
    const visit = (el, depth) => {
      const r = el.getBoundingClientRect();
      if (r.width < vw * 0.9 || r.height < vh * 0.6) return;
      const m = /rgba?\(([^)]+)\)/.exec(win.getComputedStyle(el).backgroundColor);
      const c = m && m[1].split(',').map(parseFloat);
      if (c && (c.length < 4 || c[3] > 0)) layers.push([el, c]);
      if (depth < 6) for (const ch of el.children) visit(ch, depth + 1);
    };
    visit(doc.documentElement, 0);
    layers.forEach(([el, c], i) => {
      const a = i === 0 ? (c.length < 4 ? 1 : c[3]) * bgAlpha : 0;
      el.style.setProperty('background-color', `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`, 'important');
    });
  }
  bgLayers.set(doc, layers);
}
function fadeAll() {
  root.style.setProperty('--bga', bgAlpha);
  Object.values(frames).forEach((f) => { try { fadeApp(f.contentDocument); } catch (e) { /* не загрузился */ } });
}
const opacityOpen = () => !$('opacityPop').hidden;
function showOpacity(on) {
  $('opacityPop').hidden = !on;
  $('opacityBtn').setAttribute('aria-expanded', on ? 'true' : 'false');
}
function showOpacityValue(v, from) {
  v = Math.max(OPACITY_MIN, Math.min(100, Math.round(v)));
  opacityInputs.forEach((i) => { if (i !== from) i.value = v; });
  document.querySelectorAll('.opacval').forEach((s) => { s.textContent = v + '%'; });
  return v;
}
function setBgAlpha(v, from) {
  bgAlpha = showOpacityValue(v, from) / 100;
  fadeAll();
  store.set('bg', String(Math.round(bgAlpha * 100)));
}
opacityInputs.forEach((i) => {
  i.min = OPACITY_MIN; i.max = 100; i.step = 1;
  i.addEventListener('input', () => setBgAlpha(+i.value, i));
});
$('opacityBtn').innerHTML = svg('drop');
$('opacityBtn').addEventListener('click', () => showOpacity(!opacityOpen()));
// Закрываем при щелчке мимо, в том числе внутри приложения (окно оболочки теряет фокус)
document.addEventListener('pointerdown', (e) => { if (opacityOpen() && !e.target.closest('.opacbox')) showOpacity(false); });
window.addEventListener('blur', () => { if (opacityOpen()) showOpacity(false); });
window.addEventListener('resize', () => { if (bgAlpha < 1) fadeAll(); });
showOpacityValue(100);

// ---------- Клавиши ----------
// Все клавиши настраиваются (⚙ справа снизу) и хранятся в pult.keys как отличия от значений по умолчанию.
// Группы: glob — поверх игры (занимает Пульт.exe), slide — шаги и слайды приложений (поверх игры),
// win — в окне Пульта, app — открыть приложение в окне Пульта.
const HK = {
  glob: [
    ['overlay', 'Свернуть в оверлей / развернуть', 'Ctrl+Alt+O'],
    ['menu', 'Радиальное меню оверлея', 'Ctrl+Alt+Space'],
    ['showhide', 'Скрыть / показать Пульт', ''],
    ['app:engineer', 'Инженерная панель', 'Ctrl+Alt+E', 'engineer'],
    ['app:robo', 'Робототехническая панель', 'Ctrl+Alt+R', 'robo'],
    ['app:alchimik', 'Химическая панель', 'Ctrl+Alt+C', 'alchimik'],
  ],
  slide: [
    ['next', 'Следующий шаг / слайд', 'F8'],
    ['prev', 'Предыдущий шаг / слайд', 'F7'],
    ['next_guide', 'Следующая инструкция', 'F9'],
    ['prev_guide', 'Предыдущая инструкция', 'F6'],
    ['toggle', 'Скрыть / показать окно с шагом', 'F10'],
  ],
  win: [
    ['menu', 'Меню приложений', 'Alt+0'],
    ['mode', 'Компактный / расширенный режим', 'Alt+M'],
    ['pin', 'Поверх всех окон', 'Alt+P'],
    ['overlay', 'Свернуть в оверлей', 'Alt+O'],
    ['settings', 'Настройки', 'Alt+.'],
  ],
};
// У шагов «по умолчанию» — это клавиши самого приложения (guides.json и т. п.), а не наши: их не трогаем
const SLIDE_APP = '';
let hkCfg = {};
try { hkCfg = JSON.parse(store.get('keys') || '{}') || {}; } catch (e) { hkCfg = {}; }
const hkRow = (g, k) => (HK[g] || []).find((r) => r[0] === k);
function hkDefault(g, k) {
  if (g === 'app') return appKey(APPS.findIndex((a) => a.id === k));
  if (g === 'slide') return SLIDE_APP;
  const r = hkRow(g, k);
  return r ? r[2] : '';
}
function hkGet(g, k) {
  const v = hkCfg[g] && hkCfg[g][k];
  return typeof v === 'string' ? v : hkDefault(g, k);
}
function hkSet(g, k, v) {
  hkCfg[g] = hkCfg[g] || {};
  if (v === null || v === hkDefault(g, k)) delete hkCfg[g][k]; else hkCfg[g][k] = v;
  store.set('keys', JSON.stringify(hkCfg));
  applyKeys();
}
const keyHint = (g, k) => { const v = hkGet(g, k); return v ? ` (${v})` : ''; };

// Имя клавиши по KeyboardEvent.code — те же имена понимает Пульт.exe (ParseKey)
const CODE_NAMES = {
  Minus: '-', Equal: '=', Backslash: '\\', Backquote: '`', BracketLeft: '[', BracketRight: ']',
  Semicolon: 'Semicolon', Quote: "'", Comma: ',', Period: '.', Slash: '/', Space: 'Space',
  ArrowLeft: 'Left', ArrowRight: 'Right', ArrowUp: 'Up', ArrowDown: 'Down', PageUp: 'PageUp', PageDown: 'PageDown',
  Home: 'Home', End: 'End', Insert: 'Insert', Delete: 'Delete', Pause: 'Pause', ScrollLock: 'ScrollLock',
  NumpadAdd: 'NumpadAdd', NumpadSubtract: 'NumpadSubtract', NumpadMultiply: 'NumpadMultiply',
  NumpadDivide: 'NumpadDivide', NumpadDecimal: 'NumpadDecimal',
};
function keyName(code) {
  let m;
  if ((m = /^Digit(\d)$/.exec(code))) return m[1];
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  if (/^Numpad\d$/.test(code)) return code;
  return CODE_NAMES[code] || '';
}
function comboOf(e) {
  const k = keyName(e.code);
  if (!k) return '';
  const m = [];
  if (e.ctrlKey) m.push('Ctrl');
  if (e.altKey) m.push('Alt');
  if (e.shiftKey) m.push('Shift');
  if (e.metaKey) m.push('Win');
  return m.concat(k).join('+');
}
// Одинаковые сочетания, записанные по-разному (alt+f8 и Alt+F8), сравниваем в одном виде
function normCombo(s) {
  if (!s) return '';
  const parts = String(s).split('+');
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.splice(-2, 2, '+');
  const mods = new Set();
  let key = '';
  parts.forEach((p) => {
    const l = p.trim().toLowerCase();
    if (l === 'ctrl' || l === 'control') mods.add('Ctrl');
    else if (l === 'alt') mods.add('Alt');
    else if (l === 'shift') mods.add('Shift');
    else if (l === 'win' || l === 'meta') mods.add('Win');
    else key = l;
  });
  return ['Ctrl', 'Alt', 'Shift', 'Win'].filter((x) => mods.has(x)).concat(key).join('+');
}
// Буквы, цифры, знаки и пробел без Ctrl/Alt/Win сломали бы набор текста
const needsMod = (combo) => {
  const p = combo.split('+'), k = p[p.length - 1];
  return (k.length === 1 || k === 'Space' || k === 'Semicolon') && !p.some((x) => x === 'Ctrl' || x === 'Alt' || x === 'Win');
};

const WIN_ACTIONS = {
  menu: () => toggleMenu(),
  mode: () => { if (!root.classList.contains('phone')) setMode(!compact); },
  pin: () => { if (!$('pinBtn').hidden) $('pinBtn').click(); },
  overlay: () => goOverlay(),
  settings: () => toggleSettings(),
};
let keyMap = new Map();
let capturing = null; // настройки ждут нажатия: {g, k}

function onKey(e) {
  if (capturing) { captureKey(e); return; }
  if (e.key === 'Escape' && settingsOpen()) { e.preventDefault(); e.stopPropagation(); toggleSettings(false); return; }
  if (e.key === 'Escape' && OVERLAY) { e.preventDefault(); if (!closeDept()) setOvl('button'); return; }
  if (e.key === 'Escape' && opacityOpen()) { e.preventDefault(); e.stopPropagation(); showOpacity(false); return; }
  if (e.key === 'Escape' && menuOpen() && dept) { e.preventDefault(); e.stopPropagation(); closeDept(); return; }
  if (e.key === 'Escape' && menuOpen() && current) { e.preventDefault(); e.stopPropagation(); hideMenu(); return; }
  if (OVERLAY) return;
  const fn = keyMap.get(normCombo(comboOf(e)));
  if (!fn) return;
  e.preventDefault(); e.stopPropagation();
  fn();
}
document.addEventListener('keydown', onKey, true);

// Применить настройки клавиш: клавиши окна, подсказки, клавиши поверх игры в Пульт.exe
function applyKeys() {
  keyMap = new Map();
  APPS.forEach((a) => { const c = normCombo(hkGet('app', a.id)); if (c && !keyMap.has(c)) keyMap.set(c, () => open(a.id)); });
  HK.win.forEach(([k]) => { const c = normCombo(hkGet('win', k)); if (c) keyMap.set(c, WIN_ACTIONS[k]); });
  // Подсказки на кнопках и в меню
  APPS.forEach((a) => { a.title = `${a.name} — ${a.sub}` + keyHint('app', a.id); });
  home.querySelectorAll('.lab[data-id]').forEach((n) => { if (byId[n.dataset.id]) n.title = byId[n.dataset.id].title; });
  $('switch').querySelectorAll('button[data-id]').forEach((b) => { b.title = byId[b.dataset.id].name + keyHint('app', b.dataset.id); });
  $('hubBtn').title = 'Меню приложений' + keyHint('win', 'menu');
  $('ovlBarBtn').title = 'Свернуть в оверлей поверх всех окон' + keyHint('win', 'overlay');
  $('gearBtn').title = 'Настройки: цвета и клавиши' + keyHint('win', 'settings');
  $('modeBtn').title = (compact ? 'Развернуть в расширенный режим' : 'Свернуть в компактный режим') + keyHint('win', 'mode');
  const kb = (v) => v.split('+').map((p) => `<kbd>${p}</kbd>`).join('+');
  const foot = [];
  if (hkGet('win', 'menu')) foot.push(kb(hkGet('win', 'menu')) + ' — меню');
  if (hkGet('win', 'mode')) foot.push(kb(hkGet('win', 'mode')) + ' — режим');
  if (host && hkGet('glob', 'overlay')) foot.push(kb(hkGet('glob', 'overlay')) + ' — оверлей');
  foot.push('⚙ справа снизу — цвета и клавиши');
  $('homeKeys').innerHTML = foot.join(' · ');
  pushGlobalKeys();
  pushHotkeys();
  if (settingsOpen()) renderKeys();
}
function globalSpec() {
  const seen = new Set(HK.glob.map((r) => r[0]));
  const rows = HK.glob.map((r) => r[0]).concat(APPS.map((a) => 'app:' + a.id).filter((k) => !seen.has(k)));
  return rows.map((k) => [k, hkGet('glob', k)]).filter(([, v]) => v).map(([k, v]) => k + '=' + v).join(';');
}
function pushGlobalKeys() { if (host && !OVERLAY) send('globalkeys:' + (capturing ? '' : globalSpec())); }
let globalFailed = new Set();

// ---------- Передача между приложениями ----------
// Приложение просит отправить данные другому: {type: 'pult-send', to, code, title}. Открываем получателя
// и, когда он загрузится, отдаём ему {type: 'pult-import', code, title} (Бриг → Папирус: документ в окно импорта).
window.addEventListener('message', (e) => {
  if (e.origin === location.origin) toApp(e.data);
});
function toApp(d) {
  if (!d || d.type !== 'pult-send' || !byId[d.to] || typeof d.code !== 'string') return;
  open(d.to);
  const f = frames[d.to];
  const go = () => f.contentWindow.postMessage({ type: 'pult-import', code: d.code, title: d.title || '' }, location.origin);
  if (f.dataset.loaded) go();
  else f.addEventListener('load', () => setTimeout(go, 50), { once: true });
}

// ---------- Отдельные окна ----------
// Приложение просит открыть свою страницу отдельным окном: {type: 'pult-window', page} (Детектив → протокол допроса).
// В программе это своё окно поверх игры, в браузере — всплывающее окно; на телефоне окон нет, и приложение
// получает {type: 'pult-window-inline'} и показывает страницу панелью у себя.
const WINDOWS = { protocol: 'apps/detective/protocol.html' };
const popups = {};
window.addEventListener('message', (e) => {
  const d = e.data;
  if (e.origin !== location.origin || !d || d.type !== 'pult-window' || !WINDOWS[d.page]) return;
  const inline = () => e.source.postMessage({ type: 'pult-window-inline', page: d.page }, location.origin);
  if (host) { send('window:' + d.page); return; }
  if (android) { inline(); return; }
  const w = popups[d.page];
  if (w && !w.closed) { w.focus(); return; }
  popups[d.page] = window.open(WINDOWS[d.page], 'pult-' + d.page, 'popup,width=480,height=760');
  if (!popups[d.page]) inline(); // окно заблокировано браузером
});

// ---------- Хоткеи приложений поверх игры (Инженер, оверлей Алхимика) ----------
// Приложение присылает свои клавиши: {type: 'pult-hotkeys', keys}. Пустой набор — отпустить.
// Клавиши в программе одни на всех, поэтому их занимает тот, кто попросил последним,
// а когда он отпускает — возвращаются клавиши предыдущего приложения.
const hotkeyKeys = {};
let hotkeyOwner = null;
function toFrame(id, msg) {
  const f = frames[id];
  if (f && f.contentWindow) f.contentWindow.postMessage(msg, location.origin);
}
function armHotkeys(id, keys) {
  const was = hotkeyOwner;
  if (keys && Object.keys(keys).length) { hotkeyKeys[id] = keys; hotkeyOwner = id; }
  else if (hotkeyKeys[id]) {
    delete hotkeyKeys[id];
    if (hotkeyOwner === id) { const rest = Object.keys(hotkeyKeys); hotkeyOwner = rest.length ? rest[rest.length - 1] : null; }
  }
  pushHotkeys();
  if (was && was !== hotkeyOwner) toFrame(was, { type: 'pult-hotkeys-lost' }); // клавиши ушли другому приложению
}
// Клавиши шагов из настроек заменяют клавиши приложения (только те действия, что приложение само просит)
function pushHotkeys() {
  if (OVERLAY) return;
  const keep = Object.assign({}, (hotkeyOwner && hotkeyKeys[hotkeyOwner]) || {});
  Object.keys(keep).forEach((a) => { const v = hkGet('slide', a); if (v) keep[a] = v; });
  send('hotkeys:' + (capturing ? '' : Object.entries(keep).map(([a, k]) => a + '=' + k).join(';')));
}
function appHotkey(action) {
  const id = hotkeyOwner || 'engineer';
  // «toggle» — это показать и спрятать окно, его делает сама программа; приложение не переключаем
  if (action !== 'toggle' && (!current || current.id !== id)) open(id);
  toFrame(id, { type: 'pult-hotkey', action });
}

// ---------- Связь с окном программы ----------
if (host) {
  host.addEventListener('message', (e) => {
    const d = e.data || {};
    if (typeof d.pinned === 'boolean') showPin(d.pinned);
    if (d.mode === 'compact' || d.mode === 'expanded') setMode(d.mode === 'compact', true);
    if (d.hotkey) appHotkey(d.hotkey);
    if (Array.isArray(d.hotkeysFailed) && hotkeyOwner) toFrame(hotkeyOwner, { type: 'pult-hotkeys-state', failed: d.hotkeysFailed });
    if (d.send) toApp(d.send); // из отдельного окна (протокол допроса → Папирус)
    if (typeof d.open === 'string') open(d.open); // из оверлея или по общей клавише
    // Общая клавиша приложения, когда окно на экране: второе нажатие сворачивает Пульт в оверлей
    if (typeof d.appkey === 'string') {
      if (current && current.id === d.appkey && !menuOpen() && !settingsOpen()) goOverlay();
      else { open(d.appkey); send('front'); }
    }
    if (Array.isArray(d.globalFailed)) { globalFailed = new Set(d.globalFailed); if (settingsOpen()) renderKeys(); }
    if (d.ovl === 'button' || d.ovl === 'menu') setOvl(d.ovl, true);
    if (d.ovl === 'show') applyTheme(store.get('theme') || 'system');
  });
  // Приложение сообщает свои клавиши, программа занимает их поверх игры и присылает нажатия
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.type !== 'pult-hotkeys') return;
    const id = (APPS.find((a) => frames[a.id] && frames[a.id].contentWindow === e.source) || {}).id;
    if (id) armHotkeys(id, e.data.keys);
  });
  $('opacityBox').hidden = false;
  $('opacityHomeWrap').hidden = false;
  if (store.get('bg') !== null) setBgAlpha(+store.get('bg'));
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', sendScheme);
  if (!OVERLAY) $('ovlBarBtn').hidden = false;
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
  if (menuOpen() && closeDept()) return 'ok';
  if (current && menuOpen()) { haptic('tap'); hideMenu(); return 'ok'; }
  if (current) { showMenu(); return 'ok'; }
  return 'exit';
};
// Кнопки громкости листают шаги Инженера
window.pultEngineer = (action) => appHotkey(action);
if (root.classList.contains('phone')) compact = true; // на телефоне расширенный режим не помещается

// ---------- Цветовая гамма ----------
// Цвета оболочки: меню, панель, оверлей, настройки. Приложения внутри сохраняют свои стили.
// c: фон, фон панели, поверхность, поверхность-2, линии, текст, приглушённый, бледный, акцент.
// mono — сектора меню и значки окрашиваются акцентом темы.
const THEMES = [
  { id: 'system', name: 'Системная', from: 'как в Windows' },
  { id: 'dark', name: 'Тёмная', from: 'Пульт', c: ['#12151b', '#191d25', '#20252f', '#2a303c', '#333a47', '#e6e9ef', '#98a1b3', '#677084', '#8eb4ff'] },
  { id: 'light', name: 'Светлая', from: 'Пульт', light: true, c: ['#e9ecf1', '#f4f6f9', '#ffffff', '#eef1f5', '#d3d9e2', '#1a1f29', '#5a6377', '#8a93a5', '#2f6fdc'] },
  { id: 'kpk', name: 'КПК', from: 'редактор персонажа', c: ['#131a24', '#19222e', '#202c3c', '#29384c', '#384e68', '#cfe0f2', '#8fa6bf', '#61758c', '#6f9fd8'] },
  { id: 'terminal', name: 'Терминал', from: 'редактор персонажа', mono: true, font: 'Consolas, "Courier New", monospace', c: ['#081008', '#0c170c', '#102010', '#162a16', '#1f5c1f', '#8ce694', '#5fb866', '#3d7d42', '#3fdc4f'] },
  { id: 'syndie', name: 'Синдикат', from: 'редактор персонажа', c: ['#1a0909', '#230d0d', '#2e1313', '#3b1919', '#5a2222', '#f0c9c9', '#c08f8f', '#8a5f5f', '#4caf50'] },
  { id: 'cat', name: 'Котик', from: 'редактор персонажа', c: ['#21140e', '#2a1a14', '#35221a', '#422c21', '#5a3c2c', '#efd6c4', '#c0a08a', '#8a6e5c', '#e08860'] },
  { id: 'synth', name: 'Синт', from: 'редактор персонажа', c: ['#120720', '#1a0a2e', '#24123d', '#2f1a4d', '#4a2a75', '#e0ccf5', '#a98fcf', '#75609a', '#e04090'] },
  { id: 'hotpink', name: 'Фуксия', from: 'редактор персонажа', c: ['#33133a', '#421a48', '#522259', '#632b6b', '#8a3d94', '#f2cef4', '#d39ad8', '#a46aab', '#e070ec'] },
  { id: 'hackerman', name: 'Хакер', from: 'редактор персонажа', mono: true, font: 'Consolas, "Courier New", monospace', c: ['#030703', '#071007', '#0b160b', '#102010', '#1d4a1d', '#00ff00', '#00c000', '#008a00', '#00ff00'] },
  { id: 'malfunction', name: 'Сбой', from: 'редактор персонажа', c: ['#132630', '#1b3443', '#213f52', '#2a4c62', '#355e78', '#dce7f0', '#9fb6c7', '#6e8799', '#e04848'] },
  { id: 'heretic', name: 'Еретик', from: 'редактор персонажа', c: ['#151310', '#1d1a16', '#27231d', '#312c24', '#4a3f30', '#e0d4cc', '#b0a088', '#7d705e', '#c94a4a'] },
  { id: 'wizard', name: 'Волшебник', from: 'редактор персонажа', c: ['#162b37', '#1d3746', '#244456', '#2c5166', '#3c6a82', '#d4e9f0', '#9cc0cf', '#6b8f9e', '#2cc5e6'] },
  { id: 'pact', name: 'Пакт', from: 'редактор персонажа', c: ['#0b0f24', '#131832', '#1a2142', '#222a53', '#313c72', '#d2daee', '#96a2c8', '#67729a', '#5c74ff'] },
  { id: 'abductor', name: 'Абдуктор', from: 'редактор персонажа', c: ['#1d2236', '#262c44', '#2f3653', '#384063', '#4c5680', '#ecd6e2', '#b8a4b8', '#857790', '#e0457a'] },
  { id: 'amber', name: 'Янтарь', from: 'редактор персонажа', c: ['#1c1300', '#261a02', '#302205', '#3c2b08', '#5c4210', '#ffe9c4', '#d6b47a', '#9c8050', '#ffb300'] },
  { id: 'ochre', name: 'Охра', from: 'редактор персонажа', c: ['#261803', '#311f08', '#3c280d', '#493112', '#6b4a1e', '#f2e2c8', '#c9ad85', '#94795a', '#e08a1e'] },
  { id: 'bluespace', name: 'Блюспейс', from: 'новая', c: ['#060a1c', '#0a112c', '#10193e', '#162252', '#24357a', '#dbe6ff', '#8fa5e0', '#5a6ca8', '#39c6ff'] },
  { id: 'plasma', name: 'Плазма', from: 'новая', c: ['#140919', '#1c0d23', '#26122f', '#31183d', '#52266a', '#f3d9ff', '#c08ad8', '#8a5ea0', '#c45cff'] },
  { id: 'supermatter', name: 'Суперматерия', from: 'новая', c: ['#17110a', '#1f170d', '#2a1f11', '#352816', '#5a4120', '#fff1d6', '#e3bd78', '#a3814a', '#ffcf3d'] },
  { id: 'cryo', name: 'Криостазис', from: 'новая', light: true, c: ['#e3eff6', '#eff7fb', '#ffffff', '#e6f1f7', '#bfd6e5', '#10283a', '#4a6a80', '#8aa4b5', '#1a8ccc'] },
  { id: 'paper', name: 'Бумага', from: 'новая', light: true, c: ['#e6dcc4', '#f0e7d2', '#faf5e8', '#ede3cb', '#cbbd99', '#2b2418', '#6b5d42', '#9c8d6c', '#9a5f17'] },
];
const THEME_VARS = ['--bg', '--bg2', '--surface', '--surface2', '--line', '--text', '--muted', '--faint', '--focus'];
let themeId = 'system';
function applyTheme(id) {
  const t = THEMES.find((x) => x.id === id) || THEMES[0];
  themeId = t.id;
  THEME_VARS.forEach((v, i) => { if (t.c) root.style.setProperty(v, t.c[i]); else root.style.removeProperty(v); });
  if (t.c) {
    root.style.setProperty('color-scheme', t.light ? 'light' : 'dark');
    root.style.setProperty('--shadow', t.light ? '0 18px 50px rgba(20, 30, 50, .18)' : '0 18px 50px rgba(0, 0, 0, .45)');
  } else { root.style.removeProperty('color-scheme'); root.style.removeProperty('--shadow'); }
  if (t.font) root.style.setProperty('--font', t.font); else root.style.removeProperty('--font');
  root.toggleAttribute('data-mono', !!t.mono);
  root.dataset.theme = t.id;
  sendScheme();
  document.querySelectorAll('.theme[data-theme]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.theme === t.id ? 'true' : 'false'));
}
function sendScheme() {
  if (OVERLAY) return;
  const t = THEMES.find((x) => x.id === themeId) || THEMES[0];
  const darkOs = matchMedia('(prefers-color-scheme: dark)').matches;
  send('theme:' + (t.c ? (t.light ? 'light' : 'dark') : (darkOs ? 'dark' : 'light')));
}

// ---------- Настройки (⚙ справа снизу) ----------
const settingsOpen = () => !$('settings').hidden;
let setTab = store.get('setTab') === 'keys' ? 'keys' : 'look';
function toggleSettings(on) {
  if (OVERLAY) return;
  on = on === undefined ? !settingsOpen() : on;
  if (!on) endCapture();
  $('settings').hidden = !on;
  $('gearBtn').setAttribute('aria-expanded', on ? 'true' : 'false');
  if (on) { renderSettings(); haptic('tap'); }
  else focusApp();
}
function renderSettings() {
  const el = $('settings');
  el.innerHTML = `<div class="setbox" role="dialog" aria-label="Настройки">
    <header class="sethead"><h2>Настройки</h2>
      <nav class="settabs" role="tablist">
        <button role="tab" data-tab="look" aria-selected="${setTab === 'look'}">Оформление</button>
        <button role="tab" data-tab="keys" aria-selected="${setTab === 'keys'}">Клавиши</button>
      </nav><span class="grow"></span>
      <button class="ibtn" id="setClose" title="Закрыть (Esc)" aria-label="Закрыть">${svg('close')}</button>
    </header>
    <div class="setbody" id="setBody"></div></div>`;
  el.querySelector('.settabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    endCapture();
    setTab = b.dataset.tab; store.set('setTab', setTab);
    el.querySelectorAll('.settabs button').forEach((x) => x.setAttribute('aria-selected', x === b ? 'true' : 'false'));
    renderPane();
  });
  $('setClose').addEventListener('click', () => toggleSettings(false));
  renderPane();
}
function renderPane() { if (setTab === 'keys') renderKeys(); else renderLook(); }
// Щелчок по затемнению вокруг окна настроек закрывает их
$('settings').addEventListener('click', (e) => { if (e.target === $('settings')) toggleSettings(false); });

function renderLook() {
  const body = $('setBody');
  if (!body) return;
  const card = (t) => {
    const c = t.c || THEMES[1].c;
    const st = `--tb:${c[0]};--tb2:${c[1]};--ts:${c[3]};--ts2:${c[4]};--tl:${c[4]};--tt:${c[5]};--tm:${c[6]};--tf:${c[8]}` + (t.font ? `;--tfont:${t.font}` : '');
    return `<button class="theme" data-theme="${t.id}" aria-pressed="${t.id === themeId}" style='${st}'>` +
      `<span class="tprev${t.c ? '' : ' split'}"><i></i><i></i><i></i></span><b>${t.name}</b><small>${t.from}</small></button>`;
  };
  body.innerHTML = `<h3>Цветовая гамма</h3>
    <p class="hint">Меняет цвета Пульта: меню, панель, оверлей и настройки. Приложения внутри сохраняют свои цвета.
    Темы из редактора персонажа — те же, что у окон TGUI в игре.</p>
    <div class="themes">${THEMES.map(card).join('')}</div>`;
  body.querySelector('.themes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-theme]');
    if (!b) return;
    store.set('theme', b.dataset.theme);
    applyTheme(b.dataset.theme);
    haptic('tap');
  });
}

// Все назначенные клавиши — для подсветки повторов
function allBindings() {
  const out = [];
  HK.glob.forEach(([k, label]) => out.push({ g: 'glob', k, label: label + ' (поверх игры)' }));
  APPS.forEach((a) => { if (!hkRow('glob', 'app:' + a.id)) out.push({ g: 'glob', k: 'app:' + a.id, label: a.name + ' (поверх игры)' }); });
  HK.slide.forEach(([k, label]) => out.push({ g: 'slide', k, label }));
  HK.win.forEach(([k, label]) => out.push({ g: 'win', k, label }));
  APPS.forEach((a) => out.push({ g: 'app', k: a.id, label: a.name }));
  out.forEach((b) => { b.v = normCombo(hkGet(b.g, b.k)); });
  return out;
}
function renderKeys() {
  const body = $('setBody');
  if (!body || setTab !== 'keys') return;
  const all = allBindings();
  const field = (g, k, placeholder) => {
    const v = hkGet(g, k), n = normCombo(v);
    const dups = n ? all.filter((b) => b.v === n && !(b.g === g && b.k === k)) : [];
    const fail = g === 'glob' && v && globalFailed.has(k);
    const cap = capturing && capturing.g === g && capturing.k === k;
    const custom = hkCfg[g] && typeof hkCfg[g][k] === 'string';
    let cls = 'kbtn', title = 'Нажмите, чтобы назначить клавишу';
    if (cap) cls += ' capture';
    else if (!v) cls += ' empty';
    if (fail) { cls += ' fail'; title = 'Не удалось занять: клавишу держит другая программа'; }
    else if (dups.length) { cls += ' dup'; title = 'Эта же клавиша: ' + dups.map((d) => d.label).join(', '); }
    const text = cap ? 'Нажмите сочетание… (Esc — отмена)' : v || placeholder || 'нет';
    return `<span class="kf"><button class="${cls}" data-g="${g}" data-k="${k}" title="${title}">${text.replace(/</g, '&lt;')}</button>` +
      `<button class="kx" data-clear="${g}|${k}" title="Убрать клавишу" ${v ? '' : 'disabled'}>✕</button>` +
      `<button class="kx" data-reset="${g}|${k}" title="Вернуть по умолчанию${hkDefault(g, k) ? ': ' + hkDefault(g, k) : ''}" ${custom ? '' : 'disabled'}>↺</button></span>`;
  };
  const row = (name, ...fields) => `<div class="krow"><span class="kname">${name}</span>${fields.join('')}</div>`;
  const appName = (a, extra = '') => `<span style="--c:${a.color}">${svg(a.icon)}</span>${a.name}${extra}`;
  const offNote = host ? '' : `<span class="keys-off">Клавиши поверх игры работают только в Пульт.exe — здесь их можно настроить заранее.</span>`;
  let h = `<h3>Поверх игры</h3><p class="hint">Работают, даже когда активна игра. Пока Пульт запущен, эти сочетания не доходят до других программ.
    Клавиша панели выводит Пульт с этим приложением, повторное нажатие сворачивает его в оверлей.</p>${offNote}`;
  h += HK.glob.map(([k, label, , app]) => {
    const a = byId[app];
    return row(a ? `<span style="--c:${a.color}">${svg(a.icon)}</span>${label}<small>${a.name}</small>` : label, field('glob', k));
  }).join('');
  h += `<h3>Шаги и слайды</h3><p class="hint">Листают шаги Инженера, Робототехника и оверлея Алхимика поверх игры. Пусто — клавиши самого приложения
    (у Инженера — из guides.json). Работают, пока приложение занимает клавиши.</p>`;
  h += HK.slide.map(([k, label, def]) => row(label, field('slide', k, def + ' — из приложения'))).join('');
  h += `<h3>В окне Пульта</h3><p class="hint">Действуют, когда активно окно Пульта.</p>`;
  h += HK.win.map(([k, label]) => row(label, field('win', k))).join('');
  h += `<h3>Приложения</h3><p class="hint">«В окне» — открыть приложение, пока активен Пульт. «Поверх игры» — вывести Пульт с приложением из игры.</p>`;
  h += `<div class="khead"><span></span><span>В окне</span><span>Поверх игры</span></div>`;
  h += APPS.map((a) => row(appName(a), field('app', a.id), field('glob', 'app:' + a.id))).join('');
  h += `<p class="kwarn" id="kwarn" hidden></p><div class="setfoot"><button id="kreset">Сбросить все клавиши</button></div>`;
  const top = body.scrollTop;
  body.innerHTML = h;
  body.scrollTop = top;
  body.onclick = (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.g) { if (capturing && capturing.g === b.dataset.g && capturing.k === b.dataset.k) endCapture(); else startCapture(b.dataset.g, b.dataset.k); }
    else if (b.dataset.clear) { const [g, k] = b.dataset.clear.split('|'); endCapture(true); hkSet(g, k, ''); }
    else if (b.dataset.reset) { const [g, k] = b.dataset.reset.split('|'); endCapture(true); hkSet(g, k, null); }
    else if (b.id === 'kreset') { endCapture(true); hkCfg = {}; store.set('keys', '{}'); applyKeys(); }
  };
}
function keyWarn(text, bad) {
  const w = $('kwarn');
  if (!w) return;
  w.hidden = !text; w.textContent = text || ''; w.classList.toggle('bad', !!bad);
}
// Пока ждём нажатия, Пульт.exe отпускает все свои клавиши — иначе занятое сочетание не дошло бы до страницы
function startCapture(g, k) {
  capturing = { g, k };
  pushGlobalKeys(); pushHotkeys();
  renderKeys();
  keyWarn('');
}
function endCapture(quiet) {
  if (!capturing) return;
  capturing = null;
  pushGlobalKeys(); pushHotkeys();
  if (!quiet) renderKeys();
}
function captureKey(e) {
  e.preventDefault(); e.stopPropagation();
  if (e.type !== 'keydown' || e.repeat) return;
  const { g, k } = capturing;
  if (e.key === 'Escape') { endCapture(); return; }
  if ((e.key === 'Backspace' || e.key === 'Delete') && !e.ctrlKey && !e.altKey && !e.shiftKey) { capturing = null; hkSet(g, k, ''); return; }
  const combo = comboOf(e);
  if (!combo) return; // пока зажаты только Ctrl/Alt/Shift
  if (needsMod(combo)) { keyWarn('Буквы, цифры и знаки — только вместе с Ctrl или Alt, иначе они перестанут печататься.', true); return; }
  capturing = null;
  hkSet(g, k, combo);
  const dup = allBindings().filter((b) => b.v === normCombo(combo) && !(b.g === g && b.k === k));
  keyWarn(dup.length ? 'Это сочетание уже назначено: ' + dup.map((d) => d.label).join(', ') + '.' : '');
}

$('gearBtn').innerHTML = svg('gear');
$('gearBtn').addEventListener('click', () => toggleSettings());
$('ovlBarBtn').innerHTML = svg('bubble');
$('ovlBarBtn').addEventListener('click', () => goOverlay());

// ---------- Оверлей ----------
// В главном окне — свернуться в кнопку; в окне оверлея — кнопка и меню, Пульт.exe меняет размер окна по состоянию.
function goOverlay() { if (host && !OVERLAY) send('overlay:on'); }
let ovlState = 'button';
function setOvl(state, fromHost) {
  if (!OVERLAY) return;
  ovlState = state;
  if (!fromHost) send('ovl:' + state);
  root.classList.toggle('ovl-menu', state === 'menu');
  if (state === 'menu') {
    home.classList.remove('closed');
    closeDept(true);
    introAnim();
  } else closeDept(true);
}
// Тянуть — переместить окно оверлея (его двигает Пульт.exe, пока зажата кнопка мыши), просто нажать — щелчок
function dragHandle(el) {
  if (!el) return;
  let start = null, moved = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || (e.target.closest('button') && e.target.closest('button') !== el)) return;
    start = [e.screenX, e.screenY]; moved = false;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* нет захвата */ }
  });
  el.addEventListener('pointermove', (e) => {
    if (!start || moved || Math.hypot(e.screenX - start[0], e.screenY - start[1]) < 4) return;
    moved = true;
    send('ovl:drag');
  });
  const up = () => { start = null; };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('click', (e) => { if (moved) { moved = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);
}

applyTheme(store.get('theme') || 'system');
buildRadial();
buildSwitch();
if (OVERLAY) {
  compact = true;
  const b = $('ovlBtn');
  b.innerHTML = `<svg viewBox="-12 -12 24 24" aria-hidden="true">${logoArcs(9.5, 3.4)}</svg>`;
  dragHandle(b);
  b.addEventListener('click', () => setOvl('menu'));
  b.addEventListener('contextmenu', (e) => { e.preventDefault(); send('ovl:context'); });
  home.classList.remove('closed');
  applyKeys();
  send('hello');
} else {
  setMode(compact, true);
  applyKeys();
  send('hello');
  showMenu();
}

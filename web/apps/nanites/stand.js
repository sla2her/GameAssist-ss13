'use strict';
/* Стенд нанитов: поле с программами-блоками, коды — провода, живая симуляция носителя.
   Подключается до основного скрипта index.html и пользуется его общими данными (S, byId, FX, ru…) при вызове.
   Механика тика — по code/datums/components/nanites.dm и nanite_programs.dm: раз в секунду +рост, затем каждая
   программа по порядку: таймеры → условие и правила → трата расхода (не ниже порога безопасности) → эффект. */

const ST = { built: false, sel: 0, pane: 'board', run: false, speed: 1, timer: 0, drag: null, nodes: {} };
const FIELDS = [['act', 'Вкл', '#3fae6b'], ['deact', 'Выкл', '#8b92a1'], ['trig', 'Сработать', '#e2a33a'], ['kill', 'Удалить', '#d64550']];
const SENDF = (p) => (p.set.some((s) => s.name === 'Sent Code') ? 'Sent Code' : p.set.some((s) => s.name === 'Nanite Code') ? 'Nanite Code' : '');
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const prob = (x) => Math.random() * 100 < x;

/* ===================== СИМУЛЯЦИЯ ===================== */
let SIM = null;
function newHost() {
  return { brute: 0, burn: 0, tox: 0, oxy: 0, brain: 0, blood: 560, wounds: 0, temp: 310, nutr: 400, stamina: 0,
    dead: false, sleep: 0, stun: 0, heart: true, synth: false, said: '' };
}
function newSim() {
  SIM = { t: 0, vol: 100, max: BASEMAX, safety: SAFETY, regen: REGEN, cloud: true, nextSync: 30, gone: false,
    H: Object.assign(newHost(), { synth: !!(SIM && SIM.H.synth) }), st: {}, timers: [], log: [], hist: [], flash: {} };
  syncSim(true);
  log('Наниты внедрены камерой: 100 ед., облако подключено.', 'ok');
}
const hp = (H) => 100 - H.brute - H.burn - H.tox - H.oxy;
const crit = (H) => !H.dead && hp(H) <= 0;

// Программы стенда = первые 20 из сборки; уникальная вторая копия заменяет первую
function liveList() {
  const seen = {}, out = [];
  S.build.slice(0, MAXP).forEach((b) => { const p = byId[b.id]; if (p.unique && seen[b.id]) return; seen[b.id] = 1; out.push(b); });
  return out;
}
function syncSim(fresh) {
  const keep = {};
  liveList().forEach((b) => {
    let s = SIM.st[b.uid];
    if (!s || fresh) {
      s = { uid: b.uid, on: false, nextTrig: 0, tRestart: 0, tShutdown: 0, tTrig: 0, tDelay: 0, passive: false, spent: false,
        factory: 0, deleted: false, rogue: '', wiped: false, status: '', lastUse: 0 };
      if (b.on) activate(s, b); else deactivate(s, b);
      if (b.tt) s.tTrig = SIM.t + b.tt;
    }
    keep[b.uid] = s;
  });
  SIM.st = keep;
}
const bOf = (s) => instById(s.uid);
const pOf = (s) => byId[s.rogue || bOf(s).id];
const code = (s, f) => (s.wiped || s.rogue ? 0 : +bOf(s)[f] || 0);
const setv = (s, name) => { const b = bOf(s); return b.set[name]; };
function activate(s, b) { s.on = true; if (b.ts) s.tShutdown = SIM.t + b.ts; }
function deactivate(s, b) { if (s.passive) passiveOff(s); s.on = false; if (b.tr) s.tRestart = SIM.t + b.tr; }
function log(t, k) { SIM.log.unshift({ t: SIM.t, m: t, k: k || '' }); if (SIM.log.length > 200) SIM.log.length = 200; }
const nm = (s) => ru(pOf(s));
function later(sec, fn) { SIM.timers.push({ at: SIM.t + sec, fn }); }
function flash(uid) { SIM.flash[uid] = 3; }

function adjust(a) {
  if (SIM.gone) return;
  SIM.vol = Math.max(0, SIM.vol + a);
  if (SIM.vol > SIM.max) {
    const ex = SIM.vol - SIM.max; SIM.vol = SIM.max;
    if (ex > 350) log(`Перебор на ${Math.round(ex)}: поток серой жижи из глаз, ушей и рта, паралич 12 с.`, 'bad');
    else if (ex > 100) log(`Перебор на ${Math.round(ex)}: носителя рвёт серой массой.`, 'warn');
    else if (ex > 25) log(`Перебор на ${Math.round(ex)}: из кожи сочится серая жижа.`, 'warn');
  }
  if (SIM.vol <= 0) { SIM.gone = true; log('Запас нанитов кончился — наниты исчезли вместе с программами.', 'bad'); }
}
function consume(a) { if (SIM.vol - a < SIM.safety) return false; adjust(-a); return !SIM.gone; }

function rulesOK(b) {
  if (!b.rules.length) return true;
  const H = SIM.H, pct = hp(H), vp = (SIM.vol - SIM.safety) / (SIM.max - SIM.safety) * 100;
  const dmg = { brute: H.brute, fire: H.burn, tox: H.tox, oxy: H.oxy, clone: 0, stamina: H.stamina };
  const one = (r) => r.t === 'health' ? (r.above ? pct >= r.pct : pct < r.pct) : r.t === 'crit' ? crit(H) : r.t === 'death' ? H.dead
    : r.t === 'volume' ? (r.above ? vp >= r.pct : vp < r.pct) : (r.above ? dmg[r.dtype] >= r.amt : dmg[r.dtype] < r.amt);
  return b.all ? b.rules.every(one) : b.rules.some(one);
}
// Условие самой программы (check_conditions без правил): false — наниты не тратятся
function progCond(id, s) {
  const H = SIM.H, v = SIM.vol, m = SIM.max;
  switch (id) {
    case 'regenerative': return !H.synth && (H.brute > 0 || H.burn > 0);
    case 'repairing': return H.synth && (H.brute > 0 || H.burn > 0);
    case 'purging': case 'purging_advanced': return !H.synth && H.tox > 0;
    case 'purging_synth': return H.synth && H.tox > 0;
    case 'blood_restoring': return H.blood < 475;
    case 'brain_heal': case 'brain_heal_advanced': return H.brain > 0;
    case 'temperature': return Math.abs(H.temp - 310) > 30;
    case 'heal_wounds': return H.wounds > 0;
    case 'metabolic_synthesis': return H.nutr > 350;
    case 'cryo': return H.temp > 70;
    case 'protocol/kickstart': return SIM.t < 120;
    case 'protocol/pyramid': return v / m >= 0.8;
    case 'protocol/offline': return H.sleep > 0 || H.dead || crit(H);
    case 'hard_reboot': return H.synth;
    default: return true;
  }
}
function protoBlocked(s) {
  const p = pOf(s); if (!p.proto) return false;
  return Object.values(SIM.st).some((o) => o !== s && !o.deleted && o.on && pOf(o).proto === p.proto && order(o) < order(s));
}
const order = (s) => S.build.findIndex((b) => b.uid === s.uid);
function heal(k, a) { SIM.H[k] = Math.max(0, SIM.H[k] - a); }
function effect(s) {
  const H = SIM.H, id = pOf(s).id;
  switch (id) {
    case 'regenerative': heal('brute', 0.5); heal('burn', 0.5); break;
    case 'regenerative_advanced': if (!H.synth) { heal('brute', 3); heal('burn', 3); } break;
    case 'repairing': heal('brute', 1.5); heal('burn', 1.5); break;
    case 'purging': case 'purging_advanced': case 'purging_synth': heal('tox', 1); break;
    case 'blood_restoring': H.blood = Math.min(560, H.blood + 2); break;
    case 'brain_heal': heal('brain', 1); break;
    case 'brain_heal_advanced': heal('brain', 2); break;
    case 'temperature': H.temp += H.temp > 310 ? -Math.min(20, H.temp - 310) : Math.min(20, 310 - H.temp); break;
    case 'heal_wounds': if (prob(20)) { H.wounds--; log('Заживление ран: одна рана затянулась.', 'ok'); } break;
    case 'metabolic_synthesis': H.nutr -= 0.5; adjust(0.5); break;
    case 'mitosis': adjust(Math.round(SIM.vol / 50) * 0.5); if (prob(Math.round(SIM.vol / 50) * 0.5)) randomError(s, 'Митоз'); break;
    case 'aggressive_replication': { const r = Math.round(SIM.vol / 50 * 10) / 10; adjust(r); H.brute += r / 3; break; }
    case 'protocol/kickstart': adjust(3.5); break;
    case 'protocol/factory': s.factory = Math.min(1000, s.factory + 1); adjust(Math.round(0.002 * s.factory * 10) / 10); break;
    case 'protocol/pyramid': adjust(1.2); break;
    case 'protocol/offline': adjust(3); break;
    case 'protocol/synergy': adjust(Math.round(2 * SIM.vol / SIM.max * 10) / 10); break;
    case 'protocol/free_range': adjust(0.5); break;
    case 'protocol/unsafe_storage': if (SIM.vol > 500 && prob(10)) { H.tox += SIM.vol > 1500 ? 0.5 : 0; H.brute += SIM.vol > 1750 ? 0.75 : 0; } break;
    case 'flesh_eating': H.brute += 1; break;
    case 'poison': H.tox += 1; break;
    case 'meltdown': H.burn += 3.5; break;
    case 'pyro': H.burn += 1.5; break;
    case 'cryo': H.temp = Math.max(50, H.temp - rnd(15, 25)); break;
    case 'paralyzing': H.stun = Math.max(H.stun, 4); break;
    case 'memory_leak': if (prob(6)) randomError(null, 'Утечка памяти', s); break;
    case 'necrotic': H.brute += 0.75; break;
    case 'toxic': H.tox += 0.5; break;
    case 'suffocating': H.oxy += 3; break;
    case 'brain_decay': H.brain += 1; break;
    case 'skin_decay': H.brute += 0.25; break;
    case 'research': SIM.points = (SIM.points || 0) + 1; break;
    case 'researchplus': SIM.points = (SIM.points || 0) + Math.round(1 / 12 * 10) / 10; break;
    default:
      if (id.startsWith('sensor/')) sensorTick(s, id);
  }
}
function passiveOn(s) {
  s.passive = true; const id = pOf(s).id;
  if (id === 'meltdown') { SIM.safety = 0; log('Расплав: «Кровь горит!» Порог безопасности сброшен в 0.', 'bad'); }
  const m = (FX[id] || {}).max; if (m && pOf(s).proto === 'sto') { SIM.max = Math.max(1, SIM.max + m); adjust(0); }
}
function passiveOff(s) {
  s.passive = false; const id = pOf(s).id;
  const m = (FX[id] || {}).max; if (m && pOf(s).proto === 'sto') SIM.max = Math.max(1, SIM.max - m);
}
function sensorTick(s, id) {
  const H = SIM.H, b = bOf(s); let hit = false;
  const above = (v, thr) => (setv(s, 'Direction') ? v >= thr : v < thr);
  if (id === 'sensor/health') hit = above(hp(H), +setv(s, 'Health Percent'));
  else if (id === 'sensor/crit') hit = crit(H);
  else if (id === 'sensor/nanite_volume') hit = above((SIM.vol - SIM.safety) / (SIM.max - SIM.safety) * 100, +setv(s, 'Nanite Percent'));
  else if (id === 'sensor/damage') { const k = { brute: 'brute', fire: 'burn', tox: 'tox', oxy: 'oxy', stamina: 'stamina' }[setv(s, 'Damage Type')]; hit = above(k ? H[k] : 0, +setv(s, 'Damage')); }
  else return;
  if (hit) { if (!s.spent) { s.spent = true; sendFrom(s); } } else s.spent = false;
  void b;
}
function sendFrom(s, viaRelay) {
  const f = SENDF(pOf(s)); if (!f || !s.on) return;
  const c = +setv(s, f) || 0; if (!c) return;
  flash(s.uid);
  if (viaRelay) {
    const ch = +setv(s, 'Relay Channel');
    const ok = Object.values(SIM.st).some((o) => !o.deleted && o.on && pOf(o).id === 'relay' && +setv(o, 'Relay Channel') === ch);
    if (!ok) { log(`${nm(s)}: код ${c} ушёл на канал ${ch}, но Ретранслятора на нём у носителя нет.`, 'warn'); return; }
  }
  signal(c, nm(s));
}
function signal(c, src) {
  if (SIM.gone || !c) return;
  const hits = [];
  Object.values(SIM.st).forEach((s) => {
    if (s.deleted) return; const b = bOf(s), p = pOf(s);
    if (code(s, 'act') === c && !s.on) { activate(s, b); hits.push(nm(s) + ' — вкл'); flash(s.uid); }
    else if (code(s, 'deact') === c && s.on) { deactivate(s, b); hits.push(nm(s) + ' — выкл'); flash(s.uid); }
    if (p.trig && code(s, 'trig') === c) { const r = trigger(s); hits.push(nm(s) + ' — ' + (r || 'сработала')); flash(s.uid); }
    if (code(s, 'kill') === c) { s.deleted = true; if (s.passive) passiveOff(s); hits.push(nm(s) + ' — удалена'); flash(s.uid); }
  });
  log(`${src} → код ${c}: ${hits.length ? hits.join(', ') : 'никто не ответил'}`, hits.length ? 'sig' : 'warn');
}
function cond(s) { return rulesOK(bOf(s)) && progCond(pOf(s).id, s) && !protoBlocked(s); }
// trigger(): строка-причина, если не сработала, иначе ''
function trigger(s, delayed) {
  const p = pOf(s), b = bOf(s);
  if (!p.trig) return 'не умеет срабатывать';
  if (!s.on) return 'выключена';
  if (b.td && !delayed) { s.tDelay = SIM.t + b.td; return `сработает через ${b.td} с`; }
  if (SIM.t < s.nextTrig) return `перезарядка ${Math.ceil(s.nextTrig - SIM.t)} с`;
  if (!cond(s)) return 'условие не выполнено';
  if (!consume(p.tcost)) return 'мало нанитов';
  s.nextTrig = SIM.t + p.tcd; flash(s.uid);
  onTrigger(s, p.id);
  return '';
}
function revive(how) {
  const H = SIM.H;
  if (!H.dead) { log(`${how}: носитель жив, разряд впустую.`, 'warn'); return; }
  if (H.brute + H.burn + H.tox >= 200) { log(`${how}: тело слишком повреждено (раны+ожоги+токсины ≥ 200) — не оживить.`, 'bad'); return; }
  H.dead = false; H.heart = true;
  if (hp(H) < -30) H.oxy = Math.max(0, H.oxy + hp(H) + 30);
  log(`${how}: носитель ожил! Здоровье ${Math.round(hp(H))}.`, 'ok');
}
function onTrigger(s, id) {
  const H = SIM.H;
  switch (id) {
    case 'defib': log('Дефибрилляция: заряд… разряд через 8 с.', 'sig'); later(8, () => revive('Дефибрилляция')); break;
    case 'hard_reboot': log('Перезагрузка позитронного мозга через 5 с.', 'sig'); later(5, () => { H.oxy = Math.max(0, H.oxy - 50); revive('Жёсткая перезагрузка'); }); break;
    case 'adrenaline': H.stun = 0; H.sleep = 0; H.stamina = 0; log('Выброс адреналина: оглушение снято, ускорение.', 'ok'); break;
    case 'self_scan': log(`Самоскан: здоровье ${Math.round(hp(H))}, раны ${fmt(H.brute)}, ожоги ${fmt(H.burn)}, токсины ${fmt(H.tox)}, кислород ${fmt(H.oxy)}, нанитов ${Math.round(SIM.vol)}/${SIM.max}.`); break;
    case 'access': log('Подкожная ID: доступы скопированы с карты.'); break;
    case 'sensor/repeat': { const d = +setv(s, 'Delay') || 0; log(`Повторитель: код ${setv(s, 'Sent Code')} через ${d} с.`); later(d, () => sendFrom(s)); break; }
    case 'sensor/relay_repeat': { const d = +setv(s, 'Delay') || 0; later(d, () => sendFrom(s, true)); break; }
    case 'emp': log('ЭМ-резонанс: импульс радиусом 3.', 'warn'); emp(s); break;
    case 'shocking': log('Удар током от нанитов.', 'warn'); shock(s); break;
    case 'stun': H.stun = Math.max(H.stun, 8); log('Нейрошок: носитель сбит с ног на 8 с.', 'warn'); break;
    case 'sleepy': { const d = rint(6, 20); log(`Индукция сна: сонливость, уснёт через ${d} с.`); later(d, () => { H.sleep = 20; log('Носитель уснул на 20 с.'); }); break; }
    case 'heart_stop': H.heart = !H.heart; log(H.heart ? 'Сердце снова бьётся.' : 'Сердце остановлено!', H.heart ? 'ok' : 'bad'); break;
    case 'explosive': { const d = Math.min(15, Math.max(2.5, SIM.vol * 0.035)); log(`Цепная детонация: носитель светится и жужжит… взрыв через ${fmt(d)} с!`, 'bad');
      later(Math.round(d), () => { const v = SIM.vol; log(`БУМ: тяжёлый радиус ${Math.max(0, Math.floor(v / 100) - 1)}, лёгкий ${Math.max(0, Math.floor(v / 50) - 1)}.`, 'bad'); SIM.H.brute += 150; SIM.vol = 0; SIM.gone = true; }); break; }
    case 'comm/speech': log(`Носитель говорит: «${setv(s, 'Sentence') || '…'}»`); break;
    case 'comm/voice': log(`Голос в голове: «${setv(s, 'Message') || '…'}»`); break;
    case 'comm/hallucination': log(`Галлюцинация: ${setv(s, 'Hallucination Type')}.`); break;
    case 'comm/mind_control': log(`Директива на 1 мин: «${setv(s, 'Directive')}».`, 'warn'); break;
    case 'nanite_sting': adjust(5); log('Жало: рядом нет цели без нанитов — стоимость вернулась.'); break;
    case 'signaler': log(`Сигнальщик: радиосигнал ${fmt(setv(s, 'Frequency') / 10)} / код ${setv(s, 'Radio Code')}.`); break;
    default: log(`${nm(s)} сработала.`);
  }
}
const ROGUE_RU = ['удалена', 'коды сброшены', 'переключилась', 'сработала', 'стала сбойной'];
function randomError(s, why, except) {
  if (!s) { const all = Object.values(SIM.st).filter((o) => !o.deleted && o !== except); if (!all.length) return; s = all[rint(0, all.length - 1)]; }
  const p = pOf(s), type = rint(1, 5), was = nm(s); flash(s.uid);
  if (type === 1) { s.deleted = true; if (s.passive) passiveOff(s); }
  else if (type === 2) s.wiped = true;
  else if (type === 3) { if (s.on) deactivate(s, bOf(s)); else activate(s, bOf(s)); }
  else if (type === 4) { if (p.trig) trigger(s); }
  else { if (s.passive) passiveOff(s); const r = p.rogue[rint(0, p.rogue.length - 1)]; if (r) { s.rogue = r; s.on = true; } }
  log(`Сбой (${why}): ${was} — ${ROGUE_RU[type - 1]}${type === 5 && s.rogue ? ' → ' + nm(s) : ''}.`, 'bad');
}
function emp(src) {
  const sev = 50, loss = sev / 100 * (rnd(0.3, 0.35) * SIM.vol) + rint(20, 35);
  adjust(-loss); log(`ЭМИ: −${Math.round(loss)} нанитов.`, 'bad');
  if (prob(sev * 0.25) && SIM.cloud) { SIM.cloud = false; log('ЭМИ сбросил ID облака — наниты больше не синхронизируются.', 'bad'); }
  Object.values(SIM.st).forEach((s) => {
    if (s.deleted || s === src) return;
    if (pOf(s).id === 'protocol/factory') s.factory = Math.max(0, s.factory - 300);
    if (!pOf(s).emp && prob(sev / 2)) randomError(s, 'ЭМИ');
  });
}
function shock(src, minor) {
  if (minor) { const l = rint(5, 15); adjust(-l); log(`Лёгкий разряд: −${l} нанитов.`, 'warn'); Object.values(SIM.st).forEach((s) => { if (!s.deleted && !pOf(s).shock && prob(10)) randomError(s, 'разряд'); }); return; }
  const cond = Object.values(SIM.st).some((s) => !s.deleted && s.passive && pOf(s).id === 'conductive');
  if (!cond) SIM.H.burn += 15;
  const loss = rnd(0.2, 0.25) * SIM.vol + rint(25, 45); adjust(-loss);
  log(`Удар током: ${cond ? 'носитель не пострадал (Электропроводность), но ' : 'ожоги +15, '}−${Math.round(loss)} нанитов.`, 'bad');
  Object.values(SIM.st).forEach((s) => {
    if (s.deleted || s === src || pOf(s).shock) return;
    if (prob(10)) randomError(s, 'ток'); else if (prob(33)) { s.deleted = true; if (s.passive) passiveOff(s); log(`Ток стёр программу: ${nm(s)}.`, 'bad'); flash(s.uid); }
  });
}
function die() {
  const H = SIM.H; H.dead = true; H.heart = false; log('Носитель умер.', 'bad');
  Object.values(SIM.st).forEach((s) => { if (!s.deleted && pOf(s).id === 'sensor/death') sendFrom(s); });
}
function tick() {
  if (SIM.gone) { SIM.t++; SIM.hist.push(0); return; }
  const H = SIM.H; SIM.t++;
  adjust(SIM.regen);
  // Носитель
  if (crit(H)) H.oxy += 1;
  if (!H.heart && !H.dead) H.oxy += 2;
  if (!H.dead && hp(H) <= -100) die();
  if (H.sleep > 0) H.sleep--; if (H.stun > 0) H.stun--;
  if (H.stamina > 0) H.stamina = Math.max(0, H.stamina - 3);
  if (!H.dead) H.nutr = Math.max(0, H.nutr - 0.1);
  // Программы по порядку
  liveList().forEach((b) => {
    const s = SIM.st[b.uid]; if (!s || s.deleted || SIM.gone) return;
    const p = pOf(s); s.lastUse = 0;
    if (!s.on) { if (s.tRestart && SIM.t >= s.tRestart) { s.tRestart = 0; activate(s, b); log(`${nm(s)}: таймер перезапуска — включена.`); } s.status = 'off'; return; }
    if (s.tShutdown && SIM.t >= s.tShutdown) { s.tShutdown = 0; deactivate(s, b); log(`${nm(s)}: таймер отключения — выключена.`); s.status = 'off'; return; }
    if (p.trig && b.tt && !s.rogue && SIM.t >= s.tTrig) { s.tTrig = SIM.t + b.tt; const r = trigger(s); if (r) log(`${nm(s)}: повтор срабатывания — ${r}.`, 'warn'); return; }
    if (s.tDelay && SIM.t >= s.tDelay) { s.tDelay = 0; const r = trigger(s, true); if (r) log(`${nm(s)}: отложенное срабатывание — ${r}.`, 'warn'); return; }
    const c = cond(s);
    if (c && consume(p.use)) { if (!s.passive) passiveOn(s); s.lastUse = p.use; effect(s); s.status = 'on'; }
    else { if (s.passive) passiveOff(s); s.status = !c ? (protoBlocked(s) ? 'proto' : 'idle') : 'low'; }
  });
  // Облако
  if (SIM.t >= SIM.nextSync) {
    SIM.nextSync = SIM.t + 30;
    const broken = Object.values(SIM.st).filter((s) => s.deleted || s.rogue || s.wiped);
    if (SIM.cloud) {
      if (broken.length) { broken.forEach((s) => { if (s.passive) passiveOff(s); s.deleted = false; s.rogue = ''; s.wiped = false; flash(s.uid); });
        log(`Синхронизация с облаком: восстановлено ${broken.length} пр.`, 'ok'); }
    } else if (prob(8)) randomError(null, 'нет облака');
  }
  // Отложенные действия
  const due = SIM.timers.filter((x) => x.at <= SIM.t); SIM.timers = SIM.timers.filter((x) => x.at > SIM.t);
  due.forEach((x) => x.fn());
  Object.keys(SIM.flash).forEach((k) => { if (--SIM.flash[k] <= 0) delete SIM.flash[k]; });
  SIM.hist.push(SIM.vol); if (SIM.hist.length > 300) SIM.hist.shift();
}

/* ===================== СОБЫТИЯ НОСИТЕЛЯ ===================== */
const EVENTS = [
  ['Ранить', 'brute', () => { SIM.H.brute += 25; SIM.H.wounds++; return 'Носителя ранили: +25 механических, рана.'; }],
  ['Обжечь', 'burn', () => { SIM.H.burn += 25; return 'Ожог: +25.'; }],
  ['Отравить', 'tox', () => { SIM.H.tox += 20; return 'Отравление: +20 токсинов.'; }],
  ['Душить', 'oxy', () => { SIM.H.oxy += 30; return 'Удушье: +30 кислородного.'; }],
  ['Мозг', 'brain', () => { SIM.H.brain += 30; return 'Травма головы: +30 урона мозга.'; }],
  ['Кровопотеря', 'blood', () => { SIM.H.blood = Math.max(0, SIM.H.blood - 150); return 'Кровопотеря: −150 крови.'; }],
  ['Холод', 'temp', () => { SIM.H.temp = 230; return 'Носитель промёрз: 230 K.'; }],
  ['Накормить', 'nutr', () => { SIM.H.nutr = 550; return 'Носитель плотно поел.'; }],
  ['Усыпить', 'sleep', () => { SIM.H.sleep = 60; return 'Носитель спит 60 с.'; }],
  ['Убить', 'kill', () => { if (SIM.H.dead) return 'Уже мёртв.'; log('Остановка дыхания: носитель задохнулся.', 'warn'); SIM.H.oxy += Math.max(0, hp(SIM.H) + 110); die(); return ''; }],
  ['ЭМИ', 'emp', () => { emp(); return ''; }],
  ['Ток', 'shock', () => { shock(); return ''; }],
  ['Шокер', 'minor', () => { shock(null, true); return ''; }],
  ['Вылечить', 'heal', () => { Object.assign(SIM.H, newHost(), { synth: SIM.H.synth }); return 'Носителя полностью вылечили.'; }],
];

/* ===================== ПОЛЕ ===================== */
const NW = 196;
function ensurePos() {
  let ys = 30, yr = 30;
  S.build.forEach((b) => {
    if (b.x != null) return;
    const snd = !!SENDF(byId[b.id]);
    b.x = snd ? 24 : 300; b.y = snd ? ys : yr;
    if (snd) ys += 150; else yr += 150;
  });
}
function nodeHtml(b) {
  const p = byId[b.id], [, cc] = catOf(p), snd = SENDF(p);
  const ins = FIELDS.filter(([f]) => f !== 'trig' || p.trig).map(([f, n, c]) => {
    const v = +b[f] || 0;
    return `<div class="np in" data-port="${f}"><i style="--pc:${c}" data-pin="in" data-f="${f}"></i><span>${n}</span>${v ? `<em>${v}</em>` : ''}</div>`;
  }).join('');
  const out = snd ? `<div class="np out"><span>Код</span><em>${+b.set[snd] || '—'}</em><i data-pin="out" style="--pc:${cc}"></i></div>` : '';
  const extra = b.id === 'dermal_button' ? `<button class="nb press" data-press="${b.uid}" title="Нажать кнопку">● ${esc(b.set['Button Name'] || 'Кнопка')}</button>`
    : p.trig ? `<button class="nb" data-fire="${b.uid}" title="Сработать вручную, как по коду">⚡ ${fmt(p.tcost)}</button>` : '';
  return `<div class="nd" data-uid="${b.uid}" style="left:${b.x}px;top:${b.y}px;--nc:${cc}">
    <div class="nh" data-grab="1"><span class="led"></span><b>${esc(ru(p))}</b><button class="nx" data-ndel="${b.uid}" title="Убрать">×</button></div>
    <div class="ns"><span class="stt">—</span><span class="use">${p.use ? fmt(p.use) + '/с' : ''}</span></div>
    <div class="nio"><div class="ins">${ins}</div>${out}</div>
    <div class="nf"><button class="nb" data-tog="${b.uid}" title="Включить / выключить в симуляции">⏻</button>${extra}${b.rules.length ? `<span class="rl" title="Правила">⚖ ${b.rules.length}</span>` : ''}</div>
  </div>`;
}
function links() {
  const L = [];
  S.build.forEach((s) => {
    const f = SENDF(byId[s.id]); const c = f ? +s.set[f] || 0 : 0; if (!c) return;
    S.build.forEach((r) => FIELDS.forEach(([k]) => { if (+r[k] === c && (k !== 'trig' || byId[r.id].trig) && r !== s) L.push({ s, r, k, c }); }));
  });
  return L;
}
function portXY(b, k) {
  const el = ST.nodes[b.uid]; if (!el) return [0, 0];
  const pin = k === 'out' ? el.querySelector('[data-pin="out"]') : el.querySelector(`[data-f="${k}"]`);
  if (!pin) return [b.x, b.y];
  return [b.x + pin.offsetLeft + pin.offsetWidth / 2 + (pin.offsetParent !== el ? offs(pin.offsetParent, el)[0] : 0),
    b.y + pin.offsetTop + pin.offsetHeight / 2 + (pin.offsetParent !== el ? offs(pin.offsetParent, el)[1] : 0)];
}
function offs(e, root) { let x = 0, y = 0; while (e && e !== root) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; } return [x, y]; }
const curve = (a, b) => { const dx = Math.max(40, Math.abs(b[0] - a[0]) / 2); return `M${a[0]},${a[1]} C${a[0] + dx},${a[1]} ${b[0] - dx},${b[1]} ${b[0]},${b[1]}`; };
function drawWires(tmp) {
  const svg = $('#st-wires'); if (!svg) return;
  const col = Object.fromEntries(FIELDS.map(([k, , c]) => [k, c]));
  svg.innerHTML = links().map((l) => { const d = curve(portXY(l.s, 'out'), portXY(l.r, l.k));
    const hot = SIM && SIM.flash[l.s.uid] ? ' hot' : '';
    return `<path d="${d}" class="w${hot}" style="stroke:${col[l.k]}"/><path d="${d}" class="hit" data-wire="${l.r.uid}:${l.k}"><title>Код ${l.c}: ${esc(ru(byId[l.s.id]))} → ${esc(ru(byId[l.r.id]))} (${FIELDS.find((f) => f[0] === l.k)[1]}). Нажмите, чтобы разорвать.</title></path>`; }).join('') +
    (tmp ? `<path d="${curve(tmp[0], tmp[1])}" class="tmp"/>` : '');
}
function usedCodes() { const u = new Set(); S.build.forEach((b) => { FIELDS.forEach(([k]) => u.add(+b[k] || 0)); const f = SENDF(byId[b.id]); if (f) u.add(+b.set[f] || 0); }); return u; }
function freeCode() { const u = usedCodes(); let c = 1; while (u.has(c)) c++; return c; }
function connect(sUid, rUid, k) {
  const s = instById(sUid), r = instById(rUid); if (!s || !r || s === r) return;
  const f = SENDF(byId[s.id]); let c = +s.set[f] || 0;
  const rc = +r[k] || 0;
  if (!c) { const only = !links().some((l) => l.s === s); c = rc && only ? rc : freeCode(); s.set[f] = c; }
  r[k] = c;
  if (k === 'act' && +r.deact === c) r.deact = 0;
  if (k === 'deact' && +r.act === c) r.act = 0;
  save(); rebuildBoard(); hint(`Провод: код ${c} — ${ru(byId[s.id])} → ${ru(byId[r.id])}.`);
}
function hint(t) { const el = $('#st-hint'); if (el) { el.textContent = t; el.hidden = false; clearTimeout(hint.t); hint.t = setTimeout(() => { el.hidden = true; }, 3500); } }

function applyView() { const v = S.view || (S.view = { x: 0, y: 0, k: 1 }); const w = $('#st-world'); if (w) w.style.transform = `translate(${v.x}px,${v.y}px) scale(${v.k})`; const z = $('#st-zoom'); if (z) z.textContent = Math.round(v.k * 100) + '%'; }
function zoomAt(f, cx, cy) {
  const v = S.view, k = Math.min(2, Math.max(0.35, v.k * f)); const r = $('#st-board').getBoundingClientRect();
  const px = (cx == null ? r.width / 2 : cx - r.left), py = (cy == null ? r.height / 2 : cy - r.top);
  v.x = px - (px - v.x) * k / v.k; v.y = py - (py - v.y) * k / v.k; v.k = k; applyView(); save();
}
function fit() {
  if (!S.build.length) { S.view = { x: 0, y: 0, k: 1 }; applyView(); return; }
  const r = $('#st-board').getBoundingClientRect(); if (r.width < 20) { ST.needFit = true; return; } ST.needFit = false; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  S.build.forEach((b) => { const el = ST.nodes[b.uid]; x0 = Math.min(x0, b.x); y0 = Math.min(y0, b.y); x1 = Math.max(x1, b.x + NW); y1 = Math.max(y1, b.y + (el ? el.offsetHeight : 140)); });
  const k = Math.min(1.2, Math.max(0.35, Math.min((r.width - 40) / (x1 - x0), (r.height - 40) / (y1 - y0))));
  S.view = { k, x: (r.width - (x1 - x0) * k) / 2 - x0 * k, y: (r.height - (y1 - y0) * k) / 2 - y0 * k }; applyView(); save();
}
function autoLayout() {
  const snd = S.build.filter((b) => SENDF(byId[b.id])), rest = S.build.filter((b) => !SENDF(byId[b.id]));
  const cols = Math.max(1, Math.ceil(rest.length / 5));
  snd.forEach((b, i) => { b.x = 24; b.y = 24 + i * 165; });
  rest.forEach((b, i) => { b.x = 300 + Math.floor(i / 5) * 230; b.y = 24 + (i % 5) * 175; });
  void cols; save(); rebuildBoard(); fit();
}
function rebuildBoard() {
  if (!ST.built) return;
  ensurePos();
  const w = $('#st-nodes'); w.innerHTML = S.build.map(nodeHtml).join('');
  ST.nodes = {}; w.querySelectorAll('.nd').forEach((el) => { ST.nodes[el.dataset.uid] = el; });
  $('#st-empty').hidden = !!S.build.length;
  if (SIM) syncSim(false);
  drawWires(); updateLive(); renderInspector(); updCnt();
}

/* ===================== ПАНЕЛЬ ===================== */
const STAT_RU = { ready: 'загружена', on: 'работает', idle: 'ждёт условия', low: 'мало нанитов', off: 'выключена', proto: 'другой протокол', gone: '—' };
function bar(label, v, max, cls, txt) { const w = Math.max(0, Math.min(100, v / max * 100)); return `<div class="vb ${cls || ''}"><span>${label}</span><div><i style="width:${w}%"></i></div><b>${txt != null ? txt : Math.round(v)}</b></div>`; }
function updateLive() {
  if (!ST.built || !SIM) return;
  const H = SIM.H;
  S.build.forEach((b) => {
    const el = ST.nodes[b.uid]; if (!el) return; const s = SIM.st[b.uid];
    let st = s ? (s.deleted ? 'del' : s.status || (s.on ? 'ready' : 'off')) : 'out';
    if (SIM.gone) st = 'gone';
    el.dataset.st = st; el.classList.toggle('blink', !!SIM.flash[b.uid]); el.classList.toggle('sel', ST.sel === b.uid);
    let t = st === 'del' ? 'удалена (облако вернёт)' : st === 'out' ? 'не загрузится (лимит/копия)' : STAT_RU[st] || st;
    if (s && s.rogue) t = 'СБОЙ → ' + ru(byId[s.rogue]);
    else if (s && s.wiped) t += ' · коды сброшены';
    if (s && s.nextTrig > SIM.t && byId[b.id].trig) t += ` · ⏳${Math.ceil(s.nextTrig - SIM.t)}с`;
    if (s && s.tDelay) t += ` · ⏱${Math.ceil(s.tDelay - SIM.t)}с`;
    if (s && pOf(s).id === 'protocol/factory') t += ` · ${Math.round(s.factory / 10)}%`;
    el.querySelector('.stt').textContent = t;
    el.classList.toggle('rogue', !!(s && s.rogue));
  });
  drawWires();
  const vv = $('#st-vol'); if (!vv) return;
  const net = SIM.hist.length > 1 ? SIM.hist[SIM.hist.length - 1] - SIM.hist[SIM.hist.length - 2] : 0;
  vv.innerHTML = `<div class="vbig"><b>${SIM.gone ? 0 : Math.round(SIM.vol)}</b><span>/ ${SIM.max} нанитов</span><em class="${net < 0 ? 'neg' : 'pos'}">${net >= 0 ? '+' : ''}${fmt(net)}/с</em></div>` +
    `<div class="vline"><i style="width:${Math.min(100, SIM.vol / SIM.max * 100)}%"></i><u style="left:${SIM.safety / SIM.max * 100}%" title="Порог безопасности ${SIM.safety}"></u></div>`;
  spark();
  const h = hp(H);
  $('#st-host').innerHTML =
    `<div class="hst ${H.dead ? 'dead' : crit(H) ? 'crit' : ''}">${H.dead ? '☠ Мёртв' : crit(H) ? '⚠ Критическое состояние' : H.sleep ? '💤 Спит' : H.stun ? '✶ Оглушён' : '♥ В порядке'}<span>${Math.round(h)} HP · ${SIM.t} с${SIM.cloud ? ' · ☁ облако' : ' · ☁̸ без облака'}</span></div>` +
    bar('Раны', H.brute, 200, 'r') + bar('Ожоги', H.burn, 200, 'o') + bar('Токсины', H.tox, 200, 'g') + bar('Кислород', H.oxy, 200, 'b') +
    bar('Мозг', H.brain, 200, 'p') + bar('Кровь', H.blood, 560, 'r', Math.round(H.blood / 5.6) + '%') + bar('Темп.', H.temp - 150, 300, 'b', Math.round(H.temp) + ' K') + bar('Сытость', H.nutr, 600, 'y') +
    (SIM.points ? `<div class="muted" style="font-size:12px">Очки исследований: ${Math.round(SIM.points)}</div>` : '');
  $('#st-log').innerHTML = SIM.log.slice(0, 60).map((l) => `<li class="${l.k}"><b>${l.t} с</b> ${esc(l.m)}</li>`).join('');
  $('#st-play').textContent = ST.run ? '⏸ Пауза' : '▶ Пуск';
  $('[data-mplay]').textContent = ST.run ? '⏸' : '▶';
  $('#st-minitxt').textContent = `${SIM.gone ? 0 : Math.round(SIM.vol)}/${SIM.max} нан. · ${H.dead ? '☠' : Math.round(h) + ' HP'} · ${SIM.t} с`;
  $('#st-cloud').textContent = SIM.cloud ? '☁ Отключить облако' : '☁ Подключить облако';
}
function spark() {
  const c = $('#st-spark'); if (!c) return; const W = c.clientWidth, Hh = c.clientHeight; if (!W) return;
  const dpr = window.devicePixelRatio || 1; c.width = W * dpr; c.height = Hh * dpr; const g = c.getContext('2d'); g.scale(dpr, dpr);
  const css = getComputedStyle(document.documentElement), acc = css.getPropertyValue('--accent').trim() || '#6a7fe0', bad = css.getPropertyValue('--bad').trim() || '#c00';
  const h = SIM.hist.slice(-120), m = Math.max(SIM.max, ...h, 1);
  g.strokeStyle = bad; g.globalAlpha = .5; g.setLineDash([3, 3]); g.beginPath(); const sy = Hh - SIM.safety / m * Hh; g.moveTo(0, sy); g.lineTo(W, sy); g.stroke(); g.setLineDash([]); g.globalAlpha = 1;
  if (h.length < 2) return;
  g.strokeStyle = acc; g.lineWidth = 2; g.beginPath();
  h.forEach((v, i) => { const x = i / 119 * W, y = Hh - v / m * (Hh - 4) - 2; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  g.lineTo((h.length - 1) / 119 * W, Hh); g.lineTo(0, Hh); g.closePath(); g.globalAlpha = .15; g.fillStyle = acc; g.fill(); g.globalAlpha = 1;
}
function renderInspector() {
  const el = $('#st-insp'); if (!el) return;
  const b = instById(ST.sel);
  if (!b) { el.innerHTML = `<div class="muted ihint">Нажмите на блок — здесь появятся его коды, задержки, настройки и правила. Провод тянется от кружка «Код» датчика или кнопки к входу другой программы.</div>`; return; }
  const p = byId[b.id];
  el.innerHTML = `<div class="ihd"><b>${esc(ru(p))}</b> <span class="muted">${esc(p.name)}</span><button class="lnk" data-goto="${p.id}">в каталог</button></div>` +
    (FX[p.id] ? `<div class="ifx">${FX[p.id].t}</div>` : '') + instEditor(b);
}

/* ===================== РАЗМЕТКА И СОБЫТИЯ ===================== */
function renderStand() {
  const v = $('#v-stand');
  if (!ST.built) {
    v.innerHTML = `
<div class="stand" data-pane="${ST.pane}">
  <div class="seg stseg"><button data-pane="add">+ Программы</button><button data-pane="board">Поле</button><button data-pane="host">Носитель</button><button data-pane="prop">Блок</button></div>
  <aside class="st-pal panel">
    <input type="search" id="st-q" placeholder="Найти программу…" autocomplete="off">
    <select id="st-preset"><option value="">Готовая сборка…</option>${PRESETS.map((p, i) => `<option value="${i}">${esc(p.n)}</option>`).join('')}</select>
    <div id="st-list"></div>
  </aside>
  <div class="st-mid">
    <div id="st-board" class="panel">
      <div id="st-world"><svg id="st-wires"></svg><div id="st-nodes"></div></div>
      <div id="st-empty" class="st-empty">Добавьте программы из списка («+ Программы») или выберите готовую сборку.<br>Потом тяните провода от «Код» датчиков и кнопок ко входам программ и жмите ▶.</div>
      <div class="st-tools"><button class="btn" data-z="-">−</button><span id="st-zoom">100%</span><button class="btn" data-z="+">+</button><button class="btn" data-z="fit" title="Показать всё">⤢</button><button class="btn" data-z="auto" title="Разложить блоки">⇶</button></div>
      <div id="st-hint" class="st-hint" hidden></div>
      <div class="st-mini"><button class="btn pri" data-mplay="1">▶</button><span id="st-minitxt"></span></div>
      <div class="st-legend">${FIELDS.map(([, n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('')}</div>
    </div>
  </div>
  <aside class="st-side">
    <div class="panel sbox">
      <div class="simbar"><button class="btn pri" id="st-play">▶ Пуск</button><button class="btn" id="st-step" title="Один тик">+1 с</button>
        <span class="seg spd">${[1, 5, 20].map((x) => `<button data-spd="${x}" aria-pressed="${ST.speed === x}">${x}×</button>`).join('')}</span>
        <button class="btn" id="st-reset" title="Начать заново: 100 нанитов, здоровый носитель">↺</button></div>
      <div id="st-vol"></div><canvas id="st-spark"></canvas>
    </div>
    <div class="panel sbox"><div class="sbh">Носитель <label class="chk"><input type="checkbox" id="st-synth"> синтетик</label></div><div id="st-host"></div>
      <div class="evs">${EVENTS.map(([n, k]) => `<button class="ev" data-ev="${k}">${n}</button>`).join('')}</div>
      <button class="btn wfull" id="st-cloud"></button>
    </div>
    <div class="panel sbox"><div class="sbh">Пульт</div>
      <div class="rem"><input type="number" id="st-code" min="1" max="9999" value="1" aria-label="Код"><button class="btn pri" id="st-send">Отправить код</button></div>
      <div class="rem"><input type="text" id="st-say" placeholder="Сказать рядом с носителем…"><button class="btn" id="st-sayb">Сказать</button></div>
    </div>
    <div class="panel sbox st-prop"><div class="sbh">Блок</div><div id="st-insp"></div></div>
    <div class="panel sbox"><div class="sbh">Журнал <button class="lnk" id="st-clr">очистить</button></div><ul id="st-log"></ul></div>
  </aside>
</div>`;
    ST.built = true; bindStand();
    if (!SIM) newSim();
  }
  fitHeight(); renderPalette(); rebuildBoard(); applyView();
  if (!S.view || (S.view.x === 0 && S.view.y === 0 && S.build.length)) requestAnimationFrame(fit);
}
// Стенд занимает экран под шапкой: высота считается по факту, шапка в узком окне выше
function fitHeight() { const st = $('.stand'); if (!st) return; const top = st.getBoundingClientRect().top + window.scrollY; st.style.height = Math.max(380, window.innerHeight - top - 10) + 'px'; }
function renderPalette() {
  const q = ($('#st-q').value || '').trim().toLowerCase();
  const list = P.filter((p) => p.group !== 'rogue' && (!q || HAY[p.id].includes(q)));
  const groups = {}; list.forEach((p) => { (groups[p.cat] = groups[p.cat] || []).push(p); });
  $('#st-list').innerHTML = Object.keys(CAT).filter((k) => groups[k]).map((k) => `<div class="pg"><div class="pgh" style="--c:${CAT[k][1]}">${CAT[k][0]}</div>${groups[k].map((p) =>
    `<button class="pi" data-padd="${p.id}" title="${esc(p.desc)}"><span>${esc(ru(p))}</span><small>${p.use ? fmt(p.use) + '/с' : ''}${p.trig ? ' ⚡' + fmt(p.tcost) : ''}${SENDF(p) ? ' ⇢' : ''}</small>${inBuild(p.id) ? `<em>${inBuild(p.id)}</em>` : ''}</button>`).join('')}</div>`).join('') || '<div class="muted" style="padding:8px">Ничего не нашлось.</div>';
}
function addAt(id) {
  const r = $('#st-board').getBoundingClientRect(), v = S.view || { x: 0, y: 0, k: 1 };
  const b = newInst(id); const n = S.build.length;
  b.x = Math.round(((r.width / 2) - v.x) / v.k - NW / 2 + (n % 4) * 18); b.y = Math.round(((r.height / 3) - v.y) / v.k + (n % 4) * 18);
  S.build.push(b); ST.sel = b.uid; save(); renderPalette(); rebuildBoard();
  if (ST.pane === 'add') setPane('board');
  hint(`Добавлено: ${ru(byId[id])}. ${SENDF(byId[id]) ? 'Тяните провод от «Код» к входу другой программы.' : byId[id].trig ? 'Чтобы сработала, подведите к «Сработать» провод от датчика или кнопки.' : ''}`);
}
function setPane(p) { ST.pane = p; const st = $('.stand'); st.dataset.pane = p; st.querySelectorAll('.stseg button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.pane === p)); if (p === 'board') requestAnimationFrame(() => { if (ST.needFit) fit(); drawWires(); }); if (p === 'host') spark(); }
function loop() {
  clearInterval(ST.timer);
  if (!ST.run) return;
  ST.timer = setInterval(() => { const n = ST.speed >= 20 ? 4 : 1; for (let i = 0; i < n; i++) tick(); updateLive(); }, ST.speed >= 20 ? 200 : 1000 / ST.speed);
}
function toPt(e) { const r = $('#st-board').getBoundingClientRect(), v = S.view; return [(e.clientX - r.left - v.x) / v.k, (e.clientY - r.top - v.y) / v.k]; }
function bindStand() {
  const root = $('#v-stand'), board = $('#st-board');
  root.addEventListener('click', (e) => {
    const t = e.target.closest('button,[data-wire]'); if (!t) return; const d = t.dataset;
    if (d.pane) setPane(d.pane);
    else if (d.padd) addAt(d.padd);
    else if (d.z) { if (d.z === '+') zoomAt(1.2); else if (d.z === '-') zoomAt(1 / 1.2); else if (d.z === 'fit') fit(); else autoLayout(); }
    else if (d.spd) { ST.speed = +d.spd; root.querySelectorAll('[data-spd]').forEach((b) => b.setAttribute('aria-pressed', b === t)); loop(); }
    else if (d.ev) { const ev = EVENTS.find((x) => x[1] === d.ev); const m = ev[2](); if (m) log(m, d.ev === 'heal' || d.ev === 'nutr' ? 'ok' : 'warn'); updateLive(); }
    else if (d.ndel) { S.build = S.build.filter((b) => b.uid !== +d.ndel); if (ST.sel === +d.ndel) ST.sel = 0; save(); renderPalette(); rebuildBoard(); }
    else if (d.tog) { const s = SIM.st[+d.tog]; if (s && !s.deleted) { const b = instById(+d.tog); if (s.on) deactivate(s, b); else activate(s, b); log(`${nm(s)} ${s.on ? 'включена' : 'выключена'} вручную.`); s.status = s.on ? 'ready' : 'off'; updateLive(); } }
    else if (d.fire) { const s = SIM.st[+d.fire]; if (s && !s.deleted) { const r = trigger(s); log(`${nm(s)}: ручное срабатывание${r ? ' — ' + r : ''}.`, r ? 'warn' : 'sig'); updateLive(); } }
    else if (d.press) { const s = SIM.st[+d.press]; if (s && !s.deleted) { if (SIM.H.stun || SIM.H.sleep || SIM.H.dead || crit(SIM.H)) log('Кнопку не нажать: носитель оглушён, спит или без сознания.', 'warn'); else { log(`Нажата кожная кнопка «${setv(s, 'Button Name')}».`); sendFrom(s); } updateLive(); } }
    else if (d.wire) { const [u, k] = d.wire.split(':'); const r = instById(+u); hint(`Провод разорван: ${ru(byId[r.id])} больше не слушает код ${r[k]} (${FIELDS.find((f) => f[0] === k)[1]}).`); r[k] = 0; save(); rebuildBoard(); }
    else if (d.goto) return;
    else if (d.rdel != null) { const b = instById(ST.sel); b.rules.splice(+d.rdel, 1); save(); rebuildBoard(); }
    else if (t.id === 'st-play' || d.mplay) { ST.run = !ST.run; loop(); updateLive(); }
    else if (t.id === 'st-step') { tick(); updateLive(); }
    else if (t.id === 'st-reset') { ST.run = false; loop(); newSim(); updateLive(); }
    else if (t.id === 'st-cloud') { SIM.cloud = !SIM.cloud; log(SIM.cloud ? 'Облако подключено.' : 'Облако отключено: раз в 30 с — 8% сбоя.', SIM.cloud ? 'ok' : 'warn'); updateLive(); }
    else if (t.id === 'st-send') { signal(Math.max(1, Math.min(9999, +$('#st-code').value || 0)), 'Пульт'); updateLive(); }
    else if (t.id === 'st-sayb') say();
    else if (t.id === 'st-clr') { SIM.log = []; updateLive(); }
  });
  $('#st-say').addEventListener('keydown', (e) => { if (e.key === 'Enter') say(); });
  $('#st-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#st-send').click(); });
  $('#st-q').addEventListener('input', renderPalette);
  $('#st-preset').addEventListener('change', (e) => { if (e.target.value === '') return; const i = +e.target.value; e.target.value = '';
    if (S.build.length && !confirmReplace()) { hint('Набор не пустой — выберите сборку ещё раз в течение 4 с, чтобы заменить.'); return; }
    S.build = []; loadPreset(i); S.build.forEach((b) => { delete b.x; }); ST.sel = 0; renderPalette(); rebuildBoard(); autoLayout(); newSim(); updateLive(); hint(`Загружена сборка «${PRESETS[i].n}». Жмите ▶ и пробуйте события носителя.`); });
  $('#st-synth').addEventListener('change', (e) => { SIM.H.synth = e.target.checked; log(SIM.H.synth ? 'Носитель — синтетик (IPC с чертой совместимости).' : 'Носитель — органик.'); updateLive(); });
  // Редактор блока: те же поля, что во вкладке «Сборка»
  $('#st-insp').addEventListener('change', (e) => { if (applyEdit(e.target)) { save(); rebuildBoard(); } });
  // Поле: выбор, перетаскивание блоков, провода, панорама, масштаб
  board.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const pin = e.target.closest('[data-pin]'), node = e.target.closest('.nd');
    if (e.target.closest('button,[data-wire]')) return;
    if (pin && pin.dataset.pin === 'out') { const uid = +node.dataset.uid; ST.drag = { kind: 'wire', uid, from: portXY(instById(uid), 'out') }; }
    else if (pin && pin.dataset.pin === 'in') { // провод от входа: тянем назад к источнику
      const uid = +node.dataset.uid; ST.drag = { kind: 'wirein', uid, f: pin.dataset.f, from: portXY(instById(uid), pin.dataset.f) }; }
    else if (node) { const b = instById(+node.dataset.uid); ST.sel = b.uid; renderInspector(); updateLive();
      if (e.target.closest('[data-grab]') || e.pointerType !== 'mouse' || true) ST.drag = { kind: 'node', b, sx: e.clientX, sy: e.clientY, x: b.x, y: b.y, moved: false }; }
    else ST.drag = { kind: 'pan', sx: e.clientX, sy: e.clientY, x: S.view.x, y: S.view.y };
    board.setPointerCapture(e.pointerId); if (ST.drag.kind === 'pan') board.classList.add('panning');
  });
  board.addEventListener('pointermove', (e) => {
    const d = ST.drag; if (!d) return;
    if (d.kind === 'pan') { S.view.x = d.x + e.clientX - d.sx; S.view.y = d.y + e.clientY - d.sy; applyView(); }
    else if (d.kind === 'node') { const k = S.view.k; d.b.x = Math.round(d.x + (e.clientX - d.sx) / k); d.b.y = Math.round(d.y + (e.clientY - d.sy) / k); d.moved = true;
      const el = ST.nodes[d.b.uid]; el.style.left = d.b.x + 'px'; el.style.top = d.b.y + 'px'; drawWires(); }
    else { const pt = toPt(e); drawWires(d.kind === 'wire' ? [d.from, pt] : [pt, d.from]); }
  });
  const up = (e) => {
    const d = ST.drag; ST.drag = null; board.classList.remove('panning'); if (!d) return;
    if (d.kind === 'node' || d.kind === 'pan') { save(); return; }
    const el = document.elementFromPoint(e.clientX, e.clientY), node = el && el.closest('.nd');
    if (d.kind === 'wire') {
      const port = el && el.closest('[data-port]');
      if (node && +node.dataset.uid !== d.uid) {
        let f = port ? port.dataset.port : null;
        if (!f) { const p = byId[instById(+node.dataset.uid).id]; f = p.trig ? 'trig' : 'act'; }
        connect(d.uid, +node.dataset.uid, f);
      } else { drawWires(); if (!node) hint('Отпустите провод на входе другой программы: Вкл, Выкл, Сработать или Удалить.'); }
    } else {
      if (node && +node.dataset.uid !== d.uid && SENDF(byId[instById(+node.dataset.uid).id])) connect(+node.dataset.uid, d.uid, d.f);
      else { drawWires(); hint('Вход соединяется с «Код» датчика, кнопки или повторителя.'); }
    }
  };
  board.addEventListener('pointerup', up); board.addEventListener('pointercancel', () => { ST.drag = null; drawWires(); });
  board.addEventListener('wheel', (e) => { e.preventDefault(); e.stopPropagation(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX, e.clientY); }, { passive: false });
  window.addEventListener('resize', () => { if (S.tab === 'stand') { fitHeight(); drawWires(); spark(); } });
}
function say() {
  const t = $('#st-say').value.trim(); if (!t) return; $('#st-say').value = '';
  log(`Рядом говорят: «${t}»`);
  Object.values(SIM.st).forEach((s) => {
    if (s.deleted || pOf(s).id !== 'sensor/voice' || !s.on) return;
    const ph = String(setv(s, 'Sentence') || ''); if (!ph) return;
    const hit = setv(s, 'Inclusive Mode') ? t.includes(ph) : t.toLowerCase() === ph.toLowerCase();
    if (hit) sendFrom(s);
  });
  updateLive();
}
function standPause() { if (ST.run) { ST.run = false; loop(); } }

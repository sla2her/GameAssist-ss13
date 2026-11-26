// «Теплица»: симулятор лотков в реальном времени. Правила цикла взяты из code/modules/hydroponics/hydroponics.dm
// BlueMoon (process(): вода, питание, сорняки, вредители, токсины, нестабильность и мутации, сбор урожая),
// удобрения — из on_hydroponics_apply в other_reagents.dm. Время сжато: цикл лотка в игре ~20 с, здесь ~2,5 с.
// Спрайты — из файлов иконок сервера (farm-sprites.js), ничего не нарисовано с нуля.
(function () {
  'use strict';
  const SP = window.FARM_SPRITES;
  const award = id => { try { const g = window.parent !== window && parent.PultGame; g && g.award(id); } catch (e) { /* без Пульта */ } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const prob = p => Math.random() * 100 < p;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const P = id => (window.BOTANY_DATA || {}).plants[id];
  const nm = id => (typeof RU !== 'undefined' && RU[id]) || (P(id) || {}).en || id;
  const BASE = ['tomato', 'wheat', 'potato', 'corn', 'carrot', 'cabbage', 'chili', 'eggplant', 'onion', 'banana', 'apple', 'grape', 'berry',
    'watermelon', 'pumpkin', 'sugarcane', 'cocoapod', 'ambrosia', 'plump'].filter(id => SP && SP.plants[id] && P(id));
  const ALBUM = SP ? Object.keys(SP.plants).filter(id => P(id)) : [];
  const STATS = ['lif', 'end', 'mat', 'pro', 'yie', 'pot', 'ins', 'wr', 'wc'];
  const statsOf = id => { const p = P(id), s = {}; STATS.forEach(k => s[k] = p[k]); return s; };
  const genes = id => (P(id) || {}).genes || [];
  const NUTRI = {
    ez: ['E-Z-Nutrient', 'ez', 'Понемногу всё: чуть нестабильности, потенции и урожая'],
    l4z: ['Left 4 Zed', 'l4z', 'Сильно растит нестабильность → мутации сорта'],
    rh: ['Robust Harvest', 'rh', 'Больше урожая, снижает нестабильность'],
  };
  const KEY = 'botany.farm';
  const newTray = () => ({ pid: null, age: 0, hp: 0, water: 100, nut: { ez: 10 }, weeds: 0, pests: 0, toxic: 0, harvest: false, dead: false, last: 0, st: null, scan: false });
  let F = null;
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.trays) return s; } catch (e) { /* */ }
    return { trays: [newTray(), newTray(), newTray(), newTray()], sel: 0, speed: 1, seeds: [], album: {}, crops: 0, mutants: 0, cycles: 0, log: [] };
  }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(F)); } catch (e) { /* */ } };
  const log = (t, c = '') => { F.log.unshift([c, t]); F.log.length = Math.min(F.log.length, 30); };
  const nutVol = T => Object.values(T.nut).reduce((a, x) => a + x, 0);
  function removeAny(T, amt) { const v = nutVol(T); if (!v) return; const f = Math.min(1, amt / v); for (const k in T.nut) { T.nut[k] -= T.nut[k] * f; if (T.nut[k] < 0.05) delete T.nut[k]; } }
  const adjHp = (T, d) => { T.hp = clamp(T.hp + d, -1, T.st ? T.st.end : 100); };

  function plant(T, pid, st) {
    Object.assign(T, { pid, age: 0, hp: (st || statsOf(pid)).end, harvest: false, dead: false, last: 0, st: Object.assign({}, st || statsOf(pid)), scan: false, weeds: 0, pests: 0 });
    log(`🌱 Посажено: ${nm(pid)}`);
  }
  function mutateSpecie(T, i) {
    const muts = (P(T.pid).mut || []).filter(m => SP.plants[m] && P(m));
    if (!muts.length) return;
    const from = T.pid, to = muts[Math.floor(Math.random() * muts.length)];
    const ins = T.st.ins / 2;
    plant(T, to); T.st.ins = ins; F.log.shift();
    F.mutants++;
    log(`🧬 Лоток ${i + 1}: ${nm(from)} внезапно мутирует в <b>${esc(nm(to))}</b>!`, 'ok');
    award('bot.mutant');
  }
  // Один цикл лотка — как в hydroponics.dm process()
  function cycle(T, i) {
    if (T.pid && !T.dead && T.pid !== 'weeds') {
      const st = T.st, g = genes(T.pid), fungal = g.includes('plant_type/fungal_metabolism'), hardy = g.includes('plant_type/weed_hardy');
      T.age++;
      if (T.age < st.mat) T.last = T.age;
      // удобрения: on_hydroponics_apply
      const ez = T.nut.ez || 0, l4z = T.nut.l4z || 0, rh = T.nut.rh || 0;
      if (ez) { st.ins = clamp(st.ins + 0.2, 0, 100); st.pot = clamp(st.pot + Math.round(ez * 0.3), 0, 100); st.yie = clamp(st.yie + Math.round(ez * 0.1), 0, 10); }
      if (l4z) { adjHp(T, Math.round(l4z * 0.1)); st.ins = clamp(st.ins + Math.round(l4z * 0.2), 0, 100); }
      if (rh) { st.ins = clamp(st.ins - 0.25, 0, 100); st.pot = clamp(st.pot + Math.round(rh * 0.1), 0, 100); st.yie = clamp(st.yie + Math.round(rh * 0.2), 0, 10); }
      removeAny(T, 1);
      if (nutVol(T) <= 0 && !hardy) adjHp(T, -rand(1, 3));
      T.water = clamp(T.water - rand(1, 6), 0, 100);
      if (T.water <= 10 && !fungal) { adjHp(T, -rand(0, 1)); if (T.water <= 0) adjHp(T, -rand(0, 2)); }
      else if (T.water > 10 && nutVol(T) > 0) {
        adjHp(T, rand(1, 2));
        if (prob(st.wc)) T.weeds = clamp(T.weeds + st.wr, 0, 10); else if (prob(5)) T.weeds = clamp(T.weeds + 1, 0, 10);
      }
      if (T.toxic >= 40) { adjHp(T, T.toxic >= 80 ? -3 : -1); T.toxic = clamp(T.toxic - rand(1, 10), 0, 100); }
      if (T.pests >= 8) adjHp(T, -2); else if (T.pests >= 4) adjHp(T, -1);
      if (T.weeds >= 5 && !hardy) adjHp(T, -1);
      // нестабильность
      if (st.ins >= 60 && prob(st.ins / 2) && (P(T.pid).mut || []).some(m => SP.plants[m])) { mutateSpecie(T, i); return; }
      if (st.ins >= 20 && prob(st.ins)) { const k = ['pot', 'yie', 'end', 'lif'][rand(0, 3)]; st[k] = clamp(st[k] + rand(-2, 3), k === 'yie' ? 0 : 1, k === 'yie' ? 10 : 100); }
      if (T.hp <= 0) { T.dead = true; T.harvest = false; T.weeds = clamp(T.weeds + 1, 0, 10); log(`💀 Лоток ${i + 1}: ${nm(T.pid)} погибает.`, 'bad'); return; }
      if (T.age > st.lif) adjHp(T, -rand(1, 5));
      if (T.age > st.pro && T.age - T.last > st.pro && !T.harvest) { T.harvest = true; log(`🧺 Лоток ${i + 1}: ${nm(T.pid)} — можно собирать урожай!`, 'ok'); }
      if (prob(5)) T.pests = clamp(T.pests + 1, 0, 10);
    } else if (T.water > 10 && nutVol(T) > 0 && prob(10)) T.weeds = clamp(T.weeds + 1, 0, 10);
    if (T.weeds >= 10 && prob(50) && T.pid !== 'weeds') {
      const g = T.pid ? genes(T.pid) : [];
      if (!T.pid || T.dead || !(g.includes('plant_type/weed_hardy') || g.includes('plant_type/fungal_metabolism'))) {
        Object.assign(T, newTray(), { pid: 'weeds', water: T.water, nut: T.nut, weeds: 10 });
        log(`🌾 Лоток ${i + 1}: сорняки захватили лоток!`, 'bad');
      }
    }
  }

  // ---------- действия ----------
  function act(a, T, i) {
    if (a === 'water') { T.water = clamp(T.water + 50, 0, 100); return '💧 Полито'; }
    if (NUTRI[a]) { const room = 20 - nutVol(T); if (room <= 0.05) return 'Лоток уже полон удобрений (20u)'; T.nut[a] = (T.nut[a] || 0) + Math.min(10, room); return `🧪 +${Math.round(Math.min(10, room))}u ${NUTRI[a][0]}`; }
    if (a === 'cult') { if (!T.weeds) return 'Сорняков нет'; T.weeds = 0; if (T.pid === 'weeds') Object.assign(T, { pid: null }); return '🌿 Сорняки выполоты'; }
    if (a === 'pest') { T.pests = clamp(T.pests - 5, 0, 10); T.toxic = clamp(T.toxic + 5, 0, 100); return '🐛 Пестицид: вредителей меньше, токсинов чуть больше'; }
    if (a === 'weedk') { T.weeds = clamp(T.weeds - 4, 0, 10); T.toxic = clamp(T.toxic + 8, 0, 100); if (T.pid === 'weeds' && T.weeds < 5) T.pid = null; return '🌾 Гербицид: сорняков меньше, токсинов больше'; }
    if (a === 'scan') { if (!T.pid) return 'Лоток пуст'; T.scan = true; return '📟 Анализатор: статы видны'; }
    if (a === 'dig') { if (!T.pid) return 'Лоток пуст'; const was = T.pid; Object.assign(T, { pid: null, dead: false, harvest: false, age: 0, st: null }); return `🪓 Выкопано: ${was === 'weeds' ? 'сорняки' : nm(was)}`; }
    if (a === 'harv') {
      if (!T.harvest || T.dead) return 'Собирать пока нечего';
      const n = Math.max(1, Math.round(T.st.yie));
      F.crops += n;
      const fresh = !F.album[T.pid];
      F.album[T.pid] = (F.album[T.pid] || 0) + n;
      // семена из экстрактора: копия текущих статов
      F.seeds.push({ pid: T.pid, st: Object.assign({}, T.st) });
      if (F.seeds.length > 24) F.seeds.shift();
      award('bot.harvest');
      if (n >= 8) award('bot.big');
      if (Object.keys(F.album).length >= 10) award('bot.album10');
      const msg = `🧺 Лоток ${i + 1}: собрано ${n} × ${nm(T.pid)}${fresh ? ' — новое в гербарии!' : ''}. Пакет семян с этими статами — в ящике.`;
      if (genes(T.pid).includes('repeated_harvest')) { T.harvest = false; T.last = T.age; }
      else Object.assign(T, { pid: null, harvest: false, age: 0, st: null });
      log(msg, 'ok');
      return '';
    }
    return '';
  }

  // ---------- отрисовка ----------
  const img = (u, cls = '') => u ? `<img class="${cls}" src="${u}" alt="">` : '';
  function trayStack(T) {
    let h = img(SP.ui.tray, 'fl');
    if (T.weeds >= 3 && SP.weeds.length) h += img(SP.weeds[clamp(Math.ceil(T.weeds / 10 * SP.weeds.length) - 1, 0, SP.weeds.length - 1)], 'fl');
    if (T.pid && T.pid !== 'weeds') {
      const s = SP.plants[T.pid];
      let u;
      if (T.dead) u = s.dead;
      else if (T.harvest) u = s.harv;
      else u = s.grow[clamp(Math.round(T.age / Math.max(1, T.st.mat) * s.grow.length), 1, s.grow.length) - 1];
      h += img(u, 'fl');
    }
    if (T.pid === 'weeds' && SP.weeds.length) h += img(SP.weeds[SP.weeds.length - 1], 'fl');
    if (T.water <= 10) h += img(SP.ui.lowwater, 'fl');
    if (nutVol(T) <= 2) h += img(SP.ui.lownutri, 'fl');
    if (T.pid && T.st && !T.dead && T.hp <= T.st.end / 2) h += img(SP.ui.lowhealth, 'fl');
    if (T.weeds >= 5 || T.pests >= 5 || T.toxic >= 40) h += img(SP.ui.alert, 'fl');
    if (T.harvest && !T.dead) h += img(SP.ui.harvest, 'fl');
    return h;
  }
  const bar = (v, max, cls, ic, title) => `<div class="fm-bar ${cls}" title="${title}"><span>${ic}</span><i><b style="width:${clamp(v / max * 100, 0, 100)}%"></b></i></div>`;
  function trayCard(T, i) {
    const name = T.pid === 'weeds' ? 'Сорняки' : T.pid ? nm(T.pid) + (T.dead ? ' (мёртв)' : '') : 'Пустой лоток';
    return `<div class="fm-tray${F.sel === i ? ' on' : ''}" data-ftray="${i}">
      <div class="fm-stack">${trayStack(T)}</div>
      <div class="fm-name">${i + 1}. ${esc(name)}</div>
      ${bar(T.water, 100, 'w', '💧', 'Вода ' + Math.round(T.water) + '/100')}
      ${bar(nutVol(T), 20, 'n', '🧪', 'Удобрения ' + Math.round(nutVol(T)) + '/20u')}
      ${T.pid && T.st && T.pid !== 'weeds' ? bar(Math.max(0, T.hp), T.st.end, 'h', '❤', 'Здоровье ' + Math.round(T.hp) + '/' + T.st.end) : '<div class="fm-bar ghost"></div>'}
      <div class="fm-tags">${T.weeds ? `<span title="Сорняки">🌾${T.weeds}</span>` : ''}${T.pests ? `<span title="Вредители">🐛${T.pests}</span>` : ''}${T.toxic >= 1 ? `<span title="Токсичность">☠${Math.round(T.toxic)}</span>` : ''}</div>
    </div>`;
  }
  const TOOLS = [
    ['water', SP && SP.ui.bucket, 'Ведро воды', '+50 воды'],
    ['ez', SP && SP.ui.ez, 'E-Z-Nutrient', NUTRI.ez[2]],
    ['l4z', SP && SP.ui.l4z, 'Left 4 Zed', NUTRI.l4z[2]],
    ['rh', SP && SP.ui.rh, 'Robust Harvest', NUTRI.rh[2]],
    ['cult', SP && SP.ui.cultivator, 'Культиватор', 'Выполоть все сорняки'],
    ['pest', SP && SP.ui.pestspray, 'Пестицид', '−5 вредителей, +5 токсинов'],
    ['weedk', SP && SP.ui.weedspray, 'Гербицид', '−4 сорняка, +8 токсинов'],
    ['scan', SP && SP.ui.analyzer, 'Анализатор', 'Показать статы растения'],
    ['harv', SP && SP.ui.plantbag, 'Мешок', 'Собрать урожай'],
    ['dig', SP && SP.ui.hatchet, 'Выкопать', 'Убрать растение из лотка'],
  ];
  const ST_RU = { lif: 'Срок жизни', end: 'Выносливость', mat: 'Созревание', pro: 'Плодоношение', yie: 'Урожай', pot: 'Потенция', ins: 'Нестабильность', wr: 'Рост сорняков', wc: 'Шанс сорняков' };
  function detail(T, i) {
    if (!T.pid) {
      const packs = F.seeds.map((s, k) => [s, k]);
      return `<h3>Лоток ${i + 1} пуст — посади семена</h3>
        <div class="fm-seeds">${BASE.map(id => `<button data-fplant="${id}" title="${esc(nm(id))}">${img(SP.plants[id].seed || SP.plants[id].prod, 'px')}<span>${esc(nm(id))}</span></button>`).join('')}</div>
        ${packs.length ? `<h3>Твои пакеты семян (после урожая)</h3><div class="fm-seeds">${packs.map(([s, k]) => `<button data-fpack="${k}" title="урожай ${s.st.yie}, потенция ${s.st.pot}, нестаб. ${Math.round(s.st.ins)}">${img(SP.plants[s.pid].seed || SP.plants[s.pid].prod, 'px')}<span>${esc(nm(s.pid))}<small>ур.${s.st.yie} · пот.${s.st.pot} · нест.${Math.round(s.st.ins)}</small></span></button>`).join('')}</div>` : ''}`;
    }
    if (T.pid === 'weeds') return `<h3>Лоток ${i + 1}: сорняки</h3><p class="fm-muted">Сорняки захватили лоток. Выполи их культиватором или выкопай.</p>`;
    const p = P(T.pid), st = T.st;
    const muts = (p.mut || []).filter(m => SP.plants[m]);
    return `<div class="fm-det"><div class="fm-prod">${img(SP.plants[T.pid].prod, 'px big')}</div><div>
      <h3>${esc(nm(T.pid))} <small class="fm-muted">${esc(p.en)}</small></h3>
      <div class="fm-muted">Возраст ${T.age} · ${T.dead ? 'мёртв' : T.harvest ? 'готов к сбору' : T.age < st.mat ? `созревает (${st.mat})` : 'плодоносит'}${genes(T.pid).includes('repeated_harvest') ? ' · многолетник' : ''}</div>
      ${T.scan ? `<div class="fm-stats">${STATS.map(k => `<span><small>${ST_RU[k]}</small><b>${Math.round(st[k] * 10) / 10}</b></span>`).join('')}</div>`
        : `<div class="fm-muted" style="margin:8px 0">Статы неизвестны — проверь анализатором 📟.</div>`}
      ${muts.length ? `<div class="fm-muted">Может мутировать в: ${muts.map(m => `${img(SP.plants[m].prod, 'px sm')}${esc(nm(m))}`).join(', ')}. Для этого нужна нестабильность от 60 — подкармливай Left 4 Zed.</div>` : ''}
    </div></div>`;
  }
  function render() {
    const root = document.getElementById('farm-root'); if (!root) return;
    if (!SP) { root.innerHTML = '<p>Спрайты теплицы не загрузились.</p>'; return; }
    const T = F.trays[F.sel];
    root.innerHTML = `<div class="fm">
      <div class="fm-top">
        <div class="fm-speed">${[[0, '⏸'], [1, '▶'], [3, '⏩']].map(([s, t]) => `<button data-fspeed="${s}" class="${F.speed === s ? 'on' : ''}">${t}</button>`).join('')}</div>
        <span>Цикл ${F.cycles}</span><span>🧺 Урожай: ${F.crops}</span><span>🧬 Мутаций: ${F.mutants}</span><span>📗 Гербарий: ${Object.keys(F.album).length}/${ALBUM.length}</span>
        <button class="fm-reset" data-freset="1" title="Начать заново">↺</button>
      </div>
      <div class="fm-main">
        <div class="fm-trays">${F.trays.map(trayCard).join('')}</div>
        <div class="fm-side">
          <div class="fm-card"><div class="fm-tools">${TOOLS.map(([k, u, n, d]) => `<button data-ftool="${k}" title="${esc(n)}: ${esc(d)}">${img(u, 'px')}<span>${esc(n)}</span></button>`).join('')}</div>
            <div class="fm-muted" style="margin-top:6px">Инструмент применяется к выбранному лотку (${F.sel + 1}).</div></div>
          <div class="fm-card">${detail(T, F.sel)}</div>
        </div>
      </div>
      <div class="fm-card"><h3>📜 Журнал</h3><div class="fm-log">${F.log.slice(0, 10).map(([c, t]) => `<div class="${c}">${t}</div>`).join('') || '<span class="fm-muted">Посади что-нибудь и включи время ▶.</span>'}</div></div>
      <div class="fm-card"><h3>📗 Гербарий</h3><div class="fm-album">${ALBUM.map(id => `<span class="${F.album[id] ? 'got' : ''}" title="${esc(nm(id))}${F.album[id] ? ' — собрано ' + F.album[id] : ' — ещё не собирали'}">${img(SP.plants[id].prod, 'px')}</span>`).join('')}</div></div>
    </div>`;
  }
  // Лёгкая перерисовка только лотков (раз в цикл), чтобы клики не терялись
  function refreshTrays() {
    const box = document.querySelector('.fm-trays'); if (!box) return render();
    box.innerHTML = F.trays.map(trayCard).join('');
    const top = document.querySelector('.fm-top'); if (top) top.children[1].textContent = 'Цикл ' + F.cycles;
  }

  let timer = null, acc = 0;
  function loop() {
    clearInterval(timer);
    timer = setInterval(() => {
      const root = document.getElementById('farm-root');
      if (!root || !root.offsetParent || !F.speed) return;
      acc += 250 * F.speed;
      if (acc < 2500) return;
      acc = 0; F.cycles++;
      F.trays.forEach(cycle);
      save(); render();
    }, 250);
  }

  document.addEventListener('click', e => {
    const root = document.getElementById('farm-root'); if (!root || !root.contains(e.target)) return;
    let b;
    if ((b = e.target.closest('[data-ftray]'))) { F.sel = +b.dataset.ftray; }
    else if ((b = e.target.closest('[data-fspeed]'))) { F.speed = +b.dataset.fspeed; }
    else if ((b = e.target.closest('[data-ftool]'))) { const T = F.trays[F.sel]; const m = act(b.dataset.ftool, T, F.sel); if (m) log(`Лоток ${F.sel + 1}: ${m}`); }
    else if ((b = e.target.closest('[data-fplant]'))) { plant(F.trays[F.sel], b.dataset.fplant); if (!F.speed) F.speed = 1; }
    else if ((b = e.target.closest('[data-fpack]'))) { const s = F.seeds.splice(+b.dataset.fpack, 1)[0]; if (s) { plant(F.trays[F.sel], s.pid, s.st); } }
    else if ((b = e.target.closest('[data-freset]'))) { F = { trays: [newTray(), newTray(), newTray(), newTray()], sel: 0, speed: 1, seeds: [], album: F.album, crops: 0, mutants: 0, cycles: 0, log: [] }; }
    else return;
    save(); render();
  });

  window.renderFarm = function () { if (!F) F = load(); render(); loop(); };
})();

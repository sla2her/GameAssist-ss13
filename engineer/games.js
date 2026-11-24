// Тренажёры инженера: запуск суперматерии и взлом шлюза.
// Порядок запуска СМ — как в инструкции «Суперматерия — запуск» (guides.json): мезоны → азот в контур → насосы →
// фильтры → охладитель → коллекторы с плазмой → эмиттеры → SMES. Физика упрощена: это тренажёр порядка действий
// и реакции на аварию, а не точная модель кода.
(() => {
  const award = (id) => { try { const g = window.parent !== window && parent.PultGame; g && g.award(id); } catch (e) { /* */ } };
  const root = document.getElementById('games');
  if (!root) return;
  let game = 'sm';
  try { game = localStorage.getItem('engineer.game') === 'wire' ? 'wire' : 'sm'; } catch (e) { /* */ }

  /* ================= СУПЕРМАТЕРИЯ ================= */
  let SM;
  function smNew() {
    SM = {
      t: 0, run: false, timer: 0, over: '', log: [],
      mesons: false, cans: 0, pumps: false, filter: 'all', freezer: false,
      tanks: 0, coll: [0, 0, 0, 0], collLock: false, // 0 — пусто, 1 — бак вставлен, 2 — включён
      em: [0, 0], emLock: false, // 0 — не приварен, 1 — приварен, 2 — стреляет
      smesIn: false, smesOut: false,
      n2: 0, temp: 293, power: 0, integ: 100, smes: 0, plasma: 0, stable: 0, peak: 0,
      ev: null,
    };
    smLog('Смена началась. Двигатель не запущен, станция на резервных батареях. Запустите суперматерию по инструкции.');
  }
  function smLog(m, cls = '') { SM.log.unshift(`<div class="${cls}"><span>${fmtT(SM.t)}</span> ${m}</div>`); SM.log.length = Math.min(SM.log.length, 60); }
  const fmtT = (t) => `${Math.floor(t * 2 / 60)}:${String(t * 2 % 60).padStart(2, '0')}`;
  const firing = () => SM.em.filter((x) => x === 2).length;
  const collOn = () => SM.coll.filter((x) => x === 2).length;
  function smTick() {
    if (SM.over) return;
    SM.t++;
    // Подача азота из канистр
    if (SM.cans > 0 && SM.n2 < 2400 * SM.cans / 2) SM.n2 = Math.min(2400, SM.n2 + 120 * SM.cans);
    // Эмиттеры раскачивают кристалл
    SM.power = Math.max(0, SM.power * 0.985 + firing() * 55);
    SM.peak = Math.max(SM.peak, SM.power);
    // Тепло в камеру: чем меньше газа, тем сильнее греется
    const heat = SM.power * 0.06 * (1 + SM.plasma / 200);
    SM.temp += heat / (1 + SM.n2 / 400);
    // Охлаждение: только если насосы гоняют газ через охладитель
    const cold = SM.freezer ? 70 : 293;
    const flow = SM.pumps ? Math.min(1, SM.n2 / 1200) : 0.05;
    SM.temp += (cold - SM.temp) * 0.09 * flow * (SM.freezer ? 1 : 0.4);
    SM.temp = Math.max(60, SM.temp);
    // Плохой фильтр — продукты (плазма, O2) копятся в контуре и греют сильнее
    if (SM.filter !== 'n2' && firing()) SM.plasma = Math.min(400, SM.plasma + 4);
    if (SM.filter === 'n2') SM.plasma = Math.max(0, SM.plasma - 12);
    // Урон и лечение кристалла
    let d = 0;
    if (SM.temp > 313) d += (SM.temp - 313) * 0.012;
    if (SM.power > 5000) d += (SM.power - 5000) / 900;
    if (d > 0) SM.integ -= d; else if (SM.integ < 100 && SM.temp < 280 && SM.n2 > 600) SM.integ = Math.min(100, SM.integ + 0.15);
    // Энергия: коллекторы ловят излучение, SMES копит
    const gen = SM.power * 0.012 * collOn() / 4;
    const demand = 2.4;
    const net = (SM.smesIn ? gen : 0) - (SM.smesOut ? demand : 0.3);
    SM.smes = Math.max(0, Math.min(100, SM.smes + net * 0.04));
    if (SM.power > 4500 && !SM.w45) { SM.w45 = 1; smLog('⚠️ Мощность подходит к 5000 МэВ — выше кристалл повреждается. Выключите один эмиттер.', 'warn'); }
    if (SM.power < 3500) SM.w45 = 0;
    // Случайности смены
    if (!SM.ev && SM.t > 40 && Math.random() < 0.012) {
      SM.ev = Math.random() < 0.5 ? 'freezer' : 'clown';
      if (SM.ev === 'freezer') { SM.freezer = false; smLog('⚠️ <b>Охладитель отключился</b> — сбой питания отсека. Включите снова.', 'warn'); }
      if (SM.ev === 'clown') {
        if (!SM.emLock && firing()) { SM.em = SM.em.map((x) => (x === 2 ? 1 : x)); smLog('🤡 Клоун пробежал по двигателю и <b>выключил незаблокированные эмиттеры</b>. Блокируйте их ID-картой.', 'warn'); }
        else smLog('🤡 Клоун пытался выключить эмиттеры, но они заблокированы картой.', 'ok');
      }
    }
    if (SM.ev && SM.t % 60 === 0) SM.ev = null;
    if (firing() && !SM.mesons && SM.t % 9 === 0) smLog('😵 Вы смотрите на кристалл без мезонов — галлюцинации. Наденьте мезонные очки.', 'warn');
    // Пороги тревоги как в игре
    if (SM.integ < 94 && !SM.w94) { SM.w94 = 1; smLog('📻 «Кристалл суперматерии повреждается!» — тревога в инженерном канале.', 'bad'); }
    if (SM.integ < 80 && !SM.w80) { SM.w80 = 1; smLog('📻 Тревога ушла в общий канал: целостность ниже 80 %.', 'bad'); }
    if (SM.integ <= 0) { SM.integ = 0; SM.over = 'lose'; SM.run = false; smLog('💥 <b>РАССЛОЕНИЕ.</b> Кристалл взорвался. Проверьте порядок: сначала азот и охлаждение, потом эмиттеры.', 'bad'); }
    // Победа: SMES заряжен, кристалл цел, станция питается
    const ok = SM.integ >= 90 && SM.temp < 313 && firing() && collOn() && SM.smesIn && SM.smesOut;
    SM.stable = ok ? SM.stable + 1 : 0;
    if (ok && SM.smes >= 100 && !SM.over) {
      SM.over = 'win'; SM.run = false;
      smLog(`✅ <b>Станция запитана!</b> SMES заряжен, кристалл ${Math.round(SM.integ)} %. Время ${fmtT(SM.t)}.`, 'ok');
      award('eng.sm');
      if (SM.integ >= 99.5) award('eng.sm_clean');
    }
  }
  function act(a, i) {
    if (SM.over) return;
    const need = (cond, msg) => { if (!cond) smLog(msg, 'warn'); return cond; };
    switch (a) {
      case 'mesons': SM.mesons = !SM.mesons; smLog(SM.mesons ? 'Мезоны и радкостюм надеты.' : 'Мезоны сняты.'); break;
      case 'can': if (SM.cans < 2) { SM.cans++; smLog(`N₂-канистра прикручена ключом к порту подачи (${SM.cans}/2).`); } break;
      case 'pumps': SM.pumps = !SM.pumps; smLog(SM.pumps ? 'Насосы контура включены, поток на максимум.' : 'Насосы контура выключены.'); break;
      case 'filter': SM.filter = SM.filter === 'n2' ? 'all' : 'n2'; smLog(SM.filter === 'n2' ? 'Фильтры: азот остаётся в контуре, плазма и O₂ — в отход.' : 'Фильтры сброшены: всё идёт по кругу.'); break;
      case 'freezer': SM.freezer = !SM.freezer; if (SM.ev === 'freezer' && SM.freezer) SM.ev = null; smLog(SM.freezer ? 'Охладитель включён, температура на минимум.' : 'Охладитель выключен.'); break;
      case 'tanks': if (SM.tanks < 4) { SM.tanks = 4; smLog('Баки заправлены плазмой из канистры.'); } break;
      case 'coll':
        if (SM.coll[i] === 0) { if (need(SM.tanks > 0, 'Нет заправленного бака плазмы.')) { SM.tanks--; SM.coll[i] = 1; smLog(`Бак вставлен в коллектор ${i + 1}.`); } }
        else if (SM.coll[i] === 1) { if (need(!SM.collLock, 'Коллекторы заблокированы картой.')) { SM.coll[i] = 2; smLog(`Коллектор ${i + 1} включён.`); } }
        else if (need(!SM.collLock, 'Коллекторы заблокированы картой.')) { SM.coll[i] = 1; smLog(`Коллектор ${i + 1} выключен.`); }
        break;
      case 'collLock': if (need(collOn() > 0, 'Блокировать можно только включённые коллекторы.')) { SM.collLock = !SM.collLock; smLog(SM.collLock ? 'Коллекторы заблокированы ID-картой.' : 'Коллекторы разблокированы.'); } break;
      case 'weld': if (SM.em[i] === 0) { SM.em[i] = 1; smLog(`Эмиттер ${i + 1} прикручен и приварен к полу.`); } break;
      case 'em':
        if (need(SM.em[i] > 0, 'Эмиттер не приварен к полу — он не включится.') && need(!SM.emLock, 'Эмиттеры заблокированы картой.')) {
          SM.em[i] = SM.em[i] === 2 ? 1 : 2;
          if (SM.em[i] === 2 && (SM.n2 < 800 || !SM.pumps)) smLog(`⚠️ Эмиттер ${i + 1} стреляет, но контур ${SM.n2 < 800 ? 'почти пуст' : 'стоит без насосов'} — кристалл начнёт греться!`, 'warn');
          else smLog(`Эмиттер ${i + 1} ${SM.em[i] === 2 ? 'стреляет в кристалл' : 'выключен'}.`);
        }
        break;
      case 'emLock': if (need(firing() > 0, 'Блокировать можно только работающие эмиттеры.')) { SM.emLock = !SM.emLock; smLog(SM.emLock ? 'Эмиттеры заблокированы ID-картой.' : 'Эмиттеры разблокированы.'); } break;
      case 'smesIn': SM.smesIn = !SM.smesIn; smLog(SM.smesIn ? 'SMES: вход на максимум, зарядка включена.' : 'SMES: зарядка выключена.'); break;
      case 'smesOut': SM.smesOut = !SM.smesOut; smLog(SM.smesOut ? 'SMES: выход включён — станция питается от двигателя.' : 'SMES: выход выключен.'); break;
      case 'vent': SM.n2 = Math.max(0, SM.n2 - 600); SM.plasma = 0; smLog('Часть газа из камеры сброшена в космос.'); break;
      case 'scram': SM.em = SM.em.map((x) => (x === 2 ? 1 : x)); SM.emLock = false; smLog('🛑 Эмиттеры аварийно выключены.', 'warn'); break;
    }
  }
  const STEPS = [
    ['Мезоны и радкостюм', () => SM.mesons],
    ['Азот в контур (2 канистры)', () => SM.cans >= 2],
    ['Насосы контура на максимум', () => SM.pumps],
    ['Фильтры: азот в контуре', () => SM.filter === 'n2'],
    ['Охладитель на минимум', () => SM.freezer],
    ['Баки плазмы в коллекторы', () => SM.coll.every((x) => x > 0)],
    ['Коллекторы включены и заблокированы', () => collOn() === 4 && SM.collLock],
    ['Эмиттеры приварены', () => SM.em.every((x) => x > 0)],
    ['Эмиттеры стреляют и заблокированы', () => firing() === 2 && SM.emLock],
    ['SMES: вход и выход', () => SM.smesIn && SM.smesOut],
  ];
  const gauge = (v, max, lbl, val, bad) => `<div class="gg${bad ? ' bad' : ''}"><span>${lbl}</span><i><b style="width:${Math.max(0, Math.min(100, v / max * 100))}%"></b></i><em>${val}</em></div>`;
  const sw = (a, on, label, sub = '', i = '') => `<button type="button" class="sw${on ? ' on' : ''}" data-sm="${a}" data-i="${i}" ${SM.over ? 'disabled' : ''}><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</button>`;
  function smRender() {
    const glow = Math.min(1, SM.power / 5000), hot = SM.temp > 313 || SM.power > 5000;
    root.querySelector('#gbody').innerHTML = `
      <div class="smtop">
        <div class="crystal${hot ? ' hot' : ''}" style="--g:${glow}"><div class="gem"></div><small>${firing() ? 'Эмиттеры стреляют' : 'Кристалл спит'}</small></div>
        <div class="gauges">
          ${gauge(SM.integ, 100, 'Целостность', SM.integ.toFixed(1) + ' %', SM.integ < 94)}
          ${gauge(SM.power, 6000, 'Мощность', Math.round(SM.power) + ' МэВ', SM.power > 5000)}
          ${gauge(SM.temp, 600, 'Газ в камере', Math.round(SM.temp) + ' K', SM.temp > 313)}
          ${gauge(SM.n2, 2400, 'Азот в контуре', Math.round(SM.n2) + ' моль', SM.n2 < 600)}
          ${gauge(SM.smes, 100, 'Заряд SMES', Math.round(SM.smes) + ' %', false)}
          <div class="smctl"><button type="button" class="pri" data-sm="run" ${SM.over ? 'disabled' : ''}>${SM.run ? '⏸ Пауза' : '▶ Пуск времени'}</button><button type="button" data-sm="new">Новая смена</button><span>Время ${fmtT(SM.t)}</span></div>
        </div>
      </div>
      ${SM.over ? `<div class="${SM.over === 'win' ? 'tip' : 'warn'}">${SM.over === 'win' ? `Двигатель запущен за ${fmtT(SM.t)}, кристалл ${Math.round(SM.integ)} %.` : 'Кристалл расслоился. Нажмите «Новая смена» и попробуйте по порядку.'}</div>` : ''}
      <div class="smgrid">
        <div class="dev"><h4>Вы</h4>${sw('mesons', SM.mesons, '🥽 Мезоны', 'и радкостюм')}${sw('tanks', SM.tanks > 0, '🧪 Заправить баки', SM.tanks ? `баков: ${SM.tanks}` : 'плазмой из канистры')}</div>
        <div class="dev"><h4>Контур охлаждения</h4>${sw('can', SM.cans >= 2, '🔧 N₂-канистра к порту', `${SM.cans}/2`)}${sw('pumps', SM.pumps, '🌀 Насосы', SM.pumps ? 'максимум' : 'выкл')}${sw('filter', SM.filter === 'n2', '🧹 Фильтры', SM.filter === 'n2' ? 'азот в контуре' : 'всё по кругу')}${sw('freezer', SM.freezer, '❄️ Охладитель', SM.freezer ? 'минимум' : 'выкл')}</div>
        <div class="dev"><h4>Коллекторы</h4><div class="row4">${SM.coll.map((c, i) => sw('coll', c === 2, `К${i + 1}`, ['пусто', 'бак', 'вкл'][c], i)).join('')}</div>${sw('collLock', SM.collLock, '🪪 Блок картой')}</div>
        <div class="dev"><h4>Эмиттеры</h4><div class="row4">${SM.em.map((e, i) => (e === 0 ? sw('weld', false, `Э${i + 1}`, '🔥 приварить', i) : sw('em', e === 2, `Э${i + 1}`, e === 2 ? 'стреляет' : 'выкл', i))).join('')}</div>${sw('emLock', SM.emLock, '🪪 Блок картой')}</div>
        <div class="dev"><h4>SMES</h4>${sw('smesIn', SM.smesIn, '⚡ Вход/зарядка')}${sw('smesOut', SM.smesOut, '🏠 Выход в сеть')}</div>
        <div class="dev"><h4>Авария</h4>${sw('scram', false, '🛑 Выключить эмиттеры')}${sw('vent', false, '💨 Сбросить газ', 'в космос')}</div>
      </div>
      <div class="smbottom">
        <div class="cbox"><h3>Порядок запуска</h3><ol class="chk">${STEPS.map(([n, f]) => `<li class="${f() ? 'ok' : ''}">${n}</li>`).join('')}</ol></div>
        <div class="cbox"><h3>Журнал</h3><div class="glog">${SM.log.join('')}</div></div>
      </div>`;
  }
  function smLoop() {
    clearTimeout(SM.timer);
    if (!SM.run || root.hidden) { SM.run = false; return; }
    smTick(); smRender();
    SM.timer = setTimeout(smLoop, 500);
  }

  /* ================= ВЗЛОМ ШЛЮЗА ================= */
  // Функции проводов шлюза (как в коде: wires/airlock.dm). Цвета перемешиваются каждую игру.
  const WF = [
    ['power1', 'Основное питание 1'], ['power2', 'Основное питание 2'], ['backup1', 'Резервное питание 1'], ['backup2', 'Резервное питание 2'],
    ['bolts', 'Болты'], ['open', 'Открытие'], ['shock', 'Электрификация'], ['ai', 'Управление ИИ'],
    ['idscan', 'Сканер ID'], ['safe', 'Датчик безопасности'], ['timing', 'Таймер закрытия'], ['light', 'Индикатор болтов'],
  ];
  const COLORS = [['красный', '#e0453a'], ['синий', '#4a7be0'], ['зелёный', '#3fb85a'], ['жёлтый', '#e8c73a'], ['оранжевый', '#f08a2a'], ['фиолетовый', '#a06ad6'], ['белый', '#e8e8e8'], ['чёрный', '#333'], ['розовый', '#ef7fb8'], ['голубой', '#5fd0e8'], ['коричневый', '#8a5a30'], ['серый', '#8a8f98']];
  let W;
  function wNew() {
    const cols = COLORS.slice().sort(() => Math.random() - 0.5);
    const funcs = WF.slice().sort(() => Math.random() - 0.5);
    W = {
      wires: cols.map((c, i) => ({ c, f: funcs[i][0], fn: funcs[i][1], cut: false, known: false })),
      panel: false, gloves: Math.random() < 0.5, bolted: Math.random() < 0.75, shocked: Math.random() < 0.4,
      shockT: 0, powerT: 0, open: false, hp: 100, acts: 0, log: [], over: '',
    };
    W.log.unshift(`<div>Задание: открыть шлюз в тех-хранилище без доступа. ${W.bolted ? 'Шлюз <b>заболтирован</b> — горит красный индикатор.' : 'Болты подняты, но доступа у вас нет.'} ${W.shocked ? 'Слышно гудение — шлюз может быть <b>под током</b>.' : ''}</div>`);
  }
  const wPowered = () => !W.powerT && !(W.wires.some((w) => w.f === 'power1' && w.cut) && W.wires.some((w) => w.f === 'power2' && w.cut));
  const wShocking = () => wPowered() && (W.shocked || W.shockT > 0 || W.wires.some((w) => w.f === 'shock' && w.cut));
  function wLog(m, cls = '') { W.log.unshift(`<div class="${cls}">${m}</div>`); W.log.length = Math.min(W.log.length, 40); }
  function zap() {
    if (W.gloves) { wLog('Искры по перчаткам — изоляция спасла.', 'ok'); return; }
    W.hp -= 25; wLog('⚡ <b>Удар током!</b> −25 здоровья. Изолированные перчатки решают.', 'bad');
    if (W.hp <= 0) { W.over = 'lose'; wLog('Вы без сознания у шлюза. СБ найдёт вас первой.', 'bad'); }
  }
  function wAct(a, i) {
    if (W.over) return;
    if (a === 'gloves') { W.gloves = !W.gloves; wLog(W.gloves ? 'Изолированные перчатки надеты.' : 'Перчатки сняты.'); return; }
    if (a === 'panel') { if (wShocking()) zap(); W.panel = !W.panel; W.acts++; wLog(W.panel ? 'Отвёрткой сняли панель: видно 12 проводов.' : 'Панель закрыта.'); return; }
    if (a === 'crowbar') {
      W.acts++;
      if (W.open) return wLog('Шлюз уже открыт.');
      if (wShocking()) zap();
      if (wPowered()) return wLog('Ломом не открыть: у шлюза есть питание, мотор держит створки.', 'warn');
      if (W.bolted) return wLog('Ломом не открыть: болты опущены.', 'warn');
      W.open = true; return wWin('ломом без питания');
    }
    const w = W.wires[i];
    if (!W.panel) return wLog('Сначала снимите панель отвёрткой.', 'warn');
    W.acts++;
    if (wShocking()) zap();
    if (W.over) return;
    if (a === 'pulse') {
      if (w.cut) return wLog('Перерезанный провод не пульсануть — сначала почините.');
      const pw = wPowered();
      const msg = {
        power1: () => { W.powerT = 6; return 'Свет на шлюзе погас — основное питание отключилось на время.'; },
        power2: () => { W.powerT = 6; return 'Свет на шлюзе погас — основное питание отключилось на время.'; },
        backup1: () => 'Ничего заметного. Похоже на резервное питание.', backup2: () => 'Ничего заметного. Похоже на резервное питание.',
        bolts: () => { if (!pw) return 'Без питания — ничего.'; W.bolted = !W.bolted; return W.bolted ? 'Лязг! Болты <b>опустились</b>.' : 'Лязг! Болты <b>поднялись</b>.'; },
        open: () => { if (!pw) return 'Без питания — ничего.'; if (W.bolted) return 'Мотор дёрнулся, но болты держат.'; W.open = !W.open; return W.open ? 'Створки <b>открылись</b>!' : 'Створки закрылись.'; },
        shock: () => { if (!pw) return 'Без питания — ничего.'; W.shockT = 8; return 'Треск — шлюз <b>под током</b> на 30 секунд!'; },
        ai: () => 'Индикатор управления ИИ мигнул.', idscan: () => 'Лампочка доступа мигнула красным.',
        safe: () => 'Ничего не видно, но датчик щёлкнул.', timing: () => 'Что-то тикнуло в механизме.',
        light: () => 'Индикатор болтов мигнул.',
      }[w.f]();
      w.known = w.known || ['bolts', 'open', 'shock', 'ai', 'idscan', 'light', 'timing'].includes(w.f) && pw;
      wLog(`Мультитул → <b><i class="sq" style="background:${w.c[1]}"></i>${w.c[0]}</b>: ${msg}`);
      if (W.open) wWin('через провод открытия');
    }
    if (a === 'cut') {
      w.cut = !w.cut;
      if (!w.cut) return wLog(`Провод <b><i class="sq" style="background:${w.c[1]}"></i>${w.c[0]}</b> починен.`);
      const msg = {
        power1: 'Свет мигнул. Первая линия основного питания перерезана.', power2: 'Свет мигнул. Вторая линия основного питания перерезана.',
        backup1: 'Ничего не изменилось.', backup2: 'Ничего не изменилось.',
        bolts: wPowered() ? (W.bolted ? 'Болты остаются опущенными — провод перерезан.' : 'Лязг! Перерезанный провод <b>опустил болты</b>.') : 'Ничего.',
        open: 'Мотор открытия отрезан — дверь больше не откроется сама.', shock: wPowered() ? 'Треск! Пока провод перерезан, шлюз <b>постоянно под током</b>.' : 'Ничего.',
        ai: 'ИИ больше не управляет шлюзом.', idscan: 'Сканер ID отключён — шлюз не проверяет доступ.', safe: 'Датчик безопасности отключён: створки могут раздавить.',
        timing: 'Таймер закрытия отключён.', light: 'Индикатор болтов погас.',
      }[w.f];
      if (w.f === 'bolts' && wPowered()) W.bolted = true;
      w.known = true;
      wLog(`Кусачки → <b><i class="sq" style="background:${w.c[1]}"></i>${w.c[0]}</b>: ${msg}`);
    }
  }
  function wWin(how) {
    W.over = 'win';
    wLog(`✅ <b>Шлюз открыт</b> ${how}! Действий: ${W.acts}, здоровье: ${W.hp}.`, 'ok');
    award('eng.hack');
    if (W.hp === 100 && W.acts <= 8) award('eng.hack_clean');
  }
  function wRender() {
    const pw = wPowered(), sh = wShocking();
    root.querySelector('#gbody').innerHTML = `
      <div class="door${W.open ? ' open' : ''}${sh ? ' shock' : ''}">
        <div class="leaf l"></div><div class="leaf r"></div>
        <div class="lights"><i class="${pw ? 'on' : ''}" title="Питание"></i><i class="${W.bolted ? 'bolt' : ''}" title="Болты"></i><i class="${sh ? 'zap' : ''}" title="Ток"></i></div>
      </div>
      <div class="wstat">
        <span>Питание: <b>${pw ? 'есть' : 'нет'}</b></span><span>Болты: <b>${W.bolted ? 'опущены' : 'подняты'}</b></span><span>Здоровье: <b class="${W.hp < 50 ? 'bad' : ''}">${W.hp}</b></span><span>Действий: <b>${W.acts}</b></span>
        <button type="button" class="sw${W.gloves ? ' on' : ''}" data-w="gloves"><b>🧤 Изол. перчатки</b><small>${W.gloves ? 'надеты' : 'нет'}</small></button>
        <button type="button" class="sw${W.panel ? ' on' : ''}" data-w="panel" ${W.over ? 'disabled' : ''}><b>🪛 Панель</b><small>${W.panel ? 'открыта' : 'закрыта'}</small></button>
        <button type="button" class="sw" data-w="crowbar" ${W.over ? 'disabled' : ''}><b>🦯 Лом</b><small>открыть створки</small></button>
        <button type="button" class="sw" data-w="new"><b>🔄 Новый шлюз</b></button>
      </div>
      ${W.over ? `<div class="${W.over === 'win' ? 'tip' : 'warn'}">${W.over === 'win' ? 'Взлом удался.' : 'Взлом провален.'} Нажмите «Новый шлюз».</div>` : ''}
      <div class="wires${W.panel ? '' : ' closed'}">${W.wires.map((w, i) => `<div class="wire${w.cut ? ' cut' : ''}" style="--wc:${w.c[1]}">
        <i></i><span>${w.c[0]}${w.known ? ` · <em>${w.fn}</em>` : ''}</span>
        <button type="button" data-w="pulse" data-i="${i}" ${!W.panel || W.over ? 'disabled' : ''}>Мультитул</button>
        <button type="button" data-w="cut" data-i="${i}" ${!W.panel || W.over ? 'disabled' : ''}>${w.cut ? 'Починить' : 'Кусачки'}</button></div>`).join('')}</div>
      <div class="smbottom">
        <div class="cbox"><h3>Как взламывают</h3><ul>
          <li>Отвёрткой снять панель. Без изолированных перчаток провода под током бьют.</li>
          <li>Мультитул (пульс) показывает, что делает провод: свет погас — питание, лязг — болты, створки дёрнулись — открытие.</li>
          <li>Болты поднимает только пульс провода болтов при наличии питания. Перерезанный провод болтов <b>опускает</b> их навсегда.</li>
          <li>Откройте пульсом провода открытия — или отрежьте оба основных питания и откройте ломом (если болты подняты).</li>
          <li>Взлом без разрешения — статья КЗ. Здесь — тренировка инженера и ИИ.</li></ul></div>
        <div class="cbox"><h3>Журнал</h3><div class="glog">${W.log.join('')}</div></div>
      </div>`;
  }
  let wTimer = 0;
  function wLoop() {
    clearTimeout(wTimer);
    if (root.hidden || game !== 'wire') return;
    let ch = false;
    if (W.shockT > 0) { W.shockT--; ch = true; }
    if (W.powerT > 0) { W.powerT--; ch = true; if (!W.powerT) wLog('Основное питание восстановилось.'); }
    if (ch) wRender();
    wTimer = setTimeout(wLoop, 4000);
  }

  /* ================= ОБЩЕЕ ================= */
  function render() {
    root.innerHTML = `<div class="in wide-in"><nav class="gtabs"><button type="button" data-game="sm" aria-pressed="${game === 'sm'}">☢️ Запуск суперматерии</button><button type="button" data-game="wire" aria-pressed="${game === 'wire'}">🚪 Взлом шлюза</button></nav><div id="gbody"></div></div>`;
    if (game === 'sm') { if (!SM) smNew(); smRender(); } else { if (!W) wNew(); wRender(); wLoop(); }
  }
  root.addEventListener('click', (e) => {
    const g = e.target.closest('[data-game]');
    if (g) { game = g.dataset.game; try { localStorage.setItem('engineer.game', game); } catch (er) { /* */ } if (SM) SM.run = false; render(); return; }
    const b = e.target.closest('[data-sm]');
    if (b) {
      const a = b.dataset.sm;
      if (a === 'run') { SM.run = !SM.run; smLoop(); smRender(); return; }
      if (a === 'new') { clearTimeout(SM.timer); smNew(); smRender(); return; }
      act(a, +b.dataset.i); smRender(); return;
    }
    const w = e.target.closest('[data-w]');
    if (w) { if (w.dataset.w === 'new') wNew(); else wAct(w.dataset.w, +w.dataset.i); wRender(); }
  });
  window.engineerGames = { show: render };
})();

// Достижения и ранг Пульта: лёгкая геймификация поверх всех приложений.
// Приложения зовут parent.PultGame.award('id') (они в iframe того же источника), оболочка хранит
// полученные значки в localStorage (pult.ach), показывает всплывашку и окно «Достижения» (кнопка 🏆 справа снизу).
// Подключается после shell.js и пользуется его $, store, svg, APPS, byId.
(function () {
  // [значок, название, условие, приложение, очки]
  const ACH = {
    'visit.first': ['🚪', 'Первая смена', 'Открыть любое приложение Пульта', '', 5],
    'visit.5': ['🧭', 'Любопытный', 'Заглянуть в 5 разных приложений', '', 10],
    'visit.12': ['🗺️', 'Обход станции', 'Заглянуть в 12 разных приложений', '', 20],
    'visit.all': ['🛰️', 'Знаток станции', 'Открыть все приложения Пульта', '', 40],
    'viro.safe': ['🧫', 'Безопасный штамм', 'Собрать полезный (Positive) штамм, который передаётся только через кровь', 'viro', 15],
    'viro.outbreak': ['🦠', 'Нулевой пациент', 'Довести симуляцию вспышки до конца', 'viro', 10],
    'viro.cure': ['💉', 'Эпидемиолог', 'Остановить вспышку лекарством без погибших', 'viro', 25],
    'air.room': ['🧯', 'Герметик', 'Рассчитать, сколько газа нужно на отсек', 'air', 5],
    'air.breathe': ['🫁', 'Своя смесь', 'Смешать из двух чистых газов смесь, которой можно дышать', 'air', 20],
    'air.fire': ['🔥', 'Поджигатель', 'Получить в калькуляторе горящую смесь плазмы и кислорода', 'air', 10],
    'eng.guide': ['🔧', 'По инструкции', 'Пройти инструкцию инженера до последнего шага', 'engineer', 10],
    'eng.guide5': ['🛠️', 'Мастер на все руки', 'Пройти 5 разных инструкций', 'engineer', 30],
    'eng.sm': ['☢️', 'Запуск двигателя', 'Запустить суперматерию в тренажёре и зарядить SMES', 'engineer', 25],
    'eng.sm_clean': ['💎', 'Ни царапины', 'Запустить СМ, не повредив кристалл', 'engineer', 40],
    'eng.hack': ['🚪', 'Взломщик', 'Открыть шлюз в тренажёре взлома', 'engineer', 15],
    'eng.hack_clean': ['🧤', 'Чистая работа', 'Взломать шлюз без удара током и за 8 действий', 'engineer', 30],
    'det.solve': ['🔎', 'Дело закрыто', 'Раскрыть учебное дело', 'detective', 15],
    'det.fast': ['🕵️', 'Шерлок', 'Раскрыть дело быстрее чем за 20 минут игрового времени', 'detective', 25],
    'det.five': ['📁', 'Картотека', 'Раскрыть 5 дел', 'detective', 30],
    'det.types': ['🎖️', 'Универсал', 'Раскрыть дела всех типов: убийство, кража, взлом, саботаж', 'detective', 40],
    'ai.streak5': ['🤖', 'Три закона наизусть', 'Серия из 5 верных ответов в тренажёре ИИ', 'ai', 20],
    'ai.streak12': ['🧠', 'Безупречный ИИ', 'Серия из 12 верных ответов в тренажёре ИИ', 'ai', 40],
    'hop.streak5': ['🪪', 'Отдел кадров', 'Серия из 5 верных решений в тренажёре допусков', 'hop', 20],
    'cap.shift': ['🎖️', 'Образцовая смена', 'Отметить все пункты чек-листа смены Капитана', 'captain', 15],
    'avd.streak5': ['⚖️', 'Ходячий НРП', 'Серия из 5 верных ответов «Чья это норма?»', 'avd', 20],
    'avd.streak15': ['🏛️', 'АВД года', 'Серия из 15 верных ответов «Чья это норма?»', 'avd', 50],
    'xeno.win': ['🟢', 'Слаймовод', 'Вывести слайма нужного цвета в Загоне', 'xeno', 20],
    'xeno.rainbow': ['🌈', 'Радуга', 'Получить радужного слайма в Загоне', 'xeno', 40],
    'mine.quiz': ['⛏️', 'Гроза Лаваленда', 'Серия из 5 верных ответов в тренажёре фауны', 'mine', 20],
    'miners.plan': ['💰', 'Бизнес-план', 'Рассчитать выработку майнера', 'miners', 5],
    'botany.quiz': ['🌱', 'Зелёные пальцы', 'Серия из 5 верных ответов в тренажёре мутаций', 'botany', 20],
    'bitrun.quiz': ['💾', 'Битраннер', 'Серия из 5 верных ответов «Какой домен?»', 'bitrun', 20],
    'rnd.plan': ['🧪', 'Научный план', 'Построить план изучения до цели в R&D', 'rnd', 10],
    'gen.solve': ['🧬', 'Секвенсор', 'Разгадать ген в мини-игре Генетики', 'genetics', 15],
    'nan.run': ['🔬', 'Нанотехнолог', 'Запустить симуляцию на стенде Нанитов', 'nanites', 10],
  };
  const RANKS = [[0, 'Ассистент'], [40, 'Стажёр'], [100, 'Специалист'], [180, 'Старший специалист'], [280, 'Глава отдела'], [400, 'Капитан'], [560, 'Центральное Командование']];
  let st = { got: {}, seen: [] };
  try { const s = JSON.parse(store.get('ach') || 'null'); if (s && s.got) st = Object.assign(st, s); } catch (e) { /* испорчено — заново */ }
  const save = () => store.set('ach', JSON.stringify(st));
  const xp = () => Object.keys(st.got).reduce((a, id) => a + (ACH[id] ? ACH[id][4] : 5), 0);
  const rank = (x) => { let i = 0; while (i + 1 < RANKS.length && x >= RANKS[i + 1][0]) i++; return i; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // --- всплывашка ---
  const toastBox = document.createElement('div');
  toastBox.className = 'achtoasts';
  document.getElementById('win').appendChild(toastBox);
  function toast(html) {
    const t = document.createElement('div');
    t.className = 'achtoast';
    t.innerHTML = html;
    toastBox.appendChild(t);
    setTimeout(() => t.classList.add('out'), 3800);
    setTimeout(() => t.remove(), 4300);
  }

  function award(id, title, desc) {
    if (!id || st.got[id]) return false;
    const a = ACH[id] || ['⭐', title || id, desc || '', '', 5];
    const before = rank(xp());
    st.got[id] = Date.now();
    save();
    toast(`<b>${a[0]}</b><span><small>Достижение +${a[4]}</small>${esc(a[1])}</span>`);
    const after = rank(xp());
    if (after > before) setTimeout(() => toast(`<b>⬆️</b><span><small>Новый ранг</small>${RANKS[after][1]}</span>`), 900);
    updateBtn();
    if (!$('trophies').hidden) render();
    return true;
  }
  function visit(id) {
    if (!st.seen.includes(id)) { st.seen.push(id); save(); }
    award('visit.first');
    if (st.seen.length >= 5) award('visit.5');
    if (st.seen.length >= 12) award('visit.12');
    if (APPS.every((a) => st.seen.includes(a.id))) award('visit.all');
  }

  // --- кнопка и окно ---
  const btn = document.createElement('button');
  btn.className = 'gearbtn trophybtn';
  btn.id = 'trophyBtn';
  btn.setAttribute('aria-label', 'Достижения');
  btn.innerHTML = '<span>🏆</span>';
  document.getElementById('win').appendChild(btn);
  const box = document.createElement('section');
  box.className = 'settings';
  box.id = 'trophies';
  box.hidden = true;
  box.setAttribute('aria-label', 'Достижения');
  document.getElementById('win').appendChild(box);
  function updateBtn() {
    const n = Object.keys(st.got).length;
    btn.title = `Достижения: ${n} из ${Object.keys(ACH).length} · ${RANKS[rank(xp())][1]}`;
  }
  function render() {
    const x = xp(), r = rank(x), next = RANKS[r + 1];
    const pct = next ? Math.round((x - RANKS[r][0]) / (next[0] - RANKS[r][0]) * 100) : 100;
    const ids = Object.keys(ACH);
    const appName = (id) => (byId[id] ? byId[id].short || byId[id].name : 'Пульт');
    const groups = {};
    ids.forEach((id) => { const k = ACH[id][3]; (groups[k] = groups[k] || []).push(id); });
    box.innerHTML = `<div class="setbox achbox" role="dialog" aria-label="Достижения">
      <header class="sethead"><h2>Достижения</h2><span class="grow"></span>
        <button class="ibtn" id="achClose" title="Закрыть (Esc)" aria-label="Закрыть">${svg('close')}</button></header>
      <div class="setbody">
        <div class="achrank"><div><b>${RANKS[r][1]}</b><small>${x} очков${next ? ` · до ранга «${next[1]}» ещё ${next[0] - x}` : ' · высший ранг'}</small></div>
          <div class="achbar"><i style="width:${pct}%"></i></div>
          <small>Получено ${Object.keys(st.got).length} из ${ids.length} · открыто приложений ${st.seen.filter((s) => byId[s]).length} из ${APPS.length}</small></div>
        ${Object.entries(groups).map(([k, list]) => `<h3>${k ? esc(appName(k)) : 'Пульт'}</h3><div class="achgrid">${list.map((id) => {
          const a = ACH[id], g = st.got[id];
          return `<div class="ach${g ? ' got' : ''}"${k && byId[k] ? ` data-app="${k}"` : ''}><b>${g ? a[0] : '🔒'}</b><span><strong>${esc(a[1])}</strong><small>${esc(a[2])}</small></span><em>+${a[4]}</em></div>`;
        }).join('')}</div>`).join('')}
      </div></div>`;
    $('achClose').addEventListener('click', () => toggle(false));
  }
  function toggle(on) {
    on = on === undefined ? box.hidden : on;
    box.hidden = !on;
    btn.setAttribute('aria-expanded', on ? 'true' : 'false');
    if (on) render();
  }
  btn.addEventListener('click', () => toggle());
  box.addEventListener('click', (e) => {
    if (e.target === box) return toggle(false);
    const a = e.target.closest('.ach[data-app]');
    if (a) { toggle(false); open(a.dataset.app); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) toggle(false); });
  updateBtn();

  window.PultGame = { award, visit, list: () => Object.assign({}, st.got) };
  if (typeof current !== 'undefined' && current) visit(current.id);
})();

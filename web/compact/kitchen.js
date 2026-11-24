// Кухня и бар внутри Пульта: вкладка «🎮 Смена» с играми для сервиса.
// Само приложение кухни собирается из отдельной папки (ss13-kitchen) и здесь не меняется:
// этот файл Пульт подключает к странице кухни поверх неё. Рецепты берутся из данных самой кухни
// (D.reactions, D.recipes, D.items — выгрузка из кода BlueMoon), поэтому игры не расходятся со справочником.
(function () {
  'use strict';
  if (document.getElementById('view-game')) return;
  if (typeof D === 'undefined' || typeof barReactions === 'undefined' || typeof nameOf !== 'function') return;

  const award = id => { try { const g = window.parent !== window && parent.PultGame; g && g.award(id); } catch (e) { /* без Пульта */ } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rnd = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const S = '/obj/item/reagent_containers/food/snacks/';
  const isReag = p => p.startsWith('/datum/reagent');
  const fits = (have, need) => have === need || have.startsWith(need + '/');

  // Русские подписи ингредиентов (в игре они на английском — оригинал во всплывающей подсказке)
  const RU = {
    'beer': 'пиво', 'kahlua': 'калуа', 'whiskey': 'виски', 'wine': 'вино', 'vodka': 'водка', 'gin': 'джин', 'rum': 'ром',
    'tequila': 'текила', 'vermouth': 'вермут', 'cognac': 'коньяк', 'ale': 'эль', 'absinthe': 'абсент', 'hard cider': 'сидр',
    'creme de menthe': 'мятный ликёр', 'creme de cacao': 'ликёр какао', 'creme de coconut': 'кокосовый ликёр',
    'triple sec': 'трипл-сек', 'sake': 'саке', 'applejack': 'эпплджек', 'curaçao': 'кюрасао', 'navy rum': 'флотский ром',
    'water': 'вода', 'ice': 'лёд', 'coffee': 'кофе', 'cream': 'сливки', 'tea': 'чай', 'iced tea': 'холодный чай', 'cola': 'кола',
    'tonic water': 'тоник', 'soda water': 'содовая', 'lemon lime': 'лимон-лайм', 'sugar': 'сахар', 'pineapple juice': 'ананасовый сок',
    'orange juice': 'апельсиновый сок', 'grenadine': 'гренадин', 'lime juice': 'сок лайма', 'tomato juice': 'томатный сок',
    'lemon juice': 'лимонный сок', 'menthol': 'ментол', 'positronic oil': 'позитронное масло', 'table salt': 'соль',
    'black pepper': 'чёрный перец', 'milk': 'молоко', 'flour': 'мука', 'ketchup': 'кетчуп', 'soysauce': 'соевый соус',
    'cooking oil': 'растительное масло', 'honey': 'мёд', 'banana juice': 'банановый сок', 'berry juice': 'ягодный сок',
    'meat': 'мясной пласт', 'dough': 'тесто', 'flat dough': 'раскатанное тесто', 'dough slice': 'кусок теста', 'bun': 'булочка',
    'bread': 'буханка', 'bread slice': 'ломтик хлеба', 'steak': 'стейк', 'raw cutlet': 'сырая котлета', 'cutlet': 'котлета',
    'cheese wheel': 'головка сыра', 'cheese wedge': 'кусок сыра', 'ear of corn': 'кукуруза', 'tortilla': 'тортилья',
    'potato': 'картофель', 'potato wedges': 'картофельные дольки', 'space fries': 'картошка фри', 'tomato': 'помидор',
    'egg': 'яйцо', 'stick of butter': 'сливочное масло', 'garlic': 'чеснок', 'cabbage': 'капуста', 'apple': 'яблоко',
    'cherries': 'вишня', 'banana': 'банан', 'chili': 'перец чили', 'soybeans': 'соя', 'carp fillet': 'филе карпа',
    'ricebowl': 'рис в миске', 'boiled rice': 'варёный рис', 'spaghetti': 'сырые спагетти', 'boiled spaghetti': 'варёные спагетти',
    'pie dough': 'тесто для пирога', 'plain pie': 'пустой пирог', 'raw pastry base': 'сырая основа', 'pastry base': 'основа для выпечки',
    'pizza bread': 'основа для пиццы', 'raw meatball': 'сырая фрикаделька', 'meatball': 'фрикаделька', 'peapod': 'горох',
    'bowl': 'миска', 'burned mess': 'угли', 'cake batter': 'тесто для торта', 'plain cake': 'бисквит', 'chocolate bar': 'шоколадка',
    'tofu': 'тофу', 'popcorn': 'попкорн', 'tatortot': 'картофельные шарики', 'soydope': 'соевая каша', 'cornchips': 'кукурузные чипсы',
    'raw bacon': 'сырой бекон', 'bacon': 'бекон', 'boiled egg': 'варёное яйцо', 'pizzabread': 'основа для пиццы', 'fresh noodles': 'свежая лапша',
  };
  const en = p => nameOf(p);
  const ru = p => { const n = en(p); return RU[n.toLowerCase()] || n; };
  const lbl = p => { const n = en(p), r = RU[n.toLowerCase()]; return r ? `<span title="${esc(n)}">${esc(r[0].toUpperCase() + r.slice(1))}</span>` : esc(n); };

  // ---------- стили ----------
  const css = document.createElement('style');
  css.textContent = `
#view-game{overflow:auto}
.kg{flex:1;min-width:0;padding:16px 20px 60px;max-width:1100px;display:grid;gap:14px;align-content:start}
.kg-modes{display:flex;gap:6px;flex-wrap:wrap}
.kg-modes .chip.on{background:var(--accent);border-color:var(--accent);color:#fff}
.kg-card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow)}
.kg-card h3{margin:0 0 8px;font-size:15px}
.kg-muted{color:var(--muted);font-size:12.5px}
.kg-hud{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kg-hud .kg-btn{padding:2px 10px;margin-left:auto}
.kg-hud span{background:var(--chip);border-radius:8px;padding:3px 10px;font-size:13px;font-variant-numeric:tabular-nums}
.kg-btn{border:1px solid var(--line);background:var(--panel2);border-radius:9px;padding:6px 12px;cursor:pointer;font-weight:600}
.kg-btn:hover:not(:disabled){border-color:var(--accent)}
.kg-btn.main{background:var(--accent);border-color:var(--accent);color:#fff}
.kg-btn:disabled{opacity:.45;cursor:default}
.kg-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.kg-guest{display:flex;gap:14px;align-items:flex-start}
.kg-face{font-size:44px;line-height:1}
.kg-say{font-size:15px;line-height:1.45}
.kg-say b{color:var(--accent)}
.kg-pat{height:8px;border-radius:5px;background:var(--chip);overflow:hidden;margin-top:8px}
.kg-pat i{display:block;height:100%;background:var(--ok);transition:width .2s linear}
.kg-pat.low i{background:var(--bad)}.kg-pat.mid i{background:var(--warn)}
.kg-disp{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));gap:6px}
.kg-disp button{border:1px solid var(--line);background:var(--panel2);border-radius:8px;padding:5px 8px;cursor:pointer;text-align:left;font-size:13px;display:flex;gap:6px;align-items:center}
.kg-disp button:hover{border-color:var(--accent)}
.kg-disp i{width:10px;height:10px;border-radius:50%;flex:none;border:1px solid rgba(0,0,0,.25)}
.kg-glass{display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap}
.kg-cup{width:64px;height:92px;border:2px solid var(--muted);border-top:0;border-radius:0 0 14px 14px;display:flex;flex-direction:column-reverse;overflow:hidden;background:var(--panel2)}
.kg-cup i{display:block;width:100%}
.kg-log{font-size:13px;display:grid;gap:3px;max-height:160px;overflow:auto}
.kg-log .ok{color:var(--ok)}.kg-log .bad{color:var(--bad)}
.kg-ticket{border:1px dashed var(--muted);border-radius:10px;padding:10px 12px;background:var(--panel2);display:grid;gap:4px}
.kg-ticket b{font-size:16px}
.kg-cols{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.kg-items{display:flex;flex-wrap:wrap;gap:6px}
.kg-items button{border:1px solid var(--line);background:var(--panel2);border-radius:8px;padding:4px 10px;cursor:pointer;font-size:13px}
.kg-items button.sel{border-color:var(--accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 35%,transparent)}
.kg-items button.burn{background:#3a2a22;color:#f3c9a8}
.kg-mw{height:14px;border-radius:7px;background:linear-gradient(90deg,var(--chip) 0 60%,color-mix(in srgb,var(--ok) 45%,var(--chip)) 60% 90%,color-mix(in srgb,var(--bad) 45%,var(--chip)) 90%);position:relative;overflow:hidden}
.kg-mw i{position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--text)}
.kg-end{text-align:center;display:grid;gap:8px;justify-items:center}
.kg-end .big{font-size:42px}
.kg-hint{font-size:13px;background:color-mix(in srgb,var(--warn) 12%,var(--panel));border-left:3px solid var(--warn);padding:8px 10px;border-radius:0 8px 8px 0}
.pq{background:var(--panel);border:1px solid var(--line);border-top:4px solid var(--accent);border-radius:12px;padding:16px 18px;display:grid;gap:12px;max-width:900px}
.pq-h{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline}
.pq-h b{font-size:17px}.pq-h span{font-size:12.5px;color:var(--muted)}
.pq-q{font-size:16px;font-weight:600;line-height:1.45}
.pq-pre{font-size:14px;line-height:1.5;padding:10px 12px;border-left:3px solid var(--accent);background:var(--panel2);border-radius:0 8px 8px 0}
.pq-o{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px}
.pq-o button{text-align:left;border:1px solid var(--line);background:var(--panel2);border-radius:9px;padding:9px 12px;cursor:pointer;font-size:14px}
.pq-o button:hover:not(:disabled){border-color:var(--accent)}
.pq-o button.right{background:color-mix(in srgb,var(--ok) 20%,var(--panel));border-color:var(--ok)}
.pq-o button.wrong{background:color-mix(in srgb,var(--bad) 18%,var(--panel));border-color:var(--bad)}
.pq-o button:disabled{cursor:default}
.pq-r{font-size:14px;padding:9px 12px;border-radius:8px;border-left:3px solid var(--ok);background:color-mix(in srgb,var(--ok) 9%,var(--panel))}
.pq-r.bad{border-left-color:var(--bad);background:color-mix(in srgb,var(--bad) 9%,var(--panel))}
.pq-n{justify-self:start;border:1px solid var(--accent);background:var(--accent);color:#fff;border-radius:9px;padding:6px 14px;font-weight:600;cursor:pointer}
.pult-compact .kg{padding:10px 10px 40px;gap:10px}
.pult-compact .kg-card{padding:10px 12px}
.pult-compact .kg-face{font-size:34px}
.pult-compact .kg-disp{grid-template-columns:repeat(auto-fill,minmax(112px,1fr))}
`;
  document.head.appendChild(css);

  // ---------- вкладка ----------
  const tabs = document.querySelector('header .tabs');
  const main = document.querySelector('main');
  if (!tabs || !main) return;
  const tabBtn = document.createElement('button');
  tabBtn.className = 'tab';
  tabBtn.dataset.game = '1';
  tabBtn.textContent = '🎮 Смена';
  tabs.appendChild(tabBtn);
  const view = document.createElement('section');
  view.className = 'view';
  view.id = 'view-game';
  view.innerHTML = '<div class="kg" id="kg"></div>';
  main.appendChild(view);
  const root = view.querySelector('#kg');
  let mode = 'bar';
  try { mode = localStorage.getItem('pult.kitchen.game') || 'bar'; } catch (e) { /* */ }

  function show() {
    document.querySelectorAll('header .tab').forEach(b => b.classList.toggle('on', b === tabBtn));
    document.querySelectorAll('main > .view').forEach(v => v.classList.toggle('on', v === view));
    render();
  }
  tabBtn.addEventListener('click', show);
  // Другие вкладки: прячем игру и даём кухне перерисоваться (хэш мог не поменяться)
  tabs.addEventListener('click', e => {
    const b = e.target.closest('.tab');
    if (!b || b === tabBtn || !view.classList.contains('on')) return;
    view.classList.remove('on');
    setTimeout(() => { try { route(); } catch (err) { /* */ } }, 0);
  }, true);

  function render() {
    const modes = [['bar', '🍸 Смена бармена'], ['cook', '🍳 Смена повара'], ['quiz', '❓ Угадай рецепт']];
    root.innerHTML = `<div class="kg-modes">${modes.map(([k, t]) => `<span class="chip${k === mode ? ' on' : ''}" data-kgmode="${k}">${t}</span>`).join('')}</div><div id="kg-body"></div>`;
    ({ bar: renderBar, cook: renderCook, quiz: renderQuiz })[mode]();
  }
  root.addEventListener('click', e => {
    const m = e.target.closest('[data-kgmode]');
    if (m) { mode = m.dataset.kgmode; try { localStorage.setItem('pult.kitchen.game', mode); } catch (err) { /* */ } render(); }
  });
  const body = () => root.querySelector('#kg-body');

  // =====================================================================
  // БАРМЕН
  // =====================================================================
  const BASE = [];
  for (const k of ['booze', 'soda']) for (const p of ((D.dispensers[k] || {}).dispensable_reagents || [])) if (!BASE.includes(p)) BASE.push(p);
  const baseSet = new Set(BASE);
  const DRINKS = barReactions.filter(r => !r.temp && !r.cat.length && r.req.length >= 2 && r.req.length <= 4 && r.res.length
    && r.req.every(([p]) => baseSet.has(p)) && !/vinegar|citrus/i.test(r.name));
  const drinkByName = n => DRINKS.find(r => r.name === n);
  const GUESTS = [
    ['👨‍✈️', 'Капитан', ['Manhattan', 'Classic Martini', 'Whiskey Sour', 'Stinger'], ['Совещание глав затянулось. {d}, пожалуйста.', 'Станция подождёт пять минут. {d}.']],
    ['🤡', 'Клоун', ['Bug Spray', 'Snow White', 'Sugar Rush', 'Thirteen Loko'], ['ХОНК! Мне {d}, и чтобы весело!', '{d}! Только не говори СБ, что я тут.']],
    ['🫥', 'Мим', ['Gin and Tonic', 'Iced Tea', 'Vodka Martini'], ['*молча тычет пальцем в строчку меню: {d}*', '*изображает стакан и показывает в меню: {d}*']],
    ['🪪', 'Глава Персонала', ['Gin and Tonic', 'Gin Fizz', 'Iced Coffee'], ['Очередь за доступами подождёт. {d}, будь добр.']],
    ['🛡️', 'Офицер СБ', ['Americano', 'Iced Coffee', 'Black Russian'], ['{d}. Быстро, у меня патруль.', 'Красный код не повод отказываться от {d}.']],
    ['⛏️', 'Шахтёр', ['Iced Beer', 'Grog', 'Whiskey Soda', 'Rum and Coke'], ['Только с Лаваленда, в горле пепел. {d}!', 'Сдал руду, хочу {d}.']],
    ['🔬', 'Учёный', ['Kamikaze', 'Thirteen Loko', 'Alexander'], ['Токсины опять что-то взорвали. Мне {d}.', 'Для науки: {d}. Двойную дозу не надо.']],
    ['🩺', 'Врач', ['Iced Tea', 'Lemonade', 'Painkiller'], ['Я на смене, так что... {d}.', '{d}. Звучит иронично, знаю.']],
    ['🔧', 'Инженер', ['Screwdriver', 'Anti-freeze', 'Whiskey Cola'], ['Отвёртку! Нет, не из пояса — {d}.', 'СМ стабилен, можно и {d}.']],
    ['📦', 'Грузчик', ['Tequila Sunrise', 'Margarita', 'Brave Bull'], ['Квартирмейстер отпустил на перерыв. {d}!']],
    ['🧑', 'Ассистент', ['Rum and Coke', 'Whiskey Cola', 'Vodka and Tonic', 'Screwdriver'], ['Мне бы {d}... в долг можно?', 'Я тут просто постою. И {d}, если можно.']],
    ['🤖', 'КПБ', ['Robotic Coffee', 'Liquor Synthanol'], ['БИП. ЗАПРОС: {d}. ПОЗИТРОННОЕ МАСЛО ОБЯЗАТЕЛЬНО.']],
    ['⛪', 'Священник', ['Andalusia', 'Sugar Rush', 'Bloody Mary'], ['Да благословит тебя... {d}, сын мой.']],
    ['🍳', 'Повар', ['Pina Colada', 'Bahama Mama', 'Midnight Joy'], ['Кухня на перерыве. {d} мне!']],
  ];
  const SHIFT_GUESTS = 8;
  let B = null, barTimer = null;
  function newBar() {
    B = { n: 0, served: 0, angry: 0, tips: 0, hints: 0, errs: 0, cur: null, glass: {}, step: 1, log: [], over: false };
    nextGuest();
  }
  function nextGuest() {
    if (B.n >= SHIFT_GUESTS || B.angry >= 3) { endBar(); return; }
    const g = rnd(GUESTS);
    const drink = drinkByName(rnd(g[2])) || rnd(DRINKS);
    const pat = 32 + drink.req.length * 9;
    B.cur = { g, drink, line: rnd(g[3]).replace('{d}', `<b>${esc(drink.name)}</b>`), pat, left: pat, hint: false };
    B.glass = {};
    B.n++;
  }
  function endBar() {
    B.over = true; B.cur = null;
    clearInterval(barTimer); barTimer = null;
    if (B.angry < 3) award('bar.shift');
    if (B.served === SHIFT_GUESTS && !B.hints && !B.errs) award('bar.perfect');
  }
  const glassMatch = (r, glass) => {
    const keys = Object.keys(glass).filter(k => glass[k] > 0);
    if (keys.length !== r.req.length) return false;
    const k0 = (glass[r.req[0][0]] || 0) / r.req[0][1];
    return k0 > 0 && r.req.every(([p, n]) => Math.abs((glass[p] || 0) / n - k0) < 1e-9);
  };
  const recipeText = r => r.req.map(([p, n]) => `${lbl(p)} ${n}`).join(' + ');
  function guestLeaves(angryMsg) {
    B.angry++; B.errs++;
    B.log.unshift(['bad', angryMsg]);
    nextGuest();
  }
  function tickBar() {
    if (!B || B.over || !B.cur || mode !== 'bar' || !view.classList.contains('on')) return;
    B.cur.left -= 0.25;
    if (B.cur.left <= 0) { guestLeaves(`${B.cur.g[0]} ${B.cur.g[1]} не дождался «${esc(B.cur.drink.name)}» и ушёл злым.`); renderBar(); return; }
    const bar = root.querySelector('.kg-pat'); if (!bar) return;
    const f = B.cur.left / B.cur.pat;
    bar.firstElementChild.style.width = (f * 100) + '%';
    bar.className = 'kg-pat' + (f < 0.25 ? ' low' : f < 0.5 ? ' mid' : '');
  }
  function renderBar() {
    const el = body(); if (!el) return;
    if (!B) {
      el.innerHTML = `<div class="kg-card"><h3>🍸 Смена у стойки</h3>
        <p>Посетители заказывают коктейли. Смешай их из раздатчика по рецептам из кода BlueMoon: важны ингредиенты и пропорции (их можно умножать, 2:1 = 4:2).
        Чем быстрее подашь, тем больше чаевых. Не тот напиток или долгое ожидание — гость уходит злым. Три злых гостя — и тебя снимают со смены.</p>
        <p class="kg-muted">За смену ${SHIFT_GUESTS} гостей. Подсказка «📖 Рецепт» есть, но чаевые за такой заказ вдвое меньше.</p>
        <button class="kg-btn main" data-bar="start">Открыть бар</button></div>`;
      return;
    }
    if (B.over) {
      const fired = B.angry >= 3;
      el.innerHTML = `<div class="kg-card kg-end"><div class="big">${fired ? '🚪' : B.served === SHIFT_GUESTS ? '🏆' : '🍸'}</div>
        <h3>${fired ? 'ГП снял тебя со смены: слишком много жалоб' : 'Смена окончена'}</h3>
        <div class="kg-hud"><span>Обслужено: ${B.served} из ${SHIFT_GUESTS}</span><span>Чаевые: ${B.tips} кр.</span><span>Злых гостей: ${B.angry}</span><span>Подсказок: ${B.hints}</span></div>
        <button class="kg-btn main" data-bar="start">Новая смена</button></div>${logHtml()}`;
      return;
    }
    const c = B.cur, f = c.left / c.pat;
    const glassKeys = Object.keys(B.glass).filter(k => B.glass[k] > 0);
    const total = glassKeys.reduce((a, k) => a + B.glass[k], 0);
    el.innerHTML = `
      <div class="kg-hud"><span>Гость ${B.n} из ${SHIFT_GUESTS}</span><span>💰 ${B.tips} кр.</span><span>😠 ${B.angry} / 3</span><button class="kg-btn" data-bar="start" title="Начать смену заново">↺</button></div>
      <div class="kg-card"><div class="kg-guest"><div class="kg-face">${c.g[0]}</div><div style="flex:1">
        <div class="kg-muted">${esc(c.g[1])}</div><div class="kg-say">${c.line}</div>
        <div class="kg-pat${f < 0.25 ? ' low' : f < 0.5 ? ' mid' : ''}"><i style="width:${f * 100}%"></i></div>
        ${c.hint ? `<div class="kg-hint" style="margin-top:8px">📖 ${esc(c.drink.name)}: ${recipeText(c.drink)}</div>` : ''}
      </div></div></div>
      <div class="kg-card"><h3>🥃 Стакан</h3><div class="kg-glass">
        <div class="kg-cup">${glassKeys.map(k => `<i style="height:${Math.min(100, B.glass[k] / Math.max(total, 6) * 100)}%;background:${(R[k] || {}).color || '#888'}"></i>`).join('')}</div>
        <div style="flex:1;min-width:200px;display:grid;gap:6px">
          <div>${glassKeys.length ? glassKeys.map(k => `${lbl(k)} ×${B.glass[k]}`).join(' · ') : '<span class="kg-muted">Пусто. Нажимай на бутылки ниже.</span>'}</div>
          <div class="kg-row">
            <span class="kg-muted">Порция:</span>
            ${[1, 5].map(s => `<button class="kg-btn${B.step === s ? ' main' : ''}" data-bar="step" data-s="${s}">${s}</button>`).join('')}
            <button class="kg-btn" data-bar="empty">🚰 Вылить</button>
            <button class="kg-btn" data-bar="hint" ${c.hint ? 'disabled' : ''}>📖 Рецепт</button>
            <button class="kg-btn main" data-bar="serve" ${glassKeys.length ? '' : 'disabled'}>🛎 Подать</button>
          </div>
        </div></div></div>
      <div class="kg-card"><h3>🍾 Раздатчики</h3><div class="kg-disp">
        ${BASE.map(p => `<button data-bar="add" data-p="${esc(p)}" title="${esc(en(p))}"><i style="background:${(R[p] || {}).color || '#888'}"></i>${lbl(p)}</button>`).join('')}
      </div></div>${logHtml()}`;
  }
  const logHtml = () => B && B.log.length ? `<div class="kg-card"><h3>📜 Журнал смены</h3><div class="kg-log">${B.log.slice(0, 12).map(([c, t]) => `<div class="${c}">${t}</div>`).join('')}</div></div>` : '';
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-bar]'); if (!b || b.disabled) return;
    const a = b.dataset.bar;
    if (a === 'start') { newBar(); clearInterval(barTimer); barTimer = setInterval(tickBar, 250); }
    else if (!B || B.over) return;
    else if (a === 'add') B.glass[b.dataset.p] = (B.glass[b.dataset.p] || 0) + B.step;
    else if (a === 'step') B.step = +b.dataset.s;
    else if (a === 'empty') B.glass = {};
    else if (a === 'hint') { B.cur.hint = true; B.hints++; }
    else if (a === 'serve') {
      const c = B.cur;
      if (glassMatch(c.drink, B.glass)) {
        let tip = 5 + Math.ceil(15 * c.left / c.pat);
        if (c.hint) tip = Math.floor(tip / 2);
        B.tips += tip; B.served++;
        B.log.unshift(['ok', `${c.g[0]} ${esc(c.g[1])}: «${esc(c.drink.name)}» — отлично, +${tip} кр.`]);
        nextGuest();
      } else {
        const made = DRINKS.find(r => glassMatch(r, B.glass));
        guestLeaves(`${c.g[0]} ${esc(c.g[1])} ждал «${esc(c.drink.name)}», а получил ${made ? `«${esc(made.name)}»` : 'непонятную смесь'}. Рецепт: ${recipeText(c.drink)}.`);
      }
    }
    renderBar();
  });

  // =====================================================================
  // ПОВАР
  // =====================================================================
  // Кто во что превращается: микроволновка (cooked_type), нож (slice_path), процессор, скалка
  const OPS = [];
  for (const [p, it] of Object.entries(I)) {
    if (it.cooked_type) OPS.push({ k: 'micro', from: p, to: it.cooked_type, n: 1 });
    if (it.slice_path) OPS.push({ k: 'slice', from: p, to: it.slice_path, n: it.slices_num || 1 });
  }
  for (const x of D.processor || []) OPS.push({ k: 'proc', from: x.in, to: x.out, n: x.mult || 1 });
  for (const x of D.processable || []) if (x.tool === 'TOOL_ROLLINGPIN') OPS.push({ k: 'roll', from: x.in, to: x.out, n: x.n || 1 });
  const opFor = (p, k) => OPS.filter(o => o.k === k && fits(p, o.from)).sort((x, y) => y.from.length - x.from.length)[0];
  const OPNAME = { micro: '📻 в микроволновку', slice: '🔪 нарезать', proc: '⚙️ в процессор', roll: '🪵 раскатать' };
  const BAD = /human|corgi|xeno|spider|gondola|wisdomcow|killertomato|skeleton|bear|goliath|mutant|monkey|lizard|vulpix|synth|imitation|badrecipe/;
  // Самая короткая цепочка до ингредиента: [шаги], где первый шаг — взять из холодильника
  function chain(q, seen = new Set()) {
    if (seen.has(q) || seen.size > 6) return null;
    const s = new Set(seen); s.add(q);
    let best = null;
    for (const o of OPS) {
      if (!fits(o.to, q) || BAD.test(o.from)) continue;
      const c = chain(o.from, s);
      if (c && (!best || c.length + 1 < best.length)) best = [...c, o];
    }
    return best || [{ k: 'fridge', to: q }];
  }
  const DISH_NAMES = ['Burger', 'Tofu burger', 'Pig in a Blanket', 'Sausage', 'Rice and pork', 'Black eyed gumbo', 'Carne de asada burrito',
    'Plain Taco', 'Cheesy nachos', 'Cheesy fries', 'Fish and chips', 'Loaded baked potato', 'Mashed potato', 'Fried egg', 'Buttered Toast',
    'Garlic Bread', 'Grilled cheese sandwich', 'Sandwich', 'Margherita pizza', 'Tomato pasta', 'Butter Noodles', 'Apple pie', 'Cherry cupcake',
    'Donut', 'Pancake', 'Chocolate cake', 'Tomato soup'];
  const DISHES = [];
  for (const r of D.recipes) {
    if (!DISH_NAMES.includes(r.name) || r.tools.length || DISHES.some(d => d.r.name === r.name)) continue;
    const parts = r.reqs.map(([q, n]) => ({ q, n, c: isReag(q) ? null : chain(q) }));
    const steps = parts.reduce((a, x) => a + (x.c ? x.c.length : 1), 1);
    if (steps <= 12) DISHES.push({ r, parts, steps });
  }
  const FRIDGE = [];
  for (const d of DISHES) for (const x of d.parts) if (x.c && x.c[0].k === 'fridge' && !FRIDGE.includes(x.c[0].to)) FRIDGE.push(x.c[0].to);
  // В холодильнике лежит то, с чего начинается цепочка: для «fridge» — сам ингредиент, иначе — исходник первой операции
  for (const d of DISHES) for (const x of d.parts) if (x.c && x.c[0].k !== 'fridge' && !FRIDGE.includes(x.c[0].from)) FRIDGE.push(x.c[0].from);
  const SHELF = [];
  for (const d of DISHES) for (const x of d.parts) if (isReag(x.q) && !SHELF.includes(x.q)) SHELF.push(x.q);
  for (const p of ['/datum/reagent/consumable/sodiumchloride', '/datum/reagent/consumable/blackpepper', '/datum/reagent/consumable/sugar',
    '/datum/reagent/consumable/milk', '/datum/reagent/consumable/ketchup', '/datum/reagent/consumable/soysauce']) if ((R[p]) && !SHELF.includes(p)) SHELF.push(p);
  FRIDGE.sort((a, b) => ru(a).localeCompare(ru(b), 'ru'));
  const BURNT = S + 'badrecipe';
  const chainText = x => isReag(x.q) ? `${lbl(x.q)} с полки` : x.c.map(o => o.k === 'fridge' ? `взять ${lbl(o.to)}` : `${o.k === 'micro' ? '📻' : o.k === 'slice' ? '🔪' : o.k === 'proc' ? '⚙️' : '🪵'} ${lbl(o.from)} → ${lbl(o.to)}${o.n > 1 ? ' ×' + o.n : ''}`).join(', ');

  const SHIFT_TICKETS = 5;
  let C = null, cookTimer = null, uid = 0;
  function newCook() {
    C = { n: 0, done: 0, failed: 0, coins: 0, hints: 0, burns: 0, cur: null, tray: [], sel: null, shelf: new Set(), mw: null, proc: null, log: [], over: false };
    nextTicket();
  }
  function nextTicket() {
    if (C.n >= SHIFT_TICKETS || C.failed >= 3) { endCook(); return; }
    const d = rnd(DISHES.filter(x => !C.cur || x !== C.cur.d));
    const time = 30 + d.steps * 10;
    C.cur = { d, time, left: time, hint: false };
    C.shelf = new Set();
    C.n++;
  }
  function endCook() {
    C.over = true; C.cur = null; C.mw = null;
    clearInterval(cookTimer); cookTimer = null;
    if (C.done >= 4) award('cook.shift');
    if (C.done === SHIFT_TICKETS && !C.hints && !C.burns) award('cook.perfect');
  }
  const addTray = (p, n = 1) => { for (let i = 0; i < n; i++) C.tray.push({ id: ++uid, p }); };
  function tickCook() {
    if (!C || C.over || mode !== 'cook' || !view.classList.contains('on')) return;
    let redraw = false;
    if (C.mw && C.mw.on) {
      C.mw.t += 0.25 / 7 * 100; // 7 секунд на полный круг
      if (C.mw.t >= 100) { mwStop(); redraw = true; }
    }
    if (C.proc) { C.proc.t -= 0.25; if (C.proc.t <= 0) { const o = C.proc.o; addTray(o.to, o.n); C.log.unshift(['ok', `⚙️ Процессор: ${lbl(o.from)} → ${lbl(o.to)}`]); C.proc = null; redraw = true; } }
    if (C.cur) {
      C.cur.left -= 0.25;
      if (C.cur.left <= 0) { C.failed++; C.log.unshift(['bad', `⏰ Тикет «${esc(C.cur.d.r.name)}» просрочен — клиент ушёл голодным.`]); nextTicket(); redraw = true; }
    }
    if (redraw) { renderCook(); return; }
    const m = root.querySelector('.kg-mw i'); if (m && C.mw) m.style.left = Math.min(100, C.mw.t) + '%';
    const t = root.querySelector('[data-left]'); if (t && C.cur) t.textContent = Math.ceil(C.cur.left) + ' с';
  }
  function mwStop() {
    const mw = C.mw; if (!mw) return;
    const t = mw.t;
    if (t < 60) { mw.on = false; C.log.unshift(['', `📻 Рано: ${mw.items.map(x => lbl(x.p)).join(', ')} ещё сырое. Можно включить снова.`]); return; }
    for (const x of mw.items) {
      if (t > 90) addTray(BURNT);
      else { const o = opFor(x.p, 'micro'); addTray(o ? o.to : x.p); }
    }
    if (t > 90) {
      C.burns += mw.items.length; award('cook.burn');
      C.log.unshift(['bad', `🔥 Пережарено! Вместо «${mw.items.map(x => ru(x.p)).join(', ')}» в микроволновке угли.`]);
    } else C.log.unshift(['ok', `📻 Готово: ${mw.items.map(x => { const o = opFor(x.p, 'micro'); return lbl(o ? o.to : x.p); }).join(', ')}`]);
    C.mw = null;
  }
  function renderCook() {
    const el = body(); if (!el) return;
    if (!C) {
      el.innerHTML = `<div class="kg-card"><h3>🍳 Смена на кухне</h3>
        <p>Приходят тикеты с заказами. Бери продукты из холодильника и доводи их до нужного вида: нож режет, скалка раскатывает тесто,
        процессор перемалывает, микроволновка готовит. Вытащи еду из микроволновки, пока бегунок в зелёной зоне, иначе получишь угли.
        Когда всё на подносе, собирай блюдо на столе. Цепочки взяты из кода BlueMoon.</p>
        <p class="kg-muted">За смену ${SHIFT_TICKETS} тикетов, три просроченных — конец смены. Подсказка показывает весь путь, но награда меньше.</p>
        <button class="kg-btn main" data-ck="start">Открыть кухню</button></div>`;
      return;
    }
    if (C.over) {
      el.innerHTML = `<div class="kg-card kg-end"><div class="big">${C.failed >= 3 ? '🧯' : C.done === SHIFT_TICKETS ? '🏆' : '🍽️'}</div>
        <h3>${C.failed >= 3 ? 'Кухню закрыли: слишком много просроченных заказов' : 'Смена окончена'}</h3>
        <div class="kg-hud"><span>Приготовлено: ${C.done} из ${SHIFT_TICKETS}</span><span>Заработано: ${C.coins} кр.</span><span>Углей: ${C.burns}</span><span>Подсказок: ${C.hints}</span></div>
        <button class="kg-btn main" data-ck="start">Новая смена</button></div>${cookLog()}`;
      return;
    }
    const c = C.cur, d = c.d;
    const sel = C.tray.find(x => x.id === C.sel);
    const acts = sel ? ['slice', 'roll', 'proc', 'micro'].filter(k => opFor(sel.p, k)) : [];
    el.innerHTML = `
      <div class="kg-hud"><span>Тикет ${C.n} из ${SHIFT_TICKETS}</span><span>💰 ${C.coins} кр.</span><span>❌ ${C.failed} / 3</span><button class="kg-btn" data-ck="start" title="Начать смену заново">↺</button></div>
      <div class="kg-ticket"><span class="kg-muted">🧾 ЗАКАЗ · осталось <b data-left>${Math.ceil(c.left)} с</b></span><b>${esc(d.r.name)}</b>
        <div>${d.parts.map(x => `${lbl(x.q)}${isReag(x.q) ? '' : ' ×' + x.n}`).join(' · ')}</div>
        ${c.hint ? `<div class="kg-hint">📖 ${d.parts.map(chainText).join('<br>📖 ')}</div>` : `<div><button class="kg-btn" data-ck="hint">📖 Как это сделать?</button></div>`}
      </div>
      <div class="kg-cols">
        <div class="kg-card"><h3>🧊 Холодильник</h3><div class="kg-items">${FRIDGE.map(p => `<button data-ck="take" data-p="${esc(p)}" title="${esc(en(p))}">${lbl(p)}</button>`).join('')}</div>
          <h3 style="margin-top:12px">🧂 Полка</h3><div class="kg-items">${SHELF.map(p => `<button data-ck="shelf" data-p="${esc(p)}" class="${C.shelf.has(p) ? 'sel' : ''}" title="${esc(en(p))}">${lbl(p)}${C.shelf.has(p) ? ' ✓' : ''}</button>`).join('')}</div>
          <div class="kg-muted" style="margin-top:6px">Отмеченное на полке пойдёт в блюдо.</div></div>
        <div class="kg-card"><h3>🍽 Поднос</h3>
          <div class="kg-items">${C.tray.length ? C.tray.map(x => `<button data-ck="sel" data-id="${x.id}" class="${x.id === C.sel ? 'sel' : ''}${x.p === BURNT ? ' burn' : ''}" title="${esc(en(x.p))}">${lbl(x.p)}</button>`).join('') : '<span class="kg-muted">Пусто. Возьми что-нибудь из холодильника.</span>'}</div>
          ${sel ? `<div class="kg-row" style="margin-top:10px"><span class="kg-muted">${lbl(sel.p)}:</span>
            ${acts.map(k => `<button class="kg-btn" data-ck="op" data-k="${k}" ${(k === 'micro' && C.mw && C.mw.on) || (k === 'proc' && C.proc) ? 'disabled' : ''}>${OPNAME[k]}</button>`).join('')}
            <button class="kg-btn" data-ck="trash">🗑 выбросить</button></div>` : '<div class="kg-muted" style="margin-top:8px">Нажми на продукт на подносе, чтобы увидеть, что с ним можно сделать.</div>'}
          <div style="margin-top:12px"><button class="kg-btn main" data-ck="cook">🍽 Собрать «${esc(d.r.name)}»</button></div></div>
        <div class="kg-card"><h3>📻 Микроволновка</h3>
          ${C.mw ? `<div>${C.mw.items.map(x => lbl(x.p)).join(', ')}</div><div class="kg-mw" style="margin:8px 0"><i style="left:${Math.min(100, C.mw.t)}%"></i></div>
            <div class="kg-row">${C.mw.on ? '<button class="kg-btn main" data-ck="mwstop">⏹ Достать</button>' : '<button class="kg-btn main" data-ck="mwgo">▶ Включить</button><button class="kg-btn" data-ck="mwout">Вынуть сырым</button>'}</div>
            <div class="kg-muted" style="margin-top:6px">Зелёная зона — готово, красная — подгорает.</div>`
            : '<div class="kg-muted">Пусто. Положи продукт с подноса кнопкой «📻 в микроволновку».</div>'}
          <h3 style="margin-top:12px">⚙️ Процессор</h3><div class="kg-muted">${C.proc ? `Мелет: ${lbl(C.proc.o.from)}…` : 'Свободен.'}</div></div>
      </div>${cookLog()}`;
  }
  const cookLog = () => C && C.log.length ? `<div class="kg-card"><h3>📜 Журнал кухни</h3><div class="kg-log">${C.log.slice(0, 12).map(([c, t]) => `<div class="${c}">${t}</div>`).join('')}</div></div>` : '';
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-ck]'); if (!b || b.disabled) return;
    const a = b.dataset.ck;
    if (a === 'start') { newCook(); clearInterval(cookTimer); cookTimer = setInterval(tickCook, 250); renderCook(); return; }
    if (!C || C.over) return;
    if (a === 'take') { addTray(b.dataset.p); C.sel = uid; }
    else if (a === 'shelf') { const p = b.dataset.p; C.shelf.has(p) ? C.shelf.delete(p) : C.shelf.add(p); }
    else if (a === 'sel') C.sel = +b.dataset.id === C.sel ? null : +b.dataset.id;
    else if (a === 'hint') { C.cur.hint = true; C.hints++; }
    else if (a === 'trash') { C.tray = C.tray.filter(x => x.id !== C.sel); C.sel = null; }
    else if (a === 'op') {
      const x = C.tray.find(y => y.id === C.sel), k = b.dataset.k, o = x && opFor(x.p, k);
      if (!o) return;
      C.tray = C.tray.filter(y => y !== x); C.sel = null;
      if (k === 'micro') { if (!C.mw) C.mw = { items: [], t: 0, on: false }; C.mw.items.push(x); }
      else if (k === 'proc') C.proc = { o: Object.assign({}, o, { from: x.p }), t: 1.5 };
      else { addTray(o.to, o.n); C.log.unshift(['ok', `${k === 'slice' ? '🔪' : '🪵'} ${lbl(x.p)} → ${lbl(o.to)}${o.n > 1 ? ' ×' + o.n : ''}`]); }
    }
    else if (a === 'mwgo') { C.mw.on = true; }
    else if (a === 'mwstop') mwStop();
    else if (a === 'mwout') { C.mw.items.forEach(x => C.tray.push(x)); C.mw = null; }
    else if (a === 'cook') {
      const d = C.cur.d, used = [], miss = [];
      for (const x of d.parts) {
        if (isReag(x.q)) { if (!C.shelf.has(x.q)) miss.push(ru(x.q)); continue; }
        let got = 0;
        for (const y of C.tray) if (got < x.n && !used.includes(y) && fits(y.p, x.q)) { used.push(y); got++; }
        if (got < x.n) miss.push(`${ru(x.q)}${x.n > 1 ? ' ×' + (x.n - got) : ''}`);
      }
      if (miss.length) { C.log.unshift(['bad', `🍽 Не собирается: не хватает ${esc(miss.join(', '))}.`]); }
      else {
        C.tray = C.tray.filter(y => !used.includes(y)); C.sel = null;
        let pay = 10 + Math.ceil(20 * C.cur.left / C.cur.time);
        if (C.cur.hint) pay = Math.floor(pay / 2);
        C.coins += pay; C.done++;
        C.log.unshift(['ok', `✅ «${esc(d.r.name)}» отдано на раздачу, +${pay} кр.`]);
        nextTicket();
      }
    }
    renderCook();
  });

  // =====================================================================
  // УГАДАЙ РЕЦЕПТ
  // =====================================================================
  const QUIZ_FOOD = D.recipes.filter(r => !r.tools.length && r.reqs.length >= 2 && r.reqs.length <= 4 && !BAD.test(r.result) && !r.reqs.some(([q]) => BAD.test(q) || !(I[q] || R[q])));
  const POOL_R = [...new Set(DRINKS.flatMap(r => r.req.map(([p]) => p)))];
  const POOL_I = [...new Set(QUIZ_FOOD.flatMap(r => r.reqs.map(([q]) => q)).filter(q => !isReag(q)))];
  const setKey = list => list.map(x => x[0]).sort().join('|');
  function variants(list, isDrink) {
    const key = setKey(list), out = [];
    let guard = 0;
    while (out.length < 3 && guard++ < 60) {
      const v = list.map(x => x.slice());
      const i = Math.floor(Math.random() * v.length);
      const pool = isReag(v[i][0]) ? (isDrink ? POOL_R : POOL_R.concat(['/datum/reagent/consumable/sodiumchloride', '/datum/reagent/consumable/milk'])) : POOL_I;
      const repl = rnd(pool);
      if (v.some(x => x[0] === repl)) continue;
      v[i][0] = repl;
      const k = setKey(v);
      if (k === key || out.some(o => setKey(o) === k)) continue;
      out.push(v);
    }
    return out;
  }
  const fmtSet = list => list.map(([p, n]) => `${lbl(p)}${isReag(p) ? ' ' + n : n > 1 ? ' ×' + n : ''}`).join(' + ');
  const Q = { x: null, pick: null, ok: 0, n: 0, streak: 0, best: 0 };
  try { Q.best = +(localStorage.getItem('pq.kitchen') || 0); } catch (e) { /* */ }
  function genQ() {
    const drink = Math.random() < 0.5;
    const r = drink ? rnd(DRINKS) : rnd(QUIZ_FOOD);
    const list = drink ? r.req : r.reqs;
    const name = r.name;
    if (Math.random() < 0.65) {
      const opts = shuffle([{ h: fmtSet(list), ok: true }, ...variants(list, drink).map(v => ({ h: fmtSet(v), ok: false }))]);
      return { q: `Из чего ${drink ? 'смешивают коктейль' : 'готовят'} <b>${esc(name)}</b>?`, opts, ex: `${esc(name)}: ${fmtSet(list)}.` };
    }
    const same = drink ? DRINKS : QUIZ_FOOD;
    const others = shuffle(same.filter(x => x.name !== name)).slice(0, 3);
    const opts = shuffle([{ h: esc(name), ok: true }, ...others.map(x => ({ h: esc(x.name), ok: false }))]);
    return { pre: `<div class="pq-pre">${drink ? '🍸 В шейкере' : '🍽 На столе'}: ${fmtSet(list)}</div>`, q: 'Что получится?', opts, ex: `Это ${esc(name)}.` };
  }
  function renderQuiz() {
    const el = body(); if (!el) return;
    if (!Q.x) { Q.x = genQ(); Q.pick = null; }
    const x = Q.x, done = Q.pick !== null, right = done && x.opts[Q.pick].ok;
    el.innerHTML = `<div class="pq"><div class="pq-h"><b>Угадай рецепт</b><span>${Q.n ? `верно ${Q.ok} из ${Q.n} · серия ${Q.streak} · рекорд ${Q.best}` : 'серия из 5 верных — достижение 🏆'}</span></div>
      ${x.pre || ''}<div class="pq-q">${x.q}</div>
      <div class="pq-o">${x.opts.map((o, i) => `<button type="button" data-kq="${i}" class="${done ? (o.ok ? 'right' : (i === Q.pick ? 'wrong' : '')) : ''}" ${done ? 'disabled' : ''}>${o.h}</button>`).join('')}</div>
      ${done ? `<div class="pq-r ${right ? 'ok' : 'bad'}"><b>${right ? 'Верно!' : 'Нет.'}</b> ${x.ex}</div><button type="button" class="pq-n" data-kqn="1">Дальше →</button>` : ''}</div>
      <div class="kg-muted">Рецепты коктейлей и блюд — из кода BlueMoon, как в справочнике на вкладках «Повар» и «Бармен».</div>`;
  }
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-kq]');
    if (b && !b.disabled && Q.pick === null) {
      Q.pick = +b.dataset.kq; Q.n++;
      if (Q.x.opts[Q.pick].ok) {
        Q.ok++; Q.streak++;
        if (Q.streak > Q.best) { Q.best = Q.streak; try { localStorage.setItem('pq.kitchen', Q.best); } catch (err) { /* */ } }
        if (Q.streak >= 5) award('kit.quiz');
      } else Q.streak = 0;
      renderQuiz(); return;
    }
    if (e.target.closest('[data-kqn]')) { Q.x = genQ(); Q.pick = null; renderQuiz(); }
  });

  // открыть игру сразу, если в адресе #game (удобно для проверки)
  if (location.hash === '#game') show();
})();

// Раскладка карточек «кирпичной кладкой» (masonry) для модулей Пульта.
// Пульт подключает этот файл к каждому приложению (см. prepare() в shell.js).
//
// Модули раскладывают карточки сеткой .grid в несколько колонок. Обычная CSS-сетка
// ставит карточки рядами: высота ряда = самая высокая карточка, и под короткими
// карточками остаются пустые дыры. Здесь каждая карточка по порядку встаёт в самую
// короткую колонку, поэтому дыр нет, а порядок чтения (слева направо, сверху вниз)
// сохраняется. Карточка с grid-column: 1 / -1 (класс .wide) занимает всю ширину
// и встаёт под самой длинной колонкой — как разделитель.
//
// Трогаем только сетки .grid, в которых лежат карточки (.card или .panel), — у сторонних
// приложений (Алхимик, Бриг, Кухня…) своих .grid с карточками нет, их вёрстка не меняется.
// В одну колонку (компактный режим, узкое окно) раскладка не нужна — стили снимаются.
(function () {
  if (window.__pultMasonry) return;
  window.__pultMasonry = true;

  const STYLE_ID = 'pult-masonry-style';
  const managed = new Set(); // сетки, которые сейчас разложены
  const ro = new ResizeObserver(() => schedule());
  const observed = new WeakSet();
  let pending = false;

  function addStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    // Строки по 1px: высота карточки задаётся числом строк, зазор между карточками — отступом позиции
    st.textContent =
      '.grid.pult-masonry{grid-auto-rows:1px;row-gap:0!important;grid-auto-flow:row!important}' +
      '.grid.pult-masonry>*{align-self:start}';
    document.head.appendChild(st);
  }

  const isWide = (el) => {
    if (el.classList.contains('wide')) return true;
    const gc = getComputedStyle(el).gridColumnEnd;
    return gc === '-1' || /span\s+\d{2,}/.test(gc);
  };

  function reset(grid) {
    grid.classList.remove('pult-masonry');
    for (const el of grid.children) { el.style.gridRow = ''; el.style.gridColumn = ''; }
    managed.delete(grid);
  }

  function layout(grid) {
    if (!grid.isConnected || !grid.clientWidth) return; // скрыта (другая вкладка или окно Пульта)
    // Число колонок и зазор берём у самой сетки до включения раскладки
    // Свои позиции тоже снимаем: карточка в колонке 3 создаёт лишние неявные колонки
    const wasOn = grid.classList.contains('pult-masonry');
    if (wasOn) reset(grid);
    const cs = getComputedStyle(grid);
    const cols = cs.gridTemplateColumns.split(' ').filter((t) => t && t !== 'none').length;
    const gap = parseFloat(cs.rowGap) || 0;
    const items = [...grid.children].filter((el) => getComputedStyle(el).display !== 'none' && !el.hidden);
    if (cols < 2 || items.length < 2) return;

    grid.classList.add('pult-masonry');
    const heights = new Array(cols).fill(0); // занятая высота колонок, px
    let col = 0;
    for (const el of items) {
      const wide = isWide(el);
      // Колонку ставим до замера: высота зависит от ширины карточки
      el.style.gridColumn = wide ? '1 / -1' : String(col + 1);
      const h = Math.ceil(el.getBoundingClientRect().height) || 1;
      if (wide) {
        const top = Math.max(...heights);
        el.style.gridRow = `${top + 1} / span ${h}`;
        heights.fill(top + h + gap);
      } else {
        el.style.gridRow = `${heights[col] + 1} / span ${h}`;
        heights[col] += h + gap;
      }
      // Следующая карточка — в самую короткую колонку (при равенстве — левую)
      col = heights.indexOf(Math.min(...heights));
      if (!observed.has(el)) { observed.add(el); ro.observe(el); }
    }
    managed.add(grid);
  }

  function run() {
    pending = false;
    addStyle();
    for (const g of managed) if (!g.isConnected) managed.delete(g);
    document.querySelectorAll('.grid').forEach((grid) => {
      if (!grid.querySelector(':scope > .card, :scope > .panel')) { if (managed.has(grid)) reset(grid); return; }
      if (!observed.has(grid)) { observed.add(grid); ro.observe(grid); }
      layout(grid);
    });
  }

  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(run);
  }

  // Вкладки модулей перерисовывают разделы целиком — следим за новыми карточками.
  // Показ скрытого раздела и смену режима окна ловит ResizeObserver на самих сетках.
  new MutationObserver(schedule).observe(document.body || document.documentElement, { childList: true, subtree: true });

  addEventListener('resize', schedule);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
  schedule();
})();

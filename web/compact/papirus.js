// Папирус внутри Пульта: в компактном режиме колонки «Блоки / Лист / Код» показываются по одной.
(() => {
  const root = document.documentElement;
  const ws = document.getElementById('workspace');
  if (!ws || document.querySelector('.pult-panes')) return;

  const PANES = [['palette', '🧱 Блоки'], ['page', '📄 Лист'], ['code', '⌨ Код']];
  const bar = document.createElement('div');
  bar.className = 'pult-panes';
  bar.innerHTML = PANES.map(([id, name]) => `<button type="button" data-pane="${id}">${name}${id === 'code' ? '<span class="n"></span>' : ''}</button>`).join('');
  ws.parentNode.insertBefore(bar, ws);

  let pane = 'page';
  try { pane = localStorage.getItem('papirus.pultPane') || 'page'; } catch (e) { /* */ }
  const show = (id) => {
    pane = id;
    root.dataset.pane = id;
    bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.pane === id ? 'true' : 'false'));
    try { localStorage.setItem('papirus.pultPane', id); } catch (e) { /* */ }
  };
  bar.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(b.dataset.pane); });
  show(pane);

  // Вставили блок из палитры — сразу показываем лист, чтобы было видно, куда он встал
  document.getElementById('palette').addEventListener('click', (e) => {
    if (root.classList.contains('pult-compact') && e.target.closest('.pitem')) setTimeout(() => show('page'), 0);
  });

  // На кнопке «Код» — счётчик символов, чтобы лимит листа был виден с любой вкладки
  const counter = document.getElementById('counter');
  const n = bar.querySelector('.n');
  const sync = () => {
    const m = (counter.textContent || '').match(/\d+(\s*\/\s*\d+)?/);
    n.textContent = m ? m[0].replace(/\s+/g, '') : '';
    n.classList.toggle('over', counter.classList.contains('over'));
  };
  new MutationObserver(sync).observe(counter, { childList: true, characterData: true, subtree: true, attributes: true });
  sync();

  // Пока открыты настройки, переключатель колонок не нужен
  const settings = document.getElementById('settingsView');
  const syncSettings = () => { bar.hidden = !settings.hidden; };
  new MutationObserver(syncSettings).observe(settings, { attributes: true, attributeFilter: ['hidden'] });
  syncSettings();
})();

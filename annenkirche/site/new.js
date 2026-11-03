// Новый дизайн: карточки товаров с выбором веса, подписка списком тарифов, магазин по категориям,
// меню кофейни. Корзину, окно товара и оформление заказа ведёт site.js (window.AKSite).
(() => {
  const D = window.AK;
  const S = window.AKSite;
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = S.money;
  const isDark = () => document.documentElement.dataset.theme !== 'light';
  const check = '<svg viewBox="0 0 24 24"><path d="m5 12 5 5 9-10"/></svg>';

  /** Фото есть не у всех товаров: у остальных рисунок упаковки из pic.js. */
  const PHOTOS = {
    'espresso-blend': 'img/photo/photo-1495474472287-4d71bcdd2085.jpg',
    'filter-africa': 'img/photo/photo-1461023058943-07fcbe16d735.jpg',
    'filter-latam': 'img/photo/photo-1512568400610-62da28bc8a13.jpg',
  };
  const picked = {};
  const product = (id) => D.products.find((p) => p.id === id);
  const firstWeight = (p) => (p.prices ? p.prices.findIndex((x) => x != null) : 0);

  function card(p) {
    const w = picked[p.id] ?? firstWeight(p);
    const img = PHOTOS[p.id] ? `<img src="${PHOTOS[p.id]}" alt="" loading="lazy">` : window.AKPic(p, '', isDark());
    const meta = p.origin ? `${p.origin}, ${p.roast}` : p.sub;
    const notes = p.notes ? `<div class="n-notes">${p.notes.split(', ').map((n) => `<span>${esc(n)}</span>`).join('')}</div>` : '';
    const seg = p.prices ? `<div class="n-seg" role="group" aria-label="Вес">${D.weights.map((x, i) =>
      `<button type="button" data-w="${i}" aria-pressed="${i === w}" ${p.prices[i] == null ? 'disabled' : ''}>${x}</button>`).join('')}</div>` : '';
    const price = p.prices ? p.prices[w] : p.price;
    return `<article class="n-card" data-id="${p.id}">
      <div class="ph">${img}${p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}<button type="button" class="n-more" data-open="${p.id}">Подробнее</button></div>
      <div class="bd"><h3>${esc(p.name.replace(' · ', ', '))}</h3><div class="meta">${esc(meta)}</div>${notes}${seg}
        <div class="n-buy"><span class="pr">${money(price)}</span><button class="btn orange small" type="button" data-n-add>В корзину</button></div></div></article>`;
  }

  function renderRows() {
    document.querySelectorAll('[data-n-row]').forEach((el) => {
      const ids = el.dataset.ids ? el.dataset.ids.split(',') : null;
      const items = ids ? ids.map(product) : D.products.filter((p) => p.cat === el.dataset.nRow).slice(0, Number(el.dataset.limit || 3));
      el.innerHTML = items.map(card).join('');
    });
  }

  function renderShop() {
    const grid = $('#n-shop-grid');
    if (!grid) return;
    const cat = D.categories.some((c) => c.id === location.hash.slice(1)) ? location.hash.slice(1) : 'coffee';
    $('#n-chips').innerHTML = D.categories.map((c) => `<a class="${c.id === cat ? 'on' : ''}" href="#${c.id}">${esc(c.title)}</a>`).join('');
    grid.innerHTML = D.products.filter((p) => p.cat === cat).map(card).join('');
  }
  window.addEventListener('hashchange', renderShop);

  // Подписка: тариф выбирается строкой, кнопка ведёт в бота
  let plan = (D.plans.find((p) => p.badge) || D.plans[0]).id;
  function renderPlans() {
    const el = $('#n-plans');
    if (!el) return;
    const cur = D.plans.find((p) => p.id === plan);
    el.innerHTML = D.plans.map((p) => `<button type="button" class="n-plan" role="radio" aria-checked="${p.id === plan}" data-plan="${p.id}">
        <span class="dot"></span>
        <span><b>${esc(p.title)}${p.badge ? `<span class="tag">${esc(p.badge)}</span>` : ''}</b><span>${esc(p.text)}, ${esc(p.every)}</span></span>
        <span class="pr">${money(p.price)}<small>за поставку</small></span></button>`).join('') +
      `<a class="btn orange" href="https://t.me/${D.brand.bot}?start=shop" target="_blank" rel="noopener">Оформить «${esc(cur.title)}» в боте</a>`;
  }

  // Меню кофейни — по листовке из зала (src/menu.ts бота). Сезонное меню сменится — обновить тут и там.
  const ML = (...v) => v.map((n) => `${n} мл`);
  const MENU = [
    { id: 'autumn', title: 'Осенние напитки', note: 'Сезонное меню, всё по 350 мл', items: [
      ['Тыквенный латте', [390]], ['Лютеранский глёг', [390]], ['Клюквенный тодди', [390]], ['Тропический глинтвейн', [390]],
      ['Облепиховый чай', [390]], ['Бабушкин чай с малиной', [390]], ['Вишнёвый фильтр', [390]], ['Горячий бамбл', [390]], ['Яблочная матча', [390]]] },
    { id: 'black', title: 'Чёрный кофе', items: [
      ['Эспрессо', [170], ML(40)], ['Американо', [220], ML(150)], ['Крепкий чёрный', [275], ML(150)], ['Фильтр', [220, 275], ML(250, 350)]] },
    { id: 'milk', title: 'Кофе с молоком', items: [
      ['Капучино', [285, 350], ML(250, 350)], ['Флэт уайт', [300], ML(250)], ['Латте', [350], ML(350)], ['Раф', [410], ML(350)]] },
    { id: 'cocoa', title: 'Какао', items: [
      ['Какао', [325, 375], ML(250, 350)], ['Какао с маршмеллоу', [395], ML(350)], ['Какао «Шоколадная шарлотка»', [375], ML(250)], ['Какао «Брауни с вишней»', [375], ML(250)]] },
    { id: 'tea', title: 'Чай', items: [
      ['Матча латте', [390], ML(350)], ['Ходзича латте', [390], ML(350)], ['Соба тя латте', [390], ML(350)],
      ['Чёрный чай', [250], ML(350)], ['Зелёный чай', [250], ML(350)], ['Травяной чай', [250], ML(350)]] },
  ];
  const group = (g, limit) => `<div class="n-board-g" id="m-${g.id}"><h3>${esc(g.title)}</h3>${g.note ? `<p>${esc(g.note)}</p>` : ''}
    <ul>${g.items.slice(0, limit).map(([name, prices, sizes]) => `<li><span class="nm">${esc(name)}</span><span class="dots"></span>${sizes ? `<span class="sz">${sizes.join(' / ')}</span>` : ''}<span class="pr">${prices.map(money).join(' / ')}</span></li>`).join('')}</ul></div>`;
  function renderMenu() {
    // На главной — коротко: чёрный кофе, с молоком и начало сезонного; на странице меню — всё.
    const short = $('#n-menu-short');
    if (short) short.innerHTML = ['black', 'milk'].map((id) => group(MENU.find((g) => g.id === id))).join('') + group({ ...MENU[0], note: '' }, 4);
    const el = $('#n-menu');
    if (el) el.innerHTML = MENU.map((g) => group(g)).join('');
  }

  // «Выберите, что вам подходит»: вкладки по категориям, первая — подборка из кофе и дрип-пакета
  const PICKS = [
    { id: 'top', title: 'Популярное', ids: ['espresso-blend', 'filter-africa', 'drip-10'] },
    ...D.categories.filter((c) => c.id !== 'merch').map((c) => ({ id: c.id, title: c.title })),
  ];
  let pickTab = 'top';
  function renderPicks() {
    const el = $('#n-pick');
    if (!el) return;
    $('#n-pick-tabs').innerHTML = PICKS.map((t) => `<a href="#coffee" class="${t.id === pickTab ? 'on' : ''}" data-pick-tab="${t.id}">${esc(t.title)}</a>`).join('');
    const t = PICKS.find((x) => x.id === pickTab);
    const items = t.ids ? t.ids.map(product) : D.products.filter((p) => p.cat === t.id).slice(0, 3);
    el.innerHTML = items.map(card).join('');
  }

  // Карта кофеен: OpenStreetMap через Leaflet — без рекламы, метки в форме арки из логотипа
  const SHOPS = [
    { lat: 59.922188, lng: 30.251317, title: 'Кожевенная, 30а' },
    { lat: 59.944848, lng: 30.353259, title: 'Кирочная, 8а' },
  ];
  // Карту создаём, только когда до неё долистали: плитки не тянут трафик на первом экране
  function lazyMap() {
    const box = $('#n-map-canvas');
    if (!box || !window.L) return;
    if (!('IntersectionObserver' in window)) return renderMap();
    const io = new IntersectionObserver((list) => {
      if (list.some((x) => x.isIntersecting)) { io.disconnect(); renderMap(); }
    }, { rootMargin: '400px 0px' });
    io.observe(box);
  }
  function renderMap() {
    const box = $('#n-map-canvas');
    const wide = innerWidth > 960;
    const map = L.map(box, { scrollWheelZoom: false, zoomControl: true, attributionControl: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(map);
    const pins = SHOPS.map((s) => L.marker([s.lat, s.lng], { icon: L.divIcon({ className: 'n-pin', iconSize: null, iconAnchor: [17, 42],
      html: `<i><img src="../webapp/img/emblem-white.png" alt=""></i><b>${esc(s.title)}</b>` }) }).addTo(map));
    // Карточки адресов стоят слева, поэтому на широком экране метки сдвигаем вправо
    map.attributionControl.setPrefix('<a href="https://leafletjs.com" target="_blank" rel="noopener">Leaflet</a>');
    // Подписи меток торчат вправо от точки — справа оставляем место под них
    map.fitBounds(L.latLngBounds(SHOPS.map((s) => [s.lat, s.lng])), { paddingTopLeft: [wide ? 460 : 30, 60], paddingBottomRight: [150, 30], maxZoom: 13 });
    document.querySelectorAll('[data-pin]').forEach((c) => c.addEventListener('click', (e) => {
      if (e.target.closest('a')) return;
      const i = Number(c.dataset.pin);
      map.flyTo([SHOPS[i].lat, SHOPS[i].lng], 15, { duration: .8 });
      pins.forEach((p, j) => p.getElement()?.classList.toggle('on', i === j));
    }));
  }

  document.addEventListener('click', (e) => {
    const t = e.target;
    const w = t.closest('.n-card [data-w]');
    if (w && !w.disabled) {
      const c = w.closest('.n-card');
      const p = product(c.dataset.id);
      picked[p.id] = Number(w.dataset.w);
      c.querySelectorAll('[data-w]').forEach((b) => b.setAttribute('aria-pressed', b === w));
      c.querySelector('.pr').textContent = money(p.prices[picked[p.id]]);
      return;
    }
    const add = t.closest('[data-n-add]');
    if (add) {
      const p = product(add.closest('.n-card').dataset.id);
      if (p.sizes) return S.openProduct(p.id); // у футболки сначала выбрать размер
      S.addToCart(p.id, picked[p.id] ?? firstWeight(p));
      add.textContent = 'Добавлено';
      clearTimeout(add._t);
      add._t = setTimeout(() => { add.textContent = 'В корзину'; }, 1200);
      return;
    }
    const tab = t.closest('[data-pick-tab]');
    if (tab) { e.preventDefault(); pickTab = tab.dataset.pickTab; return renderPicks(); }
    const pl = t.closest('[data-plan]');
    if (pl) { plan = pl.dataset.plan; return renderPlans(); }
    // Смена темы перерисовывает рисунки упаковок
    if (t.closest('[data-theme-toggle]')) setTimeout(() => { renderRows(); renderShop(); renderPicks(); }, 30);
  });

  renderRows();
  renderShop();
  renderPicks();
  renderPlans();
  renderMenu();
  lazyMap();
  // Каталог с сервера мог обновиться — перерисовываем витрины.
  window.AKApi.load().then((ok) => { if (ok) { renderRows(); renderShop(); renderPicks(); renderPlans(); } });
})();

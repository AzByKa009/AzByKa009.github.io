// Мини-приложение «Анненкирхе кофе»: магазин, подписка, анкета «Найди свой кофе»,
// опт и контакты (обучение и калькуляторы кофейня не захотела). Одна страница, экраны по адресу после #.
// Каталог и заказы — через сервер (api.js). Без сервера работает как демо: данные из data.js, заказ никуда не уходит.
(() => {
  const D = window.AK;
  const B = D.brand;
  const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined
    ? window.Telegram.WebApp
    : null;
  const app = document.getElementById('app');
  const API = window.AKApi;
  /** Идёт отправка заказа — вторая не нужна. */
  let sending = false;

  // ——— Состояние ———

  const store = {
    get(key, fallback) {
      try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* приватный режим */ }
    },
  };

  const state = {
    cart: store.get('ak-cart', []),
    cat: 'coffee',
    pick: {}, // выбор на карточке товара: вес, помол, размер, количество
    quiz: { step: 0, tags: [] },
    checkout: { delivery: 'pickup-k', name: '', phone: '', address: '', comment: '' },
    lead: { company: '', name: '', phone: '', comment: '' },
    sub: { plan: 'duo', coffee: 'espresso-blend', freq: 1 },
  };
  const saveCart = () => store.set('ak-cart', state.cart);

  // ——— Тема: светлая или тёмная (ночная, с неоном) ———

  const forcedTheme = (location.search.match(/theme=(light|dark)/) || [])[1];
  function systemTheme() {
    if (tg && tg.colorScheme) return tg.colorScheme;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  let theme = forcedTheme || store.get('ak-theme', null) || systemTheme();
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    const bg = theme === 'dark' ? '#0F0A11' : '#F8F4F1';
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', bg);
    if (tg) { try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } catch { /* старые клиенты */ } }
  }
  applyTheme();
  /** Знак АК зажигается один раз за заход, дальше просто горит. */
  let signLit = false;

  // ——— Мелочи ———

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (n) => (n == null ? '—' : `${n.toLocaleString('ru-RU').replace(/\s/g, ' ')} ₽`);
  const product = (id) => D.products.find((p) => p.id === id);
  const priceOf = (p, w = 0) => (p.prices ? p.prices[w] : p.price);
  const fromPrice = (p) => Math.min(...(p.prices || [p.price]).filter((x) => x != null));
  const cartCount = () => state.cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = () => state.cart.reduce((s, l) => s + l.price * l.qty, 0);
  const firstName = () => (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.first_name) || '';

  function toast(text) {
    let el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1600);
    if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
  }

  function openLink(url) {
    if (tg && url.startsWith('https://t.me/')) return tg.openTelegramLink(url);
    if (tg) return tg.openLink(url);
    window.open(url, '_blank');
  }

  // ——— Иконки (линией, в цвет текста) ———

  const ICONS = {
    home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9.5h13V10"/><path d="M10 19.5v-5h4v5"/>',
    shop: '<path d="M5 8h14l-1.2 11.2a1 1 0 0 1-1 .8H7.2a1 1 0 0 1-1-.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    repeat: '<path d="M4 12a7 7 0 0 1 12-5l2 2"/><path d="M18 4v5h-5"/><path d="M20 12a7 7 0 0 1-12 5l-2-2"/><path d="M6 20v-5h5"/>',
    cart: '<circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M3 4h2.2l2.3 11h10.8l2-8H6.3"/>',
    back: '<path d="M15 5 8 12l7 7"/>',
    chev: '<path d="m9 5 7 7-7 7"/>',
    bean: '<ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(35 12 12)"/><path d="M8.5 17c3-2 4-8 7-10"/>',
    drip: '<path d="M6 4h12v6a6 6 0 0 1-12 0z"/><path d="M12 16v4"/><path d="M8 20h8"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14z"/><path d="M5 19 14 10"/>',
    cup: '<path d="M4 9h13v5a6 6 0 0 1-6 6h-1a6 6 0 0 1-6-6z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17"/><path d="M9 3.5c0 1.5 1.5 1.5 1.5 3"/>',
    bag: '<path d="M6 8h12l1 12H5z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V5.5"/><path d="M8 7h8"/>',
    tools: '<path d="M4 7h10"/><path d="M18 7h2"/><circle cx="16" cy="7" r="2"/><path d="M4 17h4"/><path d="M12 17h8"/><circle cx="10" cy="17" r="2"/>',
    quiz: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/><path d="M9.2 9a2 2 0 1 1 2.8 1.8c-.6.3-1 .8-1 1.4"/><path d="M11 14.8v.2"/>',
    truck: '<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
    send: '<path d="M21 4 3 11l6 2.5L11.5 20z"/><path d="m9 13.5 5-4"/>',
    pin: '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    gift: '<path d="M4 10h16v10H4z"/><path d="M3 7h18v3H3z"/><path d="M12 7v13"/><path d="M12 7c-2-3-5-3-5-1s3 1 5 1c2 0 5 1 5-1s-3-2-5 1"/>',
    box: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z"/><path d="m4 7.5 8 4.5 8-4.5"/><path d="M12 12v9"/>',
    download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    card: '<rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18"/><path d="M7 15h4"/>',
    channel: '<path d="M4 10v4l12 5V5z"/><path d="M16 9a3 3 0 0 1 0 6"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M9.5 2.5h5"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  };
  const icon = (name, extra = '') => `<svg class="i" viewBox="0 0 24 24" ${extra}>${ICONS[name] || ''}</svg>`;

  /** Облачная кромка, как на их осеннем меню. */
  const clouds = (color) => {
    let d = 'M0 22 ';
    for (let x = 0; x < 400; x += 40) d += `Q ${x + 20} ${x % 80 ? 2 : 6} ${x + 40} 22 `;
    return `<svg class="clouds" viewBox="0 0 400 22" preserveAspectRatio="none"><path d="${d}V22H0z" fill="${color}"/></svg>`;
  };

  /** Арка-окно из логотипа. */
  const arch = (stroke, width = 10) =>
    `<svg viewBox="0 0 200 320" class="arch"><path d="M${width} 320V130C${width} 60 60 18 100 ${width}C140 18 ${200 - width} 60 ${200 - width} 130V320" fill="none" stroke="${stroke}" stroke-width="${width}"/></svg>`;

  // ——— Картинки товаров: общий рисовальщик из pic.js (его же использует сайт) ———

  const shortName = window.AKShortName;
  const pic = (p, label = '') => window.AKPic(p, label, theme === 'dark');

  // ——— Каркас: шапка, плашка демо, таббар ———

  const TABS = [
    { href: '#/', label: 'Главная', icon: 'home', root: '' },
    { href: '#/shop', label: 'Магазин', icon: 'shop', root: 'shop' },
    { href: '#/sub', label: 'Подписка', icon: 'repeat', root: 'sub' },
    { href: '#/cart', label: 'Корзина', icon: 'cart', root: 'cart' },
  ];

  function topbar(isRoot, title = '') {
    const count = cartCount();
    const left = isRoot
      ? `<div class="brand"><img class="logo-light" src="img/emblem.png" alt=""><img class="logo-dark" src="img/emblem-white.png" alt=""><span>${esc(B.name)}</span></div>`
      : `<button class="back" data-act="back">${icon('back')}<span>${esc(title || 'Назад')}</span></button>`;
    return `<header class="topbar">${left}
      <div class="right">
        <button class="icon-btn" data-act="theme" aria-label="Сменить тему">${icon(theme === 'dark' ? 'sun' : 'moon')}</button>
        <a class="icon-btn" href="#/cart" aria-label="Корзина">${icon('cart')}${count ? `<span class="count">${count}</span>` : ''}</a>
      </div>
    </header>`;
  }

  /** Знак АК: в тёмной теме и на заставке — неон, иначе — обычный белый. */
  function neonSign(lit, ignite) {
    const layer = (cls) => `<div class="${cls}"><div class="ns"></div></div>`;
    return `<div class="neon-sign ${lit ? 'lit' : ''} ${ignite ? 'ignite' : ''}">${layer('glass')}${layer('glow')}${layer('tube')}${layer('core')}</div>`;
  }

  function tabbar(root) {
    const count = cartCount();
    return `<nav class="tabbar"><div class="inner">${TABS.map((t) => `
      <a class="tab ${t.root === root ? 'on' : ''}" href="${t.href}">${icon(t.icon)}<span>${t.label}</span>
        ${t.root === 'cart' && count ? `<span class="count">${count}</span>` : ''}</a>`).join('')}
    </div></nav>`;
  }

  /** ?clean — макеты для презентации: без плашки демо, пометок «пример» и заглушек-подсказок. */
  const CLEAN = location.search.includes('clean');
  if (CLEAN) document.documentElement.classList.add('clean');

  const ribbon = () =>
    CLEAN || (API.online && !D.products.some((p) => p.demo))
      ? ''
      : `<div class="demo-ribbon"><b>Демо-версия.</b> ${API.online ? 'Товары и цены пока примеры' : 'Товары, цены и оплата пока заглушки'}</div>`;

  const ctaBar = (inner) => `<div class="cta-bar"><div class="inner">${inner}</div></div>`;

  // ——— Экраны ———

  function home() {
    const name = firstName();
    const popular = D.products.filter((p) => p.cat === 'coffee').slice(0, 4);
    const tile = (href, ic, title, sub, cls = '') => `
      <a class="tile ${cls}" href="${href}"><div class="ic">${icon(ic)}</div>
        <div><div class="os">${title}</div><div class="muted">${sub}</div></div></a>`;
    return `
      <section class="hero sign">
        ${neonSign(theme === 'dark', theme === 'dark' && !signLit)}
        <div class="hello">${name ? `Привет, ${esc(name)}!` : 'Добро пожаловать'}</div>
        <div class="dots">${Array.from({ length: B.every }, (_, i) =>
          `<div class="dot ${i === B.every - 1 ? 'free' : i < 3 ? 'on' : ''}">${i + 1}</div>`).join('')}</div>
        <div class="hint">Каждый ${B.every}-й напиток в кофейне — бесплатно</div>
      </section>

      <div class="section tiles">
        <a class="tile wide orange" href="#/shop"><div class="ic">${icon('shop')}</div>
          <div><div class="os">Магазин</div><div class="muted">Кофе нашей обжарки, дрип-пакеты, чай, какао и мерч</div></div></a>
        ${tile('#/sub', 'repeat', 'Подписка', 'Свежий кофе регулярно', 'plum')}
        ${tile('#/quiz', 'quiz', 'Найди свой кофе', '5 вопросов — и совет')}
        ${tile('#/wholesale', 'box', 'Опт', 'Для кафе и офисов')}
        ${tile('#/card', 'card', 'Моя карта', `${B.every}-й напиток бесплатно`)}
        <a class="tile wide" href="#/contact"><div class="ic">${icon('send')}</div>
          <div><div class="os">Написать нам</div><div class="muted">@${esc(B.telegram)} · ${esc(B.phone)}</div></div></a>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="os">Наша обжарка</h2><a href="#/shop">Все</a></div>
        <div class="grid">${popular.map(productCard).join('')}</div>
      </div>

      <div class="section">
        <div class="section-head"><h2 class="os">Где мы</h2></div>
        <div class="list">${B.addresses.map((a) => `
          <div class="card-row"><div class="ic">${icon('pin')}</div><div><b>${esc(a.title)}</b><span>${esc(a.note)} · ${esc(B.hours)}</span></div></div>`).join('')}
        </div>
      </div>`;
  }

  function productCard(p) {
    return `<a class="product" href="#/p/${p.id}">
      <div class="pic">${pic(p)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}${p.demo ? '<span class="badge demo">пример</span>' : ''}</div>
      <div class="body"><div class="name">${esc(p.name)}</div><div class="sub">${esc(p.sub)}</div>
        <div class="row"><span class="price">${p.prices ? 'от ' : ''}${money(fromPrice(p))}</span>
          <button class="plus" data-act="quick-add" data-id="${p.id}" aria-label="В корзину">+</button></div>
      </div></a>`;
  }

  function shop() {
    const items = D.products.filter((p) => p.cat === state.cat);
    return `
      <h1 class="h1 os">Магазин</h1>
      <p class="lead">Кофе обжариваем сами, чай и какао — от наших поставщиков.</p>
      <div class="section chips">${D.categories.map((c) =>
        `<button class="chip ${c.id === state.cat ? 'on' : ''}" data-act="cat" data-id="${c.id}">${c.title}</button>`).join('')}</div>
      <div class="section grid">${items.map(productCard).join('')}</div>`;
  }

  function pdp(id) {
    const p = product(id);
    if (!p) return shop();
    const s = (state.pick[id] ||= { w: 0, size: 1, qty: 1 });
    const price = priceOf(p, s.w);
    const weightLabel = p.prices ? D.weights[s.w] : '';
    const options = p.prices
      ? `<div class="label caps">Вес</div>
         <div class="seg">${D.weights.map((w, i) => `<button class="${i === s.w ? 'on' : ''}" data-act="w" data-id="${id}" data-v="${i}" ${p.prices[i] == null ? 'disabled' : ''}>${w}<small>${money(p.prices[i])}</small></button>`).join('')}</div>`
      : p.sizes
        ? `<div class="label caps">Размер</div>
           <div class="seg">${p.sizes.map((z, i) => `<button class="${i === s.size ? 'on' : ''}" data-act="size" data-id="${id}" data-v="${i}">${z}</button>`).join('')}</div>`
        : '';
    return `
      <div class="pdp">
        <div class="pdp-pic">${pic(p, weightLabel)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}${p.demo ? '<span class="badge demo">пример</span>' : ''}</div>
        <h1 class="os">${esc(p.name)}</h1>
        <div class="sub">${esc(p.sub)}</div>
        ${p.cat === 'coffee' ? `<div class="facts demo-only">
          <div class="fact"><span class="caps">Регион</span><b>—</b></div>
          <div class="fact"><span class="caps">Обработка</span><b>—</b></div>
          <div class="fact"><span class="caps">Обжарка</span><b>—</b></div></div>` : ''}
        <div class="placeholder">Здесь будет описание от обжарщика: вкус, происхождение, для чего подходит. Пришлите тексты — заменим.</div>
        ${options}
        <div class="label caps">Количество</div>
        <div class="qty"><button data-act="pqty" data-id="${id}" data-v="-1">${icon('minus')}</button><span>${s.qty}</span><button data-act="pqty" data-id="${id}" data-v="1">${icon('plus')}</button></div>
      </div>
      ${ctaBar(`<button class="btn" data-act="add" data-id="${id}">В корзину <small>· ${money(price * s.qty)}</small></button>`)}`;
  }

  function addToCart(p, s = { w: 0, size: 1, qty: 1 }, quiet = false) {
    const opts = p.prices ? `${D.weights[s.w]} · в зёрнах` : p.sizes ? `Размер ${p.sizes[s.size]}` : p.sub;
    const key = `${p.id}|${opts}`;
    const line = state.cart.find((l) => l.key === key);
    if (line) line.qty += s.qty;
    else state.cart.push({ key, id: p.id, opts, weight: p.prices ? D.weights[s.w] : '', w: s.w, size: s.size, price: priceOf(p, s.w), qty: s.qty });
    saveCart();
    if (!quiet) toast(`Добавлено: ${p.name}`);
  }

  function cart() {
    if (!state.cart.length) {
      return `<div class="empty">${icon('cart', 'style="width:64px;height:64px;opacity:.35"')}
        <div class="os">Корзина пустая</div><p class="muted">Загляните в магазин — там свежая обжарка.</p>
        <a class="btn" href="#/shop">В магазин</a></div>`;
    }
    return `
      <h1 class="h1 os">Корзина</h1>
      <div class="section list">${state.cart.map((l, i) => {
        const p = product(l.id);
        return `<div class="line"><div class="thumb">${pic(p, l.weight)}</div>
          <div class="info"><b>${esc(p.name)}</b><span>${esc(l.opts)}</span><div class="sum">${money(l.price * l.qty)}</div></div>
          <div class="qty"><button data-act="cqty" data-i="${i}" data-v="-1">${icon('minus')}</button><span>${l.qty}</span><button data-act="cqty" data-i="${i}" data-v="1">${icon('plus')}</button></div></div>`;
      }).join('')}</div>
      <div class="totals"><div><span class="muted">Товары, ${cartCount()} шт</span><span>${money(cartTotal())}</span></div>
        <div class="grand"><span>Итого</span><span>${money(cartTotal())}</span></div></div>
      ${ctaBar('<a class="btn orange" href="#/checkout">Оформить заказ</a>')}`;
  }

  function checkout() {
    if (!state.cart.length) return cart();
    const c = state.checkout;
    const d = D.delivery.find((x) => x.id === c.delivery);
    const shipping = d.price || 0;
    const needsAddress = !d.id.startsWith('pickup');
    return `
      <h1 class="h1 os">Оформление</h1>
      <div class="label caps">Как получить</div>
      ${D.delivery.map((x) => `<button class="radio ${x.id === c.delivery ? 'on' : ''}" data-act="delivery" data-id="${x.id}">
        <span class="mark"></span><span class="t">${esc(x.title)}${x.note ? `<small>${esc(x.note)}</small>` : ''}</span>
        <span class="p">${x.price == null ? '' : x.price ? money(x.price) : 'бесплатно'}</span></button>`).join('')}
      <div class="label caps">Получатель</div>
      <label class="field"><span>Имя</span><input data-bind="name" value="${esc(c.name || firstName())}" placeholder="Как к вам обращаться"></label>
      <label class="field"><span>Телефон</span><input data-bind="phone" type="tel" value="${esc(c.phone)}" placeholder="+7"></label>
      ${needsAddress ? `<label class="field"><span>Адрес доставки</span><input data-bind="address" value="${esc(c.address)}" placeholder="Улица, дом, квартира"></label>` : ''}
      <label class="field"><span>Комментарий</span><textarea data-bind="comment" rows="2" placeholder="Например, позвонить за час">${esc(c.comment)}</textarea></label>
      <div class="totals"><div><span class="muted">Товары</span><span>${money(cartTotal())}</span></div>
        <div><span class="muted">Доставка</span><span>${d.price == null ? 'по тарифу' : shipping ? money(shipping) : 'бесплатно'}</span></div>
        <div class="grand"><span>К оплате</span><span>${money(cartTotal() + shipping)}</span></div></div>
      ${!API.online ? '<div class="placeholder">Демо: кнопка оформляет пробный заказ, он никуда не уходит.</div>'
        : API.payments ? '' : '<div class="placeholder">Оплата картой скоро появится. Сейчас мы получим заказ и свяжемся с вами для подтверждения.</div>'}
      ${ctaBar(`<button class="btn orange" data-act="pay" ${sending ? 'disabled' : ''}>${API.payments ? 'Оплатить' : 'Оформить заказ'} <small>· ${money(cartTotal() + shipping)}</small></button>`)}`;
  }

  function done(kind) {
    const order = store.get('ak-last', null);
    const text = kind === 'sub'
      ? 'Подписка оформлена. Первую посылку соберём к ближайшей обжарке и напишем в боте.'
      : tg ? 'Заказ принят. Мы напишем в боте, когда он будет готов.' : 'Заказ принят. Мы позвоним, чтобы подтвердить.';
    return `<div class="done"><div class="big">${icon('check')}</div>
      <div class="os">${kind === 'sub' ? 'Готово!' : `Заказ №${order ? order.id : CLEAN ? 1024 : '—'}`}</div>
      <p class="lead">${text}</p>
      ${API.online ? '' : '<div class="placeholder">Демо: заказ никуда не отправлен.</div>'}
      <a class="btn" style="margin-top:22px" href="#/">На главную</a></div>`;
  }

  function subscription() {
    const s = state.sub;
    const plan = D.plans.find((p) => p.id === s.plan);
    const coffees = D.products.filter((p) => p.cat === 'coffee');
    return `
      <section class="sub-hero"><div class="in">
        <div class="caps" style="opacity:.85">Подписка</div>
        <div class="h1 os" style="margin-top:8px">Свежий кофе без хлопот</div>
        <p class="lead">Выберите кофе и как часто — мы обжарим и привезём сами.</p></div>
        ${clouds('#F8F4F1')}</section>

      <div class="section">${D.plans.map((p) => `<button class="plan ${p.id === s.plan ? 'on' : ''}" data-act="plan" data-id="${p.id}">
        <div class="os">${esc(p.title)}</div><div class="muted">${esc(p.text)} · ${esc(p.every)}</div>
        <div class="price">${money(p.price)}<small> / раз</small></div>
        ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}</button>`).join('')}</div>

      <div class="label caps">Какой кофе</div>
      <div class="seg">${coffees.map((p) => `<button class="${p.id === s.coffee ? 'on' : ''}" data-act="sub-coffee" data-id="${p.id}">${esc(shortName(p))}</button>`).join('')}</div>
      <div class="label caps">Как часто</div>
      <div class="seg">${D.planFrequencies.map((f, i) => `<button class="${i === s.freq ? 'on' : ''}" data-act="sub-freq" data-v="${i}">${f}</button>`).join('')}</div>

      <div class="section"><div class="section-head"><h2 class="os">Как это работает</h2></div>
        <ol class="steps"><li>Выбираете кофе и частоту</li><li>Оплачиваете картой — списание раз в период</li>
          <li>Обжариваем свежим и привозим или откладываем в кофейне</li><li>Поменять или поставить на паузу можно в любой момент</li></ol></div>
      <div class="label caps">Контакты</div>
      <label class="field"><span>Имя</span><input data-bind="name" value="${esc(state.checkout.name || firstName())}" placeholder="Как к вам обращаться"></label>
      <label class="field"><span>Телефон</span><input data-bind="phone" type="tel" value="${esc(state.checkout.phone)}" placeholder="+7"></label>
      <label class="field"><span>Адрес доставки</span><input data-bind="address" value="${esc(state.checkout.address)}" placeholder="Или «заберу в кофейне»"></label>
      ${D.plans.some((p) => p.demo) ? '<div class="placeholder">Тарифы и цены — примеры. Состав подписки пришлёт кофейня.</div>' : ''}
      ${ctaBar(`<button class="btn orange" data-act="subscribe" ${sending ? 'disabled' : ''}>Оформить подписку <small>· ${money(plan.price)}</small></button>`)}`;
  }

  function quiz() {
    const q = state.quiz;
    if (q.step >= D.quiz.length) return quizResult();
    const item = D.quiz[q.step];
    return `
      <div class="caps muted">Найди свой кофе · ${q.step + 1} из ${D.quiz.length}</div>
      <div class="progress"><i style="width:${(q.step / D.quiz.length) * 100}%"></i></div>
      <h1 class="os" style="font-size:32px;font-weight:700;margin-top:22px">${esc(item.q)}</h1>
      <div class="section">${item.a.map((a, i) => `<button class="answer" data-act="answer" data-v="${i}">${esc(a.t)}</button>`).join('')}</div>`;
  }

  function quizResult() {
    const tags = state.quiz.tags;
    const score = (p) => (p.tags || []).reduce((s, t) => s + tags.filter((x) => x === t).length, 0) + (tags.includes('decaf') && p.tags.includes('decaf') ? 10 : 0);
    const coffees = D.products.filter((p) => p.cat === 'coffee');
    const best = coffees.slice().sort((a, b) => score(b) - score(a))[0];
    return `
      <div class="caps accent">Ваш кофе</div>
      <h1 class="h1 os" style="margin-top:6px">${esc(best.name)}</h1>
      <p class="lead">${esc(best.sub)}</p>
      <div class="section">${productCard(best)}</div>
      <div class="placeholder">Подбор пока по меткам-заглушкам. Когда будет ассортимент, обжарщик расставит, какой сорт кому советовать.</div>
      <button class="btn ghost" style="margin-top:14px" data-act="quiz-again">Пройти ещё раз</button>
      ${ctaBar(`<button class="btn orange" data-act="add" data-id="${best.id}">В корзину <small>· от ${money(fromPrice(best))}</small></button>`)}`;
  }

  function wholesale() {
    const w = D.wholesale;
    return `
      <section class="hero" style="min-height:180px">${arch('#fff', 9)}<img class="logo" src="img/logo-white.png" alt="">
        <div class="hello">Для бизнеса</div><div class="title os">Опт для кафе и офисов</div></section>
      <p class="lead" style="margin-top:16px">${esc(w.text)}</p>
      <div class="section list">${w.perks.map((p) => `<div class="card-row"><div class="ic">${icon('check')}</div><div><b>${esc(p)}</b></div></div>`).join('')}</div>
      <button class="btn ghost" style="margin-top:16px" data-act="price">${icon('download')} Скачать оптовый прайс</button>
      <div class="label caps">Оставить заявку</div>
      <label class="field"><span>Компания</span><input data-lbind="company" value="${esc(state.lead.company)}" placeholder="Название кафе или офиса"></label>
      <label class="field"><span>Имя</span><input data-lbind="name" value="${esc(state.lead.name || firstName())}" placeholder="Как к вам обращаться"></label>
      <label class="field"><span>Телефон</span><input data-lbind="phone" type="tel" value="${esc(state.lead.phone)}" placeholder="+7"></label>
      <label class="field"><span>Объём в месяц</span><input data-lbind="comment" value="${esc(state.lead.comment)}" placeholder="Например, 10 кг"></label>
      ${w.demo ? '<div class="placeholder">Текст и условия — заглушка. Оптовый прайс пришлёт кофейня.</div>' : ''}
      ${ctaBar(`<button class="btn orange" data-act="lead" ${sending ? 'disabled' : ''}>Отправить заявку</button>`)}`;
  }

  function contact() {
    return `
      <h1 class="h1 os">Написать нам</h1>
      <p class="lead">Вопросы, заказы, опт и сотрудничество.</p>
      <div class="section list">
        <button class="card-row" style="width:100%;text-align:left" data-act="link" data-url="https://t.me/${esc(B.telegram)}"><div class="ic">${icon('send')}</div><div><b>@${esc(B.telegram)}</b><span>Telegram</span></div></button>
        <a class="card-row" href="tel:${esc(B.phoneRaw)}"><div class="ic">${icon('phone')}</div><div><b>${esc(B.phone)}</b><span>Позвонить</span></div></a>
        <button class="card-row" style="width:100%;text-align:left" data-act="channel"><div class="ic">${icon('channel')}</div><div><b>Наш Telegram-канал</b><span>${B.channel ? 'Новости и новинки' : 'ссылку пришлёт кофейня'}</span></div></button>
      </div>
      <div class="section"><div class="section-head"><h2 class="os">Кофейни</h2></div>
        <div class="list">${B.addresses.map((a) => `
          <button class="card-row" style="width:100%;text-align:left" data-act="link" data-url="https://yandex.ru/maps/?text=${encodeURIComponent(`Санкт-Петербург, ${a.title}`)}">
            <div class="ic">${icon('pin')}</div><div><b>${esc(a.title)}</b><span>${esc(a.note)}</span></div></button>`).join('')}
          <div class="card-row"><div class="ic">${icon('clock')}</div><div><b>${esc(B.hours)}</b><span>обе кофейни</span></div></div>
        </div></div>`;
  }

  function loyalty() {
    return `
      <section class="hero">${arch('#fff', 9)}<img class="logo" src="img/logo-white.png" alt="">
        <div class="hello">Карта гостя</div>
        <div class="title os">Каждый ${B.every}-й напиток — бесплатно</div>
        <div class="dots">${Array.from({ length: B.every }, (_, i) =>
          `<div class="dot ${i === B.every - 1 ? 'free' : i < 3 ? 'on' : ''}">${i + 1}</div>`).join('')}</div>
        <div class="hint">Пример. Ваши отметки появятся, когда карта подключится к приложению</div></section>
      <div class="section list">
        <div class="card-row"><div class="ic">${icon('card')}</div><div><b>Покажите QR на кассе</b><span>бариста отметит напиток</span></div></div>
        <div class="card-row"><div class="ic">${icon('gift')}</div><div><b>5 отметок — 6-й бесплатно</b><span>любой напиток из меню, любой объём</span></div></div>
      </div>
      ${ctaBar(`<button class="btn" data-act="link" data-url="https://t.me/${esc(B.bot)}">Открыть карту в боте</button>`)}`;
  }

  // ——— Маршруты ———

  const ROUTES = [
    [/^$/, () => ({ html: home(), root: '' })],
    [/^shop$/, () => ({ html: shop(), root: 'shop' })],
    [/^p\/([\w-]+)$/, (m) => ({ html: pdp(m[1]), root: 'shop', title: 'Магазин' })],
    [/^cart$/, () => ({ html: cart(), root: 'cart' })],
    [/^checkout$/, () => ({ html: checkout(), root: 'cart', title: 'Корзина' })],
    [/^done$/, () => ({ html: done('order'), root: '' })],
    [/^sub$/, () => ({ html: subscription(), root: 'sub' })],
    [/^sub\/done$/, () => ({ html: done('sub'), root: 'sub' })],
    [/^quiz$/, () => ({ html: quiz(), root: 'quiz', title: 'Главная' })],
    [/^wholesale$/, () => ({ html: wholesale(), root: 'wholesale', title: 'Главная' })],
    [/^contact$/, () => ({ html: contact(), root: 'contact', title: 'Главная' })],
    [/^card$/, () => ({ html: loyalty(), root: 'card', title: 'Главная' })],
  ];

  function render(keepScroll = false) {
    const path = location.hash.replace(/^#\/?/, '');
    let view = { html: home(), root: '' };
    for (const [re, make] of ROUTES) {
      const m = path.match(re);
      if (m) { view = make(m); break; }
    }
    const isTab = TABS.some((t) => t.root === view.root) && !view.title;
    if (view.root === '' && theme === 'dark') setTimeout(() => { signLit = true; }, 0);
    const y = window.scrollY;
    app.innerHTML = `${ribbon()}${topbar(isTab, view.title)}<main class="page">${view.html}</main>${tabbar(view.root)}`;
    window.scrollTo(0, keepScroll ? y : 0);
    if (tg) {
      if (isTab) tg.BackButton.hide();
      else tg.BackButton.show();
    }
  }

  // ——— Нажатия ———

  const back = () => (history.length > 1 ? history.back() : (location.hash = '#/'));

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const act = el.dataset.act;
    const id = el.dataset.id;
    const v = Number(el.dataset.v);
    e.preventDefault();
    e.stopPropagation();

    switch (act) {
      case 'back': return back();
      case 'theme': {
        theme = theme === 'dark' ? 'light' : 'dark';
        store.set('ak-theme', theme);
        signLit = false;
        applyTheme();
        return render(true);
      }
      case 'cat': state.cat = id; return render(true);
      case 'quick-add': {
        const p = product(id);
        if (p.prices || p.sizes) { location.hash = `#/p/${id}`; return; }
        addToCart(p);
        return render(true);
      }
      case 'w': state.pick[id].w = v; return render(true);
      case 'size': state.pick[id].size = v; return render(true);
      case 'pqty': state.pick[id].qty = Math.max(1, state.pick[id].qty + v); return render(true);
      case 'add': {
        const p = product(id);
        addToCart(p, state.pick[id] || undefined);
        if (state.pick[id]) state.pick[id].qty = 1;
        return render(true);
      }
      case 'cqty': {
        const line = state.cart[Number(el.dataset.i)];
        line.qty += v;
        if (line.qty <= 0) state.cart.splice(Number(el.dataset.i), 1);
        saveCart();
        return render(true);
      }
      case 'delivery': state.checkout.delivery = id; return render(true);
      case 'pay': {
        const c = state.checkout;
        if (!(c.name || firstName()).trim() || !c.phone.trim()) return toast('Укажите имя и телефон');
        if (!API.online) {
          store.set('ak-last', { id: Math.floor(1000 + Math.random() * 9000), total: cartTotal() });
          state.cart = [];
          saveCart();
          location.hash = '#/done';
          return;
        }
        return submit('order', {
          cart: state.cart.map(API.cartLine),
          delivery: c.delivery, name: c.name || firstName(), phone: c.phone, address: c.address, comment: c.comment,
        }, () => { state.cart = []; saveCart(); }, '#/done');
      }
      case 'plan': state.sub.plan = id; return render(true);
      case 'sub-coffee': state.sub.coffee = id; return render(true);
      case 'sub-freq': state.sub.freq = v; return render(true);
      case 'subscribe': {
        const c = state.checkout;
        if (!API.online) { location.hash = '#/sub/done'; return; }
        return submit('subscribe', {
          plan: state.sub.plan, coffee: state.sub.coffee, freq: state.sub.freq,
          name: c.name || firstName(), phone: c.phone, address: c.address,
        }, null, '#/sub/done');
      }
      case 'answer': {
        state.quiz.tags.push(...D.quiz[state.quiz.step].a[v].tags);
        state.quiz.step += 1;
        return render();
      }
      case 'quiz-again': state.quiz = { step: 0, tags: [] }; return render();
      case 'price': return D.wholesale.priceUrl ? openLink(D.wholesale.priceUrl) : toast('Прайс появится, когда кофейня его пришлёт');
      case 'lead': {
        if (!API.online) return toast('Демо: заявка придёт владельцу в Telegram');
        const l = state.lead;
        return submit('lead', { ...l, name: l.name || firstName() }, () => { state.lead = { company: '', name: '', phone: '', comment: '' }; }, null, 'Заявка отправлена — мы свяжемся с вами');
      }
      case 'channel': return B.channel ? openLink(B.channel) : toast('Ссылку на канал пришлёт кофейня');
      case 'link': return openLink(el.dataset.url);
    }
  });

  // Поля оформления: пишем в состояние без перерисовки, чтобы не терять фокус.
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (el.dataset.bind) state.checkout[el.dataset.bind] = el.value;
    if (el.dataset.lbind) state.lead[el.dataset.lbind] = el.value;
  });

  /** Отправка на сервер. С онлайн-оплатой — сразу на страницу Робокассы. */
  async function submit(route, body, onDone, doneHash, doneToast) {
    if (sending) return;
    sending = true;
    render(true);
    try {
      const res = await API.send(route, body);
      store.set('ak-last', { id: res.id, total: res.total });
      if (onDone) onDone();
      if (res.payUrl) { location.href = res.payUrl; return; }
      if (doneToast) toast(doneToast);
      if (doneHash) location.hash = doneHash;
    } catch (err) {
      toast(err.message);
    } finally {
      sending = false;
      render(true);
    }
  }

  window.addEventListener('hashchange', () => render());

  // Для превью: ?quizdone — сразу результат анкеты.
  if (location.search.includes('quizdone')) state.quiz = { step: D.quiz.length, tags: ['filter', 'fruit', 'bright'] };

  // Для превью: ?seed положит в корзину пару товаров, чтобы снять экраны корзины и оформления.
  if (location.search.includes('seed') && !state.cart.length) {
    addToCart(product('filter-africa'), { w: 1, size: 1, qty: 1 }, true);
    addToCart(product('drip-10'), { w: 0, size: 1, qty: 2 }, true);
    addToCart(product('mug'), undefined, true);
  }

  if (tg) {
    tg.ready();
    tg.expand();
    applyTheme();
    tg.BackButton.onClick(back);
    tg.onEvent('themeChanged', () => {
      if (store.get('ak-theme', null)) return; // гость выбрал тему сам
      theme = systemTheme();
      applyTheme();
      render(true);
    });
  }

  function splash() {
    let seen = false;
    try { seen = sessionStorage.getItem('ak-splash') === '1'; sessionStorage.setItem('ak-splash', '1'); } catch { /* приватный режим */ }
    const forced = location.search.includes('splash');
    if ((seen || CLEAN) && !forced) return;
    const el = document.createElement('div');
    el.id = 'splash';
    el.innerHTML = `${neonSign(true, true)}<div class="cap">кофе, который обжариваем сами</div>`;
    document.body.appendChild(el);
    if (forced && location.search.includes('hold')) return; // для снимка заставки
    setTimeout(() => el.classList.add('hide'), 2400);
    setTimeout(() => el.remove(), 3100);
  }

  render();
  splash();
  // Свежий каталог с сервера: цены, наличие и фото из админки бота.
  API.load().then((ok) => { if (ok) render(true); });
})();

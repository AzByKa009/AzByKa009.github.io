// Сайт «Анненкирхе кофе»: главная и магазин. Каталог, анкета, рецепты и контакты — из общего
// webapp/data.js и сервера (webapp/api.js), рисунки упаковок — из webapp/pic.js. Корзина живёт в браузере,
// заказ уходит на сервер, а с подключённой Робокассой гость сразу попадает на оплату.
(() => {
  const D = window.AK;
  const B = D.brand;
  // Рисунки упаковок: ночью — витрина под лампой, днём — пастельный фон.
  const isDark = () => document.documentElement.dataset.theme !== 'light';
  const pic = (p, label = '', night = isDark()) => window.AKPic(p, label, night);
  const API = window.AKApi;
  /** Данные покупателя в корзине — переживают перерисовку. */
  const buyer = store0('ak-site-buyer', { delivery: 'pickup-k', name: '', phone: '', email: '', address: '', comment: '' });
  let sending = false;
  function store0(k, f) { try { return { ...f, ...(JSON.parse(localStorage.getItem(k)) || {}) }; } catch { return f; } }

  /** Настройки сайта. Всё, что помечено «заглушка», уточнить у кофейни. */
  const SITE = {
    bot: `https://t.me/${B.bot}`,
    channel: B.channel || '', // ссылка на Telegram-канал — пришлют
    roastDays: [1, 4], // заглушка: обжарка по понедельникам и четвергам
    roastHour: 10,
    shipDay: 20, // заглушка: подписка отправляется 20-го числа
  };

  const CLEAN = location.search.includes('clean');
  if (CLEAN) document.documentElement.classList.add('clean');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const money = (n) => (n == null ? '—' : `${n.toLocaleString('ru-RU').replace(/\s/g, ' ')} ₽`);
  const $ = (sel) => document.querySelector(sel);
  const product = (id) => D.products.find((p) => p.id === id);
  const fromPrice = (p) => Math.min(...(p.prices || [p.price]).filter((x) => x != null));
  const priceOf = (p, w = 0) => (p.prices ? p.prices[w] : p.price);

  const store = {
    get(k, f) { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* приватный режим */ } },
  };
  let cart = store.get('ak-site-cart', []);
  const saveCart = () => { store.set('ak-site-cart', cart); updateCount(); };
  const cartCount = () => cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = () => cart.reduce((s, l) => s + l.price * l.qty, 0);

  const arch = (stroke = '#fff', w = 10) =>
    `<svg viewBox="0 0 200 320" class="arch"><path d="M${w} 320V130C${w} 60 60 18 100 ${w}C140 18 ${200 - w} 60 ${200 - w} 130V320" fill="none" stroke="${stroke}" stroke-width="${w}"/></svg>`;

  function toast(text) {
    let el = $('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), 1800);
  }

  // ——— Шапка: прозрачная над ночным экраном, светлая после прокрутки ———

  const header = $('.header');
  // Знак на фоне ярче всего на первом экране, а дальше приглушается, чтобы не спорить с содержимым.
  const marks = $('#marks');
  const onScroll = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 10);
    if (marks) marks.style.opacity = String(Math.max(0.35, 1 - window.scrollY / (window.innerHeight * 1.2)));
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  function updateCount() {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      const n = cartCount();
      el.textContent = n;
      el.style.display = n ? '' : 'none';
    });
  }

  // ——— Таймер «до следующей обжарки» и дата отправки подписки ———

  function nextRoast(now = new Date()) {
    for (let add = 0; add < 8; add++) {
      const d = new Date(now);
      d.setDate(now.getDate() + add);
      d.setHours(SITE.roastHour, 0, 0, 0);
      if (SITE.roastDays.includes(d.getDay()) && d > now) return d;
    }
    return now;
  }
  function tick() {
    const el = $('#countdown');
    if (!el) return;
    let s = Math.max(0, Math.floor((nextRoast() - new Date()) / 1000));
    const parts = [['дн', Math.floor(s / 86400)], ['ч', Math.floor((s %= 86400) / 3600)], ['мин', Math.floor((s %= 3600) / 60)], ['сек', s % 60]];
    el.innerHTML = parts.map(([u, v]) => `<div><b>${String(v).padStart(2, '0')}</b><span>${u}</span></div>`).join('');
  }
  function nextShip(now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), SITE.shipDay);
    if (d <= now) d.setMonth(d.getMonth() + 1);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  // ——— Товары ———

  function productCard(p) {
    return `<article class="product" data-open="${p.id}">
      <div class="pic">${pic(p)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}${p.demo ? '<span class="badge demo">пример</span>' : ''}</div>
      <div class="body"><div class="name">${esc(p.name)}</div><div class="sub">${esc(p.sub)}</div>
        <div class="row"><span class="price">${p.prices ? 'от ' : ''}${money(fromPrice(p))}</span>
          <button class="plus" data-quick="${p.id}">В корзину</button></div></div></article>`;
  }

  function renderRows() {
    document.querySelectorAll('[data-row]').forEach((el) => {
      const items = D.products.filter((p) => p.cat === el.dataset.row).slice(0, Number(el.dataset.limit || 4));
      el.innerHTML = items.map(productCard).join('');
    });
  }

  function renderCats() {
    const el = $('#cats');
    if (!el) return;
    const hint = { coffee: 'зерно 200 г, 500 г и 1 кг', drip: 'кофе в дорогу', tea: 'от наших поставщиков', cocoa: 'и горячий шоколад', merch: 'кружки, футболки, шопперы' };
    el.innerHTML = D.categories.map((c) => {
      const sample = D.products.find((p) => p.cat === c.id);
      return `<a class="cat" href="shop.html#${c.id}"><div class="pic arch">${pic(sample)}</div>
        <div class="t"><b>${esc(c.title)}</b><span>${hint[c.id] || ''}</span></div></a>`;
    }).join('');
  }

  // ——— Подписка ———

  function renderPlans() {
    const el = $('#plans');
    for (const id of ['#next-ship', '#next-ship-2']) { const sh = $(id); if (sh) sh.textContent = nextShip(); }
    if (!el) return;
    el.innerHTML = D.plans.map((p) => `<div class="plan">
      <div class="f">${esc(p.title)}${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ''}</div>
      <div class="muted">${esc(p.text)}, ${esc(p.every)}</div>
      <div class="price">${money(p.price)} <small>за поставку</small></div>
      <a class="btn small" href="${SITE.bot}" target="_blank" rel="noopener">Оформить в боте</a></div>`).join('');
    for (const id of ['#next-ship', '#next-ship-2']) { const el2 = $(id); if (el2) el2.textContent = nextShip(); }
  }

  // ——— Анкета «Найди свой кофе» ———

  const quiz = { step: 0, tags: [] };
  function renderQuiz() {
    const el = $('#quiz-body');
    if (!el) return;
    if (quiz.step < D.quiz.length) {
      const item = D.quiz[quiz.step];
      el.innerHTML = `<div class="progress"><i style="width:${(quiz.step / D.quiz.length) * 100}%"></i></div>
        <div class="step">Вопрос ${quiz.step + 1} из ${D.quiz.length}</div>
        <div class="q">${esc(item.q)}</div>
        ${item.a.map((a, i) => `<button class="answer" data-answer="${i}">${esc(a.t)}</button>`).join('')}`;
      return;
    }
    const score = (p) => (p.tags || []).reduce((s, t) => s + quiz.tags.filter((x) => x === t).length, 0) + (quiz.tags.includes('decaf') && p.tags.includes('decaf') ? 10 : 0);
    const best = D.products.filter((p) => p.cat === 'coffee').sort((a, b) => score(b) - score(a))[0];
    el.innerHTML = `<div class="step">Вам подойдёт</div>
      <div class="result" style="margin-top:10px"><div class="pic arch">${pic(best)}</div>
        <div><div class="q">${esc(best.name)}</div><div style="opacity:.75; margin-top:6px">${esc(best.sub)}</div>
          <div class="promo">Есть в нашем Telegram-приложении</div>
          <div style="display:flex; gap:10px; margin-top:18px; flex-wrap:wrap">
            <button class="btn orange small" data-open="${best.id}">Посмотреть</button>
            <button class="btn ghost small" data-quiz-again>Ещё раз</button></div>
          <div class="ph">Какой сорт кому советовать, расставит обжарщик</div></div></div>`;
  }

  // ——— Кофейни ———

  function renderShops() {
    const el = $('#shops-list');
    if (!el) return;
    el.innerHTML = B.addresses.map((a) => `<div class="shop surface">
      <div class="f">${esc(a.title)}</div><p>${esc(a.note[0].toUpperCase() + a.note.slice(1))}. ${esc(B.hours)}</p>
      <a class="btn small" target="_blank" rel="noopener" href="https://yandex.ru/maps/?text=${encodeURIComponent(`Санкт-Петербург, ${a.title}`)}">Маршрут</a></div>`).join('');
  }

  // ——— Окно товара ———

  function openModal(html) {
    let m = $('#modal');
    if (!m) {
      m = document.createElement('div');
      m.id = 'modal';
      m.className = 'modal';
      document.body.appendChild(m);
    }
    m.innerHTML = `<div class="box"><button class="close" data-close aria-label="Закрыть">✕</button>${html}</div>`;
    m.classList.add('open');
  }
  const closeModal = () => $('#modal')?.classList.remove('open');

  const pick = {};
  function openProduct(id) {
    const p = product(id);
    const s = (pick[id] ||= { w: 0, size: 1, qty: 1 });
    const opts = p.prices
      ? `<div class="opt-label caps">Вес</div><div class="seg">${D.weights.map((w, i) => `<button class="${i === s.w ? 'on' : ''}" data-pick="w" data-v="${i}" ${p.prices[i] == null ? 'disabled' : ''}>${w}<small>${money(p.prices[i])}</small></button>`).join('')}</div>
`
      : p.sizes
        ? `<div class="opt-label caps">Размер</div><div class="seg">${p.sizes.map((z, i) => `<button class="${i === s.size ? 'on' : ''}" data-pick="size" data-v="${i}">${z}</button>`).join('')}</div>`
        : '';
    openModal(`<div class="pic">${pic(p, p.prices ? D.weights[s.w] : '')}</div>
      <div class="info" data-product="${id}">
        <div class="caps">${esc(D.categories.find((c) => c.id === p.cat).title)}</div>
        <h3 class="f" style="margin-top:8px">${esc(p.name)}</h3><p class="muted" style="margin-top:6px">${esc(p.sub)}</p>
        <div class="ph">Описание от обжарщика: вкус, происхождение, обработка — пришлите тексты</div>
        ${opts}
        <div class="opt-label caps">Количество</div>
        <div class="qty"><button data-pick="qty" data-v="-1">−</button><span>${s.qty}</span><button data-pick="qty" data-v="1">+</button></div>
        <button class="btn orange" style="margin-top:26px; width:100%" data-add="${id}">В корзину за ${money(priceOf(p, s.w) * s.qty)}</button>
      </div>`);
  }

  function addToCart(p, s = { w: 0, size: 1, qty: 1 }) {
    const opts = p.prices ? `${D.weights[s.w]}, в зёрнах` : p.sizes ? `Размер ${p.sizes[s.size]}` : p.sub;
    const key = `${p.id}|${opts}`;
    const line = cart.find((l) => l.key === key);
    if (line) line.qty += s.qty;
    else cart.push({ key, id: p.id, opts, weight: p.prices ? D.weights[s.w] : '', w: s.w, size: s.size, price: priceOf(p, s.w), qty: s.qty });
    saveCart();
    toast(`Добавлено: ${p.name}`);
  }

  // ——— Корзина ———

  function renderDrawer() {
    const d = $('#drawer');
    if (!d) return;
    const lines = cart.map((l, i) => {
      const p = product(l.id);
      return `<div class="line"><div class="thumb">${pic(p, l.weight)}</div>
        <div class="info"><b>${esc(p.name)}</b><span>${esc(l.opts)}</span><div class="f" style="font-size:18px; margin-top:4px">${money(l.price * l.qty)}</div></div>
        <div class="qty"><button data-cq="${i}" data-v="-1">−</button><span>${l.qty}</span><button data-cq="${i}" data-v="1">+</button></div></div>`;
    }).join('');
    d.innerHTML = `<div class="dh"><div class="f">Корзина</div><button class="icon-btn" data-drawer-close aria-label="Закрыть">✕</button></div>
      <div class="lines">${lines || '<p class="muted" style="padding:30px 0">Корзина пока пустая</p>'}</div>
      ${cart.length ? checkoutForm() : ''}`;
  }
  function checkoutForm() {
    const d = D.delivery.find((x) => x.id === buyer.delivery) || D.delivery[0];
    const shipping = d.price || 0;
    const needsAddress = !d.id.startsWith('pickup');
    return `<div class="df">
        <label class="field"><select data-buyer="delivery">${D.delivery.map((x) => `<option value="${esc(x.id)}" ${x.id === d.id ? 'selected' : ''}>${esc(x.title)}${x.price ? `, ${money(x.price)}` : x.price === 0 ? ', бесплатно' : x.note ? `, ${esc(x.note)}` : ''}</option>`).join('')}</select></label>
        <label class="field"><input data-buyer="name" value="${esc(buyer.name)}" placeholder="Имя"></label>
        <label class="field"><input data-buyer="phone" value="${esc(buyer.phone)}" placeholder="Телефон" type="tel"></label>
        <label class="field"><input data-buyer="email" value="${esc(buyer.email)}" placeholder="E-mail для чека (необязательно)" type="email"></label>
        ${needsAddress ? `<label class="field"><input data-buyer="address" value="${esc(buyer.address)}" placeholder="Адрес доставки"></label>` : ''}
        <label class="field"><input data-buyer="comment" value="${esc(buyer.comment)}" placeholder="Комментарий"></label>
        <div class="total"><span>Итого</span><span>${money(cartTotal() + shipping)}${d.price == null ? ' + доставка' : ''}</span></div>
        <button class="btn orange" style="width:100%; margin-top:14px" data-checkout ${sending ? 'disabled' : ''}>${sending ? 'Отправляем…' : API.payments ? 'Перейти к оплате' : 'Оформить заказ'}</button>
        <div class="ph" style="display:block">${!API.online ? 'Демо: заказ никуда не уходит' : API.payments ? 'Оплата картой через Робокассу' : 'Оплата картой скоро появится — мы позвоним, чтобы подтвердить заказ'}.
          Нажимая кнопку, вы принимаете <a href="offer.html" target="_blank">оферту</a> и <a href="privacy.html" target="_blank">политику обработки данных</a>.</div></div>`;
  }

  async function checkout() {
    if (sending) return;
    if (!API.online) {
      cart = [];
      saveCart();
      closeDrawer();
      return toast('Демо: заказ принят. На настоящем сайте он придёт владельцу в Telegram');
    }
    sending = true;
    renderDrawer();
    try {
      const res = await API.send('order', { ...buyer, cart: cart.map(API.cartLine) });
      cart = [];
      saveCart();
      if (res.payUrl) { location.href = res.payUrl; return; }
      closeDrawer();
      toast(`Заказ №${res.id} принят — мы позвоним, чтобы подтвердить`);
    } catch (err) {
      toast(err.message);
    } finally {
      sending = false;
      renderDrawer();
    }
  }

  // Поля покупателя: сохраняем без перерисовки, кроме способа получения (от него зависит адрес).
  document.addEventListener('input', (e) => {
    const key = e.target.dataset && e.target.dataset.buyer;
    if (!key) return;
    buyer[key] = e.target.value;
    store.set('ak-site-buyer', buyer);
    if (key === 'delivery') renderDrawer();
  });

  const openDrawer = () => { renderDrawer(); $('#drawer')?.classList.add('open'); $('#backdrop')?.classList.add('open'); };
  const closeDrawer = () => { $('#drawer')?.classList.remove('open'); $('#backdrop')?.classList.remove('open'); };

  // ——— Магазин: категории через адрес #coffee ———

  function renderShop() {
    const grid = $('#shop-grid');
    if (!grid) return;
    const cat = (location.hash.slice(1) || 'coffee');
    $('#shop-chips').innerHTML = D.categories.map((c) => `<a class="chip ${c.id === cat ? 'on' : ''}" href="#${c.id}">${esc(c.title)}</a>`).join('');
    grid.innerHTML = D.products.filter((p) => p.cat === cat).map(productCard).join('');
  }
  window.addEventListener('hashchange', renderShop);

  // ——— Нажатия ———

  document.addEventListener('click', (e) => {
    const t = e.target;
    const q = (sel) => t.closest(sel);
    if (q('[data-quick]')) {
      e.stopPropagation();
      const p = product(q('[data-quick]').dataset.quick);
      if (p.prices || p.sizes) return openProduct(p.id);
      return addToCart(p);
    }
    if (q('[data-open]')) return openProduct(q('[data-open]').dataset.open);
    if (q('[data-close]') || t.id === 'modal') return closeModal();
    if (q('[data-pick]')) {
      const el = q('[data-pick]');
      const id = q('[data-product]').dataset.product;
      const s = pick[id];
      const v = Number(el.dataset.v);
      if (el.dataset.pick === 'qty') s.qty = Math.max(1, s.qty + v); else s[el.dataset.pick] = v;
      return openProduct(id);
    }
    if (q('[data-add]')) {
      const id = q('[data-add]').dataset.add;
      addToCart(product(id), { ...pick[id] });
      pick[id].qty = 1;
      closeModal();
      return;
    }
    if (q('[data-answer]')) {
      quiz.tags.push(...D.quiz[quiz.step].a[Number(q('[data-answer]').dataset.answer)].tags);
      quiz.step += 1;
      return renderQuiz();
    }
    if (q('[data-quiz-again]')) { quiz.step = 0; quiz.tags = []; return renderQuiz(); }
    if (q('[data-cart]')) { e.preventDefault(); return openDrawer(); }
    if (q('[data-drawer-close]') || t.id === 'backdrop') return closeDrawer();
    if (q('[data-cq]')) {
      const i = Number(q('[data-cq]').dataset.cq);
      cart[i].qty += Number(q('[data-cq]').dataset.v);
      if (cart[i].qty <= 0) cart.splice(i, 1);
      saveCart();
      return renderDrawer();
    }
    if (q('[data-checkout]')) return checkout();
    if (q('[data-channel]')) {
      e.preventDefault();
      return SITE.channel ? window.open(SITE.channel, '_blank') : toast('Ссылку на канал пришлёт кофейня');
    }
    if (q('[data-price]')) { e.preventDefault(); return D.wholesale.priceUrl ? window.open(D.wholesale.priceUrl, '_blank') : toast('Оптовый прайс появится, когда кофейня его пришлёт'); }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); closeDrawer(); } });

  // Для превью: ?seed положит пару товаров в корзину, ?drawer откроет её.
  if (location.search.includes('seed') && !cart.length) {
    cart = [
      { key: 'a', id: 'filter-africa', opts: '500 г · в зёрнах', weight: '500 г', price: 1790, qty: 1 },
      { key: 'b', id: 'drip-10', opts: 'кофе в дорогу и на работу', weight: '', price: 690, qty: 2 },
    ];
    saveCart();
  }

  // ——— Карусель на первом экране: сама листается, пауза при наведении, свайп на телефоне ———

  const SLIDES = [
    { kicker: 'Магазин', title: 'Кофе нашей обжарки', text: 'В зёрнах, пачки 200 г, 500 г и 1 кг.', href: 'shop.html#coffee', cta: 'Выбрать', cat: 'coffee', n: 0 },
    { kicker: 'Подписка', title: 'Кофе каждый месяц', text: 'Обжариваем к отправке и привозим сами.', href: '#subscription', cta: 'Тарифы', cat: 'coffee', n: 1 },
    { kicker: 'Магазин', title: 'Дрип-пакеты', text: 'Чашка кофе без кофемашины, в дорогу и на работу.', href: 'shop.html#drip', cta: 'Смотреть', cat: 'drip', n: 0 },
    { kicker: 'Подбор', title: 'Какой кофе вам подойдёт', text: 'Пять вопросов о том, как вы пьёте кофе.', href: '#quiz', cta: 'Подобрать', cat: 'coffee', n: 2 },
    { kicker: 'Магазин', title: 'Чай и какао', text: 'Те же, что мы завариваем в кофейнях.', href: 'shop.html#tea', cta: 'Смотреть', cat: 'tea', n: 0 },
    { kicker: 'Для бизнеса', title: 'Кофе для кафе и офисов', text: 'Зерно оптом и дрип-пакеты с вашим логотипом.', href: '#b2b', cta: 'Подробнее', cat: 'drip', n: 2 },
  ];
  const SLIDE_MS = 6000;
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let slideAt = 0;
  let slideTimer = null;

  function slideProduct(s) {
    const list = D.products.filter((p) => p.cat === s.cat);
    return list[Math.min(s.n, list.length - 1)] || D.products[0];
  }

  function renderSlides() {
    const box = $('#slides');
    const dots = $('#dots');
    if (!box || !dots) return;
    box.innerHTML = SLIDES.map((s, i) => `<div class="slide ${i === slideAt ? 'on' : ''}" role="group" aria-label="${i + 1} из ${SLIDES.length}">
        <div class="pic arch">${pic(slideProduct(s))}</div>
        <div class="t"><div class="kicker">${esc(s.kicker)}</div><h2>${esc(s.title)}</h2><p>${esc(s.text)}</p>
          <div class="cta"><a class="btn small" href="${s.href}">${esc(s.cta)}</a></div></div></div>`).join('');
    dots.innerHTML = SLIDES.map((s, i) => `<button type="button" data-dot="${i}" class="${i === slideAt ? 'on' : i < slideAt ? 'done' : ''}" aria-label="${esc(s.title)}"><i></i></button>`).join('');
    $('#slider').style.setProperty('--slide-time', `${SLIDE_MS}ms`);
  }

  function goSlide(to) {
    const box = $('#slides');
    if (!box) return;
    const n = SLIDES.length;
    const next = (to + n) % n;
    const slides = box.querySelectorAll('.slide');
    slides[slideAt]?.classList.remove('on');
    slideAt = next;
    slides[slideAt]?.classList.add('on');
    document.querySelectorAll('#dots button').forEach((d, i) => {
      d.classList.remove('on', 'done');
      // Перезапуск полоски прогресса у текущей точки.
      void d.offsetWidth;
      if (i === slideAt) d.classList.add('on');
      else if (i < slideAt) d.classList.add('done');
    });
    restartTimer();
  }

  function restartTimer() {
    clearTimeout(slideTimer);
    if (reduceMotion || $('#slider')?.classList.contains('paused')) return;
    slideTimer = setTimeout(() => goSlide(slideAt + 1), SLIDE_MS);
  }

  const slider = $('#slider');
  if (slider) {
    const pause = (on) => { slider.classList.toggle('paused', on); if (on) clearTimeout(slideTimer); else restartTimer(); };
    slider.addEventListener('mouseenter', () => pause(true));
    slider.addEventListener('mouseleave', () => pause(false));
    slider.addEventListener('focusin', () => pause(true));
    slider.addEventListener('focusout', () => pause(false));
    slider.addEventListener('click', (e) => {
      const arrow = e.target.closest('[data-slide]');
      const dot = e.target.closest('[data-dot]');
      if (arrow) goSlide(slideAt + Number(arrow.dataset.slide));
      if (dot) goSlide(Number(dot.dataset.dot));
    });
    // Свайп пальцем: больше 40 px по горизонтали — листаем.
    let x0 = null;
    slider.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    slider.addEventListener('touchend', (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 40) goSlide(slideAt + (dx < 0 ? 1 : -1));
      x0 = null;
    });
    document.addEventListener('visibilitychange', () => (document.hidden ? clearTimeout(slideTimer) : restartTimer()));
  }

  // ——— Тема: тёмная и светлая, выбор запоминается ———

  function rerender() {
    renderSlides(); renderCats(); renderRows(); renderQuiz(); renderShop(); renderPlans();
    if ($('#drawer')?.classList.contains('open')) renderDrawer();
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('[data-theme-toggle]')) return;
    const next = isDark() ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('ak-site-theme', next); } catch { /* приватный режим */ }
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', next === 'dark' ? '#1F1623' : '#ECE6EC');
    rerender();
  });

  renderSlides();
  restartTimer();
  renderCats();
  renderRows();
  renderPlans();
  renderQuiz();
  renderShops();
  renderShop();
  updateCount();
  tick();
  setInterval(tick, 1000);
  if (location.search.includes('drawer')) openDrawer();
  // Свежий каталог с сервера — перерисовываем витрины.
  API.load().then((ok) => {
    if (!ok) return;
    renderSlides(); renderCats(); renderRows(); renderPlans(); renderShop();
    document.querySelectorAll('.demo-ribbon').forEach((el) => { if (!D.products.some((p) => p.demo)) el.remove(); });
  });
  const openId = (location.search.match(/product=([\w-]+)/) || [])[1];
  if (openId) openProduct(openId);
})();

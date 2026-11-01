// Админ-панель: заказы, подписки, заявки, товары и цены. Одна и та же на сайте и в мини-приложении.
// Кто вошёл, определяет сервер (подпись Telegram или вход через Telegram на сайте), он же решает, что показать:
// админ видит всё, бариста — только заказы на самовывоз. Сама панель ничего не решает за сервер.
(() => {
  const root = document.getElementById('admin');
  const API = window.AKApi;
  const home = root.dataset.home || './';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => `${new Intl.NumberFormat('ru-RU').format(n)} ₽`;
  const phoneLabel = (p) => `+${String(p).replace(/^(\d)(\d{3})(\d{3})(\d{2})(\d{2})$/, '$1 $2 $3-$4-$5')}`;
  const dateLabel = (iso) => (iso ? iso.split('-').reverse().slice(0, 2).join('.') : '—');

  const STATUS = { new: '🆕 Новый', paid: '💳 Оплачен', accepted: '✅ Принят', ready: '📦 Готов', sent: '🚚 Отправлен', done: '✔️ Выдан', canceled: '✖️ Отменён' };
  const SUB_STATUS = { pending: 'ждёт оплаты', active: 'активна', paused: 'на паузе', canceled: 'отменена' };

  // Тема — та же, что выбрана на сайте или в мини-приложении.
  try {
    const saved = localStorage.getItem('ak-site-theme') || localStorage.getItem('ak-theme');
    document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch { document.documentElement.dataset.theme = 'dark'; }

  const state = { me: null, tab: 'orders', kind: 'order', scope: 'open', timer: null };

  function toast(text) {
    let el = document.getElementById('a-toast');
    if (!el) { el = document.createElement('div'); el.id = 'a-toast'; el.className = 'a-toast'; document.body.append(el); }
    el.textContent = text; el.classList.add('show');
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2600);
  }

  const shell = (inner) => {
    root.innerHTML = `<header class="a-head"><a class="a-back" href="${esc(home)}">← Назад</a><h1>Админ-панель</h1>
      <span class="a-who">${state.me ? `${esc(state.me.name || 'гость')} · ${state.me.role === 'admin' ? 'админ' : 'бариста'}` : ''}</span></header>${inner}`;
  };

  // ——— Вход и права ———

  function showLogin(message) {
    shell(`<section class="a-card a-center"><h2>Войдите через Telegram</h2>
      <p>${esc(message || 'Админ-панель открывается тем, у кого в боте есть роль админа или баристы.')}</p>
      <button class="a-btn a-primary" id="a-login">Войти через Telegram</button>
      <p class="a-note" id="a-login-note" hidden>Откройте Telegram и нажмите «Запустить». Ждём подтверждения…</p></section>`);
    document.getElementById('a-login').addEventListener('click', async (e) => {
      e.target.disabled = true;
      const win = window.open('', '_blank');
      try {
        const { url, poll } = await API.loginStart();
        if (win) win.location.href = url;
        document.getElementById('a-login-note').hidden = false;
        const me = await API.loginWait(poll);
        if (me) return start();
        toast('Время входа вышло, попробуйте ещё раз');
      } catch (err) {
        if (win) win.close();
        toast(err.message);
      }
      e.target.disabled = false;
    });
  }

  async function start() {
    clearInterval(state.timer);
    shell('<p class="a-note a-center">Загружаем…</p>');
    state.me = await API.me();
    if (!state.me) return showLogin();
    if (!state.me.role) {
      return shell(`<section class="a-card a-center"><h2>Нет доступа</h2>
        <p>У вашего аккаунта в боте нет роли админа или баристы. Попросите владельца добавить ваш номер в разделе «Сотрудники».</p>
        <a class="a-btn" href="${esc(home)}">Вернуться</a></section>`);
    }
    state.tab = location.hash === '#scan' ? 'scan' : 'orders'; state.kind = 'order';
    render();
    state.timer = setInterval(() => { if (!document.hidden && state.tab === 'orders') refreshOrders(true); }, 20000);
  }

  // ——— Каркас с вкладками ———

  function render() {
    const admin = state.me.role === 'admin';
    const tabs = admin
      ? [['scan', 'Карта гостя'], ['orders', 'Заказы'], ['subs', 'Подписки'], ['leads', 'Опт'], ['products', 'Товары'], ['staff', 'Сотрудники'], ['stats', 'Сводка']]
      : [['scan', 'Карта гостя'], ['orders', 'Заказы']];
    shell(`${tabs.length > 1 ? `<nav class="a-tabs">${tabs.map(([id, t]) => `<button class="${id === state.tab ? 'on' : ''}" data-tab="${id}">${t}</button>`).join('')}</nav>` : ''}
      <main id="a-body"></main>`);
    root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { state.tab = b.dataset.tab; render(); }));
    ({ scan: loadScan, orders: refreshOrders, subs: loadSubs, leads: loadLeads, products: loadProducts, staff: loadStaff, stats: loadStats })[state.tab]();
  }

  const body = () => document.getElementById('a-body');
  const failed = (err) => {
    if (err.status === 401 || err.status === 403) return showLogin(err.message);
    if (body()) body().innerHTML = `<p class="a-note a-center">${esc(err.message)} <button class="a-btn" id="a-retry">Повторить</button></p>`;
    document.getElementById('a-retry')?.addEventListener('click', render);
  };

  // ——— Заказы ———

  const nextStatuses = (o) => {
    if (o.kind === 'lead' || o.status === 'done' || o.status === 'canceled') return [];
    const next = [];
    if (o.status === 'new' || o.status === 'paid') next.push('accepted');
    if (o.status !== 'ready' && o.status !== 'sent') next.push((o.delivery || '').startsWith('Самовывоз') || o.kind === 'sub' ? 'ready' : 'sent');
    next.push('done');
    if (state.me.role === 'admin') next.push('canceled');
    return next;
  };

  function orderCard(o) {
    const lines = o.lines.map((l) => `<li>${esc(l.name)}${l.opts ? ` <span>(${esc(l.opts)})</span>` : ''} × ${l.qty} — ${money(l.price * l.qty)}</li>`).join('');
    return `<article class="a-card a-order ${o.status}" data-id="${o.id}">
      <div class="a-row"><b>${o.kind === 'sub' ? '🔁 Поставка' : o.kind === 'lead' ? '🤝 Заявка' : '🛍 Заказ'} №${o.id}</b>
        ${o.kind === 'lead' ? '' : `<span class="a-badge">${STATUS[o.status]}</span>`}</div>
      <p class="a-who2">${esc(o.name)} · <a href="tel:+${esc(o.phone)}">${phoneLabel(o.phone)}</a>${o.email ? ` · ${esc(o.email)}` : ''}</p>
      ${o.delivery ? `<p>📍 ${esc(o.delivery)}${o.address ? `: ${esc(o.address)}` : ''}</p>` : o.address ? `<p>📍 ${esc(o.address)}</p>` : ''}
      ${o.comment ? `<p>💬 ${esc(o.comment)}</p>` : ''}
      ${lines ? `<ul class="a-lines">${lines}</ul>` : ''}
      ${o.kind === 'lead' ? '' : `<p class="a-total">${money(o.total)} · ${o.paid ? 'оплачено ✅' : 'не оплачено'}</p>`}
      <div class="a-actions">${nextStatuses(o).map((s) => `<button class="a-btn ${s === 'canceled' ? 'a-danger' : ''}" data-status="${s}">${STATUS[s]}</button>`).join('')}</div>
      <p class="a-time">${esc(o.created_at)}</p></article>`;
  }

  async function refreshOrders(quiet) {
    if (!body()) return;
    const admin = state.me.role === 'admin';
    try {
      const { orders } = await API.call('GET', `admin/orders?kind=${state.kind}&scope=${state.scope}`);
      if (!body()) return;
      const controls = `<div class="a-controls">
        ${admin ? `<div class="a-seg">${[['order', 'Заказы'], ['sub', 'Поставки подписок']].map(([k, t]) => `<button class="${state.kind === k ? 'on' : ''}" data-kind="${k}">${t}</button>`).join('')}</div>` : ''}
        <div class="a-seg">${[['open', 'В работе'], ['all', 'Все']].map(([k, t]) => `<button class="${state.scope === k ? 'on' : ''}" data-scope="${k}">${t}</button>`).join('')}</div></div>`;
      body().innerHTML = `${controls}${orders.length ? orders.map(orderCard).join('') : '<p class="a-note a-center">Здесь пока пусто</p>'}
        <p class="a-note a-center">Обновлено ${new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>`;
      body().querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => { state.kind = b.dataset.kind; refreshOrders(); }));
      body().querySelectorAll('[data-scope]').forEach((b) => b.addEventListener('click', () => { state.scope = b.dataset.scope; refreshOrders(); }));
      body().querySelectorAll('[data-status]').forEach((b) => b.addEventListener('click', () => setStatus(b)));
    } catch (err) { if (!quiet) failed(err); }
  }

  async function setStatus(button) {
    const card = button.closest('[data-id]');
    card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    try {
      await API.call('POST', 'admin/status', { id: Number(card.dataset.id), status: button.dataset.status });
      toast('Готово: гостю отправлено уведомление');
      refreshOrders(true);
    } catch (err) {
      toast(err.message);
      card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    }
  }

  // ——— Подписки ———

  async function loadSubs() {
    try {
      const { subscriptions } = await API.call('GET', 'admin/subs');
      body().innerHTML = subscriptions.length
        ? subscriptions.map((s) => `<article class="a-card" data-sub="${s.id}">
            <div class="a-row"><b>🔁 Подписка №${s.id}</b><span class="a-badge">${SUB_STATUS[s.status]}</span></div>
            <p class="a-who2">${esc(s.name)} · <a href="tel:+${esc(s.phone)}">${phoneLabel(s.phone)}</a></p>
            <p>${esc(s.line.name)}${s.line.opts ? ` (${esc(s.line.opts)})` : ''} — ${money(s.line.price)}</p>
            <p class="a-time">${s.status === 'active' ? `Следующая поставка: ${dateLabel(s.next_date)}` : ''}</p>
            <div class="a-actions">
              ${s.status === 'active' ? '<button class="a-btn" data-act="pause">⏸ Пауза</button>' : ''}
              ${s.status === 'paused' ? '<button class="a-btn" data-act="resume">▶️ Возобновить</button>' : ''}
              <button class="a-btn a-danger" data-act="cancel">✖️ Отменить</button></div></article>`).join('')
        : '<p class="a-note a-center">Подписок пока нет</p>';
      body().querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', async () => {
        b.disabled = true;
        try { await API.call('POST', 'admin/sub', { id: Number(b.closest('[data-sub]').dataset.sub), action: b.dataset.act }); toast('Готово'); loadSubs(); }
        catch (err) { toast(err.message); b.disabled = false; }
      }));
    } catch (err) { failed(err); }
  }

  // ——— Заявки на опт ———

  async function loadLeads() {
    try {
      const { orders } = await API.call('GET', 'admin/orders?kind=lead&scope=all');
      body().innerHTML = orders.length ? orders.map(orderCard).join('') : '<p class="a-note a-center">Заявок пока нет</p>';
    } catch (err) { failed(err); }
  }

  // ——— Товары и цены ———

  async function loadProducts() {
    try {
      const { products, weights, categories } = await API.call('GET', 'admin/products');
      body().innerHTML = categories.map((c) => {
        const items = products.filter((p) => p.cat === c.id);
        if (!items.length) return '';
        return `<h2 class="a-h2">${esc(c.title)}</h2>${items.map((p) => `<article class="a-card a-product" data-pid="${esc(p.id)}">
          <label class="a-field"><span>Название</span><input data-f="name" value="${esc(p.name)}"></label>
          ${p.prices
            ? `<div class="a-prices">${p.prices.map((v, i) => `<label class="a-field"><span>${esc(weights[i] || '')}</span><input data-f="price" data-i="${i}" inputmode="numeric" value="${v ?? ''}" placeholder="нет"></label>`).join('')}</div>`
            : `<label class="a-field"><span>Цена, ₽</span><input data-f="single" inputmode="numeric" value="${p.price ?? ''}"></label>`}
          <label class="a-check"><input type="checkbox" data-f="visible" ${p.hidden ? '' : 'checked'}> В продаже</label>
          <div class="a-actions"><button class="a-btn a-primary" data-save>Сохранить</button></div></article>`).join('')}`;
      }).join('');
      body().querySelectorAll('[data-save]').forEach((b) => b.addEventListener('click', async () => {
        const card = b.closest('[data-pid]');
        const payload = { id: card.dataset.pid, name: card.querySelector('[data-f=name]').value, hidden: !card.querySelector('[data-f=visible]').checked };
        const multi = [...card.querySelectorAll('[data-f=price]')];
        if (multi.length) payload.prices = multi.map((i) => (i.value.trim() === '' ? null : i.value.trim()));
        const single = card.querySelector('[data-f=single]');
        if (single) payload.price = single.value.trim();
        b.disabled = true;
        try { await API.call('POST', 'admin/product', payload); toast('Сохранено, на сайте и в приложении уже обновилось'); }
        catch (err) { toast(err.message); }
        b.disabled = false;
      }));
    } catch (err) { failed(err); }
  }

  // ——— Сводка ———

  async function loadStats() {
    try {
      const s = await API.call('GET', 'admin/stats');
      const tile = (n, t) => `<div class="a-tile"><b>${n}</b><span>${t}</span></div>`;
      body().innerHTML = `<div class="a-tiles">${tile(s.today, 'заказов сегодня')}${tile(s.week, 'за неделю')}${tile(money(s.revenueWeek), 'оплачено за неделю')}
        ${tile(s.open, 'в работе')}${tile(s.subscriptions, 'активных подписок')}${tile(s.paused, 'подписок на паузе')}</div>`;
    } catch (err) { failed(err); }
  }


  // ——— Карта гостя: сканер QR и отметка напитков (бариста и админ) ———

  const dots = (g) => `<div class="a-dots">${Array.from({ length: g.needed }, (_, i) => `<i class="${i < g.cups ? 'on' : ''}"></i>`).join('')}<i class="gift ${g.giftReady ? 'on' : ''}">🎁</i></div>`;

  function loadScan() {
    body().innerHTML = `<section class="a-card"><h2 class="a-h2">Отметить напитки гостю</h2>
      <p class="a-note">Наведите камеру на QR гостя из его мини-приложения или введите последние 4 цифры его номера.</p>
      <div class="a-actions"><button class="a-btn a-primary" id="a-scan">📷 Сканировать QR</button></div>
      <form id="a-find" class="a-find"><input id="a-q" placeholder="Код гостя, телефон или имя" autocomplete="off"><button class="a-btn" type="submit">Найти</button></form></section>
      <div id="a-guest"></div>`;
    document.getElementById('a-scan').addEventListener('click', scanQr);
    document.getElementById('a-find').addEventListener('submit', (e) => { e.preventDefault(); findGuest(document.getElementById('a-q').value); });
  }

  function scanQr() {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.initData && tg.showScanQrPopup && (!tg.isVersionAtLeast || tg.isVersionAtLeast('6.4'))) {
      tg.showScanQrPopup({ text: 'Наведите камеру на QR гостя' }, (text) => { findGuest(text); return true; });
      return;
    }
    if ('BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) return cameraScan();
    toast('Сканер в этом браузере недоступен — введите код гостя вручную');
  }

  /** Сканер камерой для сайта: встроенное распознавание QR в браузере, без сторонних библиотек. */
  async function cameraScan() {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } }); }
    catch { return toast('Нет доступа к камере. Разрешите её в браузере или введите код вручную'); }
    const layer = document.createElement('div');
    layer.className = 'a-scanner';
    layer.innerHTML = '<video playsinline muted></video><button class="a-btn">Закрыть</button>';
    document.body.append(layer);
    const video = layer.querySelector('video');
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    let alive = true;
    const stop = () => { alive = false; stream.getTracks().forEach((t) => t.stop()); layer.remove(); };
    layer.querySelector('button').addEventListener('click', stop);
    (async function loop() {
      while (alive) {
        try {
          const found = await detector.detect(video);
          if (found.length) { stop(); return findGuest(found[0].rawValue); }
        } catch { /* кадр ещё не готов */ }
        await new Promise((r) => setTimeout(r, 250));
      }
    })();
  }

  async function findGuest(query) {
    const q = String(query || '').trim();
    if (!q) return toast('Введите код гостя');
    try {
      const data = await API.call('GET', `staff/guest?q=${encodeURIComponent(q)}`);
      showGuest(data);
    } catch (err) {
      if (err.status === 401 || err.status === 403) return failed(err);
      const box = document.getElementById('a-guest');
      if (box) box.innerHTML = `<p class="a-note a-center">${esc(err.message)}</p>`;
    }
  }

  const KIND = { cup: 'напитки', gift: '🎁 подарок', visit: 'визит' };

  function showGuest({ guest: g, history }) {
    const box = document.getElementById('a-guest');
    if (!box) return;
    box.innerHTML = `<article class="a-card a-guest" data-phone="${esc(g.phone)}">
      <div class="a-row"><b>${esc(g.name || 'Гость')}</b><span class="a-badge">код ${esc(g.code)}</span></div>
      <p class="a-who2">${phoneLabel(g.phone)}${g.birthdayToday ? ' · 🎂 сегодня день рождения' : ''}</p>
      ${dots(g)}
      <p class="a-total">${g.giftReady ? '🎁 Подарок заработан — можно выдать' : `Осталось ${g.left} до подарка`}</p>
      <p class="a-time">Визитов: ${g.visits} · подарков выдано: ${g.gifts}${g.lastVisit ? ` · был: ${esc(g.lastVisit)}` : ''}</p>
      <div class="a-actions">
        <button class="a-btn a-primary" data-cups="1">+1 напиток</button><button class="a-btn" data-cups="2">+2</button><button class="a-btn" data-cups="3">+3</button>
        <button class="a-btn" data-undo>↩ Снять 1</button>
        <button class="a-btn ${g.giftReady ? 'a-primary' : ''}" data-gift ${g.giftReady ? '' : 'disabled'}>🎁 Выдать подарок</button></div>
      <ul class="a-lines a-history">${history.map((v) => `<li>${esc(v.created_at)} — ${KIND[v.kind] || v.kind}${v.kind === 'cup' ? ` ${v.cups > 0 ? '+' : ''}${v.cups}` : ''}</li>`).join('')}</ul></article>`;
    const card = box.querySelector('.a-guest');
    const act = async (route, payload, label, button) => {
      card.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      try {
        const data = await API.call('POST', route, { phone: g.phone, ...payload });
        toast(label);
        showGuest(data);
      } catch (err) {
        toast(err.message);
        card.querySelectorAll('button').forEach((b) => { b.disabled = false; });
        if (button) button.disabled = !g.giftReady;
      }
    };
    card.querySelectorAll('[data-cups]').forEach((b) => b.addEventListener('click', () => act('staff/cups', { cups: Number(b.dataset.cups) }, `Отмечено: +${b.dataset.cups}. Гостю ушло сообщение`)));
    card.querySelector('[data-undo]').addEventListener('click', () => act('staff/uncup', {}, 'Снят 1 напиток'));
    // Подарок — в два нажатия, чтобы не выдать случайно.
    const gift = card.querySelector('[data-gift]');
    gift.addEventListener('click', () => {
      if (gift.dataset.armed) return act('staff/gift', {}, 'Подарок выдан. Гостю ушло сообщение', gift);
      gift.dataset.armed = '1';
      gift.textContent = 'Нажмите ещё раз — выдать';
      setTimeout(() => { if (gift.isConnected) { delete gift.dataset.armed; gift.textContent = '🎁 Выдать подарок'; } }, 4000);
    });
  }

  // ——— Сотрудники: только админ ———

  async function loadStaff() {
    try {
      const { staff, self } = await API.call('GET', 'admin/staff');
      renderStaff(staff, self);
    } catch (err) { failed(err); }
  }

  function renderStaff(staff, self) {
    const roleLabel = (r) => (r === 'admin' ? 'Админ' : 'Бариста');
    body().innerHTML = `<section class="a-card"><h2 class="a-h2">Добавить сотрудника</h2>
        <p class="a-note">Права включатся, как только человек поделится номером в боте. Админ видит всё, бариста — заказы на самовывоз и карты гостей.</p>
        <form id="a-staff-add" class="a-find"><input id="a-phone" placeholder="+7 999 123-45-67" inputmode="tel" autocomplete="off">
          <select id="a-role"><option value="staff">Бариста</option><option value="admin">Админ</option></select>
          <button class="a-btn a-primary" type="submit">Добавить</button></form></section>
      ${staff.length ? staff.map((p) => `<article class="a-card" data-phone="${esc(p.phone)}">
        <div class="a-row"><b>${phoneLabel(p.phone)}</b><span class="a-badge">${roleLabel(p.role)}</span></div>
        <p class="a-who2">${esc(p.names || 'ещё не заходил в бота')}${p.byCode ? ' · вошёл по коду' : ''}</p>
        ${p.phone === self ? '<p class="a-time">Это вы</p>' : '<div class="a-actions"><button class="a-btn a-danger" data-remove>Убрать</button></div>'}</article>`).join('') : '<p class="a-note a-center">Сотрудников пока нет</p>'}`;
    document.getElementById('a-staff-add').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = await API.call('POST', 'admin/staff', { phone: document.getElementById('a-phone').value, role: document.getElementById('a-role').value });
        toast('Добавлено');
        renderStaff(data.staff, data.self);
      } catch (err) { toast(err.message); }
    });
    body().querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
      const phone = b.closest('[data-phone]').dataset.phone;
      // Убирать доступ — в два нажатия.
      if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Точно убрать?'; return; }
      try {
        const data = await API.call('POST', 'admin/staff/remove', { phone });
        toast('Доступ убран');
        renderStaff(data.staff, data.self);
      } catch (err) { toast(err.message); b.dataset.armed = ''; b.textContent = 'Убрать'; }
    }));
  }

  document.addEventListener('visibilitychange', () => { if (!document.hidden && state.me?.role && state.tab === 'orders') refreshOrders(true); });
  start();
})();

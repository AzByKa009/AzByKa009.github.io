// Демо админ-панели для GitHub Pages: там нет сервера, поэтому панель работает на примерных данных в памяти страницы.
// Ничего никуда не отправляется и не сохраняется. На настоящем сервере этот файл не используется.
(() => {
  const stamp = (shift = 0) => new Date(Date.now() - shift * 60000).toLocaleString('sv-SE').slice(0, 19);

  const orders = [
    { id: 1004, kind: 'lead', status: 'new', source: 'site', name: 'Кофейня «Рассвет»', phone: '79990004444', email: null, delivery: null, address: null, comment: 'Компания: Рассвет\nОбъём в месяц: 30–100 кг', lines: [], total: 0, shipping: null, paid: false, created_at: stamp(300) },
    { id: 1003, kind: 'order', status: 'new', source: 'tg', name: 'Мария', phone: '79990001111', email: null, delivery: 'Самовывоз · Кожевенная линия, 30а', address: null, comment: 'Заберу к 15:00', lines: [{ name: 'Эспрессо-смесь', opts: '200 г', price: 690, qty: 2 }], total: 1380, shipping: 0, paid: true, created_at: stamp(12) },
    { id: 1002, kind: 'order', status: 'paid', source: 'site', name: 'Иван', phone: '79990002222', email: 'ivan@example.com', delivery: 'Курьером по Петербургу', address: 'Невский пр., 10, кв. 4', comment: null, lines: [{ name: 'Фильтр · Африка', opts: '500 г', price: 1790, qty: 1 }, { name: 'Дрип-пакеты', opts: '', price: 590, qty: 1 }], total: 2730, shipping: 350, paid: true, created_at: stamp(95) },
    { id: 1001, kind: 'sub', status: 'accepted', source: 'tg', name: 'Мария', phone: '79990001111', email: null, delivery: null, address: 'Самовывоз из кофейни', comment: 'Очередная поставка по подписке №1', lines: [{ name: 'Подписка «На двоих»', opts: 'Эспрессо-смесь, 2 пачки по 200 г, раз в месяц', price: 1290, qty: 1 }], total: 1290, shipping: null, paid: true, created_at: stamp(1500) },
  ];
  const subscriptions = [
    { id: 1, status: 'active', name: 'Мария', phone: '79990001111', line: { name: 'Подписка «На двоих»', opts: 'Эспрессо-смесь, раз в месяц', price: 1290 }, next_date: '2026-12-02' },
    { id: 2, status: 'paused', name: 'Олег', phone: '79990005555', line: { name: 'Подписка «Для себя»', opts: 'Фильтр · Африка, раз в 2 недели', price: 690 }, next_date: '2026-11-10' },
  ];
  const products = [
    { id: 'espresso-blend', cat: 'coffee', name: 'Эспрессо-смесь', prices: [690, 1490, 2790], hidden: false },
    { id: 'filter-africa', cat: 'coffee', name: 'Фильтр · Африка', prices: [790, 1790, 3290], hidden: false },
    { id: 'decaf', cat: 'coffee', name: 'Декаф', prices: [790, 1790, null], hidden: true },
    { id: 'drip-box', cat: 'drip', name: 'Дрип-пакеты, 10 шт', price: 590, hidden: false },
  ];
  let staff = [
    { phone: '79990001122', role: 'admin', names: 'Вы (демо)' },
    { phone: '79990003344', role: 'staff', names: 'Борис' },
  ];
  const guest = { phone: '79990005566', name: 'Анна', code: '5566', cups: 3, needed: 5, every: 6, gifts: 1, visits: 9, lastVisit: stamp(2000), birthdayToday: false };
  const history = [{ id: 1, kind: 'cup', cups: 1, created_at: stamp(2000) }, { id: 2, kind: 'cup', cups: 2, created_at: stamp(6000) }];

  const view = () => ({ ...guest, left: Math.max(0, guest.needed - guest.cups), giftReady: guest.cups >= guest.needed });
  const card = () => ({ guest: view(), history: history.slice(0, 8) });
  const fail = (status, message) => Object.assign(new Error(message), { status });
  const wait = (data) => new Promise((resolve) => setTimeout(() => resolve(JSON.parse(JSON.stringify(data))), 120));

  async function call(method, path, body = {}) {
    const [route, queryString = ''] = path.split('?');
    const query = new URLSearchParams(queryString);

    if (route === 'admin/orders') {
      const kind = query.get('kind');
      const open = ['new', 'paid', 'accepted', 'ready', 'sent'];
      const list = orders.filter((o) => (kind === 'all' || !kind ? true : o.kind === kind))
        .filter((o) => query.get('scope') === 'all' || o.kind === 'lead' || open.includes(o.status));
      return wait({ orders: list, role: 'admin' });
    }
    if (route === 'admin/status') {
      const order = orders.find((o) => o.id === body.id);
      if (!order) throw fail(404, 'Заказ не найден');
      order.status = body.status;
      return wait({ order });
    }
    if (route === 'admin/stats') return wait({ today: 3, week: 14, revenueWeek: 28450, open: orders.filter((o) => o.kind !== 'lead' && ['new', 'paid', 'accepted', 'ready', 'sent'].includes(o.status)).length, subscriptions: subscriptions.filter((s) => s.status === 'active').length, paused: subscriptions.filter((s) => s.status === 'paused').length });
    if (route === 'admin/subs') return wait({ subscriptions });
    if (route === 'admin/sub') {
      const sub = subscriptions.find((s) => s.id === body.id);
      if (!sub) throw fail(404, 'Подписка не найдена');
      if (body.action === 'cancel') subscriptions.splice(subscriptions.indexOf(sub), 1);
      else sub.status = body.action === 'pause' ? 'paused' : 'active';
      return wait({ subscription: sub });
    }
    if (route === 'admin/products') return wait({ products, weights: ['200 г', '500 г', '1 кг'], categories: [{ id: 'coffee', title: 'Кофе' }, { id: 'drip', title: 'Дрип-пакеты' }] });
    if (route === 'admin/product') {
      const product = products.find((p) => p.id === body.id);
      if (!product) throw fail(404, 'Товар не найден');
      if (body.name) product.name = body.name;
      if (body.prices) product.prices = body.prices.map((p) => (p === null ? null : Number(p)));
      if (body.price !== undefined) product.price = Number(body.price);
      product.hidden = !!body.hidden;
      return wait({ product });
    }
    if (route === 'admin/staff') {
      if (method === 'POST') {
        const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
        if (phone.length !== 10) throw fail(400, 'Укажите телефон в формате +7 999 123-45-67');
        staff = staff.filter((p) => p.phone !== `7${phone}`);
        staff.push({ phone: `7${phone}`, role: body.role === 'admin' ? 'admin' : 'staff', names: null });
      }
      return wait({ staff, self: '79990001122' });
    }
    if (route === 'admin/staff/remove') {
      const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
      staff = staff.filter((p) => p.phone !== `7${phone}`);
      return wait({ staff, self: '79990001122' });
    }
    if (route === 'staff/guest') {
      if (!query.get('q')) throw fail(404, 'Гость не найден');
      return wait(card());
    }
    if (route === 'staff/cups') {
      guest.cups += body.cups; guest.visits += 1; history.unshift({ id: Date.now(), kind: 'cup', cups: body.cups, created_at: stamp() });
      return wait(card());
    }
    if (route === 'staff/uncup') {
      guest.cups = Math.max(0, guest.cups - 1); history.unshift({ id: Date.now(), kind: 'cup', cups: -1, created_at: stamp() });
      return wait(card());
    }
    if (route === 'staff/gift') {
      if (guest.cups < guest.needed) throw fail(409, `Подарок ещё не заработан: нужно ещё ${guest.needed - guest.cups}`);
      guest.cups -= guest.needed; guest.gifts += 1; history.unshift({ id: Date.now(), kind: 'gift', cups: 0, created_at: stamp() });
      return wait(card());
    }
    throw fail(404, 'Не найдено');
  }

  window.AKAdminDemo = { call };
})();

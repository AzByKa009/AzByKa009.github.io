// Связь мини-приложения и сайта с сервером: каталог и отправка заказов.
// Если сервера нет (превью на GitHub Pages, открыт файл с диска) — работает демо на данных из data.js.
(() => {
  const api = {
    online: false,
    payments: false,

    /** Свежий каталог с сервера: цены, наличие и фото, которые админ поменял в боте. */
    async load() {
      try {
        const res = await fetch('/api/catalog', { cache: 'no-store' });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data || !Array.isArray(data.products)) return false;
        const { payments, ...catalog } = data;
        Object.assign(window.AK, catalog);
        api.online = true;
        api.payments = !!payments;
        return true;
      } catch {
        return false;
      }
    },

    /** Отправка заказа, подписки или заявки. Ответ: { id, total, payUrl } или исключение с текстом для гостя. */
    async send(route, body) {
      const tg = window.Telegram && window.Telegram.WebApp;
      const initData = (tg && tg.initData) || '';
      let res;
      try {
        res = await fetch(`/api/${route}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData },
          body: JSON.stringify(body),
        });
      } catch {
        throw new Error('Нет связи. Проверьте интернет и попробуйте ещё раз');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не получилось отправить. Попробуйте ещё раз');
      return data;
    },

    /** Строка корзины → то, что ждёт сервер: товар, индекс веса и размера, количество. */
    cartLine(line) {
      const D = window.AK;
      const p = D.products.find((x) => x.id === line.id);
      const w = line.w ?? Math.max(0, D.weights.indexOf(line.weight));
      const sizeLabel = (String(line.opts || '').match(/Размер (\S+)/) || [])[1];
      const size = line.size ?? (p && p.sizes ? Math.max(0, p.sizes.indexOf(sizeLabel)) : 0);
      return { id: line.id, w, size, qty: line.qty };
    },
  };
  window.AKApi = api;
})();

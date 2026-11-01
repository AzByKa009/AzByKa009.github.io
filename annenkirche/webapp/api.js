// Связь мини-приложения и сайта с сервером: каталог и отправка заказов.
// Если сервера нет (превью на GitHub Pages, открыт файл с диска) — работает демо на данных из data.js.
(() => {
  const SESSION_KEY = 'ak-site-session';
  const getSession = () => { try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; } };
  const setSession = (value) => { try { if (value) localStorage.setItem(SESSION_KEY, value); else localStorage.removeItem(SESSION_KEY); } catch { /* приватный режим */ } };

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
          headers: { 'Content-Type': 'application/json', 'X-Telegram-Init-Data': initData, 'X-Session': getSession() },
          body: JSON.stringify(body),
        });
      } catch {
        throw new Error('Нет связи. Проверьте интернет и попробуйте ещё раз');
      }
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && data.login) { setSession(''); api.profile = null; }
      if (!res.ok) throw new Error(data.error || 'Не получилось отправить. Попробуйте ещё раз');
      return data;
    },

    // ——— Вход на сайт через Telegram ———
    // Сессия живёт в браузере (ключ в localStorage), на сервере её подтверждает бот: пароля и кода вводить не нужно.
    profile: null,

    /** Кто вошёл: { name, phone } или null. Просроченную сессию забываем. */
    async me() {
      const session = getSession();
      if (!api.online || !session) return null;
      try {
        const data = await (await fetch('/api/me', { headers: { 'X-Session': session } })).json();
        if (data.loggedIn) return (api.profile = { name: data.name, phone: data.phone });
        setSession('');
      } catch { /* нет связи — оставим как было */ }
      return null;
    },

    /** Начало входа: { url, poll }. url открываем в Telegram, poll — секрет для опроса. */
    async loginStart() {
      let res;
      try { res = await fetch('/api/login/start', { method: 'POST' }); } catch { throw new Error('Нет связи. Проверьте интернет'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не получилось начать вход');
      return data;
    },

    /** Ждём, пока гость нажмёт «Запустить» в боте. Опрашиваем раз в 2 секунды до 15 минут. */
    async loginWait(poll) {
      const until = Date.now() + 15 * 60 * 1000;
      while (Date.now() < until) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
          const { status } = await (await fetch(`/api/login/poll?poll=${encodeURIComponent(poll)}`)).json();
          if (status === 'ok') { setSession(poll); return api.me(); }
          if (status === 'expired') return null;
        } catch { /* связь моргнула — спросим ещё раз */ }
      }
      return null;
    },

    async logout() {
      const session = getSession();
      setSession('');
      api.profile = null;
      if (session) fetch('/api/logout', { method: 'POST', headers: { 'X-Session': session } }).catch(() => undefined);
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

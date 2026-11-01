// Связь мини-приложения и сайта с сервером: каталог и отправка заказов.
// Если сервера нет (превью на GitHub Pages, открыт файл с диска) — работает демо на данных из data.js.
(() => {
  const SESSION_KEY = 'ak-site-session';
  const getSession = () => { try { return localStorage.getItem(SESSION_KEY) || ''; } catch { return ''; } };
  const setSession = (value) => { try { if (value) localStorage.setItem(SESSION_KEY, value); else localStorage.removeItem(SESSION_KEY); } catch { /* приватный режим */ } };

  const initData = () => (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || '';
  /** Кто спрашивает: мини-приложение подписано Telegram, сайт — ключом входа через Telegram. */
  const authHeaders = () => {
    const headers = {};
    if (initData()) headers['X-Telegram-Init-Data'] = initData();
    if (getSession()) headers['X-Session'] = getSession();
    return headers;
  };

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
        const { payments, emailLogin, ...catalog } = data;
        api.emailLogin = !!emailLogin;
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

    /** Кто вошёл: { name, phone, role } или null. role — admin, staff или null. Просроченную сессию забываем. */
    async me() {
      if (!getSession() && !initData()) return null;
      try {
        const res = await fetch('/api/me', { headers: authHeaders() });
        if (!res.ok) return null;
        const data = await res.json();
        if (data.loggedIn) return (api.profile = { name: data.name, phone: data.phone, email: data.email || '', role: data.role || null });
        if (!initData()) setSession('');
      } catch { /* нет связи — оставим как было */ }
      return null;
    },

    /** Запрос админ-панели. Ошибку сервера превращаем в исключение с текстом для человека. */
    async call(method, path, body) {
      let res;
      try {
        res = await fetch('/api/' + path, {
          method,
          headers: { 'Content-Type': 'application/json', ...authHeaders() },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch {
        throw new Error('Нет связи. Проверьте интернет');
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || 'Не получилось. Попробуйте ещё раз');
        err.status = res.status;
        throw err;
      }
      return data;
    },

    /** Вход по почте включён на сервере (заполнен SMTP). */
    emailLogin: false,

    /** Письмо со ссылкой для входа на адрес. */
    async loginEmail(email) {
      let res;
      try { res = await fetch('/api/login/email', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) }); }
      catch { throw new Error('Нет связи. Проверьте интернет'); }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не получилось отправить письмо');
      return data;
    },

    /** Новая ссылка для входа по почте: старая перестаёт работать. */
    async resetEmailLink() {
      const res = await fetch('/api/login/email/reset', { method: 'POST', headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Не получилось');
      return data;
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

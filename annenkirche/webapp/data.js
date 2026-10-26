// Данные мини-приложения «Анненкирхе кофе».
// ВСЁ, ЧТО ПОМЕЧЕНО demo: true, — заглушки: названия, цены и описания заменим,
// когда кофейня пришлёт прайс и фото. Правило: ни рецептур напитков, ни выдуманных вкусов —
// поля notes у заглушек пустые, вкус описывает сам обжарщик.

window.AK = {
  brand: {
    name: 'Анненкирхе кофе',
    short: 'АК',
    tagline: 'Обжариваем кофе сами',
    phone: '+7 (921) 917-78-53',
    phoneRaw: '+79219177853',
    telegram: 'mrgvzd',
    channel: '', // ссылка на канал — пришлют
    bot: 'annenkirche_coffee_bot',
    addresses: [
      { title: 'Кожевенная линия, 30а', note: '«Брусницын», 1 этаж' },
      { title: 'Кирочная улица, 8а', note: 'цокольный этаж' },
    ],
    hours: 'Ежедневно 10:00–22:00',
    every: 6,
  },

  categories: [
    { id: 'coffee', title: 'Кофе', icon: 'bean' },
    { id: 'drip', title: 'Дрип-пакеты', icon: 'drip' },
    { id: 'tea', title: 'Чай', icon: 'leaf' },
    { id: 'cocoa', title: 'Какао', icon: 'cup' },
    { id: 'merch', title: 'Мерч', icon: 'bag' },
  ],

  /** Варианты веса зерна: 200 г, 500 г, 1 кг — так фасует кофейня. */
  weights: ['200 г', '500 г', '1 кг'],
  // Помола нет: кофе продаётся в зёрнах (ответ кофейни, 20.10.2026).

  products: [
    { id: 'espresso-blend', cat: 'coffee', name: 'Эспрессо-смесь', sub: 'для эспрессо и молочных', prices: [690, 1490, 2790], tags: ['espresso', 'milk', 'choco'], color: 'plum', demo: true },
    { id: 'filter-africa', cat: 'coffee', name: 'Фильтр · Африка', sub: 'для воронки и аэропресса', prices: [790, 1790, 3290], tags: ['filter', 'fruit', 'bright'], color: 'orange', demo: true },
    { id: 'filter-latam', cat: 'coffee', name: 'Фильтр · Латинская Америка', sub: 'для воронки и френч-пресса', prices: [740, 1690, 3090], tags: ['filter', 'nuts', 'soft'], color: 'sand', demo: true },
    { id: 'seasonal', cat: 'coffee', name: 'Сезонный лот', sub: 'ограниченная партия', prices: [890, 1990, null], tags: ['filter', 'fruit', 'bright'], color: 'dark', badge: 'Новинка', demo: true },
    { id: 'decaf', cat: 'coffee', name: 'Декаф', sub: 'без кофеина', prices: [790, 1790, null], tags: ['espresso', 'milk', 'soft', 'decaf'], color: 'sand', demo: true },

    { id: 'drip-10', cat: 'drip', name: 'Дрип-пакеты · 10 шт', sub: 'кофе в дорогу и на работу', price: 690, color: 'orange', demo: true },
    { id: 'drip-mix', cat: 'drip', name: 'Дрип-микс · 5 сортов', sub: 'попробовать всё', price: 490, color: 'plum', demo: true },
    { id: 'drip-gift', cat: 'drip', name: 'Подарочный набор', sub: '20 дрип-пакетов в коробке', price: 1390, color: 'dark', badge: 'В подарок', demo: true },

    { id: 'tea-black', cat: 'tea', name: 'Чай чёрный', sub: '100 г', price: 490, color: 'dark', demo: true },
    { id: 'tea-green', cat: 'tea', name: 'Чай зелёный', sub: '100 г', price: 520, color: 'sand', demo: true },
    { id: 'tea-herbal', cat: 'tea', name: 'Травяной сбор', sub: '80 г', price: 450, color: 'orange', demo: true },

    { id: 'cocoa', cat: 'cocoa', name: 'Какао', sub: '250 г', price: 590, color: 'plum', demo: true },
    { id: 'cocoa-dark', cat: 'cocoa', name: 'Горячий шоколад', sub: '250 г', price: 690, color: 'dark', demo: true },

    { id: 'mug', cat: 'merch', name: 'Кружка АК', sub: 'керамика, 350 мл', price: 990, color: 'plum', demo: true },
    { id: 'tee', cat: 'merch', name: 'Футболка АК', sub: 'хлопок, S–XL', price: 1990, sizes: ['S', 'M', 'L', 'XL'], color: 'dark', demo: true },
    { id: 'tote', cat: 'merch', name: 'Шоппер АК', sub: 'плотный хлопок', price: 1190, color: 'sand', demo: true },
  ],

  delivery: [
    { id: 'pickup-k', title: 'Самовывоз · Кожевенная линия, 30а', price: 0 },
    { id: 'pickup-r', title: 'Самовывоз · Кирочная, 8а', price: 0 },
    { id: 'spb', title: 'Курьером по Петербургу', price: 350, demo: true },
    { id: 'russia', title: 'СДЭК по России', price: null, note: 'по тарифу СДЭК', demo: true },
  ],

  /** Подписка — примеры: состав и цены пришлёт кофейня. */
  plans: [
    { id: 'solo', title: 'Для себя', text: '1 пачка 200 г', every: 'раз в месяц', price: 690, demo: true },
    { id: 'duo', title: 'На двоих', text: '2 пачки по 200 г', every: 'раз в месяц', price: 1290, badge: 'Выгодно', demo: true },
    { id: 'office', title: 'В офис', text: '1 кг зерна', every: 'раз в 2 недели', price: 2590, demo: true },
  ],
  planFrequencies: ['Раз в 2 недели', 'Раз в месяц'],

  /** «Найди свой кофе»: ответы копят метки, побеждает товар с наибольшим совпадением. */
  quiz: [
    { q: 'Как вы обычно пьёте кофе?', a: [
      { t: 'Эспрессо, капучино, латте', tags: ['espresso', 'milk'] },
      { t: 'Чёрный, в воронке или аэропрессе', tags: ['filter'] },
      { t: 'Во френч-прессе или турке', tags: ['filter', 'soft'] },
      { t: 'Не знаю, хочу попробовать', tags: [] },
    ] },
    { q: 'С молоком или без?', a: [
      { t: 'Почти всегда с молоком', tags: ['milk', 'choco'] },
      { t: 'Только чёрный', tags: ['filter', 'bright'] },
      { t: 'По настроению', tags: [] },
    ] },
    { q: 'Какие вкусы вам ближе?', a: [
      { t: 'Шоколад, карамель', tags: ['choco'] },
      { t: 'Орехи, печенье', tags: ['nuts', 'soft'] },
      { t: 'Ягоды, фрукты', tags: ['fruit'] },
      { t: 'Цветы, цитрус', tags: ['bright', 'fruit'] },
    ] },
    { q: 'Кислинка в кофе — это…', a: [
      { t: 'Обожаю', tags: ['bright', 'fruit'] },
      { t: 'Немного можно', tags: ['soft'] },
      { t: 'Лучше без неё', tags: ['choco', 'nuts'] },
    ] },
    { q: 'А кофеин?', a: [
      { t: 'Конечно, да', tags: [] },
      { t: 'Лучше без кофеина', tags: ['decaf'] },
    ] },
  ],

  wholesale: {
    text: 'Обжариваем кофе для кофеен, ресторанов и офисов. Свежая обжарка, стабильное качество, помощь с настройкой.',
    priceUrl: '', // оптовый прайс — пришлют
    perks: ['Свежая обжарка под ваш график', 'Цены от объёма', 'Дрип-пакеты под ваш бренд'],
    demo: true,
  },
};

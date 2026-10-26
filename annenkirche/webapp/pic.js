// Рисунки упаковок для товаров, пока нет фото: общие для мини-приложения и сайта.
// pic(товар, подпись, ночь) → SVG. Ночью — витрина под лампой с тёплым светом.
(() => {
  // Откуда брать картинки: мини-приложение лежит рядом с img/, сайт задаёт AKAssetBase = '../webapp/'.
  const BASE = window.AKAssetBase || '';
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  // ——— Картинки товаров: рисуем упаковку в фирменных цветах, пока нет фото ———

  const PALETTE = {
    plum: { bg: '#EDE4EC', body: '#5E4666', fold: '#4B3752', label: '#F8F4F1', ink: '#5E4666' },
    orange: { bg: '#FBE9DC', body: '#E07B39', fold: '#C9662A', label: '#FFFFFF', ink: '#5E4666' },
    sand: { bg: '#F3EADF', body: '#C9A27E', fold: '#B38B66', label: '#FFFFFF', ink: '#5E4666' },
    dark: { bg: '#E7E1E8', body: '#3B2C40', fold: '#2C2030', label: '#F8F4F1', ink: '#3B2C40' },
  };

  function shortName(p) {
    return p.name.replace(/^(Фильтр|Чай|Дрип-пакеты|Дрип-микс)\s·\s/, '').replace(/\s·.*$/, '');
  }

  function pic(p, label = '', night = false) {
    // Настоящее фото, если админ загрузил его в боте.
    if (p.photo) return `<img class="photo" src="${esc(p.photo)}" alt="${esc(p.name)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block">`;
    const c = PALETTE[p.color] || PALETTE.plum;
    const name = esc(shortName(p)).toUpperCase();
    const fontSize = name.length > 12 ? 15 : 18;
    const uid = `${p.id}-${Math.random().toString(36).slice(2, 7)}`;
    // Светлая тема — пастельный фон. Тёмная — ночная витрина: сверху лампа, тёплый свет падает на упаковку.
    const bg = night
      ? `<defs>
          <radialGradient id="room-${uid}" cx="50%" cy="10%" r="80%">
            <stop offset="0" stop-color="#3A2A2A"/><stop offset=".55" stop-color="#1A1219"/><stop offset="1" stop-color="#0E0A10"/></radialGradient>
          <linearGradient id="beam-${uid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#FFE3B3" stop-opacity=".42"/><stop offset=".7" stop-color="#FFC77F" stop-opacity=".10"/><stop offset="1" stop-color="#FFC77F" stop-opacity="0"/></linearGradient>
          <radialGradient id="pool-${uid}" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="#FFC27A" stop-opacity=".38"/><stop offset="1" stop-color="#FFC27A" stop-opacity="0"/></radialGradient>
          <radialGradient id="bulb-${uid}" cx="50%" cy="50%" r="50%">
            <stop offset="0" stop-color="#FFF4DC"/><stop offset=".35" stop-color="#FFD48F" stop-opacity=".8"/><stop offset="1" stop-color="#FFB15C" stop-opacity="0"/></radialGradient>
        </defs>
        <rect width="400" height="400" fill="url(#room-${uid})"/>
        <ellipse cx="200" cy="352" rx="165" ry="26" fill="url(#pool-${uid})"/>
        <ellipse cx="200" cy="356" rx="110" ry="11" fill="rgba(0,0,0,.45)"/>`
      : `<rect width="400" height="400" fill="${c.bg}"/><ellipse cx="200" cy="360" rx="120" ry="14" fill="rgba(59,44,64,.12)"/>`;
    // Лампа и луч рисуются поверх упаковки и осветляют её (screen), как настоящий свет.
    const lamp = night
      ? `<path d="M189 44 L211 44 L340 372 L60 372 Z" fill="url(#beam-${uid})" style="mix-blend-mode:screen"/>
        <line x1="200" y1="0" x2="200" y2="20" stroke="#3B3040" stroke-width="2"/>
        <path d="M176 20 h48 l12 24 h-72 z" fill="#2B2230"/>
        <path d="M164 44 h72" stroke="#4A3D50" stroke-width="2"/>
        <ellipse cx="200" cy="46" rx="40" ry="16" fill="url(#bulb-${uid})"/>
        <ellipse cx="200" cy="45" rx="11" ry="3.5" fill="#FFF4DC"/>`
      : '';
    let body;
    if (p.cat === 'merch' && p.id === 'mug') {
      body = `<path d="M118 150h150v140a40 40 0 0 1-40 40h-70a40 40 0 0 1-40-40z" fill="${c.body}"/>
        <path d="M268 180h22a32 32 0 0 1 0 64h-22" fill="none" stroke="${c.body}" stroke-width="18"/>
        <image href="${BASE}img/emblem-white.png" x="158" y="205" width="70" height="58"/>`;
    } else if (p.cat === 'merch' && p.id === 'tee') {
      body = `<path d="M150 100l-60 34 22 50 30-14v180h116V170l30 14 22-50-60-34c-6 18-24 30-50 30s-44-12-50-30z" fill="${c.body}"/>
        <image href="${BASE}img/emblem-white.png" x="168" y="170" width="64" height="53"/>`;
    } else if (p.cat === 'merch') {
      body = `<path d="M160 140c0-40 80-40 80 0" fill="none" stroke="${c.fold}" stroke-width="10"/>
        <path d="M118 140h164l-8 200H126z" fill="${c.body}"/>
        <image href="${BASE}img/emblem.png" x="160" y="200" width="80" height="66"/>`;
    } else if (p.cat === 'drip') {
      body = `<rect x="104" y="120" width="192" height="220" rx="14" fill="${c.body}"/>
        <rect x="104" y="120" width="192" height="40" rx="14" fill="${c.fold}"/>
        <rect x="134" y="186" width="132" height="120" rx="10" fill="${c.label}"/>
        <image href="${BASE}img/emblem.png" x="176" y="196" width="48" height="40"/>
        <text x="200" y="262" text-anchor="middle" font-family="Forum" font-weight="600" font-size="${fontSize}" fill="${c.ink}">${name}</text>
        <text x="200" y="288" text-anchor="middle" font-family="Onest" font-weight="600" font-size="12" fill="${c.ink}" opacity=".6">дрип-пакеты</text>`;
    } else {
      // Пакет с клапаном — кофе, чай, какао.
      body = `<path d="M124 112h152l14 226a12 12 0 0 1-12 12H122a12 12 0 0 1-12-12z" fill="${c.body}"/>
        <path d="M124 82h152v34H124z" fill="${c.fold}"/>
        <path d="M124 82l9-8 9 8 9-8 9 8 9-8 9 8 9-8 9 8 9-8 9 8 9-8 9 8 9-8 9 8 9-8 9 8 9-8 9 8z" fill="${c.fold}"/>
        <circle cx="200" cy="140" r="7" fill="${c.fold}"/>
        <rect x="140" y="166" width="120" height="146" rx="10" fill="${c.label}"/>
        <image href="${BASE}img/emblem.png" x="172" y="178" width="56" height="46"/>
        <text x="200" y="252" text-anchor="middle" font-family="Forum" font-weight="600" font-size="${fontSize}" fill="${c.ink}">${name}</text>
        <text x="200" y="278" text-anchor="middle" font-family="Onest" font-weight="700" font-size="13" fill="${c.ink}" opacity=".6">${esc(label || (p.prices ? '200 г' : p.sub))}</text>
        <rect x="176" y="290" width="48" height="4" rx="2" fill="#E07B39"/>`;
    }
    // slice: в рамке другой формы (арка 4:5) рисунок заполняет её целиком, без полос.
    return `<svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${bg}${body}${lamp}</svg>`;
  }


  window.AKPic = pic;
  window.AKShortName = shortName;
})();

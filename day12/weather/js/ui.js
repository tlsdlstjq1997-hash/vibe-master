// 툴팁 HTML, 하단 상세 패널, 진행률/알림 + 공통 유틸
const UI = (() => {
  const NIGHT_START = 20;
  const NIGHT_END = 7;
  // 기온 구간 상한 → CSS 클래스 t1 ~ t6 (색은 style.css 의 --t1 ~ --t6)
  const TEMP_LIMITS = [-10, 0, 10, 20, 30, Infinity];
  const WEEKDAYS = '일월화수목금토';
  const DIRS = ['북', '북북동', '북동', '동북동', '동', '동남동', '남동', '남남동',
    '남', '남남서', '남서', '서남서', '서', '서북서', '북서', '북북서'];
  const STATUS_TEXT = {
    loading: '<span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>불러오는 중…',
    error: '<span class="text-danger">날씨 정보를 불러오지 못했습니다</span>',
    nokey: '<span class="text-warning-emphasis">API 키가 필요합니다</span>',
  };

  const $ = sel => document.querySelector(sel);
  const pad = n => String(n).padStart(2, '0');

  // ---------- 유틸 ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  function tempClass(t) {
    return `t${TEMP_LIMITS.findIndex(max => t < max) + 1}`;
  }

  // 현지 시각: UTC + timezone(초). 결과 Date 는 getUTC* 메서드로 읽는다.
  function localDate(w, unix = Date.now() / 1000) {
    return new Date((unix + w.timezone) * 1000);
  }

  function isNight(w) {
    const h = localDate(w).getUTCHours();
    return h >= NIGHT_START || h < NIGHT_END;
  }

  const fmtTime = d => `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  const fmtDate = d =>
    `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())} (${WEEKDAYS[d.getUTCDay()]})`;
  const fmtTemp = t => `${t.toFixed(1)}°C`;
  const iconUrl = (code, size) => `https://openweathermap.org/img/wn/${code}@${size}.png`;

  function windDirKo(deg) {
    return `${DIRS[Math.round(deg / 22.5) % 16]}풍`;
  }

  function dayBadge(w) {
    return isNight(w)
      ? '<span class="badge text-bg-dark"><i class="bi bi-moon-stars-fill"></i> 밤</span>'
      : '<span class="badge text-bg-warning"><i class="bi bi-sun-fill"></i> 낮</span>';
  }

  function flagImg(city, cls) {
    return `<img src="https://flagcdn.com/w80/${city.cc.toLowerCase()}.png" alt="" class="${cls}">`;
  }

  // ---------- 툴팁 ----------
  function tooltipHtml(city, w, status = 'loading') {
    const head = `<div class="tt-head">${flagImg(city, 'tt-flag')}
      <strong>${escapeHtml(city.name)}</strong>
      <span class="text-body-secondary">(${escapeHtml(city.country)})</span></div>`;

    if (!w) return `<div class="tt">${head}<div class="small text-body-secondary">${STATUS_TEXT[status]}</div></div>`;

    const desc = w.weather[0];
    const windy = Effects.classify(w).windy;
    return `<div class="tt">${head}
      <div class="tt-main">
        <img src="${iconUrl(desc.icon, '2x')}" alt="" class="tt-icon">
        <span class="tt-temp">${fmtTemp(w.main.temp)}</span>
        <span class="tt-desc">${escapeHtml(desc.description)}</span>
      </div>
      <div class="tt-meta">
        <span class="${windy ? 'wind-alert' : ''}"><i class="bi bi-wind"></i> ${w.wind.speed.toFixed(1)} m/s</span>
        <span><i class="bi bi-clock"></i> 현지 ${fmtTime(localDate(w))}</span>
        ${dayBadge(w)}
      </div></div>`;
  }

  // ---------- 상세 패널 ----------
  function detailHeader(city, w) {
    const when = w ? ` · 현지 ${fmtDate(localDate(w))} ${fmtTime(localDate(w))}` : '';
    return `<div class="card-header detail-head d-flex flex-wrap align-items-center gap-3">
      ${flagImg(city, 'detail-flag')}
      <div class="me-auto">
        <h2 class="h4 mb-0">${escapeHtml(city.name)}
          <small class="text-body-secondary fs-6">${escapeHtml(city.nameEn)}</small></h2>
        <div class="small text-body-secondary"><i class="bi bi-geo-alt"></i>
          ${escapeHtml(city.country)} (${city.lat.toFixed(2)}, ${city.lon.toFixed(2)})${when}</div>
      </div>
      ${w ? dayBadge(w) : ''}
    </div>`;
  }

  function tile(icon, label, value, sub = '') {
    return `<div class="col-6 col-md-3"><div class="info-tile">
      <div class="info-label"><i class="bi ${icon}"></i> ${label}</div>
      <div class="info-value">${value}</div>
      ${sub ? `<div class="info-sub">${sub}</div>` : ''}
    </div></div>`;
  }

  function alertBadges(w) {
    const fx = Effects.classify(w);
    const badges = [];
    if (fx.windy) badges.push('<span class="badge bg-danger"><i class="bi bi-wind"></i> 강풍</span>');
    if (fx.storm) badges.push('<span class="badge bg-dark"><i class="bi bi-cloud-lightning-fill"></i> 뇌우</span>');
    if (fx.rain) badges.push(`<span class="badge bg-primary"><i class="bi bi-cloud-rain-fill"></i> ${fx.heavy ? '폭우' : '비'}</span>`);
    return badges.length ? badges.join('') : '<span class="badge text-bg-light border">특이사항 없음</span>';
  }

  function renderDetail(city, w) {
    const desc = w.weather[0];
    const m = w.main;
    const deg = w.wind.deg || 0;
    const rain = (w.rain && w.rain['1h']) || 0;
    const snow = w.snow && w.snow['1h'];
    const sun = unix => fmtTime(localDate(w, unix));
    const arrow = `<i class="bi bi-arrow-up wind-arrow" style="transform:rotate(${(deg + 180) % 360}deg)"></i>`;

    const tiles = [
      tile('bi-droplet', '습도', `${m.humidity}%`),
      tile('bi-speedometer2', '기압', `${m.pressure} hPa`),
      tile('bi-wind', '풍속', `${w.wind.speed.toFixed(1)} m/s`, `${arrow} ${windDirKo(deg)} (${deg}°)`),
      tile('bi-tornado', '돌풍', w.wind.gust != null ? `${w.wind.gust.toFixed(1)} m/s` : '-'),
      tile('bi-cloud', '구름량', `${w.clouds.all}%`),
      tile('bi-eye', '가시거리', w.visibility != null ? `${(w.visibility / 1000).toFixed(1)} km` : '-'),
      tile('bi-cloud-rain', '1시간 강수량', `${rain} mm`, snow ? `<i class="bi bi-snow"></i> 강설 ${snow} mm` : ''),
      tile('bi-sunrise', '일출 / 일몰', `${sun(w.sys.sunrise)} / ${sun(w.sys.sunset)}`, '현지 시각'),
    ].join('');

    $('#detail-panel').innerHTML = `<div class="card shadow-sm detail-card">
      ${detailHeader(city, w)}
      <div class="card-body">
        <div class="row g-3 align-items-center mb-3">
          <div class="col-md-5 d-flex align-items-center gap-2">
            <img src="${iconUrl(desc.icon, '4x')}" alt="" class="detail-icon">
            <div>
              <div class="detail-temp">${fmtTemp(m.temp)}</div>
              <div class="fs-5">${escapeHtml(desc.description)}</div>
            </div>
          </div>
          <div class="col-md-7">
            <div class="d-flex flex-wrap gap-2 mb-2">${alertBadges(w)}</div>
            <div class="text-body-secondary">
              <i class="bi bi-thermometer-half"></i> 체감 ${fmtTemp(m.feels_like)}
              · 최저 ${fmtTemp(m.temp_min)} / 최고 ${fmtTemp(m.temp_max)}
            </div>
          </div>
        </div>
        <div class="row g-3">${tiles}</div>
      </div>
      <div class="card-footer d-flex flex-wrap align-items-center gap-2 small text-body-secondary">
        <span>관측 시각: ${fmtTime(localDate(w, w.dt))} (현지) · 데이터: OpenWeatherMap</span>
        <button type="button" class="btn btn-sm btn-outline-primary ms-auto" data-action="refresh">
          <i class="bi bi-arrow-clockwise"></i> 새로고침
        </button>
      </div>
    </div>`;
  }

  function renderDetailStatus(city, status) {
    $('#detail-panel').innerHTML = `<div class="card shadow-sm detail-card">
      ${detailHeader(city, null)}
      <div class="card-body text-center py-5 text-body-secondary">${STATUS_TEXT[status]}
        ${status === 'error'
          ? '<div class="mt-3"><button type="button" class="btn btn-sm btn-outline-primary" data-action="refresh"><i class="bi bi-arrow-clockwise"></i> 다시 시도</button></div>'
          : ''}
      </div>
    </div>`;
  }

  // ---------- 진행률 / 알림 ----------
  function setProgress(done, total) {
    const wrap = $('#progress-wrap');
    wrap.classList.toggle('d-none', total === 0);
    if (!total) return;
    const pct = Math.round((done / total) * 100);
    $('#progress-text').textContent = `날씨 불러오는 중 ${done} / ${total}`;
    $('#progress-bar').style.width = `${pct}%`;
    wrap.querySelector('.progress').setAttribute('aria-valuenow', pct);
  }

  function clearAlert(id) {
    const el = document.querySelector(`#alert-area [data-alert-id="${id}"]`);
    if (el) el.remove();
  }

  function showAlert(type, message, id) {
    clearAlert(id);
    $('#alert-area').insertAdjacentHTML('beforeend',
      `<div class="alert alert-${type} alert-dismissible fade show py-2 mb-2" role="alert" data-alert-id="${id}">
        ${message}
        <button type="button" class="btn-close py-2" data-bs-dismiss="alert" aria-label="닫기"></button>
      </div>`);
  }

  function showMapError(message, onRetry) {
    const map = $('#map');
    map.innerHTML = `<div class="map-error">
      <div class="alert alert-danger mb-0">
        <i class="bi bi-exclamation-triangle-fill"></i> ${message}
        <button type="button" class="btn btn-sm btn-danger ms-2">다시 시도</button>
      </div></div>`;
    map.querySelector('button').addEventListener('click', onRetry, { once: true });
  }

  return {
    tempClass,
    localDate,
    isNight,
    tooltipHtml,
    renderDetail,
    renderDetailStatus,
    setProgress,
    showAlert,
    clearAlert,
    showMapError,
  };
})();

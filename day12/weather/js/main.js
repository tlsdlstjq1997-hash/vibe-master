// 초기화, 전체 흐름 연결
(() => {
  const { PRIORITY, CACHE_MS } = WeatherAPI;
  const TICK_MS = 60 * 1000;
  const DEMO = new URLSearchParams(location.search).get('demo') === '1';

  const state = {
    cities: {},  // 도시 id → { id, name, nameEn, cc, country, lat, lon, tier }
    weather: {}, // 도시 id → OWM 응답
    errors: {},  // 도시 id → true (요청 실패)
    selected: null,
  };
  CITIES.forEach(c => { state.cities[c.id] = c; });

  const hasKey = () =>
    typeof CONFIG !== 'undefined' && !!CONFIG.OWM_API_KEY && !CONFIG.OWM_API_KEY.startsWith('YOUR_');

  // ---------- 데모 데이터 (?demo=1) ----------
  function makeDemo({ id, desc, icon, temp, speed, deg, rain, timezone }) {
    const now = Math.floor(Date.now() / 1000);
    return {
      weather: [{ id, description: desc, icon }],
      main: { temp, feels_like: temp - 1.5, temp_min: temp - 2, temp_max: temp + 2, humidity: 72, pressure: 1006 },
      wind: { speed, deg, gust: speed + 3 },
      clouds: { all: 80 },
      visibility: 8000,
      rain: rain ? { '1h': rain } : undefined,
      sys: { sunrise: now - 6 * 3600, sunset: now + 6 * 3600 },
      timezone,
      dt: now,
      _savedAt: Date.now(),
    };
  }

  const DEMO_DATA = DEMO ? {
    seoul: makeDemo({ id: 800, desc: '맑음 (데모: 강풍)', icon: '01d', temp: 16, speed: 12.5, deg: 300, timezone: 32400 }),
    tokyo: makeDemo({ id: 501, desc: '보통 비 (데모)', icon: '10d', temp: 19, speed: 3, deg: 180, rain: 2.4, timezone: 32400 }),
    delhi: makeDemo({ id: 211, desc: '뇌우 (데모)', icon: '11d', temp: 29, speed: 5, deg: 220, rain: 6, timezone: 19800 }),
    london: makeDemo({ id: 502, desc: '폭우 + 강풍 (데모)', icon: '10d', temp: 11, speed: 16, deg: 240, rain: 9, timezone: 3600 }),
  } : {};

  // ---------- 날씨 반영 ----------
  function statusOf(id) {
    if (state.errors[id]) return 'error';
    if (!hasKey() && !DEMO_DATA[id]) return 'nokey';
    return 'loading';
  }

  function tooltipFor(id) {
    return UI.tooltipHtml(state.cities[id], state.weather[id], statusOf(id));
  }

  function applyWeather(id, data) {
    const city = state.cities[id];
    state.weather[id] = data;
    delete state.errors[id];
    WeatherMap.updateCity(city, data);
    Effects.update(city, data);
    WeatherMap.refreshTooltip(id);
    if (state.selected === id) UI.renderDetail(city, data);
  }

  function applyError(id) {
    state.errors[id] = true;
    WeatherMap.refreshTooltip(id);
    if (state.selected === id && !state.weather[id]) UI.renderDetailStatus(state.cities[id], 'error');
  }

  function request(id, priority, force = false) {
    if (DEMO_DATA[id]) {
      applyWeather(id, DEMO_DATA[id]);
      return;
    }
    if (!hasKey()) return;
    WeatherAPI.getWeather(state.cities[id], priority, force)
      .then(data => applyWeather(id, data))
      .catch(err => {
        if (err.status !== 401) console.error(`[${id}]`, err);
        applyError(id);
      });
  }

  // ---------- 이벤트 핸들러 ----------
  function onHover(id) {
    if (!state.weather[id]) request(id, PRIORITY.HOVER);
  }

  function onClick(id) {
    state.selected = id;
    WeatherMap.select(id);
    const city = state.cities[id];
    if (state.weather[id]) {
      UI.renderDetail(city, state.weather[id]);
    } else {
      UI.renderDetailStatus(city, hasKey() ? 'loading' : 'nokey');
      delete state.errors[id];
      request(id, PRIORITY.CLICK);
    }
    document.getElementById('detail-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // 화면에 보이는 도시(현재 줌에서 표시되는 tier)를 먼저 불러온다
  function onViewChange(bounds, maxTier) {
    CITIES.forEach(c => {
      if (!state.weather[c.id] && c.tier <= maxTier && bounds.contains([c.lat, c.lon])) {
        request(c.id, PRIORITY.VISIBLE);
      }
    });
  }

  function onDetailAction(e) {
    const btn = e.target.closest('[data-action="refresh"]');
    if (!btn || !state.selected) return;
    const id = state.selected;
    delete state.errors[id];
    UI.renderDetailStatus(state.cities[id], 'loading');
    request(id, PRIORITY.CLICK, true);
  }

  // 1분마다: 밤 영역 이동, 현지 시각 갱신, 10분 지난 데이터와 실패한 도시 재요청
  function tick() {
    WeatherMap.refreshNight();
    Object.keys(state.weather).forEach(WeatherMap.refreshTooltip);
    const sel = state.selected;
    if (sel && state.weather[sel]) UI.renderDetail(state.cities[sel], state.weather[sel]);

    CITIES.forEach(({ id }) => {
      if (DEMO_DATA[id]) return;
      const w = state.weather[id];
      if (state.errors[id] || (w && Date.now() - w._savedAt > CACHE_MS)) request(id, PRIORITY.BACKGROUND);
    });
  }

  // ---------- 초기화 ----------
  function watchNetwork() {
    const update = () => {
      if (navigator.onLine) {
        UI.clearAlert('offline');
        Object.keys(state.errors).forEach(id => request(id, PRIORITY.BACKGROUND));
      } else {
        UI.showAlert('secondary', '<i class="bi bi-wifi-off"></i> 오프라인 상태입니다.', 'offline');
      }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if (!navigator.onLine) update();
  }

  async function init() {
    let land;
    try {
      land = await WeatherAPI.loadLand();
    } catch (err) {
      console.error(err);
      UI.showMapError('지도 데이터를 불러오지 못했습니다.', () => {
        document.getElementById('map').innerHTML = '';
        init();
      });
      return;
    }

    WeatherMap.init('map', land, CITIES, { tooltip: tooltipFor, onHover, onClick, onViewChange });
    Effects.init(WeatherMap.getMap());

    if (!hasKey()) {
      UI.showAlert('warning',
        '<i class="bi bi-key-fill"></i> <code>js/config.js</code> 에 OpenWeatherMap API 키를 입력하세요. (<code>config.example.js</code> 참고)',
        'nokey');
    }

    // 주요 도시(tier 1)부터 요청 → 화면에 보이는 도시는 우선순위를 올린다
    [...CITIES]
      .sort((a, b) => a.tier - b.tier)
      .forEach(c => request(c.id, PRIORITY.BACKGROUND));
    const map = WeatherMap.getMap();
    onViewChange(map.getBounds(), WeatherMap.maxTier());

    setInterval(tick, TICK_MS);
  }

  WeatherAPI.onProgress(UI.setProgress);
  WeatherAPI.onFatal(() => {
    UI.showAlert('danger',
      '<i class="bi bi-exclamation-octagon-fill"></i> API 키가 올바르지 않습니다 (401). 새로 발급한 키는 활성화까지 몇 시간 걸릴 수 있어요.',
      'key');
  });
  document.getElementById('detail-panel').addEventListener('click', onDetailAction);
  watchNetwork();
  init();
})();

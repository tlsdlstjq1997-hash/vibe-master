// OpenWeatherMap / 배경 지도 호출, 캐시, 요청 큐
const WeatherAPI = (() => {
  const GEOJSON_URL = 'https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json';
  const OWM_URL = 'https://api.openweathermap.org/data/2.5/weather';

  const STATIC_CACHE_MS = 7 * 24 * 60 * 60 * 1000; // 국경 데이터: 7일
  const CACHE_MS = 10 * 60 * 1000;                  // 날씨: 10분
  const REQUEST_GAP_MS = 1100;                      // 분당 약 54회 (무료 플랜 60회 제한)
  const RATE_LIMIT_WAIT_MS = 60 * 1000;             // 429 응답 시 대기

  // 숫자가 작을수록 먼저 요청
  const PRIORITY = { CLICK: 1, HOVER: 2, VISIBLE: 3, BACKGROUND: 4 };

  const queue = [];
  const pending = {}; // 도시 id → 대기 중이거나 요청 중인 job
  let seq = 0;
  let running = false;
  let stopped = false;
  let nextAt = 0;
  let total = 0;
  let done = 0;
  let progressCb = () => {};
  let fatalCb = () => {};

  const config = () => (typeof CONFIG !== 'undefined' ? CONFIG : {});
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function readCache(key, maxAge) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const { data, savedAt } = JSON.parse(raw);
      return Date.now() - savedAt > maxAge ? null : data;
    } catch {
      return null;
    }
  }

  function writeCache(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify({ data, savedAt: Date.now() }));
    } catch {
      // 저장 공간 부족 등은 무시 (캐시 없이 동작)
    }
  }

  async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }

  // 배경 지도용 국경 GeoJSON
  async function loadLand() {
    const cached = readCache('static:geo', STATIC_CACHE_MS);
    if (cached) return cached;
    const data = await fetchJson(GEOJSON_URL);
    writeCache('static:geo', data);
    return data;
  }

  function fetchWeather({ city }) {
    const { OWM_API_KEY, UNITS = 'metric', LANG = 'kr' } = config();
    const params = new URLSearchParams({
      lat: city.lat, lon: city.lon, appid: OWM_API_KEY, units: UNITS, lang: LANG,
    });
    return fetchJson(`${OWM_URL}?${params}`);
  }

  const cacheKey = id => `owm:city:${id}`;

  function getCached(id) {
    return readCache(cacheKey(id), CACHE_MS);
  }

  function notify() {
    progressCb(done, total);
  }

  function finish(job) {
    delete pending[job.id];
    done++;
    notify();
  }

  // 401: API 키 오류 → 남은 요청을 모두 취소하고 큐 정지
  function stop(err) {
    stopped = true;
    queue.splice(0).forEach(job => {
      delete pending[job.id];
      job.reject(err);
    });
    total = 0;
    done = 0;
    notify();
    fatalCb(err);
  }

  async function pump() {
    if (running) return;
    running = true;
    while (queue.length && !stopped) {
      const wait = nextAt - Date.now();
      if (wait > 0) await sleep(wait);
      if (!queue.length || stopped) break;

      // 기다리는 동안 우선순위가 바뀌었을 수 있으므로 꺼내기 직전에 정렬
      queue.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
      const job = queue.shift();
      nextAt = Date.now() + REQUEST_GAP_MS;

      try {
        const data = await fetchWeather(job);
        data._savedAt = Date.now();
        writeCache(cacheKey(job.id), data);
        finish(job);
        job.resolve(data);
      } catch (err) {
        if (err.status === 429) {
          queue.unshift(job);
          nextAt = Date.now() + RATE_LIMIT_WAIT_MS;
          continue;
        }
        finish(job);
        job.reject(err);
        if (err.status === 401) stop(err);
      }
    }
    running = false;
    if (!queue.length) {
      total = 0;
      done = 0;
      notify();
    }
  }

  // 캐시 확인 → 없으면 큐에 넣고 Promise 반환. 같은 도시는 중복 요청하지 않는다.
  function getWeather(city, priority = PRIORITY.BACKGROUND, force = false) {
    const { id } = city;
    if (!force) {
      const cached = getCached(id);
      if (cached) return Promise.resolve(cached);
    }
    const existing = pending[id];
    if (existing) {
      existing.priority = Math.min(existing.priority, priority);
      return existing.promise;
    }
    if (stopped) return Promise.reject(new Error('API 요청이 중지되었습니다'));

    const job = { id, city, priority, seq: seq++ };
    job.promise = new Promise((resolve, reject) => {
      job.resolve = resolve;
      job.reject = reject;
    });
    pending[id] = job;
    queue.push(job);
    total++;
    notify();
    pump();
    return job.promise;
  }

  return {
    PRIORITY,
    CACHE_MS,
    loadLand,
    getWeather,
    getCached,
    onProgress: cb => { progressCb = cb; },
    onFatal: cb => { fatalCb = cb; },
  };
})();

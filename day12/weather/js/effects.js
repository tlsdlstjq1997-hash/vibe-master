// 바람 / 비 / 천둥번개 애니메이션 마커
const Effects = (() => {
  const WIND_ALERT_MS = 7;
  const HEAVY_RAIN_MM = 4;
  const HEAVY_RAIN_IDS = [502, 503, 504, 522];
  const ICON_SIZE = 32;
  const LABEL_GAP = 8;
  const DROPS = 7;

  let group = null;
  const markers = {}; // 도시 id → [L.Marker]

  // OWM 날씨 코드: 2xx 천둥번개, 3xx 이슬비, 5xx 비
  function classify(w) {
    const id = w.weather[0].id;
    const storm = id >= 200 && id < 300;
    const rainy = (id >= 300 && id < 400) || (id >= 500 && id < 600);
    const rain1h = (w.rain && w.rain['1h']) || 0;
    return {
      storm,
      rain: rainy && !storm, // 천둥번개가 우선
      heavy: rainy && (rain1h >= HEAVY_RAIN_MM || HEAVY_RAIN_IDS.includes(id)),
      windy: ((w.wind && w.wind.speed) || 0) >= WIND_ALERT_MS,
    };
  }

  function windDuration(speed) {
    if (speed < 10) return 1.2;
    if (speed < 15) return 0.8;
    return 0.5;
  }

  function dropsHtml(count) {
    let html = '';
    for (let i = 0; i < count; i++) {
      const left = 6 + (i * 88) / (count - 1);
      const delay = ((i * 0.37) % 0.8).toFixed(2);
      html += `<i style="left:${left.toFixed(1)}%;animation-delay:-${delay}s"></i>`;
    }
    return `<div class="fx-drops">${html}</div>`;
  }

  // 도시 기온 라벨을 가리지 않도록 라벨 위쪽에 띄운다
  function icon(html, tier, offsetX = 0) {
    return L.divIcon({
      className: `fx-icon tier-${tier}`,
      html,
      iconSize: [ICON_SIZE, ICON_SIZE],
      iconAnchor: [ICON_SIZE / 2 - offsetX, ICON_SIZE + LABEL_GAP],
    });
  }

  function windIcon(w, tier, offsetX) {
    // wind.deg 는 불어오는 방향 → 흘러가는 방위 = deg + 180
    // CSS rotate 0° 는 동쪽(→) 이므로 방위에서 90° 를 빼면 deg + 90
    const rot = ((w.wind.deg || 0) + 90) % 360;
    const dur = windDuration(w.wind.speed);
    return icon(
      `<div class="fx fx-wind" aria-hidden="true" style="--rot:${rot}deg;--dur:${dur}s">
         <div class="fx-wind-rot"><span></span><span></span><span></span><span></span></div>
       </div>`,
      tier,
      offsetX,
    );
  }

  function rainIcon(heavy, tier) {
    return icon(
      `<div class="fx fx-rain${heavy ? ' heavy' : ''}" aria-hidden="true">
         <div class="fx-cloud"></div>${dropsHtml(heavy ? DROPS * 2 : DROPS)}
       </div>`,
      tier,
    );
  }

  function stormIcon(tier) {
    return icon(
      `<div class="fx fx-storm" aria-hidden="true">
         ${dropsHtml(DROPS)}<div class="fx-cloud"></div>
         <svg class="fx-bolt" viewBox="0 0 20 28"><polygon points="12,0 2,15 9,15 6,28 18,10 11,10 14,0"/></svg>
       </div>`,
      tier,
    );
  }

  function clear(id) {
    (markers[id] || []).forEach(m => group.removeLayer(m));
    delete markers[id];
  }

  function update(city, w) {
    if (!group) return;
    clear(city.id);
    const fx = classify(w);
    const icons = [];
    if (fx.storm) icons.push(stormIcon(city.tier));
    else if (fx.rain) icons.push(rainIcon(fx.heavy, city.tier));
    if (fx.windy) icons.push(windIcon(w, city.tier, fx.storm || fx.rain ? 20 : 0));

    markers[city.id] = icons.map(i =>
      L.marker([city.lat, city.lon], { icon: i, interactive: false, keyboard: false }).addTo(group),
    );
  }

  return {
    WIND_ALERT_MS,
    init: map => { group = L.layerGroup().addTo(map); },
    classify,
    update,
  };
})();

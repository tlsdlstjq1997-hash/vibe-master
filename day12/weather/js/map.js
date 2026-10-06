// Leaflet 지도, 도시 마커, hover/click, 밤 영역
const WeatherMap = (() => {
  const TILE_PX = 256;
  const TIER2_MIN_ZOOM = 3;  // 이 줌부터 tier 2 도시 표시
  const NAMES_MIN_ZOOM = 4;  // 이 줌부터 도시 이름 표시
  const NIGHT_START = 20;
  const NIGHT_END = 7;
  const LAND_STYLE = { color: '#c3cad3', weight: 0.8, fillColor: '#eef0e8', fillOpacity: 1, interactive: false };
  const NIGHT_STYLE = { stroke: false, fillColor: '#0b1a3a', fillOpacity: 0.4, interactive: false, pane: 'night' };
  const TOOLTIP_OPTIONS = { direction: 'top', offset: [0, -12], className: 'weather-tooltip', opacity: 1 };

  let map = null;
  let nightLayer = null;
  const markers = {}; // 도시 id → L.Marker
  let hovered = null;
  let selected = null;

  // 지도 폭이 세계 폭보다 넓으면 회색 여백이 생기므로 최소 줌을 화면 폭에 맞춘다
  function fitMinZoom() {
    const z = Math.max(2, Math.ceil(Math.log2(map.getSize().x / TILE_PX) * 4) / 4);
    map.setMinZoom(z);
    if (map.getZoom() < z) map.setZoom(z);
  }

  // 줌에 따라 tier 2 도시 / 도시 이름을 CSS 클래스로 켜고 끈다
  function updateZoomClasses() {
    const el = map.getContainer();
    el.classList.toggle('hide-tier2', map.getZoom() < TIER2_MIN_ZOOM);
    el.classList.toggle('show-names', map.getZoom() >= NAMES_MIN_ZOOM);
  }

  const maxTier = () => (map.getZoom() >= TIER2_MIN_ZOOM ? 2 : 1);

  function cityIcon(city, w) {
    const cls = w ? UI.tempClass(w.main.temp) : 'tnone';
    const temp = w ? `${Math.round(w.main.temp)}°` : '…';
    return L.divIcon({
      className: `city-icon tier-${city.tier}`,
      html: `<div class="city-pill ${cls}"><span class="city-name">${city.name}</span><span class="city-temp">${temp}</span></div>`,
      iconSize: null,
      iconAnchor: [0, 0],
    });
  }

  // setIcon 으로 아이콘이 다시 만들어지므로 hover/선택 표시를 매번 다시 붙인다
  function syncState(id) {
    const marker = markers[id];
    const pill = marker.getElement() && marker.getElement().firstElementChild;
    const active = id === hovered || id === selected;
    marker.setZIndexOffset(active ? 1000 : 0);
    if (!pill) return;
    pill.classList.toggle('is-hover', id === hovered);
    pill.classList.toggle('is-selected', id === selected);
  }

  function addCity(city, handlers) {
    const marker = L.marker([city.lat, city.lon], { icon: cityIcon(city, null) })
      .bindTooltip(() => handlers.tooltip(city.id), TOOLTIP_OPTIONS)
      .on({
        mouseover: () => {
          hovered = city.id;
          syncState(city.id);
          handlers.onHover(city.id);
        },
        mouseout: () => {
          hovered = null;
          syncState(city.id);
        },
        click: () => handlers.onClick(city.id),
      })
      .addTo(map);
    markers[city.id] = marker;
  }

  function init(elId, landGeojson, cities, handlers) {
    map = L.map(elId, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 7,
      zoomSnap: 0.25,
      worldCopyJump: false,
      maxBounds: [[-85, -180], [85, 180]],
      maxBoundsViscosity: 1,
    });
    map.attributionControl.addAttribution('날씨 © OpenWeatherMap');

    // 밤 영역은 국경 위, 도시 마커 아래에 그린다
    map.createPane('night');
    map.getPane('night').style.zIndex = 450;
    map.getPane('night').style.pointerEvents = 'none';

    L.geoJSON(landGeojson, LAND_STYLE).addTo(map);
    nightLayer = L.layerGroup().addTo(map);
    refreshNight();
    cities.forEach(city => addCity(city, handlers));

    fitMinZoom();
    updateZoomClasses();
    map.on('resize', fitMinZoom);
    map.on('zoomend', updateZoomClasses);
    map.on('moveend', () => handlers.onViewChange(map.getBounds(), maxTier()));
  }

  function updateCity(city, w) {
    markers[city.id].setIcon(cityIcon(city, w));
    syncState(city.id);
  }

  function select(id) {
    const prev = selected;
    selected = id;
    if (prev) syncState(prev);
    syncState(id);
  }

  // 경도 기준 현지 시각(UTC + 경도/15)이 20:00 ~ 07:00 인 구간을 어둡게 덮는다
  function refreshNight() {
    nightLayer.clearLayers();
    const now = new Date();
    const utcHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    const width = (24 - NIGHT_START + NIGHT_END) * 15;
    const start = ((((NIGHT_START - utcHour) * 15 + 180) % 360) + 360) % 360 - 180;
    const end = start + width;
    const bands = end <= 180 ? [[start, end]] : [[start, 180], [-180, end - 360]];
    bands.forEach(([west, east]) => {
      L.rectangle([[-85, west], [85, east]], NIGHT_STYLE).addTo(nightLayer);
    });
  }

  function refreshTooltip(id) {
    const marker = markers[id];
    if (marker && marker.isTooltipOpen()) marker.getTooltip().update();
  }

  return {
    init,
    getMap: () => map,
    maxTier,
    updateCity,
    select,
    refreshNight,
    refreshTooltip,
  };
})();

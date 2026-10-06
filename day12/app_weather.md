# PRD: 세계 날씨 지도 (app_weather)

## 1. 개요

| 항목 | 내용 |
|---|---|
| 제품명 | 세계 날씨 지도 |
| 목적 | 세계지도 위에서 **도시별** 현재 날씨를 미리 보고(hover), 클릭하면 지도 아래에 상세 날씨를 보여주는 웹 앱 |
| 대상 | 세계 여러 도시의 날씨를 한눈에 비교하고 싶은 사용자 |
| 기술 | HTML5, CSS3, Vanilla JavaScript (ES6+), Bootstrap 5.3 (CDN), Leaflet 1.9 (CDN, 지도 렌더링) |
| 날씨 데이터 | OpenWeatherMap (https://openweathermap.org/) — Current Weather Data API (무료 플랜) |
| 실행 환경 | 최신 Chrome / Edge / Safari / Firefox, PC 우선 (모바일은 터치=클릭으로 동작) |
| 서버 | 없음. 정적 파일만으로 동작. `index.html` 더블클릭(file://)으로도 실행 가능해야 함 → **ES Module(`type="module"`) 사용 금지**, 일반 `<script>` 를 순서대로 로드 |

### 범위 밖 (이번 버전에서 하지 않음)
- 사용자가 도시를 검색/추가하는 기능 (표시 도시는 `cities.js` 에 고정된 약 120곳)
- 로그인, 즐겨찾기 저장, 서버/백엔드, API 키 숨기기(프록시)
- 유료 API(One Call 3.0 등) 사용

---

## 2. 파일 구조

HTML, CSS, JS는 반드시 분리한다. 인라인 `style=""` / `<script>` 코드 금지.

```
day12/
├── app_weather.md          # 이 문서
└── weather/
    ├── index.html          # 마크업만
    ├── css/
    │   └── style.css       # Bootstrap 위에 덮어쓰는 커스텀 스타일 + 날씨 애니메이션
    └── js/
        ├── config.example.js  # API 키 예시 (커밋 O)
        ├── config.js          # 실제 API 키 (커밋 X, .gitignore 에 추가)
        ├── cities.js          # 표시할 도시 목록 (한글명, 국가, 좌표, tier)
        ├── api.js             # OpenWeatherMap / 배경 지도 호출, 캐시, 요청 큐
        ├── map.js             # Leaflet 지도, 도시 마커, hover/click, 밤 영역
        ├── effects.js         # 바람/비/천둥번개 애니메이션 마커
        ├── ui.js              # 툴팁 HTML, 하단 상세 패널 렌더링
        └── main.js            # 초기화, 전체 흐름 연결
```

### 스크립트 로드 순서 (body 끝)
```html
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="js/config.js"></script>
<script src="js/cities.js"></script>
<script src="js/api.js"></script>
<script src="js/effects.js"></script>
<script src="js/ui.js"></script>
<script src="js/map.js"></script>
<script src="js/main.js"></script>
```
- 각 JS 파일은 전역 객체 하나만 노출한다: `CITIES`, `WeatherAPI`, `Effects`, `UI`, `WeatherMap`. 나머지는 IIFE 안에 감춘다.

### head
```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<link href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css" rel="stylesheet">
<link href="css/style.css" rel="stylesheet">
```

### API 키 설정
```js
// js/config.example.js  → 복사해서 js/config.js 로 만들고 키 입력
const CONFIG = {
  OWM_API_KEY: 'YOUR_OPENWEATHERMAP_API_KEY',
  UNITS: 'metric',   // 섭씨, 풍속 m/s
  LANG: 'kr',        // 날씨 설명 한국어
};
```
- `config.js` 가 없거나 키가 `YOUR_...` 그대로면 화면 상단에 Bootstrap `alert-warning` 으로 "config.js 에 API 키를 입력하세요" 안내를 띄우고 지도만 표시한다.
- `.gitignore` 에 `day12/weather/js/config.js` 추가.
- 참고: 클라이언트 JS 에 키가 노출되는 구조이므로 무료 키만 사용한다 (학습용).

---

## 3. 외부 데이터

### 3-1. 배경 지도 (국경 GeoJSON)
- URL: `https://raw.githubusercontent.com/johan/world.geo.json/master/countries.geo.json`
- 육지 모양을 그리는 배경으로만 사용 (클릭/hover 없음). `localStorage` 에 7일간 캐시.

### 3-2. 도시 목록 (`js/cities.js`)
- 날씨 API 에는 "세계 주요 도시 목록" 을 주는 무료 엔드포인트가 없으므로 도시 목록은 직접 관리한다.
- 형식: `[id, 한글명, 영문명, 국가코드(ISO alpha-2), 위도, 경도, tier]` 배열 → `CITIES` 객체 배열로 변환.
- 약 120곳. 대륙별로 고르게 배치하고 한국·일본·중국 도시는 조금 더 촘촘하게.
- **tier**: `1` = 주요 도시(약 60곳, 항상 표시), `2` = 보조 도시(확대했을 때 표시).
- 국가 한글명은 국가코드 → 한글명 표(`COUNTRY_KO`)로 변환.
- 국기: `https://flagcdn.com/w80/{국가코드 소문자}.png`.

### 3-3. 날씨 (OpenWeatherMap Current Weather)
```
GET https://api.openweathermap.org/data/2.5/weather
    ?lat={도시 위도}&lon={도시 경도}&appid={KEY}&units=metric&lang=kr
```
사용하는 응답 필드:

| 필드 | 용도 |
|---|---|
| `weather[0].id` | 날씨 코드 → 효과 판정 (아래 표) |
| `weather[0].description` | 한글 설명 |
| `weather[0].icon` | 아이콘 `https://openweathermap.org/img/wn/{icon}@2x.png` |
| `main.temp`, `feels_like`, `temp_min`, `temp_max` | 기온 (°C) |
| `main.humidity`, `main.pressure` | 습도(%), 기압(hPa) |
| `wind.speed`, `wind.deg`, `wind.gust` | 풍속(m/s), 풍향(°), 돌풍 |
| `clouds.all` | 구름량(%) |
| `visibility` | 가시거리(m) |
| `rain['1h']`, `snow['1h']` | 1시간 강수/강설량(mm), 없을 수 있음 |
| `sys.sunrise`, `sys.sunset` | 일출/일몰 (UTC unix) |
| `timezone` | UTC 대비 초 단위 오프셋 → **현지 시각 계산** |
| `dt` | 관측 시각 |

### 3-4. 요청 제한 대응 (중요)
- 무료 플랜은 **분당 60회** 제한. 도시는 약 120곳이므로 한 번에 다 부르면 안 된다 (전체 로드 약 2분 10초).
- `WeatherAPI` 안에 **요청 큐**를 만든다:
  - 동시에 1개, 요청 간격 **1100ms** (분당 약 54회).
  - 우선순위: ① 사용자가 클릭한 도시 ② hover 한 도시 ③ 현재 화면에 보이는(현재 줌에서 표시되는 tier) 도시 ④ 나머지 (tier 1 먼저). 우선순위 높은 요청은 큐 맨 앞으로 끼워 넣는다.
  - 같은 도시 중복 요청 금지 (진행 중이면 같은 Promise 반환).
- 응답은 `localStorage` 에 **10분** 캐시 (`owm:city:seoul` → `{ data, savedAt }`). 새로고침해도 10분 안이면 재요청하지 않음.
- 429 응답 시 60초 대기 후 큐 재개. 401 이면 큐를 멈추고 API 키 오류 alert 표시.
- 화면 우측 상단에 진행률 표시: `날씨 불러오는 중 32 / 120` (Bootstrap `progress` 바). 모두 끝나면 숨김.

---

## 4. 화면 구성

```
┌───────────────────────────────────────────────────────────┐
│ ① 네비바: 🌍 세계 날씨 지도      [진행률]  [범례 버튼]       │
├───────────────────────────────────────────────────────────┤
│                                                           │
│ ② 세계지도 (Leaflet, 높이 65vh)                            │
│    - 육지(밝은 회색) + 바다                                  │
│    - 도시마다 기온 라벨 [서울 18°] (기온에 따라 색)            │
│    - 밤 영역은 어둡게 덮음                                   │
│    - 도시 라벨 위에 바람/비/번개 애니메이션                    │
│    - 라벨 hover → 미리보기 툴팁                              │
│                                                           │
├───────────────────────────────────────────────────────────┤
│ ③ 상세 날씨 패널 (클릭 전: "지도에서 도시를 클릭하세요")       │
└───────────────────────────────────────────────────────────┘
```
- 레이아웃: `container-fluid`, 지도는 전체 폭. 상세 패널은 `container` 안에 Bootstrap 카드/그리드.

### ① 네비바
- `navbar navbar-dark bg-dark`. 좌측 제목, 우측에 진행률 바 + 범례 버튼.
- 범례 버튼 클릭 → Bootstrap `offcanvas` 또는 `popover` 로 범례 표시 (기온 색, 밤, 강풍, 비, 천둥번개 아이콘 설명).

### ② 지도
- Leaflet 지도. 배경 타일 없이 **국경 GeoJSON** 만 육지로 그린다 (육지 `#eef0e8`, 경계선 `#c3cad3`, 바다 `#a9d3f0`). 클릭/hover 없음.
- 초기 뷰: `center [20, 10]`, `zoom 2`, `maxZoom 7`, `maxBounds [[-85,-180],[85,180]]`. 최소 줌은 화면 폭에 세계가 꽉 차도록 계산.
- **도시 기온 라벨**: `L.marker` + `L.divIcon` 알약 모양 `[서울 18°]`. 데이터 전에는 회색 `…`.
  - 줌 < 3: tier 1 만 표시 / 줌 ≥ 3: tier 2 도 표시 / 줌 ≥ 4: 도시 이름도 표시 (지도 컨테이너 CSS 클래스 `hide-tier2`, `show-names` 로 제어).
- **기온별 라벨 색**:

| 기온 | 색 | 글자 |
|---|---|---|
| < -10°C | `#3b4cc0` | 흰색 |
| -10 ~ 0 | `#6f9ce8` | 흰색 |
| 0 ~ 10 | `#a8d5e2` | 검정 |
| 10 ~ 20 | `#9fd38a` | 검정 |
| 20 ~ 30 | `#f6c453` | 검정 |
| ≥ 30 | `#e8604c` | 흰색 |

### ③ 상세 패널
→ F3 참고.

---

## 5. 기능 요구사항

### F1. 지도 초기화
1. 국경 GeoJSON 을 불러와 육지를 그리고, `CITIES` 의 모든 도시에 회색 라벨을 먼저 표시 (지도는 1초 안에 보여야 함).
2. 모든 도시를 큐에 넣어 날씨를 순차 로드 (tier 1 먼저, 화면에 보이는 도시 우선). 한 도시 로드될 때마다 그 도시 라벨 + 효과 마커만 갱신.

### F2. 마우스 hover → 미리보기
- 도시 라벨 `mouseover` 시:
  - 라벨 강조: 테두리 `#212529`, 1.15배 확대, 맨 위로.
  - Leaflet `tooltip` (클래스 `weather-tooltip`) 으로 미리보기 표시:
    ```
    [국기] 서울 (대한민국)
    [아이콘] 18.3°C  맑음
    💨 3.2 m/s   🕐 현지 14:05 (낮/밤)
    ```
  - 데이터가 아직 없으면 툴팁에 Bootstrap `spinner-border spinner-border-sm` + "불러오는 중…" 표시하고, 우선순위 ②로 즉시 요청. 응답 오면 툴팁 내용 갱신.
- `mouseout` 시 강조 해제 (선택된 도시는 선택 스타일 유지).

### F3. 클릭 → 하단 상세 정보
- 도시 라벨 클릭 시:
  - 선택 스타일: 테두리 `#0d6efd` + 파란 링. 이전 선택은 해제.
  - 지도 아래 상세 패널을 렌더링하고 `scrollIntoView({ behavior: 'smooth' })`.
  - 데이터 없으면 패널에 스피너 → 우선순위 ①로 요청.
- 상세 패널 내용 (Bootstrap `card`, 내부는 `row g-3` 그리드):

| 영역 | 내용 |
|---|---|
| 헤더 | 국기, 도시명(한글/영문), 국가명, 좌표, 현지 날짜·시각, 낮/밤 배지 |
| 메인 | 큰 날씨 아이콘, 현재 기온(큰 글씨), 날씨 설명, 체감온도, 최저/최고 |
| 정보 카드들 (`col-6 col-md-3`) | 습도, 기압, 풍속 + 풍향(화살표 아이콘을 `wind.deg` 만큼 회전, 16방위 한글 "북서풍"), 돌풍, 구름량, 가시거리(km), 1시간 강수량/강설량, 일출/일몰(현지 시각) |
| 경고 배지 | 풍속 ≥ 7m/s → `badge bg-danger` "강풍", 비 → `bg-primary` "비", 천둥번개 → `bg-dark` "뇌우" |
| 푸터 | "관측 시각: HH:mm (현지) · 데이터: OpenWeatherMap" + 새로고침 버튼(캐시 무시하고 재요청) |

- 모든 시각은 `timezone` 오프셋으로 **그 도시 현지 시각**으로 표시 (`new Date((unix + timezone) * 1000)` 후 `getUTCHours()` 등 UTC 메서드 사용).

### F4. 강풍 표시 (풍속 ≥ 7 m/s)
- 해당 도시 라벨 위에 **빨간 바람 애니메이션** 마커.
- 구현: `L.marker` + `L.divIcon` (클래스 `fx-wind`). 안에 빨간색(`#dc3545`) 곡선/선 3~4개(`<span>`)가 바람 방향으로 흘러가며 사라지는 CSS 애니메이션.
- 바람 방향: OWM `wind.deg` 는 바람이 **불어오는** 방향이므로 흘러가는 방향 = `deg + 180`. 컨테이너에 `transform: rotate(...)` 적용.
- 풍속이 셀수록 애니메이션 속도 빠르게 (예: 7~10m/s → 1.2s, 10~15 → 0.8s, 15+ → 0.5s).

### F5. 비 표시
- 조건: `weather[0].id` 가 `3xx`(이슬비) 또는 `5xx`(비). 단, 천둥번개(F6)이면 F6 우선.
- 도시 라벨 위에 `fx-rain` divIcon: 작은 회색 구름 + 아래로 떨어지는 파란 빗줄기 6~8개 (각각 `animation-delay` 다르게, 무한 반복).
- 강수량 `rain['1h'] ≥ 4mm` 또는 `id 502~504, 522` 이면 빗줄기 개수 2배 (폭우).

### F6. 천둥번개 표시
- 조건: `weather[0].id` 가 `2xx`.
- 도시 라벨 위에 `fx-storm` divIcon: **어두운 먹구름** (`#3a3f47` ~ `#22262b` 그라데이션) + 노란 **번개 모양**(SVG polygon 또는 `bi-lightning-fill`, `#ffd43b`)이 불규칙하게 번쩍이는 애니메이션 (opacity 0 → 1 → 0, 3초 주기 중 짧게 2번).
- 빗줄기도 함께 표시.

### F7. 효과 공통 규칙
- 한 도시에 강풍 + 비/번개가 동시에 해당하면 둘 다 표시 (바람 마커는 약간 오른쪽으로 offset).
- 효과 마커는 `interactive: false` (hover/click 방해 금지).
- 마커 크기 32px, 도시 라벨을 가리지 않도록 라벨 위쪽(8px 간격)에 띄운다. 줌에 따라 키우지 않음.
- 효과 마커도 도시의 tier 를 따라 숨김/표시.
- 성능: 효과 마커는 별도 `L.layerGroup` 에 담고, 날씨 갱신 시 해당 도시 마커만 교체.
- `prefers-reduced-motion: reduce` 이면 애니메이션 정지(정적 아이콘만).

### F8. 밤 표시 (현지 20:00 ~ 07:00)
- **지도**: 경도 기준 현지 시각 `UTC + 경도/15` 가 20:00 ~ 07:00 인 구간(경도 폭 165°)을 남색(`#0b1a3a`, 불투명도 0.4) 사각형으로 덮는다.
  - 날짜변경선(±180°)을 넘으면 사각형 2개로 나눈다.
  - 전용 pane(`night`, z-index 450)에 그려 육지 위·도시 라벨 아래에 오도록 하고 마우스 이벤트는 통과시킨다.
- **도시**: 날씨 응답의 `timezone` 으로 계산한 실제 현지 시각이 `hour >= 20 || hour < 7` 이면 툴팁/상세 패널에 `bi-moon-stars-fill` + "밤" 배지, 아니면 `bi-sun-fill` + "낮".
  - 참고: 지도 밤 영역은 경도 기준이라 실제 시간대(예: 중국은 전역 UTC+8)와 1~2시간 차이가 날 수 있다. 도시 배지가 정확한 값.
- **1분마다** 밤 영역을 다시 그리고 배지를 갱신 (API 재호출 없이 계산만).

### F9. 자동 갱신
- 캐시가 10분 지난 도시는 백그라운드 큐에 다시 넣어 갱신 (우선순위 ④).

### F10. 오류 처리
- 지도 데이터 로드 실패 → 지도 영역에 `alert-danger` + 다시 시도 버튼.
- 개별 도시 날씨 실패 → 그 도시 라벨은 회색 유지, 툴팁에 "날씨 정보를 불러오지 못했습니다".
- 네트워크 오프라인 → 상단 `alert-secondary` "오프라인 상태입니다".

---

## 6. 디자인 가이드

- Bootstrap 5.3 컴포넌트 우선 사용: `navbar`, `card`, `badge`, `progress`, `spinner`, `alert`, `offcanvas`, 그리드.
- 색상은 `style.css` 의 `:root` CSS 변수로 정의 (`--sea`, `--night`, `--wind-red`, `--rain-blue`, `--storm-cloud`, `--bolt` 및 기온 색 6개).
- 폰트: Pretendard, 없으면 시스템 sans-serif.
- 툴팁: 흰 배경, `border-radius: .75rem`, `box-shadow`, 폭 220px, 기온 숫자는 굵게 1.25rem.
- 상세 패널 기온 숫자: 3rem, `fw-bold`.
- 아이콘: Bootstrap Icons (`bi-thermometer-half`, `bi-droplet`, `bi-speedometer2`, `bi-wind`, `bi-cloud`, `bi-eye`, `bi-cloud-rain`, `bi-sunrise`, `bi-sunset`, `bi-moon-stars-fill`, `bi-sun-fill`, `bi-arrow-up`(풍향, 회전)).
- 애니메이션 keyframes 는 모두 `style.css` 에 작성 (`@keyframes wind-flow`, `rain-fall`, `bolt-flash`).

---

## 7. 구현 가이드

### 상태 (main.js)
```js
const state = {
  cities: {},   // 도시 id → { id, name, nameEn, cc, country, lat, lon, tier }
  weather: {},  // 도시 id → OWM 응답
  errors: {},   // 도시 id → true (요청 실패)
  selected: null,
};
```

### 주요 함수
| 파일 | 함수 | 역할 |
|---|---|---|
| api.js | `WeatherAPI.loadLand()` | 국경 GeoJSON 로드/캐시 |
| api.js | `WeatherAPI.getWeather(city, priority, force)` | 캐시 확인 → 큐에 넣고 Promise 반환 |
| api.js | `WeatherAPI.onProgress(cb)` / `onFatal(cb)` | 진행률 / 401 콜백 등록 |
| map.js | `WeatherMap.init(el, land, cities, handlers)` | 지도, 육지, 도시 라벨 생성, hover/click 바인딩 |
| map.js | `WeatherMap.updateCity(city, weather)` | 라벨 기온·색 갱신 |
| map.js | `WeatherMap.refreshNight()` | 밤 영역 다시 그리기 |
| effects.js | `Effects.update(city, weather)` | 강풍/비/뇌우 마커 생성·교체·제거 |
| ui.js | `UI.tooltipHtml(city, weather, status)` | 미리보기 HTML |
| ui.js | `UI.renderDetail(city, weather)` | 하단 상세 패널 렌더링 |
| ui.js | `UI.setProgress(done, total)` / `UI.showAlert(type, msg, id)` | 상태 표시 |
| ui.js | `tempClass(t)`, `localDate(w)`, `isNight(w)`, `windDirKo(deg)` | 유틸 |

### 규칙
- `innerHTML` 에 외부 데이터(날씨 설명 등)를 넣을 땐 escape 함수 거친다.
- 매직 넘버는 상수로: `WIND_ALERT_MS = 7`, `NIGHT_START = 20`, `NIGHT_END = 7`, `CACHE_MS = 600000`, `REQUEST_GAP_MS = 1100`.
- `console.error` 외의 디버그 로그는 남기지 않는다.

### 주요 요소 ID
| ID | 요소 |
|---|---|
| `#map` | Leaflet 지도 컨테이너 |
| `#progress-wrap`, `#progress-bar`, `#progress-text` | 로딩 진행률 |
| `#alert-area` | 경고/오류 메시지 |
| `#detail-panel` | 하단 상세 정보 |
| `#legend` | 범례 offcanvas |

---

## 8. 접근성
- 상세 패널에 `aria-live="polite"`.
- 효과 마커는 장식용이므로 `aria-hidden="true"`; 대신 상세 패널 배지로 텍스트 제공.
- 색만으로 정보 전달하지 않음 (기온 숫자, "밤"/"강풍" 텍스트 배지 병행).

---

## 9. 완료 기준 (Acceptance Criteria)
- [ ] `index.html` 을 더블클릭해서 열어도 지도가 표시된다 (서버 불필요).
- [ ] HTML / CSS / JS 가 분리되어 있고 인라인 스타일·스크립트가 없다.
- [ ] 도시 라벨에 마우스를 올리면 국기·이름·기온·날씨·풍속·현지시각이 담긴 미리보기가 뜬다.
- [ ] 도시를 클릭하면 지도 아래에 상세 날씨 카드가 나타나고 그 위치로 스크롤된다.
- [ ] 풍속 7m/s 이상인 도시 라벨 위에 빨간 바람 애니메이션이 바람 방향으로 흐른다.
- [ ] 비가 오는 도시에 빗줄기 애니메이션이 보인다.
- [ ] 천둥번개인 도시에 먹구름 + 번쩍이는 번개가 보인다.
- [ ] 현지 20:00~07:00 인 지역이 지도에서 어둡게 보이고, 1분마다 이동한다.
- [ ] 축소하면 주요 도시만, 확대하면 보조 도시와 도시 이름까지 보인다.
- [ ] OWM 요청이 분당 60회를 넘지 않는다 (네트워크 탭에서 확인).
- [ ] 새로고침 후 10분 이내에는 캐시를 사용해 즉시 기온 라벨이 표시된다.
- [ ] API 키 미설정/오류 시 안내 메시지가 뜨고 앱이 멈추지 않는다.
- [ ] `config.js` 가 git 에 올라가지 않는다.

### 테스트 팁
- 효과 확인용: URL 에 `?demo=1` 이 있으면 `seoul` = 강풍, `tokyo` = 비, `delhi` = 천둥번개, `london` = 폭우 + 강풍으로 가짜 데이터를 덮어써 바로 확인할 수 있게 한다.

---

## 10. 구현 순서 (Claude Code 작업 단계)
1. 폴더/파일 뼈대, `index.html` 레이아웃, CDN 연결, `config.example.js`, `.gitignore`.
2. `cities.js` 도시 목록, `api.js`: 국경 로드 → `map.js`: 육지 + 회색 도시 라벨 표시.
3. `api.js`: 요청 큐 + 캐시 + 진행률 → 라벨에 기온·색 반영, 줌별 tier 표시.
4. hover 툴팁 (F2).
5. 클릭 상세 패널 (F3).
6. 밤 표시 (F8).
7. 효과: 강풍(F4) → 비(F5) → 천둥번개(F6), `?demo=1` 모드.
8. 오류 처리, 접근성, 완료 기준 체크.

---

## 11. 향후 확장 (선택)
- 5일 예보 (`/data/2.5/forecast`, 무료) 를 상세 패널에 탭으로 추가.
- OWM 타일 레이어(`precipitation_new`, `wind_new`) 토글.
- 실제 태양 위치 기반 밤 경계선(터미네이터) 표시.
- 도시 검색으로 원하는 도시 추가 (OWM Geocoding API).
- 다크 모드 (`data-bs-theme="dark"`).

# PRD: 로또 번호 생성기 (app_lotto)

## 1. 개요

| 항목 | 내용 |
|---|---|
| 제품명 | 로또 번호 생성기 |
| 목적 | 고정 번호와 제외 번호를 반영해 로또 번호 5세트를 랜덤 생성하고 복사할 수 있는 웹 앱 |
| 대상 | 로또 번호를 직접 고르기 귀찮거나, 일부 번호만 정해두고 나머지는 랜덤으로 뽑고 싶은 사용자 |
| 기술 | HTML5, CSS3, Vanilla JavaScript (ES6+), Bootstrap 5.3 (CDN) |
| 실행 환경 | 최신 Chrome / Edge / Safari / Firefox, PC와 모바일 모두 지원 |
| 서버 | 없음. 정적 파일만으로 동작 (`index.html` 더블클릭으로도 실행 가능해야 함) |

### 범위 밖 (이번 버전에서 하지 않음)
- 지난주 당첨번호 조회 (동행복권 API 중지, 네이버는 CORS 차단으로 브라우저에서 직접 가져올 수 없음)
- 생성 기록 저장, 로그인, 통계 분석

---

## 2. 파일 구조

HTML, CSS, JS는 반드시 분리한다.

```
day12/
├── app_lotto.md        # 이 문서
├── index.html          # 마크업만 (인라인 style / script 금지)
├── css/
│   └── style.css       # Bootstrap 위에 덮어쓰는 커스텀 스타일
└── js/
    └── app.js          # 상태 관리, 이벤트, 번호 생성, 복사 로직
```

### 외부 리소스 (CDN)
```html
<!-- head -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
<link href="css/style.css" rel="stylesheet">

<!-- body 끝 -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="js/app.js"></script>
```
- 폰트: `Pretendard` (CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css`), 없으면 시스템 sans-serif.

---

## 3. 화면 구성

위에서 아래로 한 컬럼에 쌓는다. 최대 폭 `720px`, 가운데 정렬 (`container` + `max-width`).

```
┌──────────────────────────────────────────────┐
│ ① 헤더                                        │
│    ● ● ● ● ●  (로또 색 장식 공 5개)            │
│    로또 번호 생성기                             │
│    넣을 번호와 뺄 번호를 고르고 5세트를 뽑아보세요 │
├──────────────────────┬───────────────────────┤
│ ② 고정 번호 패널      │ ③ 제외 번호 패널        │
│ [핀] 고정 번호  0 / 5 │ [금지] 제외 번호 0 / 39 │
│ 1~45 번호판 (7열)     │ 1~45 번호판 (7열)       │
│ 선택 번호 미리보기 [초기화] │ 선택 번호 미리보기 [초기화] │
├──────────────────────┴───────────────────────┤
│ ④ [ ✨ 5세트 생성하기 ]        [ ↻ 전체 초기화 ] │
│    (안내/오류 메시지 영역)                      │
├──────────────────────────────────────────────┤
│ ⑤ 생성 결과   ◯ 고정 번호   [전체 복사][결과 지우기] │
│  A  ● ● ● ● ● ●                    [복사]     │
│  B  ● ● ● ● ● ●                    [복사]     │
│  C  ● ● ● ● ● ●                    [복사]     │
│  D  ● ● ● ● ● ●                    [복사]     │
│  E  ● ● ● ● ● ●                    [복사]     │
│  (결과 없을 때: 티켓 아이콘 + "생성 버튼을 누르면 여기에 5세트가 나와요") │
└──────────────────────────────────────────────┘
```

### 반응형
- `768px` 이상: ②③ 패널 좌우 2분할 (`row` > `col-md-6`).
- `768px` 미만: ②③ 위아래로 쌓임. 번호판 7열은 유지하고 칸 크기만 줄어든다.
- 가로 스크롤이 생기면 안 된다.

---

## 4. 기능 요구사항

### F1. 고정 번호 선택 (패널 ②)
- 1~45 번호 버튼을 7열 그리드로 표시한다.
- 클릭하면 선택/해제가 토글된다. 선택 시 파란 원으로 채운다.
- 최대 **5개**까지 선택 가능. 6번째 선택 시 막고 메시지: `고정 번호는 최대 5개까지 고를 수 있어요`
- 헤더 배지에 `선택 개수 / 5` 표시.
- 패널 하단에 선택한 번호를 작은 로또 색 공(24px)으로 오름차순 표시. 없으면 `모든 세트에 들어갈 번호` 안내 문구.
- **초기화** 버튼: 고정 번호만 비운다.

### F2. 제외 번호 선택 (패널 ③)
- 고정 패널과 같은 구조. 선택 시 빨간 원으로 채운다.
- 최대 **39개** 선택 가능 (45 − 6). 초과 시 메시지: `제외 번호는 최대 39개까지예요`
- 헤더 배지에 `선택 개수 / 39` 표시.
- 빈 상태 안내 문구: `절대 나오지 않을 번호`
- **초기화** 버튼: 제외 번호만 비운다.

### F3. 고정/제외 상호 배타
- 한 번호는 고정과 제외 중 하나에만 속할 수 있다.
- 한쪽에서 선택된 번호는 반대쪽 번호판에서 흐리게(opacity 0.35) + `cursor: not-allowed` 로 표시한다.
- 잠긴 번호를 누르면 선택하지 않고 메시지: `{n}번은 고정 번호로 선택돼 있어요` / `{n}번은 제외 번호로 선택돼 있어요`

### F4. 5세트 생성 (버튼 ④)
- 버튼 클릭 시 5세트(A~E)를 새로 생성해 결과 영역을 **덮어쓴다**.
- 생성 규칙:
  1. 후보 풀 = 1~45 중 고정 번호와 제외 번호를 뺀 나머지.
  2. 필요 개수 = 6 − 고정 번호 개수.
  3. 후보 풀이 필요 개수보다 적으면 생성하지 않고 메시지: `남은 번호가 부족해요. 제외 번호를 줄여주세요`
  4. 각 세트 = 고정 번호 전부 + 후보 풀에서 **중복 없이** 필요 개수만큼 랜덤 추출.
  5. 세트 안의 번호는 오름차순 정렬.
  6. 세트끼리는 독립적으로 뽑는다 (세트 간 중복 허용).
- 랜덤은 `crypto.getRandomValues` 사용을 권장하고, 없으면 `Math.random` 으로 대체한다.
- 결과에서 고정 번호에 해당하는 공은 파란 테두리(outline 2px, offset 2px)로 강조한다.

### F5. 세트별 복사
- 결과 각 줄 오른쪽 끝에 `[복사 아이콘] 복사` 버튼을 둔다.
- 클릭 시 해당 세트를 `3, 12, 22, 27, 35, 43` 형식(쉼표+공백)으로 클립보드에 복사한다.
- 성공 피드백: 버튼이 1.5초 동안 초록 배경 + 체크 아이콘 + `복사됨` 으로 바뀌었다가 원래대로 돌아온다. 연속 클릭 시 타이머를 재시작한다.

### F6. 전체 복사
- 결과 패널 헤더의 `전체 복사` 버튼.
- 5세트를 아래 형식으로 복사한다.
  ```
  A: 3, 12, 22, 27, 35, 43
  B: ...
  ```
- 피드백은 F5와 동일 (`복사됨` 1.5초).
- 결과가 없으면 복사하지 않고 메시지: `복사할 결과가 없어요`

### F7. 결과 지우기
- 결과 패널 헤더의 `결과 지우기` 버튼.
- 생성 결과만 비우고 빈 상태 안내로 돌아간다. 고정/제외 선택은 유지한다.

### F8. 전체 초기화
- 생성 버튼 오른쪽의 `전체 초기화` 버튼.
- 고정 번호, 제외 번호, 생성 결과, 메시지를 모두 비운다.

### 초기화 범위 정리

| 버튼 | 고정 번호 | 제외 번호 | 생성 결과 |
|---|---|---|---|
| 고정 패널 `초기화` | 지움 | 유지 | 유지 |
| 제외 패널 `초기화` | 유지 | 지움 | 유지 |
| `결과 지우기` | 유지 | 유지 | 지움 |
| `전체 초기화` | 지움 | 지움 | 지움 |

### F9. 메시지 영역
- 생성 버튼 바로 아래 한 줄. 오류는 빨간 글자(`text-danger`).
- 사용자가 다음 동작(번호 클릭, 생성, 초기화)을 하면 메시지를 지운다.
- `alert()` 는 사용하지 않는다.

---

## 5. 복사 구현 상세

```js
async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) { /* 아래로 */ }
  }
  // file:// 등 보안 컨텍스트가 아닐 때 대체
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (e) {}
  ta.remove();
  return ok;
}
```
- 복사가 실패하면 버튼 피드백 대신 메시지: `복사하지 못했어요. 번호를 직접 선택해 복사해주세요`

---

## 6. 디자인 가이드

### 톤
- 밝고 깔끔한 카드형 UI. 그라디언트와 강한 그림자는 쓰지 않고, 얇은 테두리와 넉넉한 여백으로 구분한다.
- 문구는 짧고 친근한 존댓말("~해요").

### 색상 (CSS 변수로 `:root` 에 정의)

| 변수 | 값 | 용도 |
|---|---|---|
| `--bg-page` | `#F5F5F7` | 페이지 배경 |
| `--bg-card` | `#FFFFFF` | 패널 배경 |
| `--border` | `rgba(0,0,0,0.08)` | 패널/번호 테두리 |
| `--text-main` | `#1D1D1F` | 본문 |
| `--text-sub` | `#6E6E73` | 보조 문구 |
| `--fixed` | `#2F6FEB` | 고정 번호 선택, 생성 버튼 |
| `--fixed-soft` | `#E7F0FD` | 고정 배지 배경 |
| `--exclude` | `#E5484D` | 제외 번호 선택 |
| `--exclude-soft` | `#FDECEC` | 제외 배지 배경 |
| `--success` | `#2E9E5B` / 배경 `#E7F6EC` | 복사됨 피드백 |

### 로또 공 색 (실제 로또 기준)

| 범위 | 배경 | 글자 |
|---|---|---|
| 1–10 | `#FBC400` | `#412402` |
| 11–20 | `#69C8F2` | `#FFFFFF` |
| 21–30 | `#FF7272` | `#FFFFFF` |
| 31–40 | `#AAAAAA` | `#FFFFFF` |
| 41–45 | `#B0D840` | `#FFFFFF` |

클래스: `.ball` + `.ball-y` / `.ball-b` / `.ball-r` / `.ball-g` / `.ball-gr`

### 크기와 모양
- 패널: `border-radius: 16px`, `padding: 14px`, 테두리 1px `--border`.
- 번호판 버튼: 정원(`aspect-ratio: 1; border-radius: 50%`), 글자 13px, 간격 6px.
  - hover 시 테두리 진하게, 누를 때 `transform: scale(0.92)`.
- 결과 공: 지름 38px (모바일 32px), 글자 15px, 굵기 600.
- 생성 버튼: 높이 52px, `border-radius: 14px`, 파란 배경에 흰 글자, 16px.
- 배지: 알약 모양(`border-radius: 999px`), 12px.
- 결과 줄 사이 구분선 1px.

### 아이콘 (Bootstrap Icons)

| 위치 | 아이콘 |
|---|---|
| 고정 번호 | `bi-pin-angle` |
| 제외 번호 | `bi-slash-circle` |
| 생성 버튼 | `bi-stars` |
| 전체 초기화 | `bi-arrow-clockwise` |
| 복사 / 복사됨 | `bi-copy` / `bi-check-lg` |
| 결과 지우기 | `bi-eraser` |
| 빈 상태 | `bi-ticket-perforated` |

---

## 7. 구현 가이드 (app.js)

### 상태
```js
const state = {
  fixed: new Set(),    // 고정 번호
  excluded: new Set(), // 제외 번호
  results: []          // [[1,2,3,4,5,6], ...] 최대 5개
};
const MAX_FIXED = 5;
const MAX_EXCLUDED = 39;
const SET_COUNT = 5;
const SET_LABELS = ['A', 'B', 'C', 'D', 'E'];
```

### 주요 함수

| 함수 | 역할 |
|---|---|
| `init()` | 번호판 생성, 이벤트 바인딩, 첫 렌더 |
| `getBallClass(n)` | 번호 → 공 색 클래스 |
| `toggleNumber(type, n)` | 고정/제외 토글 + 검증 (F1–F3) |
| `generateSets()` | 5세트 생성 (F4) |
| `pickRandom(pool, count)` | 풀에서 중복 없이 count개 추출 (Fisher–Yates) |
| `renderBoards()` | 두 번호판 선택/잠금 상태, 배지, 미리보기 갱신 |
| `renderResults()` | 결과 목록 또는 빈 상태 렌더 |
| `copyText(text)` | 클립보드 복사 (5장) |
| `showCopied(button, label)` | 버튼 `복사됨` 피드백 1.5초 |
| `showMessage(text)` / `clearMessage()` | 메시지 영역 제어 |
| `resetFixed()` / `resetExcluded()` / `resetResults()` / `resetAll()` | 초기화 (F7, F8) |

### 규칙
- 상태를 바꾼 뒤에는 항상 `render*()` 를 호출해 화면을 상태와 일치시킨다.
- 번호판과 결과 영역의 클릭은 **이벤트 위임**으로 처리한다 (`data-number`, `data-type`, `data-index` 속성 사용).
- 전역 변수는 최소화한다. 즉시 실행 함수나 `DOMContentLoaded` 안에서 시작한다.
- `innerHTML` 에는 숫자처럼 앱이 만든 값만 넣는다.

### 주요 요소 ID

| ID | 요소 |
|---|---|
| `fixedBoard` / `excludedBoard` | 번호판 그리드 |
| `fixedCount` / `excludedCount` | 개수 배지 |
| `fixedPreview` / `excludedPreview` | 선택 번호 미리보기 |
| `btnResetFixed` / `btnResetExcluded` | 패널 초기화 |
| `btnGenerate` | 5세트 생성 |
| `btnResetAll` | 전체 초기화 |
| `message` | 메시지 영역 |
| `btnCopyAll` / `btnClearResults` | 전체 복사 / 결과 지우기 |
| `resultList` | 결과 목록 |

---

## 8. 접근성
- 번호판 버튼은 `<button type="button">` 으로 만들고 `aria-pressed` 로 선택 상태를 알린다.
- 잠긴 번호는 `aria-disabled="true"`.
- 메시지 영역은 `aria-live="polite"`.
- 키보드 Tab / Enter / Space 로 모든 기능을 쓸 수 있어야 한다. 포커스 링을 지우지 않는다.
- 공 색만으로 정보를 전달하지 않는다 (번호 숫자를 항상 표시).

---

## 9. 완료 기준 (Acceptance Criteria)

- [ ] `index.html` 을 파일로 직접 열어도 모든 기능이 동작한다.
- [ ] HTML/CSS/JS 가 각각 `index.html`, `css/style.css`, `js/app.js` 로 분리되어 있다.
- [ ] 생성 버튼을 누르면 A~E 5세트가 나오고, 각 세트는 1~45 사이 서로 다른 6개 번호가 오름차순이다.
- [ ] 고정 번호는 5세트 모두에 들어가고 파란 테두리로 강조된다.
- [ ] 제외 번호는 어떤 세트에도 나오지 않는다.
- [ ] 같은 번호를 고정과 제외에 동시에 넣을 수 없다.
- [ ] 고정 6개째, 제외 40개째는 선택되지 않고 안내 문구가 나온다.
- [ ] 세트별 복사 버튼이 해당 세트만 복사하고 `복사됨` 이 1.5초 표시된다.
- [ ] 전체 복사가 `A: …` 형식 5줄을 복사한다. 결과가 없으면 안내 문구가 나온다.
- [ ] 4가지 초기화 버튼이 "초기화 범위 정리" 표대로 동작한다.
- [ ] 375px 폭에서 가로 스크롤 없이 패널이 위아래로 쌓인다.
- [ ] 콘솔 에러가 없다.

---

## 10. 향후 확장 (선택)
- 생성 기록 저장 (localStorage)
- 세트 수 선택 (1~10)
- 지난주 당첨번호: Node 스크립트로 네이버 검색 결과를 받아 `data/lotto.json` 으로 저장하고 앱이 읽는 방식 (서버 측 수집이므로 CORS 문제 없음)
- 다크 모드

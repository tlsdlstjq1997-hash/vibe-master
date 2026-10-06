(() => {
  const MAX_FIXED = 5;
  const MAX_EXCLUDED = 39;
  const SET_COUNT = 5;
  const SET_LABELS = ['A', 'B', 'C', 'D', 'E'];
  const COPIED_MS = 1500;

  const state = {
    fixed: new Set(),
    excluded: new Set(),
    results: []
  };

  const $ = (id) => document.getElementById(id);
  const sortAsc = (arr) => [...arr].sort((a, b) => a - b);
  const otherType = (type) => (type === 'fixed' ? 'excluded' : 'fixed');
  const typeName = (type) => (type === 'fixed' ? '고정' : '제외');

  function getBallClass(n) {
    if (n <= 10) return 'ball-y';
    if (n <= 20) return 'ball-b';
    if (n <= 30) return 'ball-r';
    if (n <= 40) return 'ball-g';
    return 'ball-gr';
  }

  function randomInt(max) {
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  // Fisher–Yates 로 앞에서부터 count개만 섞어서 뽑는다
  function pickRandom(pool, count) {
    const arr = [...pool];
    for (let i = 0; i < count; i++) {
      const j = i + randomInt(arr.length - i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, count);
  }

  /* 메시지 */
  function showMessage(text) {
    $('message').textContent = text;
  }

  function clearMessage() {
    $('message').textContent = '';
  }

  /* 번호판 */
  function buildBoards() {
    ['fixed', 'excluded'].forEach((type) => {
      const board = $(type + 'Board');
      const frag = document.createDocumentFragment();
      for (let n = 1; n <= 45; n++) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'num';
        btn.textContent = n;
        btn.dataset.number = n;
        frag.appendChild(btn);
      }
      board.appendChild(frag);
    });
  }

  function renderBoards() {
    ['fixed', 'excluded'].forEach((type) => {
      const mine = state[type];
      const other = state[otherType(type)];

      $(type + 'Board').querySelectorAll('.num').forEach((btn) => {
        const n = Number(btn.dataset.number);
        const selected = mine.has(n);
        const locked = other.has(n);
        btn.classList.toggle('selected-' + type, selected);
        btn.classList.toggle('locked', locked);
        btn.setAttribute('aria-pressed', String(selected));
        btn.setAttribute('aria-disabled', String(locked));
      });

      const preview = $(type + 'Preview');
      if (mine.size === 0) {
        preview.textContent = type === 'fixed' ? '모든 세트에 들어갈 번호' : '절대 나오지 않을 번호';
      } else {
        preview.innerHTML = sortAsc(mine)
          .map((n) => `<span class="ball ball-sm ${getBallClass(n)}">${n}</span>`)
          .join('');
      }
    });

    $('fixedCount').textContent = `${state.fixed.size} / ${MAX_FIXED}`;
    $('excludedCount').textContent = `${state.excluded.size} / ${MAX_EXCLUDED}`;
  }

  function toggleNumber(type, n) {
    clearMessage();
    const mine = state[type];

    if (state[otherType(type)].has(n)) {
      showMessage(`${n}번은 ${typeName(otherType(type))} 번호로 선택돼 있어요`);
      return;
    }

    if (mine.has(n)) {
      mine.delete(n);
    } else {
      if (type === 'fixed' && mine.size >= MAX_FIXED) {
        showMessage(`고정 번호는 최대 ${MAX_FIXED}개까지 고를 수 있어요`);
        return;
      }
      if (type === 'excluded' && mine.size >= MAX_EXCLUDED) {
        showMessage(`제외 번호는 최대 ${MAX_EXCLUDED}개까지예요`);
        return;
      }
      mine.add(n);
    }
    renderBoards();
  }

  /* 생성 */
  function generateSets() {
    clearMessage();
    const pool = [];
    for (let n = 1; n <= 45; n++) {
      if (!state.fixed.has(n) && !state.excluded.has(n)) pool.push(n);
    }
    const need = 6 - state.fixed.size;
    if (pool.length < need) {
      showMessage('남은 번호가 부족해요. 제외 번호를 줄여주세요');
      return;
    }

    state.results = [];
    for (let i = 0; i < SET_COUNT; i++) {
      state.results.push(sortAsc([...state.fixed, ...pickRandom(pool, need)]));
    }
    renderResults();
  }

  function renderResults() {
    const list = $('resultList');
    if (state.results.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <i class="bi bi-ticket-perforated" aria-hidden="true"></i>
          생성 버튼을 누르면 여기에 5세트가 나와요
        </div>`;
      return;
    }

    list.innerHTML = state.results
      .map((set, i) => {
        const balls = set
          .map((n) => {
            const fixedCls = state.fixed.has(n) ? ' is-fixed' : '';
            return `<span class="ball ${getBallClass(n)}${fixedCls}">${n}</span>`;
          })
          .join('');
        return `
          <div class="result-row">
            <span class="result-label">${SET_LABELS[i]}</span>
            <div class="result-balls">${balls}</div>
            <button type="button" class="btn btn-copy" data-index="${i}" aria-label="${SET_LABELS[i]} 세트 복사">
              <i class="bi bi-copy" aria-hidden="true"></i><span>복사</span>
            </button>
          </div>`;
      })
      .join('');
  }

  /* 복사 */
  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (e) {
        // 아래 대체 방식으로 진행
      }
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    ta.remove();
    return ok;
  }

  function showCopied(button, label) {
    const icon = button.querySelector('i');
    const text = button.querySelector('span');
    button.classList.add('is-copied');
    icon.className = 'bi bi-check-lg';
    text.textContent = '복사됨';

    clearTimeout(button._copiedTimer);
    button._copiedTimer = setTimeout(() => {
      button.classList.remove('is-copied');
      icon.className = 'bi bi-copy';
      text.textContent = label;
    }, COPIED_MS);
  }

  async function copyWithFeedback(button, text, label) {
    clearMessage();
    const ok = await copyText(text);
    if (ok) {
      showCopied(button, label);
    } else {
      showMessage('복사하지 못했어요. 번호를 직접 선택해 복사해주세요');
    }
  }

  function copyAll() {
    if (state.results.length === 0) {
      showMessage('복사할 결과가 없어요');
      return;
    }
    const text = state.results
      .map((set, i) => `${SET_LABELS[i]}: ${set.join(', ')}`)
      .join('\n');
    copyWithFeedback($('btnCopyAll'), text, '전체 복사');
  }

  /* 초기화 */
  function resetFixed() {
    state.fixed.clear();
    clearMessage();
    renderBoards();
  }

  function resetExcluded() {
    state.excluded.clear();
    clearMessage();
    renderBoards();
  }

  function resetResults() {
    state.results = [];
    clearMessage();
    renderResults();
  }

  function resetAll() {
    state.fixed.clear();
    state.excluded.clear();
    state.results = [];
    clearMessage();
    renderBoards();
    renderResults();
  }

  /* 이벤트 */
  function bindEvents() {
    ['fixed', 'excluded'].forEach((type) => {
      $(type + 'Board').addEventListener('click', (e) => {
        const btn = e.target.closest('.num');
        if (!btn) return;
        toggleNumber(type, Number(btn.dataset.number));
      });
    });

    $('resultList').addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-copy');
      if (!btn) return;
      const set = state.results[Number(btn.dataset.index)];
      if (set) copyWithFeedback(btn, set.join(', '), '복사');
    });

    $('btnGenerate').addEventListener('click', generateSets);
    $('btnResetFixed').addEventListener('click', resetFixed);
    $('btnResetExcluded').addEventListener('click', resetExcluded);
    $('btnCopyAll').addEventListener('click', copyAll);
    $('btnClearResults').addEventListener('click', resetResults);
    $('btnResetAll').addEventListener('click', resetAll);
  }

  function init() {
    buildBoards();
    bindEvents();
    renderBoards();
    renderResults();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

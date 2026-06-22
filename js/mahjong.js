/* ============================================================
   ICOC OMNIPO — 마작 솔리테어 (Shanghai Mahjong Solitaire)
   같은 패 2장을 클릭해 제거. 양쪽 중 하나가 열리고 위가 비어있어야 선택 가능.
   5층 피라미드 레이아웃 (144타일): 60 + 40 + 24 + 12 + 8
   ============================================================ */

(function (global) {
  'use strict';

  // ── Layout (5 layers, 144 tiles total) ──
  // [z, r, c]: z=층(0=바닥), r=행, c=열
  const LAYOUT = [];
  (function () {
    for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) LAYOUT.push([0, r, c]); // 60
    for (let r = 1; r <= 5; r++) for (let c = 1; c <= 8; c++) LAYOUT.push([1, r, c]); // 40
    for (let r = 2; r <= 4; r++) for (let c = 1; c <= 8; c++) LAYOUT.push([2, r, c]); // 24
    for (let r = 3; r <= 4; r++) for (let c = 2; c <= 7; c++) LAYOUT.push([3, r, c]); // 12
    for (let r = 3; r <= 4; r++) for (let c = 3; c <= 6; c++) LAYOUT.push([4, r, c]); // 8
  })(); // total = 144

  // ── Tile types (34 Unicode types × 4 + flower×4 + season×4 = 144) ──
  const GLYPHS = [
    '🀇','🀈','🀉','🀊','🀋','🀌','🀍','🀎','🀏', // 만수패 1-9
    '🀙','🀚','🀛','🀜','🀝','🀞','🀟','🀠','🀡', // 통수패 1-9
    '🀐','🀑','🀒','🀓','🀔','🀕','🀖','🀗','🀘', // 대나무 1-9
    '🀀','🀁','🀂','🀃',                           // 바람패 동남서북
    '🀄','🀅','🀆',                               // 삼원패 중발백
  ]; // 34종

  const POOL = [];
  GLYPHS.forEach((g, i) => {
    for (let k = 0; k < 4; k++) POOL.push({ id: 'T' + i, g });
  });
  // 꽃패(4장) — 꽃끼리 매칭
  for (let k = 0; k < 4; k++) POOL.push({ id: 'flower' + k, g: '🌸', group: 'FL' });
  // 계절패(4장) — 계절끼리 매칭
  for (let k = 0; k < 4; k++) POOL.push({ id: 'season' + k, g: '🍂', group: 'SE' });
  // 34×4 + 4 + 4 = 144 ✓

  function tilesMatch(a, b) {
    if (a === b) return false;
    if (a.group && b.group) return a.group === b.group;
    if (a.group || b.group) return false;
    return a.id === b.id;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── 타일 배치 (셔플 후 레이아웃에 할당) ──
  function createTiles(attempt = 0) {
    const shuffled = shuffle(POOL);
    const tiles = LAYOUT.map(([z, r, c], i) => ({
      ...shuffled[i], z, r, c, removed: false, el: null,
    }));
    // 시작 시 최소 2쌍 이상의 자유 매칭이 있어야 함
    if (attempt < 12 && findHint(tiles) === null) return createTiles(attempt + 1);
    return tiles;
  }

  // ── 자유 타일 판정 ──
  // 자유 조건: 위가 비어있고 (왼쪽이 막혀있지 않거나 오른쪽이 막혀있지 않음)
  function isFree(tile, all) {
    if (tile.removed) return false;
    const { z, r, c } = tile;
    for (const t of all) {
      if (t.removed || t === tile) continue;
      // 위 차단: 같은 (r,c)에 z+1 타일
      if (t.z === z + 1 && t.r === r && t.c === c) return false;
    }
    let L = false, R = false;
    for (const t of all) {
      if (t.removed || t === tile || t.z !== z || t.r !== r) continue;
      if (t.c === c - 1) L = true;
      if (t.c === c + 1) R = true;
    }
    return !L || !R;
  }

  // ── 힌트: 자유 타일 중 매칭 쌍 탐색 ──
  function findHint(all) {
    const free = all.filter(t => !t.removed && isFree(t, all));
    for (let i = 0; i < free.length; i++)
      for (let j = i + 1; j < free.length; j++)
        if (tilesMatch(free[i], free[j])) return [free[i], free[j]];
    return null;
  }

  // ── 픽셀 좌표 계산 ──
  const TW = 40, TH = 52, GAP = 1; // 타일 크기
  const ZDX = 5, ZDY = -6;          // 층별 아이소메트릭 오프셋
  const PX = 10, PY = 36;           // 보드 여백

  function tx(z, c) { return PX + c * (TW + GAP) + z * ZDX; }
  function ty(z, r) { return PY + r * (TH + GAP) + z * ZDY; }

  // ── 게임 상태 ──
  let tiles, selected, gameOver, awarded;

  function renderFree() {
    if (!tiles) return;
    tiles.forEach(t => {
      if (!t.el || t.removed) return;
      const free = isFree(t, tiles);
      t.el.className = 'mj-tile' +
        (free  ? ' mj-free'    : ' mj-blocked') +
        (t === selected ? ' mj-selected' : '');
    });
  }

  function updateStatus() {
    const rem = tiles.filter(t => !t.removed).length;
    const done = (144 - rem) / 2;
    const el = document.getElementById('mj-status');
    if (el) el.textContent = `남은 타일 ${rem}개  |  ${done} / 72쌍 제거`;
  }

  function setMsg(msg)  { const e = document.getElementById('mj-result');    if (e) e.textContent = msg || ''; }
  function setPts(msg)  { const e = document.getElementById('mj-points-msg'); if (e) e.textContent = msg || ''; }

  function endGame(win) {
    if (awarded) return;
    gameOver = true; awarded = true;
    const pts = win ? 30 : 15;
    setMsg(win
      ? '🎉 완성! 모든 타일을 제거했습니다!'
      : '😵 더 이상 맞출 수 있는 쌍이 없습니다. 다시 도전해보세요!');
    const res = window.ICOC_POINTS.addPoints(pts, 'mahjong_' + (win ? 'win' : 'lose'));
    setPts(res.capped
      ? `+${res.added}P 적립 (오늘 한도 도달 · 보유 ${res.total.toLocaleString()}P)`
      : `+${res.added}P 적립 · 보유 ${res.total.toLocaleString()}P`);
    window.ICOC_POINTS.showToast(`+${res.added}P 적립되었습니다.`);
  }

  // ── 클릭 핸들러 ──
  function onTileClick(tile) {
    if (gameOver || tile.removed) return;
    if (!isFree(tile, tiles)) {
      tile.el.classList.add('mj-shake');
      setTimeout(() => tile.el && tile.el.classList.remove('mj-shake'), 300);
      return;
    }

    if (selected === tile) { selected = null; renderFree(); return; }

    if (selected && tilesMatch(selected, tile)) {
      // 매칭 성공 — 제거
      selected.removed = true; tile.removed = true;
      if (selected.el) selected.el.style.display = 'none';
      if (tile.el)     tile.el.style.display = 'none';
      selected = null;
      renderFree();
      updateStatus();
      const rem = tiles.filter(t => !t.removed).length;
      if (rem === 0)           { endGame(true);  return; }
      if (!findHint(tiles))    { endGame(false); return; }
      return;
    }

    // 다른 자유 타일 선택
    selected = tile;
    renderFree();
  }

  // ── 힌트 버튼 ──
  function showHint() {
    if (gameOver) return;
    tiles.forEach(t => t.el && t.el.classList.remove('mj-hint'));
    const pair = findHint(tiles);
    if (!pair) { setMsg('힌트 없음 — 더 이상 맞출 수 있는 쌍이 없습니다.'); return; }
    pair.forEach(t => {
      t.el.classList.add('mj-hint');
      setTimeout(() => t.el && t.el.classList.remove('mj-hint'), 2000);
    });
  }

  // ── 보드 DOM 생성 ──
  function buildBoard(wrap) {
    wrap.innerHTML = '';
    const board = document.createElement('div');
    board.className = 'mj-board';

    // 보드 크기 계산 (y 오프셋 포함)
    let maxX = 0, maxY = 0;
    LAYOUT.forEach(([z, r, c]) => {
      maxX = Math.max(maxX, tx(z, c) + TW);
      maxY = Math.max(maxY, ty(z, r) + TH);
    });
    board.style.width  = (maxX + PX) + 'px';
    board.style.height = (maxY + PY) + 'px';

    tiles.forEach(tile => {
      const el = document.createElement('div');
      el.className = 'mj-tile mj-free';
      el.style.left   = tx(tile.z, tile.c) + 'px';
      el.style.top    = ty(tile.z, tile.r) + 'px';
      el.style.zIndex = tile.z * 1000 + tile.r * 10 + tile.c;
      el.textContent  = tile.g;
      el.addEventListener('click', () => onTileClick(tile));
      tile.el = el;
      board.appendChild(el);
    });

    wrap.appendChild(board);

    // 모바일: 보드 폭이 컨테이너보다 넓으면 축소
    requestAnimationFrame(() => {
      const avail = wrap.clientWidth - 8;
      const bw = parseFloat(board.style.width);
      if (bw > avail && avail > 0) {
        const scale = avail / bw;
        board.style.transform = `scale(${scale})`;
        board.style.transformOrigin = 'top left';
        board.style.marginBottom = (parseFloat(board.style.height) * (scale - 1)) + 'px';
      }
    });
  }

  function reset() {
    selected = null; gameOver = false; awarded = false;
    tiles = createTiles();
    setMsg(''); setPts('');
    buildBoard(document.getElementById('mj-board-wrap'));
    renderFree();
    updateStatus();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="mj-topbar">
        <span id="mj-status" class="mj-status-text">남은 타일 144개</span>
        <button class="game-btn ghost mj-hint-btn" id="mj-hint-btn">💡 힌트</button>
      </div>
      <div id="mj-board-wrap" class="mj-board-wrap"></div>
      <div id="mj-result" class="game-result-msg"></div>
      <div id="mj-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="mj-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('mj-hint-btn').addEventListener('click', showHint);
    document.getElementById('mj-restart-btn').addEventListener('click', reset);
    tiles = createTiles(); gameOver = false; awarded = false; selected = null;
    buildBoard(document.getElementById('mj-board-wrap'));
    renderFree();
    updateStatus();
  }

  global.MahjongGame = { start };
})(window);

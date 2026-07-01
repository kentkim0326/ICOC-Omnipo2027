/* ============================================================
   ICOC OMNIPO — 헥스 (Hex) vs AI
   11x11 마름모형 보드. 플레이어(빨강)는 좌-우, AI(파랑)는 상-하를 연결하면 승리.
   ============================================================ */

(function (global) {
  const SIZE = 11;
  const EMPTY = 0, PLAYER = 1, AI = 2; // PLAYER: 좌→우 연결, AI: 상→하 연결
  // 헥스 보드의 6방향 인접 (axial 좌표계, 행렬 인덱스 기준)
  const NB = [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0]];

  let board, turn, gameOver, cellEls, awarded;

  function inB(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

  // Union-Find로 연결 여부 판단
  function makeUF(n) {
    const parent = Array.from({ length: n }, (_, i) => i);
    function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
    function union(a, b) { a = find(a); b = find(b); if (a !== b) parent[a] = b; }
    return { find, union };
  }

  // 가상 노드: TOP, BOTTOM (AI용 상하), LEFT, RIGHT (PLAYER용 좌우)
  function checkWinFor(b, player) {
    const n = SIZE * SIZE;
    const TOP = n, BOTTOM = n + 1, LEFT = n + 2, RIGHT = n + 3;
    const uf = makeUF(n + 4);
    const idx = (r, c) => r * SIZE + c;

    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (b[r][c] !== player) continue;
        if (player === AI) {
          if (r === 0) uf.union(idx(r, c), TOP);
          if (r === SIZE - 1) uf.union(idx(r, c), BOTTOM);
        } else {
          if (c === 0) uf.union(idx(r, c), LEFT);
          if (c === SIZE - 1) uf.union(idx(r, c), RIGHT);
        }
        for (const [dr, dc] of NB) {
          const nr = r + dr, nc = c + dc;
          if (inB(nr, nc) && b[nr][nc] === player) uf.union(idx(r, c), idx(nr, nc));
        }
      }
    }
    return player === AI ? uf.find(TOP) === uf.find(BOTTOM) : uf.find(LEFT) === uf.find(RIGHT);
  }

  // ── AI 평가: 자신의 연결 강화 + 상대 연결 방해 (간이 전기회로식 휴리스틱) ──
  function bridgeScore(b, r, c, player) {
    // 인접 칸 중 이미 같은 색 돌이 있으면 가중치, 보드 중앙에 가까울수록 약간 가중치
    let score = 0;
    for (const [dr, dc] of NB) {
      const nr = r + dr, nc = c + dc;
      if (inB(nr, nc) && b[nr][nc] === player) score += 15;
      if (inB(nr, nc) && b[nr][nc] !== EMPTY && b[nr][nc] !== player) score += 4; // 상대 견제
    }
    const center = (SIZE - 1) / 2;
    score += (SIZE - (Math.abs(r - center) + Math.abs(c - center))) * 1.5;
    // AI는 위/아래로 진행해야 하므로 자기 진행축 방향 정렬 가중치, PLAYER는 좌/우
    return score;
  }

  function aiPickMove() {
    let best = -Infinity, bestCell = null;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) continue;
        const attack = bridgeScore(board, r, c, AI);
        const defense = bridgeScore(board, r, c, PLAYER);
        const score = attack + defense * 0.8 + Math.random() * 6;
        if (score > best) { best = score; bestCell = [r, c]; }
      }
    }
    return bestCell;
  }

  function setTurnUI() {
    const pPill = document.getElementById('hex-turn-p');
    const aPill = document.getElementById('hex-turn-a');
    if (!pPill) return;
    pPill.classList.toggle('active', turn === PLAYER && !gameOver);
    aPill.classList.toggle('active', turn === AI && !gameOver);
  }
  function setStatus(msg) { const el = document.getElementById('hex-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('hex-points-msg'); if (el) el.textContent = msg || ''; }

  function renderCell(r, c) {
    const cell = cellEls[r][c];
    cell.innerHTML = '';
    if (board[r][c] !== EMPTY) {
      const disc = document.createElement('div');
      disc.className = 'hex-disc ' + (board[r][c] === PLAYER ? 'hex-red' : 'hex-blue');
      cell.appendChild(disc);
    }
  }

  function endGame(result) {
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 승리했습니다! 양쪽을 연결했습니다.'); pts = 30; }
    else { setStatus('AI가 승리했습니다.'); pts = 10; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'hex_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function onCellClick(r, c) {
    if (window.ICOC_ONLINE?.active) {
      if (!ICOC_ONLINE.isMyTurn || gameOver) return;
      window._goingOnline = true;
    }
    if (gameOver || turn !== PLAYER || board[r][c] !== EMPTY) return;
    board[r][c] = PLAYER;
    renderCell(r, c);
    if (checkWinFor(board, PLAYER)) { endGame('win'); return; }
    
    if (window._goingOnline) { ICOC_ONLINE.sendMove({r,c}); ICOC_ONLINE.showTurnIndicator(false); window._goingOnline=false; return; }
    turn = AI;
    setTurnUI();
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const mv = aiPickMove();
      if (mv) {
        board[mv[0]][mv[1]] = AI;
        renderCell(mv[0], mv[1]);
        if (checkWinFor(board, AI)) { endGame('lose'); return; }
      }
      turn = PLAYER;
      setStatus('');
      setTurnUI();
    }, 450);
  }

  function buildBoardDOM(container) {
    const wrap = document.createElement('div');
    wrap.className = 'hex-board-wrap';
    cellEls = [];
    for (let r = 0; r < SIZE; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'hex-row';
      rowEl.style.marginLeft = (r * 1.8) + '%';
      const rowArr = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'hex-cell';
        cell.addEventListener('click', () => onCellClick(r, c));
        rowEl.appendChild(cell);
        rowArr.push(cell);
      }
      cellEls.push(rowArr);
      wrap.appendChild(rowEl);
    }
    container.appendChild(wrap);
  }

  function reset() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    turn = PLAYER; gameOver = false; awarded = false;
    setStatus('');
    setPointsMsg('당신(빨강)은 좌-우, AI(파랑)는 상-하를 먼저 연결하면 승리합니다.');
    setTurnUI();
    if (cellEls) for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) renderCell(r, c);
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="hex-turn-p" class="game-turn-pill">🔴 당신 (좌-우)</span>
        <span id="hex-turn-a" class="game-turn-pill">🔵 AI (상-하)</span>
      </div>
      <div id="hex-board-wrap"></div>
      <div id="hex-result" class="game-result-msg"></div>
      <div id="hex-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="hex-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('hex-board-wrap'));
    document.getElementById('hex-restart-btn').addEventListener('click', reset);
    reset();
  }

  
  function applyOpponentMove(payload) {
    if (!payload || gameOver) return;
    window._goingOnline = false;
    onCellClick(payload.r, payload.c);
    window.ICOC_ONLINE?.showTurnIndicator(true);
  }
  global.HexGame = { start, applyOpponentMove };
})(window);

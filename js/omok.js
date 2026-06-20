/* ============================================================
   ICOC OMNIPO — 오목 (Omok / Gomoku) vs AI
   15x15 보드, 5개 연속 완성 시 승리 (자유 룰, 렌주 제한 없음)
   AI: 휴리스틱 점수 기반 (공격/방어 동시 평가)
   ============================================================ */

(function (global) {
  const SIZE = 15;
  const EMPTY = 0, BLACK = 1, WHITE = 2; // BLACK = 플레이어, WHITE = AI
  const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];

  let board, turn, gameOver, lastMoveEl, cellEls, awarded, moveCount;

  function inBounds(r, c) {
    return r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  }

  // (r,c)에 player 돌이 놓였다고 가정했을 때, 방향(dr,dc) 라인의 길이와 열린 끝 개수
  function lineInfo(r, c, dr, dc, player) {
    let count = 1, openEnds = 0;
    let rr = r + dr, cc = c + dc;
    while (inBounds(rr, cc) && board[rr][cc] === player) { count++; rr += dr; cc += dc; }
    if (inBounds(rr, cc) && board[rr][cc] === EMPTY) openEnds++;
    rr = r - dr; cc = c - dc;
    while (inBounds(rr, cc) && board[rr][cc] === player) { count++; rr -= dr; cc -= dc; }
    if (inBounds(rr, cc) && board[rr][cc] === EMPTY) openEnds++;
    return { count, openEnds };
  }

  function scoreFor(count, openEnds) {
    if (count >= 5) return 1000000;
    if (count === 4) return openEnds === 2 ? 100000 : (openEnds === 1 ? 10000 : 0);
    if (count === 3) return openEnds === 2 ? 1000 : (openEnds === 1 ? 100 : 0);
    if (count === 2) return openEnds === 2 ? 100 : (openEnds === 1 ? 10 : 0);
    return openEnds === 2 ? 5 : (openEnds === 1 ? 2 : 1);
  }

  function evalCell(r, c, player) {
    let total = 0;
    for (const [dr, dc] of DIRS) {
      const { count, openEnds } = lineInfo(r, c, dr, dc, player);
      total += scoreFor(count, openEnds);
    }
    return total;
  }

  function checkWin(r, c, player) {
    for (const [dr, dc] of DIRS) {
      const { count } = lineInfo(r, c, dr, dc, player);
      if (count >= 5) return true;
    }
    return false;
  }

  function boardFull() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (board[r][c] === EMPTY) return false;
    return true;
  }

  function aiPickMove() {
    let best = -Infinity, bestCell = null;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) continue;
        const attack = evalCell(r, c, WHITE);
        const defense = evalCell(r, c, BLACK);
        const score = attack + defense * 1.1 + Math.random() * 3;
        if (score > best) { best = score; bestCell = [r, c]; }
      }
    }
    return bestCell;
  }

  function setTurnUI() {
    const bPill = document.getElementById('omok-turn-black');
    const wPill = document.getElementById('omok-turn-white');
    if (!bPill) return;
    bPill.classList.toggle('active', turn === BLACK && !gameOver);
    wPill.classList.toggle('active', turn === WHITE && !gameOver);
  }

  function setStatus(msg) {
    const el = document.getElementById('omok-result');
    if (el) el.textContent = msg || '';
  }

  function setPointsMsg(msg) {
    const el = document.getElementById('omok-points-msg');
    if (el) el.textContent = msg || '';
  }

  function renderStone(r, c, player) {
    const cell = cellEls[r][c];
    cell.innerHTML = '';
    const stone = document.createElement('div');
    stone.className = 'stone ' + (player === BLACK ? 'black' : 'white') + ' last-move';
    cell.appendChild(stone);
    if (lastMoveEl) lastMoveEl.classList.remove('last-move');
    lastMoveEl = stone;
  }

  function endGame(result) {
    // result: 'win' | 'lose' | 'draw'
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 승리했습니다!'); pts = 30; }
    else if (result === 'lose') { setStatus('AI가 승리했습니다. 다음엔 이겨봐요!'); pts = 10; }
    else { setStatus('무승부입니다.'); pts = 15; }

    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'omok_' + result);
      setPointsMsg(
        r.capped
          ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
          : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`
      );
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function onCellClick(r, c) {
    if (gameOver || turn !== BLACK || board[r][c] !== EMPTY) return;
    placeMove(r, c, BLACK);
  }

  function placeMove(r, c, player) {
    board[r][c] = player;
    moveCount++;
    renderStone(r, c, player);
    if (checkWin(r, c, player)) {
      endGame(player === BLACK ? 'win' : 'lose');
      return;
    }
    if (boardFull()) { endGame('draw'); return; }

    turn = player === BLACK ? WHITE : BLACK;
    setTurnUI();

    if (turn === WHITE && !gameOver) {
      setStatus('AI가 생각 중...');
      setTimeout(() => {
        const mv = aiPickMove();
        if (mv) placeMove(mv[0], mv[1], WHITE);
        if (!gameOver) setStatus('');
      }, 450);
    }
  }

  function buildBoardDOM(container) {
    const grid = document.createElement('div');
    grid.className = 'board-grid';
    grid.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
    cellEls = [];
    for (let r = 0; r < SIZE; r++) {
      const rowArr = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell';
        cell.addEventListener('click', () => onCellClick(r, c));
        grid.appendChild(cell);
        rowArr.push(cell);
      }
      cellEls.push(rowArr);
    }
    container.appendChild(grid);
  }

  function reset() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    turn = BLACK;
    gameOver = false;
    lastMoveEl = null;
    awarded = false;
    moveCount = 0;
    setStatus('');
    setPointsMsg('당신은 흑, AI는 백입니다. 5개를 먼저 연결하세요.');
    setTurnUI();
    if (cellEls) {
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) cellEls[r][c].innerHTML = '';
    }
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="omok-turn-black" class="game-turn-pill">⚫ 당신 (흑)</span>
        <span id="omok-turn-white" class="game-turn-pill">⚪ AI (백)</span>
      </div>
      <div id="omok-board-wrap"></div>
      <div id="omok-result" class="game-result-msg"></div>
      <div id="omok-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="omok-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('omok-board-wrap'));
    document.getElementById('omok-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.OmokGame = { start };
})(window);

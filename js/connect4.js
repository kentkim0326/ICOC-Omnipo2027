/* ============================================================
   ICOC OMNIPO — 커넥트4 (Connect 4) vs AI
   7열 x 6행, 중력 적용(아래로 떨어짐), 4개 연결 시 승리
   ============================================================ */

(function (global) {
  const COLS = 7, ROWS = 6;
  const EMPTY = 0, PLAYER = 1, AI = 2;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];

  let board, turn, gameOver, colEls, slotEls, awarded, lastCol;

  function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  function dropRow(b, col) {
    for (let r = ROWS - 1; r >= 0; r--) if (b[r][col] === EMPTY) return r;
    return -1;
  }

  function lineInfo(b, r, c, dr, dc, player) {
    let count = 1, openEnds = 0;
    let rr = r + dr, cc = c + dc;
    while (inBounds(rr, cc) && b[rr][cc] === player) { count++; rr += dr; cc += dc; }
    if (inBounds(rr, cc) && b[rr][cc] === EMPTY) openEnds++;
    rr = r - dr; cc = c - dc;
    while (inBounds(rr, cc) && b[rr][cc] === player) { count++; rr -= dr; cc -= dc; }
    if (inBounds(rr, cc) && b[rr][cc] === EMPTY) openEnds++;
    return { count, openEnds };
  }

  function checkWin(b, r, c, player) {
    for (const [dr, dc] of DIRS) if (lineInfo(b, r, c, dr, dc, player).count >= 4) return true;
    return false;
  }

  function scoreFor(count, openEnds) {
    if (count >= 4) return 100000;
    if (count === 3) return openEnds >= 1 ? 500 : 0;
    if (count === 2) return openEnds >= 1 ? 30 : 0;
    return 1;
  }

  function evalDrop(b, col, player) {
    const row = dropRow(b, col);
    if (row === -1) return null;
    let total = 0;
    for (const [dr, dc] of DIRS) {
      const { count, openEnds } = lineInfo(b, row, col, dr, dc, player);
      total += scoreFor(count, openEnds);
    }
    total += (3 - Math.abs(col - 3)) * 4; // 중앙 열 선호
    return { row, score: total };
  }

  function boardFull(b) { for (let c = 0; c < COLS; c++) if (b[0][c] === EMPTY) return false; return true; }

  function aiPickCol() {
    let best = -Infinity, bestCol = null;
    for (let c = 0; c < COLS; c++) {
      const row = dropRow(board, c);
      if (row === -1) continue;
      const attack = evalDrop(board, c, AI);
      const defense = evalDrop(board, c, PLAYER);
      const score = (attack ? attack.score : 0) + (defense ? defense.score * 1.05 : 0) + Math.random() * 4;
      if (score > best) { best = score; bestCol = c; }
    }
    return bestCol;
  }

  function setTurnUI() {
    const pPill = document.getElementById('c4-turn-p');
    const aPill = document.getElementById('c4-turn-a');
    if (!pPill) return;
    pPill.classList.toggle('active', turn === PLAYER && !gameOver);
    aPill.classList.toggle('active', turn === AI && !gameOver);
  }
  function setStatus(msg) { const el = document.getElementById('c4-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('c4-points-msg'); if (el) el.textContent = msg || ''; }

  function renderCell(r, c) {
    const slot = slotEls[r][c];
    slot.innerHTML = '';
    if (board[r][c] !== EMPTY) {
      const disc = document.createElement('div');
      disc.className = 'stone ' + (board[r][c] === PLAYER ? 'black' : 'white');
      slot.appendChild(disc);
    }
  }

  function endGame(result) {
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 승리했습니다!'); pts = 30; }
    else if (result === 'lose') { setStatus('AI가 승리했습니다.'); pts = 10; }
    else { setStatus('무승부입니다.'); pts = 15; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'connect4_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function dropPiece(col, player) {
    const row = dropRow(board, col);
    if (row === -1) return false;
    board[row][col] = player;
    renderCell(row, col);
    if (lastCol !== null) slotEls.forEach(rowArr => rowArr[lastCol] && rowArr[lastCol].classList.remove('last-move-col'));
    lastCol = col;
    if (checkWin(board, row, col, player)) { endGame(player === PLAYER ? 'win' : 'lose'); return true; }
    if (boardFull(board)) { endGame('draw'); return true; }
    return false;
  }

  function onColClick(col) {
    if (gameOver || turn !== PLAYER) return;
    if (dropRow(board, col) === -1) { global.ICOC_POINTS.showToast('이 열은 가득 찼습니다.'); return; }
    const ended = dropPiece(col, PLAYER);
    if (ended) return;
    turn = AI;
    setTurnUI();
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const c = aiPickCol();
      if (c !== null) dropPiece(c, AI);
      turn = PLAYER;
      setStatus('');
      setTurnUI();
    }, 450);
  }

  function buildBoardDOM(container) {
    const grid = document.createElement('div');
    grid.className = 'board-grid connect4-grid';
    grid.style.gridTemplateColumns = `repeat(${COLS}, 1fr)`;
    grid.style.gridTemplateRows = `repeat(${ROWS}, 1fr)`;
    slotEls = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell connect4-cell';
        cell.addEventListener('click', () => onColClick(c));
        grid.appendChild(cell);
        slotEls[r][c] = cell;
      }
    }
    container.appendChild(grid);
  }

  function reset() {
    board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
    turn = PLAYER; gameOver = false; awarded = false; lastCol = null;
    setStatus('');
    setPointsMsg('당신이 선공입니다. 가로·세로·대각선으로 4개를 먼저 연결하세요.');
    setTurnUI();
    if (slotEls) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) renderCell(r, c);
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="c4-turn-p" class="game-turn-pill">⚫ 당신</span>
        <span id="c4-turn-a" class="game-turn-pill">⚪ AI</span>
      </div>
      <div id="c4-board-wrap"></div>
      <div id="c4-result" class="game-result-msg"></div>
      <div id="c4-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="c4-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('c4-board-wrap'));
    document.getElementById('c4-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.Connect4Game = { start };
})(window);

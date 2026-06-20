/* ============================================================
   ICOC OMNIPO — 리버시 / 오델로 (Reversi) vs AI
   8x8 보드, 상대 돌을 뒤집어 자신의 색으로 만듦. 더 많은 돌을 가진 쪽이 승리.
   ============================================================ */

(function (global) {
  const SIZE = 8;
  const EMPTY = 0, PLAYER = 1, AI = 2; // PLAYER = 흑(선공), AI = 백
  const DIRS = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];

  // 코너/가장자리 가중치 (간단한 위치 평가표)
  const WEIGHT = [
    [100,-20,10,5,5,10,-20,100],
    [-20,-50,-2,-2,-2,-2,-50,-20],
    [10,-2,1,1,1,1,-2,10],
    [5,-2,1,0,0,1,-2,5],
    [5,-2,1,0,0,1,-2,5],
    [10,-2,1,1,1,1,-2,10],
    [-20,-50,-2,-2,-2,-2,-50,-20],
    [100,-20,10,5,5,10,-20,100]
  ];

  let board, turn, gameOver, cellEls, awarded, lastMove;

  function inB(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function opp(p) { return p === PLAYER ? AI : PLAYER; }

  function flipsFor(b, r, c, player) {
    if (b[r][c] !== EMPTY) return [];
    const enemy = opp(player);
    let allFlips = [];
    for (const [dr, dc] of DIRS) {
      let rr = r + dr, cc = c + dc;
      const line = [];
      while (inB(rr, cc) && b[rr][cc] === enemy) { line.push([rr, cc]); rr += dr; cc += dc; }
      if (line.length > 0 && inB(rr, cc) && b[rr][cc] === player) allFlips = allFlips.concat(line);
    }
    return allFlips;
  }

  function legalMoves(b, player) {
    const moves = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const flips = flipsFor(b, r, c, player);
      if (flips.length > 0) moves.push({ r, c, flips });
    }
    return moves;
  }

  function applyMove(b, move, player) {
    b[move.r][move.c] = player;
    for (const [rr, cc] of move.flips) b[rr][cc] = player;
  }

  function countDiscs(b) {
    let p = 0, a = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (b[r][c] === PLAYER) p++; else if (b[r][c] === AI) a++;
    }
    return { p, a };
  }

  function evalMove(b, move, player) {
    let score = WEIGHT[move.r][move.c] * 10;
    score += move.flips.length * 8;
    return score + Math.random() * 5;
  }

  function aiPickMove() {
    const moves = legalMoves(board, AI);
    if (moves.length === 0) return null;
    let best = -Infinity, bestMove = null;
    for (const m of moves) {
      const s = evalMove(board, m, AI);
      if (s > best) { best = s; bestMove = m; }
    }
    return bestMove;
  }

  function setTurnUI() {
    const pPill = document.getElementById('rv-turn-p');
    const aPill = document.getElementById('rv-turn-a');
    if (!pPill) return;
    const { p, a } = countDiscs(board);
    pPill.classList.toggle('active', turn === PLAYER && !gameOver);
    aPill.classList.toggle('active', turn === AI && !gameOver);
    pPill.textContent = `⚫ 당신 · ${p}`;
    aPill.textContent = `⚪ AI · ${a}`;
  }
  function setStatus(msg) { const el = document.getElementById('rv-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('rv-points-msg'); if (el) el.textContent = msg || ''; }

  function renderBoard() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const cell = cellEls[r][c];
      cell.innerHTML = '';
      cell.classList.remove('reversi-hint');
      if (board[r][c] !== EMPTY) {
        const disc = document.createElement('div');
        disc.className = 'stone ' + (board[r][c] === PLAYER ? 'black' : 'white');
        cell.appendChild(disc);
      }
    }
    if (turn === PLAYER && !gameOver) {
      legalMoves(board, PLAYER).forEach(m => cellEls[m.r][m.c].classList.add('reversi-hint'));
    }
    if (lastMove) cellEls[lastMove[0]][lastMove[1]].classList.add('chess-last');
  }

  function endGame() {
    gameOver = true;
    const { p, a } = countDiscs(board);
    setTurnUI();
    let result = p > a ? 'win' : p < a ? 'lose' : 'draw';
    let pts;
    if (result === 'win') { setStatus(`🎉 승리! (${p} : ${a})`); pts = 30; }
    else if (result === 'lose') { setStatus(`AI 승리. (${p} : ${a})`); pts = 10; }
    else { setStatus(`무승부. (${p} : ${a})`); pts = 15; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'reversi_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function nextTurnAfter(playerJustMoved) {
    const next = opp(playerJustMoved);
    if (legalMoves(board, next).length > 0) { turn = next; return; }
    // 다음 사람이 둘 곳이 없으면 패스, 현재 사람이 또 둘 곳이 있으면 그대로 턴 유지
    if (legalMoves(board, playerJustMoved).length > 0) {
      global.ICOC_POINTS.showToast((next === PLAYER ? '당신은' : 'AI는') + ' 둘 곳이 없어 패스합니다.');
      turn = playerJustMoved;
      return;
    }
    endGame();
  }

  function doAiTurn() {
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const mv = aiPickMove();
      if (mv) {
        applyMove(board, mv, AI);
        lastMove = [mv.r, mv.c];
      }
      renderBoard();
      setTurnUI();
      setStatus('');
      nextTurnAfter(AI);
      setTurnUI();
      renderBoard();
      if (!gameOver && turn === AI) doAiTurn();
    }, 450);
  }

  function onCellClick(r, c) {
    if (gameOver || turn !== PLAYER) return;
    const flips = flipsFor(board, r, c, PLAYER);
    if (flips.length === 0) { global.ICOC_POINTS.showToast('그 자리에는 둘 수 없습니다.'); return; }
    applyMove(board, { r, c, flips }, PLAYER);
    lastMove = [r, c];
    renderBoard();
    setTurnUI();
    nextTurnAfter(PLAYER);
    setTurnUI();
    renderBoard();
    if (!gameOver && turn === AI) doAiTurn();
  }

  function buildBoardDOM(container) {
    const grid = document.createElement('div');
    grid.className = 'board-grid';
    grid.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
    cellEls = [];
    for (let r = 0; r < SIZE; r++) {
      const row = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell reversi-cell';
        cell.addEventListener('click', () => onCellClick(r, c));
        grid.appendChild(cell);
        row.push(cell);
      }
      cellEls.push(row);
    }
    container.appendChild(grid);
  }

  function reset() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    const mid = SIZE / 2;
    board[mid - 1][mid - 1] = AI; board[mid - 1][mid] = PLAYER;
    board[mid][mid - 1] = PLAYER; board[mid][mid] = AI;
    turn = PLAYER; gameOver = false; awarded = false; lastMove = null;
    setStatus('');
    setPointsMsg('당신은 흑(선공), AI는 백입니다. 더 많은 돌을 가진 쪽이 승리합니다.');
    setTurnUI();
    if (cellEls) renderBoard();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="rv-turn-p" class="game-turn-pill">⚫ 당신</span>
        <span id="rv-turn-a" class="game-turn-pill">⚪ AI</span>
      </div>
      <div id="rv-board-wrap"></div>
      <div id="rv-result" class="game-result-msg"></div>
      <div id="rv-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="rv-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('rv-board-wrap'));
    document.getElementById('rv-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.ReversiGame = { start };
})(window);

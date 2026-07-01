/* ============================================================
   ICOC OMNIPO — 체커 (Checkers) vs AI
   8x8 보드, 표준 룰: 대각선 이동, 점프 포획(강제 포획 적용), 끝줄 도달시 킹 승급
   ============================================================ */

(function (global) {
  const SIZE = 8;
  const EMPTY = 0, PLAYER = 1, AI = 2, PLAYER_K = 3, AI_K = 4; // PLAYER는 아래(행7)에서 시작, 위(행0)로 진행
  const PLAYER_SET = new Set([PLAYER, PLAYER_K]);
  const AI_SET = new Set([AI, AI_K]);

  let board, turn, gameOver, cellEls, awarded, lastMove, mustContinueFrom;

  function inB(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function isPlayerPiece(p) { return PLAYER_SET.has(p); }
  function isAiPiece(p) { return AI_SET.has(p); }
  function isKing(p) { return p === PLAYER_K || p === AI_K; }
  function ownerSet(p) { return isPlayerPiece(p) ? PLAYER_SET : AI_SET; }

  function cloneBoard(b) { return b.map(row => row.slice()); }

  function forwardDirs(p) {
    if (p === PLAYER) return [[-1, -1], [-1, 1]];
    if (p === AI) return [[1, -1], [1, 1]];
    return [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // king
  }

  // 단순 이동(점프 아님) 목록
  function simpleMoves(b, r, c) {
    const p = b[r][c];
    if (p === EMPTY) return [];
    const moves = [];
    for (const [dr, dc] of forwardDirs(p)) {
      const nr = r + dr, nc = c + dc;
      if (inB(nr, nc) && b[nr][nc] === EMPTY) moves.push({ from: [r, c], to: [nr, nc], captures: [] });
    }
    return moves;
  }

  // 점프(포획) 목록 — 연속 점프까지 재귀적으로 모두 탐색
  function jumpMoves(b, r, c, capturedSoFar = []) {
    const p = b[r][c];
    if (p === EMPTY) return [];
    const enemySet = isPlayerPiece(p) ? AI_SET : PLAYER_SET;
    const results = [];
    for (const [dr, dc] of forwardDirs(p)) {
      const mr = r + dr, mc = c + dc; // 잡히는 칸
      const lr = r + dr * 2, lc = c + dc * 2; // 착지 칸
      if (!inB(lr, lc) || b[lr][lc] !== EMPTY) continue;
      if (!inB(mr, mc) || !enemySet.has(b[mr][mc])) continue;
      const alreadyCaptured = capturedSoFar.some(([cr, cc]) => cr === mr && cc === mc);
      if (alreadyCaptured) continue;

      const newCaptured = capturedSoFar.concat([[mr, mc]]);
      const sim = cloneBoard(b);
      sim[r][c] = EMPTY; sim[mr][mc] = EMPTY; sim[lr][lc] = p;
      const promoted = maybePromote(sim, lr, lc, p);
      const further = jumpMoves(sim, lr, lc, newCaptured);
      if (further.length > 0) {
        for (const f of further) results.push(f);
      } else {
        results.push({ from: [r, c], to: [lr, lc], captures: newCaptured, finalPiece: promoted });
      }
    }
    return results;
  }

  function maybePromote(b, r, c, p) {
    if (p === PLAYER && r === 0) { b[r][c] = PLAYER_K; return PLAYER_K; }
    if (p === AI && r === SIZE - 1) { b[r][c] = AI_K; return AI_K; }
    return p;
  }

  // 한 플레이어의 전체 합법 이동 — 포획 가능한 수가 있으면 "강제 포획" 룰에 따라 포획 이동만 반환
  function allMovesFor(b, owner) {
    const set = owner === PLAYER ? PLAYER_SET : AI_SET;
    let jumps = [];
    let simples = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (!set.has(b[r][c])) continue;
      const js = jumpMoves(b, r, c);
      if (js.length) jumps = jumps.concat(js);
      else simples = simples.concat(simpleMoves(b, r, c));
    }
    return jumps.length > 0 ? jumps : simples;
  }

  function applyMove(b, move) {
    const [fr, fc] = move.from, [tr, tc] = move.to;
    const p = b[fr][fc];
    b[fr][fc] = EMPTY;
    for (const [cr, cc] of move.captures) b[cr][cc] = EMPTY;
    b[tr][tc] = p;
    maybePromote(b, tr, tc, p);
  }

  function countPieces(b) {
    let p = 0, a = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      if (isPlayerPiece(b[r][c])) p++; else if (isAiPiece(b[r][c])) a++;
    }
    return { p, a };
  }

  // ── AI: 미니맥스(2-ply) + 기본 평가 ──
  function evaluate(b) {
    let score = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const p = b[r][c];
      if (p === EMPTY) continue;
      let val = (p === AI || p === PLAYER) ? 100 : 160; // 킹 가중치
      if (isAiPiece(p)) score += val; else score -= val;
    }
    return score;
  }

  function minimax(b, depth, maximizing) {
    const owner = maximizing ? AI : PLAYER;
    const moves = allMovesFor(b, owner);
    if (depth === 0 || moves.length === 0) {
      if (moves.length === 0) return maximizing ? -9999 : 9999;
      return evaluate(b);
    }
    let best = maximizing ? -Infinity : Infinity;
    for (const m of moves) {
      const sim = cloneBoard(b);
      applyMove(sim, m);
      const val = minimax(sim, depth - 1, !maximizing);
      best = maximizing ? Math.max(best, val) : Math.min(best, val);
    }
    return best;
  }

  function aiPickMove() {
    const moves = allMovesFor(board, AI);
    if (moves.length === 0) return null;
    let best = -Infinity, bestMoves = [];
    for (const m of moves) {
      const sim = cloneBoard(board);
      applyMove(sim, m);
      const val = minimax(sim, 2, false) + Math.random() * 4;
      if (val > best + 0.001) { best = val; bestMoves = [m]; }
      else if (Math.abs(val - best) < 4) bestMoves.push(m);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ── UI ──
  function setTurnUI() {
    const pPill = document.getElementById('ck-turn-p');
    const aPill = document.getElementById('ck-turn-a');
    if (!pPill) return;
    const { p, a } = countPieces(board);
    pPill.classList.toggle('active', turn === PLAYER && !gameOver);
    aPill.classList.toggle('active', turn === AI && !gameOver);
    pPill.textContent = `⚪ 당신 · ${p}개`;
    aPill.textContent = `⚫ AI · ${a}개`;
  }
  function setStatus(msg) { const el = document.getElementById('ck-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('ck-points-msg'); if (el) el.textContent = msg || ''; }

  function renderBoard() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const cell = cellEls[r][c];
      cell.innerHTML = '';
      cell.classList.remove('chess-selected', 'chess-target', 'chess-last');
      const p = board[r][c];
      if (p !== EMPTY) {
        const disc = document.createElement('div');
        disc.className = 'stone ' + (isPlayerPiece(p) ? 'white' : 'black');
        if (isKing(p)) {
          const crown = document.createElement('span');
          crown.className = 'checker-king';
          crown.textContent = '♛';
          disc.appendChild(crown);
        }
        cell.appendChild(disc);
      }
    }
    if (selectedCell) cellEls[selectedCell[0]][selectedCell[1]].classList.add('chess-selected');
    if (selectedTargets) selectedTargets.forEach(m => cellEls[m.to[0]][m.to[1]].classList.add('chess-target'));
    if (lastMove) {
      cellEls[lastMove.from[0]][lastMove.from[1]].classList.add('chess-last');
      cellEls[lastMove.to[0]][lastMove.to[1]].classList.add('chess-last');
    }
  }

  let selectedCell = null, selectedTargets = null;

  function endGame(result) {
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 승리했습니다! AI가 더 이상 움직일 수 없습니다.'); pts = 30; }
    else { setStatus('AI가 승리했습니다.'); pts = 10; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'checkers_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function doAiTurn() {
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const mv = aiPickMove();
      if (!mv) { endGame('win'); return; }
      applyMove(board, mv);
      lastMove = mv;
      renderBoard();
      turn = PLAYER;
      setStatus('');
      setTurnUI();
      if (allMovesFor(board, PLAYER).length === 0) endGame('lose');
    }, 450);
  }

  function onCellClick(r, c) {
    if (window.ICOC_ONLINE?.active) {
      if (!ICOC_ONLINE.isMyTurn || gameOver) return;
      window._goingOnline = true;
    }
    if (gameOver || turn !== PLAYER) return;
    const allMoves = allMovesFor(board, PLAYER);
    const piece = board[r][c];

    if (selectedCell) {
      const move = selectedTargets.find(m => m.to[0] === r && m.to[1] === c);
      if (move) {
        applyMove(board, move);
        lastMove = move;
        selectedCell = null; selectedTargets = null;
        renderBoard();
        turn = AI;
        setTurnUI();
        if (allMovesFor(board, AI).length === 0) { endGame('win'); return; }
        
    if (window._goingOnline) { ICOC_ONLINE.sendMove({r,c}); ICOC_ONLINE.showTurnIndicator(false); window._goingOnline=false; return; }
    doAiTurn();
        return;
      }
      if (isPlayerPiece(piece)) {
        const targets = allMoves.filter(m => m.from[0] === r && m.from[1] === c);
        if (targets.length === 0) { global.ICOC_POINTS.showToast('이 말은 지금 움직일 수 없습니다 (포획이 가능하면 포획해야 합니다).'); return; }
        selectedCell = [r, c]; selectedTargets = targets;
        renderBoard();
        return;
      }
      selectedCell = null; selectedTargets = null;
      renderBoard();
      return;
    }

    if (isPlayerPiece(piece)) {
      const targets = allMoves.filter(m => m.from[0] === r && m.from[1] === c);
      if (targets.length === 0) {
        const anyCapture = allMoves.some(m => m.captures.length > 0);
        global.ICOC_POINTS.showToast(anyCapture ? '포획이 가능한 다른 말로 두어야 합니다 (강제 포획 규칙).' : '이 말은 지금 움직일 수 없습니다.');
        return;
      }
      selectedCell = [r, c]; selectedTargets = targets;
      renderBoard();
    }
  }

  function buildBoardDOM(container) {
    const grid = document.createElement('div');
    grid.className = 'board-grid checkers-grid';
    grid.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
    cellEls = [];
    for (let r = 0; r < SIZE; r++) {
      const row = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell chess-cell ' + (((r + c) % 2 === 0) ? 'chess-light' : 'chess-dark');
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
    for (let r = 0; r < 3; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) board[r][c] = AI;
    for (let r = 5; r < 8; r++) for (let c = 0; c < SIZE; c++) if ((r + c) % 2 === 1) board[r][c] = PLAYER;
    turn = PLAYER; gameOver = false; awarded = false; lastMove = null;
    selectedCell = null; selectedTargets = null;
    setStatus('');
    setPointsMsg('당신(흰색)이 선공입니다. 점프로 상대 말을 포획할 수 있을 때는 반드시 포획해야 합니다(강제 포획).');
    setTurnUI();
    if (cellEls) renderBoard();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="ck-turn-p" class="game-turn-pill">⚪ 당신</span>
        <span id="ck-turn-a" class="game-turn-pill">⚫ AI</span>
      </div>
      <div id="ck-board-wrap"></div>
      <div id="ck-result" class="game-result-msg"></div>
      <div id="ck-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="ck-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('ck-board-wrap'));
    document.getElementById('ck-restart-btn').addEventListener('click', reset);
    reset();
  }

  
  function applyOpponentMove(payload) {
    if (!payload || gameOver) return;
    window._goingOnline = false;
    onCellClick(payload.r, payload.c);
    window.ICOC_ONLINE?.showTurnIndicator(true);
  }
  global.CheckersGame = { start, applyOpponentMove };
})(window);

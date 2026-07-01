/* ============================================================
   ICOC OMNIPO — 장기 (Janggi) vs AI
   보드: 10행 x 9열의 교차점(交叉點)에 기물을 놓는 방식.
   규칙: 차/포(직선+포는 반드시 한 기물을 넘어야 함), 마(직선1+대각선1, 멱 막히면 불가),
   상(직선1+대각선2, 경로 막히면 불가), 사/궁(궁성 내 1칸), 병/졸(전진+좌우, 적궁성에선 대각선도).
   (단순화: 마상 배치 선택은 생략하고 표준 배치 고정, 빅장/장군 선언 등 일부 규칙 단순화)
   ============================================================ */

(function (global) {
  const ROWS = 10, COLS = 9;
  const PLAYER = 'red', AI = 'blue';

  const PALACE_DIAG = {
    '0,3': [[1,1]], '0,5': [[1,-1]], '2,3': [[-1,1]], '2,5': [[-1,-1]],
    '1,4': [[-1,-1],[-1,1],[1,-1],[1,1]],
    '7,3': [[1,1]], '7,5': [[1,-1]], '9,3': [[-1,1]], '9,5': [[-1,-1]],
    '8,4': [[-1,-1],[-1,1],[1,-1],[1,1]],
  };
  function diagAt(r, c) { return PALACE_DIAG[r + ',' + c] || []; }
  function inPalace(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS && (r <= 2 || r >= 7) && c >= 3 && c <= 5; }
  function inBoard(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }
  function opp(color) { return color === 'red' ? 'blue' : 'red'; }

  function initBoard() {
    const b = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    const backRow = ['cha', 'ma', 'sang', 'sa', null, 'sa', 'sang', 'ma', 'cha'];
    backRow.forEach((t, c) => { if (t) { b[0][c] = { type: t, color: 'blue' }; b[9][c] = { type: t, color: 'red' }; } });
    b[1][4] = { type: 'gung', color: 'blue' };
    b[8][4] = { type: 'gung', color: 'red' };
    b[2][1] = { type: 'po', color: 'blue' }; b[2][7] = { type: 'po', color: 'blue' };
    b[7][1] = { type: 'po', color: 'red' }; b[7][7] = { type: 'po', color: 'red' };
    [0, 2, 4, 6, 8].forEach(c => { b[3][c] = { type: 'jol', color: 'blue' }; b[6][c] = { type: 'jol', color: 'red' }; });
    return b;
  }

  function cloneBoard(b) { return b.map(row => row.map(cell => cell ? { ...cell } : null)); }

  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function lineMoves(b, r, c, color, isCannon) {
    const moves = [];
    const dirs = ORTHO.concat(diagAt(r, c));
    dirs.forEach(([dr, dc]) => {
      let cr = r + dr, cc = c + dc;
      if (!isCannon) {
        while (inBoard(cr, cc)) {
          const cell = b[cr][cc];
          if (!cell) moves.push([cr, cc]);
          else { if (cell.color !== color) moves.push([cr, cc]); break; }
          cr += dr; cc += dc;
        }
      } else {
        let screenFound = false;
        while (inBoard(cr, cc)) {
          const cell = b[cr][cc];
          if (!screenFound) {
            if (cell) { if (cell.type === 'po') break; screenFound = true; }
          } else {
            if (!cell) moves.push([cr, cc]);
            else { if (cell.type !== 'po' && cell.color !== color) moves.push([cr, cc]); break; }
          }
          cr += dr; cc += dc;
        }
      }
    });
    return moves;
  }

  const MA_PATHS = [
    [[-1, 0], [-2, -1]], [[-1, 0], [-2, 1]], [[1, 0], [2, -1]], [[1, 0], [2, 1]],
    [[0, -1], [-1, -2]], [[0, -1], [1, -2]], [[0, 1], [-1, 2]], [[0, 1], [1, 2]],
  ];
  function horseMoves(b, r, c, color) {
    const out = [];
    MA_PATHS.forEach(([leg, final]) => {
      const lr = r + leg[0], lc = c + leg[1];
      if (!inBoard(lr, lc) || b[lr][lc]) return;
      const fr = r + final[0], fc = c + final[1];
      if (!inBoard(fr, fc)) return;
      const cell = b[fr][fc];
      if (!cell || cell.color !== color) out.push([fr, fc]);
    });
    return out;
  }

  const SANG_PATHS = [
    [[-1, 0], [-2, -1], [-3, -2]], [[-1, 0], [-2, 1], [-3, 2]],
    [[1, 0], [2, -1], [3, -2]], [[1, 0], [2, 1], [3, 2]],
    [[0, -1], [-1, -2], [-2, -3]], [[0, -1], [1, -2], [2, -3]],
    [[0, 1], [-1, 2], [-2, 3]], [[0, 1], [1, 2], [2, 3]],
  ];
  function sangMoves(b, r, c, color) {
    const out = [];
    SANG_PATHS.forEach(path => {
      let blocked = false;
      for (let i = 0; i < path.length; i++) {
        const [dr, dc] = path[i];
        const rr = r + dr, cc = c + dc;
        if (!inBoard(rr, cc)) { blocked = true; break; }
        const cell = b[rr][cc];
        if (i < path.length - 1) { if (cell) { blocked = true; break; } }
        else if (cell && cell.color === color) blocked = true;
      }
      if (!blocked) { const [dr, dc] = path[path.length - 1]; out.push([r + dr, c + dc]); }
    });
    return out;
  }

  function guardKingMoves(b, r, c, color) {
    const out = [];
    ORTHO.forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc; if (inPalace(rr, cc)) { const cell = b[rr][cc]; if (!cell || cell.color !== color) out.push([rr, cc]); } });
    diagAt(r, c).forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc; if (inPalace(rr, cc)) { const cell = b[rr][cc]; if (!cell || cell.color !== color) out.push([rr, cc]); } });
    return out;
  }

  function soldierMoves(b, r, c, color) {
    const fwd = color === 'red' ? -1 : 1;
    const dirs = [[fwd, 0], [0, -1], [0, 1]];
    const out = [];
    dirs.forEach(([dr, dc]) => { const rr = r + dr, cc = c + dc; if (inBoard(rr, cc)) { const cell = b[rr][cc]; if (!cell || cell.color !== color) out.push([rr, cc]); } });
    diagAt(r, c).forEach(([dr, dc]) => {
      const rr = r + dr, cc = c + dc;
      if (!inBoard(rr, cc)) return;
      const cell = b[rr][cc];
      if (!cell || cell.color !== color) out.push([rr, cc]);
    });
    return out;
  }

  function pieceMoves(b, r, c) {
    const piece = b[r][c];
    if (!piece) return [];
    switch (piece.type) {
      case 'cha': return lineMoves(b, r, c, piece.color, false);
      case 'po': return lineMoves(b, r, c, piece.color, true);
      case 'ma': return horseMoves(b, r, c, piece.color);
      case 'sang': return sangMoves(b, r, c, piece.color);
      case 'sa': case 'gung': return guardKingMoves(b, r, c, piece.color);
      case 'jol': return soldierMoves(b, r, c, piece.color);
    }
    return [];
  }

  function findKing(b, color) {
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (b[r][c] && b[r][c].type === 'gung' && b[r][c].color === color) return [r, c];
    return null;
  }
  function isAttacked(b, r, c, byColor) {
    for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
      const p = b[rr][cc];
      if (p && p.color === byColor && pieceMoves(b, rr, cc).some(([mr, mc]) => mr === r && mc === c)) return true;
    }
    return false;
  }
  function inCheck(b, color) {
    const k = findKing(b, color);
    if (!k) return false;
    return isAttacked(b, k[0], k[1], opp(color));
  }
  function legalMovesForColor(b, color) {
    const all = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = b[r][c];
      if (p && p.color === color) {
        pieceMoves(b, r, c).forEach(([tr, tc]) => {
          const nb = cloneBoard(b);
          nb[tr][tc] = nb[r][c]; nb[r][c] = null;
          if (!inCheck(nb, color)) all.push({ from: [r, c], to: [tr, tc] });
        });
      }
    }
    return all;
  }
  function legalMovesForSquare(b, r, c, color) {
    return legalMovesForColor(b, color).filter(m => m.from[0] === r && m.from[1] === c);
  }

  // ── AI ──
  const PIECE_VALUE = { cha: 13, ma: 5, sang: 3, po: 7, sa: 3, jol: 2, gung: 0 };
  function evaluate(b) {
    let score = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = b[r][c]; if (!p) continue;
      score += (p.color === AI ? 1 : -1) * PIECE_VALUE[p.type];
    }
    return score;
  }
  function minimax(b, depth, alpha, beta, maximizing, turnColor) {
    const moves = legalMovesForColor(b, turnColor);
    if (moves.length === 0) return maximizing ? -100000 - depth : 100000 + depth;
    if (depth === 0) return evaluate(b);
    let best = maximizing ? -Infinity : Infinity;
    for (const m of moves) {
      const nb = cloneBoard(b);
      nb[m.to[0]][m.to[1]] = nb[m.from[0]][m.from[1]];
      nb[m.from[0]][m.from[1]] = null;
      const val = minimax(nb, depth - 1, alpha, beta, !maximizing, opp(turnColor));
      if (maximizing) { best = Math.max(best, val); alpha = Math.max(alpha, val); }
      else { best = Math.min(best, val); beta = Math.min(beta, val); }
      if (alpha >= beta) break;
    }
    return best;
  }
  function aiPickMove() {
    const moves = legalMovesForColor(board, AI);
    if (moves.length === 0) return null;
    let best = -Infinity, bestMoves = [];
    moves.forEach(m => {
      const nb = cloneBoard(board);
      nb[m.to[0]][m.to[1]] = nb[m.from[0]][m.from[1]];
      nb[m.from[0]][m.from[1]] = null;
      const val = minimax(nb, 2, -Infinity, Infinity, false, PLAYER) + Math.random() * 1.5;
      if (val > best + 0.001) { best = val; bestMoves = [m]; }
      else if (Math.abs(val - best) < 1.5) bestMoves.push(m);
    });
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ── 게임 상태/UI ──
  let board, turn, gameOver, awarded, boardUI, selected, legalForSelected;

  const LABEL = { cha: '차', ma: '마', sang: '상', po: '포', sa: '사' };
  function pieceLabel(p) {
    if (p.type === 'gung') return p.color === 'red' ? '한' : '초';
    if (p.type === 'jol') return p.color === 'red' ? '병' : '졸';
    return LABEL[p.type];
  }

  function setStatus(msg) { const el = document.getElementById('jg-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('jg-points-msg'); if (el) el.textContent = msg || ''; }
  function setTurnUI() {
    const rEl = document.getElementById('jg-turn-red'), bEl = document.getElementById('jg-turn-blue');
    if (rEl) rEl.classList.toggle('active', turn === PLAYER && !gameOver);
    if (bEl) bEl.classList.toggle('active', turn === AI && !gameOver);
  }

  function renderBoard() {
    boardUI.clearAll();
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const p = board[r][c];
      const slot = boardUI.cellEls[r][c];
      slot.classList.remove('jg-selected', 'jg-legal', 'jg-legal-capture');
      if (p) {
        const el = boardUI.placeStone(r, c, p.color === 'red' ? 'jg-piece jg-red' : 'jg-piece jg-blue');
        el.textContent = pieceLabel(p);
      }
    }
    if (selected) {
      boardUI.cellEls[selected[0]][selected[1]].classList.add('jg-selected');
      legalForSelected.forEach(m => {
        const [tr, tc] = m.to;
        boardUI.cellEls[tr][tc].classList.add(board[tr][tc] ? 'jg-legal-capture' : 'jg-legal');
      });
    }
  }

  function checkGameEndAfter(movedColor) {
    const nextColor = opp(movedColor);
    const nextMoves = legalMovesForColor(board, nextColor);
    if (nextMoves.length === 0) {
      endGame(movedColor === PLAYER ? 'win' : 'lose');
      return true;
    }
    return false;
  }

  function doMove(m) {
    board[m.to[0]][m.to[1]] = board[m.from[0]][m.from[1]];
    board[m.from[0]][m.from[1]] = null;
    selected = null; legalForSelected = [];
  }

  function doAiTurn() {
    if (gameOver) return;
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const m = aiPickMove();
      if (!m) { endGame('win'); return; }
      doMove(m);
      renderBoard();
      if (checkGameEndAfter(AI)) return;
      const inCk = inCheck(board, PLAYER);
      setStatus(inCk ? '⚔️ 장군! 당신의 궁이 위협받고 있습니다.' : '');
      turn = PLAYER;
      setTurnUI();
    }, 450);
  }

  function onCellClick(r, c) {
    if(global.ICOC_SFX)global.ICOC_SFX.piece();
    if (turn !== PLAYER || gameOver) return;
    const p = board[r][c];
    if (selected) {
      const move = legalForSelected.find(m => m.to[0] === r && m.to[1] === c);
      if (move) {
        doMove(move);
        renderBoard();
        if (checkGameEndAfter(PLAYER)) return;
        const inCk = inCheck(board, AI);
        setStatus(inCk ? '⚔️ 장군! AI의 궁을 위협하고 있습니다.' : '');
        turn = AI;
        setTurnUI();
        doAiTurn();
        return;
      }
      if (p && p.color === PLAYER) {
        selected = [r, c];
        legalForSelected = legalMovesForSquare(board, r, c, PLAYER);
      } else {
        selected = null; legalForSelected = [];
      }
      renderBoard();
      return;
    }
    if (p && p.color === PLAYER) {
      selected = [r, c];
      legalForSelected = legalMovesForSquare(board, r, c, PLAYER);
      renderBoard();
    }
  }

  function endGame(result) {
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 외통! AI의 궁이 더 이상 움직일 수 없습니다. 승리!'); pts = 30; }
    else { setStatus('😵 외통에 걸렸습니다. 당신의 궁이 더 이상 움직일 수 없습니다. 패배입니다.'); pts = 15; }
    if (!awarded) {
      awarded = true;
      const res = window.ICOC_POINTS.addPoints(pts, 'janggi_' + result);
      setPointsMsg(res.capped
        ? `+${res.added}P 적립 (오늘 획득 한도 도달, 보유 ${res.total.toLocaleString()}P)`
        : `+${res.added}P 적립 · 보유 ${res.total.toLocaleString()}P`);
      window.ICOC_POINTS.showToast(`+${res.added}P 적립되었습니다.`);
    }
  }

  function buildBoardDOM(container) {
    const diagLines = [
      [0, 3, 1, 4], [1, 4, 2, 5], [0, 5, 1, 4], [1, 4, 2, 3],
      [7, 3, 8, 4], [8, 4, 9, 5], [7, 5, 8, 4], [8, 4, 9, 3],
    ];
    boardUI = global.BoardUI.createGoban(container, ROWS, COLS, {
      onIntersectionClick: onCellClick,
      extraLines: diagLines,
    });
  }

  function reset() {
    board = initBoard();
    turn = PLAYER;
    gameOver = false;
    awarded = false;
    selected = null; legalForSelected = [];
    setStatus('');
    setPointsMsg('상대 궁을 외통(체크메이트)시키면 승리합니다. 기물을 눌러 이동할 곳을 확인하세요.');
    setTurnUI();
    renderBoard();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="jg-turn-blue" class="game-turn-pill">🔵 AI (초)</span>
        <span id="jg-turn-red" class="game-turn-pill">🔴 당신 (한)</span>
      </div>
      <div id="jg-board-wrap"></div>
      <div id="jg-result" class="game-result-msg"></div>
      <div id="jg-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="jg-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('jg-board-wrap'));
    document.getElementById('jg-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.JanggiGame = { start };
})(window);

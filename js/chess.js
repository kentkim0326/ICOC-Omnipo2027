/* ============================================================
   ICOC OMNIPO — 체스 (Chess) vs AI
   8x8 보드, 표준 룰: 캐슬링, 앙파상, 폰 승급(자동 퀸 승급)
   체크/체크메이트/스테일메이트 판정 + 미니맥스(알파베타) AI
   ============================================================ */

(function (global) {
  const SIZE = 8;
  const PLAYER = 'w', AI = 'b'; // 플레이어 = 백(선공), AI = 흑

  const PIECE_GLYPH = {
    w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
    b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' }
  };
  const PIECE_VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

  // 기물별 위치 가치표(흑 기준 대칭) — 매우 단순화된 PST
  const PST_PAWN = [
    [0,0,0,0,0,0,0,0],
    [50,50,50,50,50,50,50,50],
    [10,10,20,30,30,20,10,10],
    [5,5,10,25,25,10,5,5],
    [0,0,0,20,20,0,0,0],
    [5,-5,-10,0,0,-10,-5,5],
    [5,10,10,-20,-20,10,10,5],
    [0,0,0,0,0,0,0,0]
  ];
  const PST_KNIGHT = [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,0,0,0,0,-20,-40],
    [-30,0,10,15,15,10,0,-30],
    [-30,5,15,20,20,15,5,-30],
    [-30,0,15,20,20,15,0,-30],
    [-30,5,10,15,15,10,5,-30],
    [-40,-20,0,5,5,0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50]
  ];
  const PST_CENTER = [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,0,0,0,0,0,0,-10],
    [-10,0,5,5,5,5,0,-10],
    [-10,0,5,10,10,5,0,-10],
    [-10,0,5,10,10,5,0,-10],
    [-10,0,5,5,5,5,0,-10],
    [-10,0,0,0,0,0,0,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20]
  ];

  let board, turn, gameOver, selected, legalTargets, lastMove, awarded;
  let castleRights, enPassantTarget, history, boardUI;

  function initBoard() {
    const b = Array.from({ length: 8 }, () => Array(8).fill(null));
    const back = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
    for (let c = 0; c < 8; c++) {
      b[0][c] = { type: back[c], color: AI };
      b[1][c] = { type: 'p', color: AI };
      b[6][c] = { type: 'p', color: PLAYER };
      b[7][c] = { type: back[c], color: PLAYER };
    }
    return b;
  }

  function inB(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }
  function opp(color) { return color === 'w' ? 'b' : 'w'; }
  function cloneBoard(b) { return b.map(row => row.map(cell => cell ? { ...cell } : null)); }

  // ── 슬라이딩/점프 기물 이동 생성 (체크 여부는 별도 필터링) ──
  function pieceMoves(b, r, c, enPassant) {
    const piece = b[r][c];
    if (!piece) return [];
    const moves = [];
    const color = piece.color;
    const add = (rr, cc, flag) => { if (inB(rr, cc)) moves.push({ from: [r, c], to: [rr, cc], flag }); };

    if (piece.type === 'p') {
      const dir = color === PLAYER ? -1 : 1;
      const startRow = color === PLAYER ? 6 : 1;
      const promoRow = color === PLAYER ? 0 : 7;
      if (inB(r + dir, c) && !b[r + dir][c]) {
        add(r + dir, c, (r + dir === promoRow) ? 'promo' : null);
        if (r === startRow && !b[r + 2 * dir][c]) add(r + 2 * dir, c, 'double');
      }
      for (const dc of [-1, 1]) {
        const nr = r + dir, nc = c + dc;
        if (inB(nr, nc)) {
          if (b[nr][nc] && b[nr][nc].color !== color) add(nr, nc, (nr === promoRow) ? 'promo' : null);
          else if (enPassant && enPassant[0] === nr && enPassant[1] === nc) add(nr, nc, 'enpassant');
        }
      }
    } else if (piece.type === 'n') {
      const deltas = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of deltas) {
        const nr = r + dr, nc = c + dc;
        if (inB(nr, nc) && (!b[nr][nc] || b[nr][nc].color !== color)) add(nr, nc);
      }
    } else if (piece.type === 'k') {
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (inB(nr, nc) && (!b[nr][nc] || b[nr][nc].color !== color)) add(nr, nc);
      }
    } else {
      const dirs = piece.type === 'b' ? [[-1,-1],[-1,1],[1,-1],[1,1]]
                 : piece.type === 'r' ? [[-1,0],[1,0],[0,-1],[0,1]]
                 : [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]; // queen
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (inB(nr, nc)) {
          if (!b[nr][nc]) { add(nr, nc); }
          else { if (b[nr][nc].color !== color) add(nr, nc); break; }
          nr += dr; nc += dc;
        }
      }
    }
    return moves;
  }

  function findKing(b, color) {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (b[r][c] && b[r][c].type === 'k' && b[r][c].color === color) return [r, c];
    return null;
  }

  function isSquareAttacked(b, r, c, byColor) {
    for (let rr = 0; rr < 8; rr++) for (let cc = 0; cc < 8; cc++) {
      const p = b[rr][cc];
      if (p && p.color === byColor) {
        const mvs = pieceMoves(b, rr, cc, null);
        if (mvs.some(m => m.to[0] === r && m.to[1] === c)) return true;
      }
    }
    return false;
  }

  function inCheck(b, color) {
    const k = findKing(b, color);
    return k ? isSquareAttacked(b, k[0], k[1], opp(color)) : false;
  }

  function applyMove(b, move, rights, ep) {
    const [fr, fc] = move.from, [tr, tc] = move.to;
    const piece = b[fr][fc];
    const isCapture = b[tr][tc] !== null || move.flag === 'enpassant';
    const newRights = { ...rights };
    let newEp = null;

    if (move.flag === 'enpassant') {
      b[fr][tc] = null; // 잡힌 폰 제거 (가로 방향, 같은 행)
    }
    b[tr][tc] = { ...piece };
    b[fr][fc] = null;

    if (move.flag === 'promo') b[tr][tc].type = 'q';
    if (move.flag === 'double') newEp = [(fr + tr) / 2, fc];

    if (move.flag === 'castle-k') { b[tr][tc - 1] = b[tr][7]; b[tr][7] = null; }
    if (move.flag === 'castle-q') { b[tr][tc + 1] = b[tr][0]; b[tr][0] = null; }

    if (piece.type === 'k') { newRights[piece.color].k = false; newRights[piece.color].q = false; }
    if (piece.type === 'r') {
      if (fc === 0) newRights[piece.color].q = false;
      if (fc === 7) newRights[piece.color].k = false;
    }
    return { rights: newRights, ep: newEp };
  }

  function addCastleMoves(b, color, rights, moves) {
    const row = color === PLAYER ? 7 : 0;
    const king = b[row][4];
    if (!king || king.type !== 'k') return;
    if (inCheck(b, color)) return;
    const enemy = opp(color);
    if (rights[color].k && !b[row][5] && !b[row][6] && b[row][7] && b[row][7].type === 'r') {
      if (!isSquareAttacked(b, row, 4, enemy) && !isSquareAttacked(b, row, 5, enemy) && !isSquareAttacked(b, row, 6, enemy)) {
        moves.push({ from: [row, 4], to: [row, 6], flag: 'castle-k' });
      }
    }
    if (rights[color].q && !b[row][1] && !b[row][2] && !b[row][3] && b[row][0] && b[row][0].type === 'r') {
      if (!isSquareAttacked(b, row, 4, enemy) && !isSquareAttacked(b, row, 3, enemy) && !isSquareAttacked(b, row, 2, enemy)) {
        moves.push({ from: [row, 4], to: [row, 2], flag: 'castle-q' });
      }
    }
  }

  function legalMovesForColor(b, color, rights, ep) {
    let moves = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if (b[r][c] && b[r][c].color === color) moves = moves.concat(pieceMoves(b, r, c, ep));
    }
    addCastleMoves(b, color, rights, moves);
    // 자신의 킹이 체크에 걸리는 수는 제외
    return moves.filter(m => {
      const sim = cloneBoard(b);
      applyMove(sim, m, rights, ep);
      return !inCheck(sim, color);
    });
  }

  function legalMovesForSquare(r, c) {
    if (!board[r][c] || board[r][c].color !== turn) return [];
    return legalMovesForColor(board, turn, castleRights, enPassantTarget).filter(m => m.from[0] === r && m.from[1] === c);
  }

  // ── 평가 함수 ──
  function evaluate(b) {
    let score = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = b[r][c];
      if (!p) continue;
      let val = PIECE_VALUE[p.type];
      let pst = 0;
      const rr = p.color === AI ? r : 7 - r; // 백 관점으로 뒤집어서 동일 테이블 사용
      if (p.type === 'p') pst = PST_PAWN[rr][c];
      else if (p.type === 'n') pst = PST_KNIGHT[rr][c];
      else if (p.type === 'b' || p.type === 'q') pst = PST_CENTER[rr][c];
      val += pst;
      score += p.color === AI ? val : -val;
    }
    return score; // 양수 = AI(흑) 유리
  }

  function minimax(b, depth, alpha, beta, maximizing, rights, ep) {
    const color = maximizing ? AI : PLAYER;
    const moves = legalMovesForColor(b, color, rights, ep);
    if (depth === 0 || moves.length === 0) {
      if (moves.length === 0) {
        if (inCheck(b, color)) return maximizing ? -100000 - depth : 100000 + depth;
        return 0; // 스테일메이트
      }
      return evaluate(b);
    }
    if (maximizing) {
      let best = -Infinity;
      for (const m of moves) {
        const sim = cloneBoard(b);
        const { rights: r2, ep: ep2 } = applyMove(sim, m, rights, ep);
        const val = minimax(sim, depth - 1, alpha, beta, false, r2, ep2);
        best = Math.max(best, val);
        alpha = Math.max(alpha, val);
        if (alpha >= beta) break;
      }
      return best;
    } else {
      let best = Infinity;
      for (const m of moves) {
        const sim = cloneBoard(b);
        const { rights: r2, ep: ep2 } = applyMove(sim, m, rights, ep);
        const val = minimax(sim, depth - 1, alpha, beta, true, r2, ep2);
        best = Math.min(best, val);
        beta = Math.min(beta, val);
        if (alpha >= beta) break;
      }
      return best;
    }
  }

  function aiPickMove() {
    const moves = legalMovesForColor(board, AI, castleRights, enPassantTarget);
    if (moves.length === 0) return null;
    let best = -Infinity, bestMoves = [];
    const DEPTH = 2; // 성능을 위해 2수 깊이(상대 응수까지 고려) + 약간의 무작위성
    for (const m of moves) {
      const sim = cloneBoard(board);
      const { rights: r2, ep: ep2 } = applyMove(sim, m, castleRights, enPassantTarget);
      const val = minimax(sim, DEPTH, -Infinity, Infinity, false, r2, ep2) + Math.random() * 6;
      if (val > best + 0.001) { best = val; bestMoves = [m]; }
      else if (Math.abs(val - best) < 6) bestMoves.push(m);
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ── UI ──
  function setTurnUI() {
    const wPill = document.getElementById('chess-turn-w');
    const bPill = document.getElementById('chess-turn-b');
    if (!wPill) return;
    wPill.classList.toggle('active', turn === PLAYER && !gameOver);
    bPill.classList.toggle('active', turn === AI && !gameOver);
  }
  function setStatus(msg) { const el = document.getElementById('chess-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('chess-points-msg'); if (el) el.textContent = msg || ''; }

  function renderBoard() {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const cell = boardUI.cellEls[r][c];
      cell.innerHTML = '';
      cell.classList.remove('chess-selected', 'chess-target', 'chess-last');
      const p = board[r][c];
      if (p) {
        const span = document.createElement('span');
        span.className = 'chess-piece ' + (p.color === 'w' ? 'chess-piece-w' : 'chess-piece-b');
        span.textContent = PIECE_GLYPH[p.color][p.type];
        cell.appendChild(span);
      }
    }
    if (selected) boardUI.cellEls[selected[0]][selected[1]].classList.add('chess-selected');
    if (legalTargets) legalTargets.forEach(m => boardUI.cellEls[m.to[0]][m.to[1]].classList.add('chess-target'));
    if (lastMove) {
      boardUI.cellEls[lastMove.from[0]][lastMove.from[1]].classList.add('chess-last');
      boardUI.cellEls[lastMove.to[0]][lastMove.to[1]].classList.add('chess-last');
    }
  }

  function endGame(result) {
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 체크메이트! 승리했습니다.'); pts = 30; if(global.ICOC_SFX) setTimeout(()=>global.ICOC_SFX.win(),100); }
    else if (result === 'lose') { setStatus('체크메이트. AI가 승리했습니다.'); pts = 10; if(global.ICOC_SFX) setTimeout(()=>global.ICOC_SFX.lose(),100); }
    else { setStatus('스테일메이트. 무승부입니다.'); pts = 15; }

    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'chess_' + result);
      if(window.ICOC_AUTH) window.ICOC_AUTH.recordGameResult('체스', result==='win', pts);
      setPointsMsg(
        r.capped
          ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
          : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`
      );
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function checkGameEndAfter(color) {
    const moves = legalMovesForColor(board, color, castleRights, enPassantTarget);
    if (moves.length === 0) {
      if (inCheck(board, color)) endGame(color === PLAYER ? 'lose' : 'win');
      else endGame('draw');
      return true;
    }
    return false;
  }

  function doMove(move) {
    const { rights, ep } = applyMove(board, move, castleRights, enPassantTarget);
    castleRights = rights; enPassantTarget = ep;
    lastMove = move;
    selected = null; legalTargets = null;
    if (global.ICOC_SFX) global.ICOC_SFX.piece();
    renderBoard();
  }

  function doAiTurn() {
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const mv = aiPickMove();
      if (!mv) { checkGameEndAfter(AI); return; }
      doMove(mv);
      turn = PLAYER;
      setTurnUI();
      if (!checkGameEndAfter(PLAYER)) setStatus(inCheck(board, PLAYER) ? '체크! 방어하세요.' : '');
    }, 350);
  }

  function onCellClick(r, c) {
    if (gameOver || turn !== PLAYER) return;
    const piece = board[r][c];

    if (selected) {
      const move = legalTargets.find(m => m.to[0] === r && m.to[1] === c);
      if (move) {
        doMove(move);
        if (window.ICOC_ONLINE?.active) {
          ICOC_ONLINE.sendMove({r, c});
          ICOC_ONLINE.showTurnIndicator(false);
          return;
        }
        turn = AI;
        setTurnUI();
        if (!checkGameEndAfter(AI)) doAiTurn();
        return;
      }
      if (piece && piece.color === PLAYER) {
        selected = [r, c];
        legalTargets = legalMovesForSquare(r, c);
        renderBoard();
        return;
      }
      selected = null; legalTargets = null;
      renderBoard();
      return;
    }

    if (piece && piece.color === PLAYER) {
      selected = [r, c];
      legalTargets = legalMovesForSquare(r, c);
      if (legalTargets.length === 0) global.ICOC_POINTS.showToast('이 기물은 이동할 수 있는 곳이 없습니다.');
      renderBoard();
    }
  }

  function buildBoardDOM(container) {
    const grid = document.createElement('div');
    grid.className = 'board-grid chess-board';
    grid.style.gridTemplateColumns = `repeat(8, 1fr)`;
    const cellEls = [];
    for (let r = 0; r < 8; r++) {
      const row = [];
      for (let c = 0; c < 8; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell chess-cell ' + (((r + c) % 2 === 0) ? 'chess-light' : 'chess-dark');
        cell.addEventListener('click', () => onCellClick(r, c));
        grid.appendChild(cell);
        row.push(cell);
      }
      cellEls.push(row);
    }
    container.appendChild(grid);
    boardUI = { cellEls };
  }

  function reset() {
    board = initBoard();
    turn = PLAYER;
    gameOver = false;
    selected = null; legalTargets = null; lastMove = null; awarded = false;
    castleRights = { w: { k: true, q: true }, b: { k: true, q: true } };
    enPassantTarget = null;
    setStatus('');
    setPointsMsg('당신은 백, AI는 흑입니다. 체크메이트로 승리하세요.');
    setTurnUI();
    if (boardUI) renderBoard();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="chess-turn-w" class="game-turn-pill">♔ 당신 (백)</span>
        <span id="chess-turn-b" class="game-turn-pill">♚ AI (흑)</span>
      </div>
      <div id="chess-board-wrap"></div>
      <div id="chess-result" class="game-result-msg"></div>
      <div id="chess-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="chess-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('chess-board-wrap'));
    document.getElementById('chess-restart-btn').addEventListener('click', reset);
    reset();
  }

  
  // 온라인: 상대 수 적용
  function applyOpponentMove(payload) {
    if (!payload || gameOver) return;
    onCellClick(payload.r, payload.c);
    ICOC_ONLINE?.showTurnIndicator(true);
  }
  global.ChessGame = { start, applyOpponentMove };
})(window);

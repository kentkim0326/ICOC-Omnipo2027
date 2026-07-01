/* ============================================================
   ICOC OMNIPO — 쇼기 (将棋, Shogi) vs AI
   보드: 9x9 칸. 잡은 기물을 자신의 기물로 다시 사용하는 "모치고마(持ち駒, 드롭)" 규칙이 핵심.
   (단순화: 승진은 가능할 때 항상 자동 승진 처리 — 승진 여부를 직접 고르는 선택 UI는 생략)
   ============================================================ */

(function (global) {
  const SIZE = 9;
  const PLAYER = 'player', AI = 'ai';
  function opp(color) { return color === 'player' ? 'ai' : 'player'; }
  function inBoard(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function fwdDir(color) { return color === 'player' ? -1 : 1; }
  function promZone(color) { return color === 'player' ? [0, 1, 2] : [6, 7, 8]; }

  function initBoardState() {
    const b = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
    const back = ['lance', 'knight', 'silver', 'gold', 'king', 'gold', 'silver', 'knight', 'lance'];
    back.forEach((t, c) => { b[0][c] = { type: t, color: 'ai', promoted: false }; b[8][c] = { type: t, color: 'player', promoted: false }; });
    b[1][1] = { type: 'bishop', color: 'ai', promoted: false }; b[1][7] = { type: 'rook', color: 'ai', promoted: false };
    b[7][1] = { type: 'bishop', color: 'player', promoted: false }; b[7][7] = { type: 'rook', color: 'player', promoted: false };
    for (let c = 0; c < SIZE; c++) { b[2][c] = { type: 'pawn', color: 'ai', promoted: false }; b[6][c] = { type: 'pawn', color: 'player', promoted: false }; }
    return b;
  }
  function initHandsState() { return { player: {}, ai: {} }; }
  function cloneBoard(b) { return b.map(row => row.map(cell => cell ? { ...cell } : null)); }
  function cloneHands(h) { return { player: { ...h.player }, ai: { ...h.ai } }; }

  const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function slide(b, r, c, color, dirs) {
    const moves = [];
    dirs.forEach(([dr, dc]) => {
      let cr = r + dr, cc = c + dc;
      while (inBoard(cr, cc)) {
        const cell = b[cr][cc];
        if (!cell) moves.push([cr, cc]);
        else { if (cell.color !== color) moves.push([cr, cc]); break; }
        cr += dr; cc += dc;
      }
    });
    return moves;
  }
  function step(b, r, c, color, offsets) {
    const moves = [];
    offsets.forEach(([dr, dc]) => {
      const rr = r + dr, cc = c + dc;
      if (!inBoard(rr, cc)) return;
      const cell = b[rr][cc];
      if (!cell || cell.color !== color) moves.push([rr, cc]);
    });
    return moves;
  }

  function pieceMoves(b, r, c) {
    const p = b[r][c];
    if (!p) return [];
    const fwd = fwdDir(p.color);
    const { type, color, promoted } = p;
    if (type === 'king') return step(b, r, c, color, ORTHO.concat(DIAG));
    if (type === 'gold' || (promoted && ['silver', 'knight', 'lance', 'pawn'].includes(type))) {
      return step(b, r, c, color, [[fwd, 0], [fwd, -1], [fwd, 1], [0, -1], [0, 1], [-fwd, 0]]);
    }
    if (type === 'silver') return step(b, r, c, color, [[fwd, 0], [fwd, -1], [fwd, 1], [-fwd, -1], [-fwd, 1]]);
    if (type === 'knight') return step(b, r, c, color, [[2 * fwd, -1], [2 * fwd, 1]]);
    if (type === 'lance') return promoted ? step(b, r, c, color, [[fwd, 0], [fwd, -1], [fwd, 1], [0, -1], [0, 1], [-fwd, 0]]) : slide(b, r, c, color, [[fwd, 0]]);
    if (type === 'pawn') return promoted ? step(b, r, c, color, [[fwd, 0], [fwd, -1], [fwd, 1], [0, -1], [0, 1], [-fwd, 0]]) : step(b, r, c, color, [[fwd, 0]]);
    if (type === 'bishop') return promoted ? slide(b, r, c, color, DIAG).concat(step(b, r, c, color, ORTHO)) : slide(b, r, c, color, DIAG);
    if (type === 'rook') return promoted ? slide(b, r, c, color, ORTHO).concat(step(b, r, c, color, DIAG)) : slide(b, r, c, color, ORTHO);
    return [];
  }

  function findKing(b, color) {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (b[r][c] && b[r][c].type === 'king' && b[r][c].color === color) return [r, c];
    return null;
  }
  function isAttacked(b, r, c, byColor) {
    for (let rr = 0; rr < SIZE; rr++) for (let cc = 0; cc < SIZE; cc++) {
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
  function canPromote(p, fromR, toR) {
    if (p.promoted || p.type === 'king' || p.type === 'gold') return false;
    const zone = promZone(p.color);
    return zone.includes(fromR) || zone.includes(toR);
  }

  function boardMovesForColor(b, color) {
    const all = [];
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const p = b[r][c];
      if (p && p.color === color) {
        pieceMoves(b, r, c).forEach(([tr, tc]) => {
          const promoOK = canPromote(p, r, tr);
          const variants = promoOK ? [true, false] : [false];
          variants.forEach(promote => {
            const nb = cloneBoard(b);
            nb[tr][tc] = { ...nb[r][c], promoted: nb[r][c].promoted || promote };
            nb[r][c] = null;
            if (!inCheck(nb, color)) all.push({ from: [r, c], to: [tr, tc], promote, drop: null });
          });
        });
      }
    }
    return all;
  }
  function dropMovesForColor(b, hands, color, skipUchifuzumeCheck) {
    const all = [];
    const handTypes = Object.keys(hands[color]).filter(t => hands[color][t] > 0);
    handTypes.forEach(type => {
      for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
        if (b[r][c]) continue;
        if (type === 'pawn') {
          let hasUnpromotedPawnInCol = false;
          for (let rr = 0; rr < SIZE; rr++) { const cell = b[rr][c]; if (cell && cell.color === color && cell.type === 'pawn' && !cell.promoted) hasUnpromotedPawnInCol = true; }
          if (hasUnpromotedPawnInCol) continue;
        }
        const nb = cloneBoard(b);
        nb[r][c] = { type, color, promoted: false };
        if (inCheck(nb, color)) continue;
        if (type === 'pawn' && !skipUchifuzumeCheck) {
          const oppColor = opp(color);
          if (inCheck(nb, oppColor)) {
            const oppMoves = legalMovesForColor(nb, hands, oppColor, true);
            if (oppMoves.length === 0) continue;
          }
        }
        all.push({ from: null, to: [r, c], promote: false, drop: type });
      }
    });
    return all;
  }
  function legalMovesForColor(b, hands, color, skipUchifuzumeCheck) {
    return boardMovesForColor(b, color).concat(dropMovesForColor(b, hands, color, skipUchifuzumeCheck));
  }

  // ── AI ──
  const VAL = { pawn: 1, lance: 3, knight: 4, silver: 5, gold: 6, bishop: 8, rook: 10, king: 0 };
  const PROMO_VAL = { pawn: 6, lance: 6, knight: 6, silver: 6, bishop: 10, rook: 12 };
  function pieceValue(p) { return p.promoted ? (PROMO_VAL[p.type] || VAL[p.type]) : VAL[p.type]; }
  function evaluate(b, hands) {
    let score = 0;
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) { const p = b[r][c]; if (!p) continue; score += (p.color === AI ? 1 : -1) * pieceValue(p); }
    ['player', 'ai'].forEach(color => { Object.keys(hands[color]).forEach(t => { score += (color === AI ? 1 : -1) * (hands[color][t] || 0) * VAL[t]; }); });
    return score;
  }
  function applyMoveSim(b, hands, m, color) {
    const nb = cloneBoard(b); const nh = cloneHands(hands);
    if (m.drop) { nb[m.to[0]][m.to[1]] = { type: m.drop, color, promoted: false }; nh[color][m.drop] -= 1; }
    else {
      const captured = nb[m.to[0]][m.to[1]];
      if (captured) nh[color][captured.type] = (nh[color][captured.type] || 0) + 1;
      nb[m.to[0]][m.to[1]] = { ...nb[m.from[0]][m.from[1]], promoted: nb[m.from[0]][m.from[1]].promoted || m.promote };
      nb[m.from[0]][m.from[1]] = null;
    }
    return { nb, nh };
  }
  // 탐색 전용(가지치기): 드롭 후보가 너무 많으면 양쪽 왕 근처 + 일부 샘플만 고려 (실제 플레이어가 두는 수는 항상 풀 합법수)
  function searchMoves(b, hands, color, cap) {
    const boardMoves = boardMovesForColor(b, color);
    const allDrops = dropMovesForColor(b, hands, color);
    if (allDrops.length <= cap) return boardMoves.concat(allDrops);
    const kp = findKing(b, 'player'), ka = findKing(b, 'ai');
    const near = allDrops.filter(d => { const [r, c] = d.to; return (kp && Math.abs(r - kp[0]) <= 2 && Math.abs(c - kp[1]) <= 2) || (ka && Math.abs(r - ka[0]) <= 2 && Math.abs(c - ka[1]) <= 2); });
    const nearSet = new Set(near);
    const rest = allDrops.filter(d => !nearSet.has(d));
    const step2 = Math.max(1, Math.ceil(rest.length / Math.max(4, cap)));
    const sampled = rest.filter((_, i) => i % step2 === 0);
    return boardMoves.concat(near).concat(sampled);
  }
  function minimax(b, hands, depth, alpha, beta, maximizing, turnColor) {
    if (depth === 0) return evaluate(b, hands);
    const moves = searchMoves(b, hands, turnColor, 14);
    if (moves.length === 0) return maximizing ? -100000 - depth : 100000 + depth;
    let best = maximizing ? -Infinity : Infinity;
    for (const m of moves) {
      const { nb, nh } = applyMoveSim(b, hands, m, turnColor);
      const val = minimax(nb, nh, depth - 1, alpha, beta, !maximizing, opp(turnColor));
      if (maximizing) { best = Math.max(best, val); alpha = Math.max(alpha, val); }
      else { best = Math.min(best, val); beta = Math.min(beta, val); }
      if (alpha >= beta) break;
    }
    return best;
  }
  function aiPickMove() {
    const realMoves = legalMovesForColor(board, hands, AI);
    if (realMoves.length === 0) return null;
    const rootMoves = realMoves.length > 50 ? searchMoves(board, hands, AI, 20) : realMoves;
    let best = -Infinity, bestMoves = [];
    rootMoves.forEach(m => {
      const { nb, nh } = applyMoveSim(board, hands, m, AI);
      const val = minimax(nb, nh, 2, -Infinity, Infinity, false, PLAYER) + Math.random() * 1.2;
      if (val > best + 0.001) { best = val; bestMoves = [m]; }
      else if (Math.abs(val - best) < 1.2) bestMoves.push(m);
    });
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  }

  // ── 게임 상태 / UI ──
  let board, hands, turn, gameOver, awarded, cellEls, selected, legalForSelected;

  const LABEL = { pawn: '歩', lance: '香', knight: '桂', silver: '銀', gold: '金', bishop: '角', rook: '飛' };
  const PROMO_LABEL = { pawn: 'と', lance: '杏', knight: '圭', silver: '全', bishop: '馬', rook: '龍' };
  function pieceLabel(p) {
    if (p.type === 'king') return p.color === 'player' ? '王' : '玉';
    if (p.promoted) return PROMO_LABEL[p.type];
    return LABEL[p.type];
  }
  const HAND_LABEL = LABEL;

  function setStatus(msg) { const el = document.getElementById('shg-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('shg-points-msg'); if (el) el.textContent = msg || ''; }
  function setTurnUI() {
    const pEl = document.getElementById('shg-turn-player'), aEl = document.getElementById('shg-turn-ai');
    if (pEl) pEl.classList.toggle('active', turn === PLAYER && !gameOver);
    if (aEl) aEl.classList.toggle('active', turn === AI && !gameOver);
  }

  function renderHand(color) {
    const el = document.getElementById(color === PLAYER ? 'shg-hand-player' : 'shg-hand-ai');
    if (!el) return;
    el.innerHTML = '';
    Object.keys(hands[color]).filter(t => hands[color][t] > 0).forEach(type => {
      const div = document.createElement('div');
      div.className = 'shg-hand-piece' + (color === PLAYER ? ' shg-piece-player' : ' shg-piece-ai');
      if (selected && selected.drop === type) div.classList.add('shg-hand-selected');
      div.innerHTML = `${HAND_LABEL[type]}<span class="shg-hand-count">${hands[color][type]}</span>`;
      if (color === PLAYER) div.addEventListener('click', () => onHandClick(type));
      el.appendChild(div);
    });
  }

  function renderBoard() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const cell = cellEls[r][c];
      cell.classList.remove('shg-selected', 'shg-target', 'shg-target-capture');
      cell.innerHTML = '';
      const p = board[r][c];
      if (p) {
        const span = document.createElement('span');
        span.className = 'shg-piece ' + (p.color === 'player' ? 'shg-piece-player' : 'shg-piece-ai') + (p.promoted ? ' shg-promoted' : '');
        span.textContent = pieceLabel(p);
        cell.appendChild(span);
      }
    }
    if (selected) {
      if (selected.from) cellEls[selected.from[0]][selected.from[1]].classList.add('shg-selected');
      legalForSelected.forEach(m => {
        const [tr, tc] = m.to;
        cellEls[tr][tc].classList.add(board[tr][tc] ? 'shg-target-capture' : 'shg-target');
      });
    }
    renderHand(PLAYER); renderHand(AI);
  }

  function checkGameEndAfter(movedColor) {
    const nextColor = opp(movedColor);
    const nextMoves = legalMovesForColor(board, hands, nextColor);
    if (nextMoves.length === 0) { endGame(movedColor === PLAYER ? 'win' : 'lose'); return true; }
    return false;
  }

  function doMove(m, color) {
    if(global.ICOC_SFX) global.ICOC_SFX.piece();
    if (m.drop) {
      board[m.to[0]][m.to[1]] = { type: m.drop, color, promoted: false };
      hands[color][m.drop] -= 1;
    } else {
      const captured = board[m.to[0]][m.to[1]];
      if (captured) hands[color][captured.type] = (hands[color][captured.type] || 0) + 1;
      const moving = board[m.from[0]][m.from[1]];
      board[m.to[0]][m.to[1]] = { ...moving, promoted: moving.promoted || m.promote };
      board[m.from[0]][m.from[1]] = null;
    }
    selected = null; legalForSelected = [];
  }

  function doAiTurn() {
    if (gameOver) return;
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const m = aiPickMove();
      if (!m) { endGame('win'); return; }
      doMove(m, AI);
      renderBoard();
      if (checkGameEndAfter(AI)) return;
      setStatus(inCheck(board, PLAYER) ? '⚔️ 왕이 위협받고 있습니다(왕수).' : '');
      turn = PLAYER;
      setTurnUI();
    }, 450);
  }

  function pickPromoVariant(moves) {
    // 자동승진 단순화: 승진/비승진 둘 다 합법이면 승진을 우선 선택
    const promo = moves.find(m => m.promote === true);
    return promo || moves[0];
  }

  function onCellClick(r, c) {
    if (turn !== PLAYER || gameOver) return;
    const p = board[r][c];
    if (selected) {
      const matches = legalForSelected.filter(m => m.to[0] === r && m.to[1] === c);
      if (matches.length > 0) {
        const move = pickPromoVariant(matches);
        doMove(move, PLAYER);
        renderBoard();
        if (checkGameEndAfter(PLAYER)) return;
        setStatus(inCheck(board, AI) ? '⚔️ AI의 왕을 위협하고 있습니다(왕수).' : '');
        turn = AI;
        setTurnUI();
        doAiTurn();
        return;
      }
      if (p && p.color === PLAYER) {
        selected = { from: [r, c] };
        legalForSelected = boardMovesForColor(board, PLAYER).filter(m => m.from[0] === r && m.from[1] === c);
      } else {
        selected = null; legalForSelected = [];
      }
      renderBoard();
      return;
    }
    if (p && p.color === PLAYER) {
      selected = { from: [r, c] };
      legalForSelected = boardMovesForColor(board, PLAYER).filter(m => m.from[0] === r && m.from[1] === c);
      renderBoard();
    }
  }

  function onHandClick(type) {
    if (turn !== PLAYER || gameOver) return;
    if (!hands[PLAYER][type]) return;
    selected = { drop: type };
    legalForSelected = dropMovesForColor(board, hands, PLAYER).filter(m => m.drop === type);
    renderBoard();
  }

  function endGame(result) {
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 외통! AI의 왕이 더 이상 움직일 수 없습니다. 승리!'); pts = 30; if(global.ICOC_SFX) setTimeout(()=>global.ICOC_SFX.win(),100); }
    else { setStatus('😵 외통에 걸렸습니다. 당신의 왕이 더 이상 움직일 수 없습니다. 패배입니다.'); pts = 15; }
    if (!awarded) {
      awarded = true;
      const res = window.ICOC_POINTS.addPoints(pts, 'shogi_' + result);
      if(window.ICOC_AUTH) window.ICOC_AUTH.recordGameResult('쇼기', result==='win', pts);
      setPointsMsg(res.capped
        ? `+${res.added}P 적립 (오늘 획득 한도 도달, 보유 ${res.total.toLocaleString()}P)`
        : `+${res.added}P 적립 · 보유 ${res.total.toLocaleString()}P`);
      window.ICOC_POINTS.showToast(`+${res.added}P 적립되었습니다.`);
    }
  }

  function buildBoardDOM(container) {
    const grid = document.createElement('div');
    grid.className = 'board-grid shg-board';
    grid.style.gridTemplateColumns = 'repeat(9, 1fr)';
    cellEls = [];
    for (let r = 0; r < SIZE; r++) {
      const row = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'board-cell shg-cell ' + (((r + c) % 2 === 0) ? 'shg-light' : 'shg-dark');
        cell.addEventListener('click', () => onCellClick(r, c));
        grid.appendChild(cell);
        row.push(cell);
      }
      cellEls.push(row);
    }
    container.appendChild(grid);
  }

  function reset() {
    board = initBoardState();
    hands = initHandsState();
    turn = PLAYER;
    gameOver = false;
    awarded = false;
    selected = null; legalForSelected = [];
    setStatus('');
    setPointsMsg('상대 왕을 외통(체크메이트)시키면 승리합니다. 잡은 기물은 손에 들어와 다시 내 기물로 쓸 수 있습니다(드롭).');
    setTurnUI();
    renderBoard();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="shg-turn-ai" class="game-turn-pill">🔵 AI</span>
        <span id="shg-turn-player" class="game-turn-pill">🔴 당신</span>
      </div>
      <div id="shg-hand-ai" class="shg-hand-tray"></div>
      <div id="shg-board-wrap"></div>
      <div id="shg-hand-player" class="shg-hand-tray"></div>
      <div id="shg-result" class="game-result-msg"></div>
      <div id="shg-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="shg-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('shg-board-wrap'));
    document.getElementById('shg-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.ShogiGame = { start };
})(window);

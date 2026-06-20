/* ============================================================
   ICOC OMNIPO — 바둑 (Go / Baduk) vs AI
   13x13 보드, 단순 승부 판정: 더 많은 돌을 포획한 쪽이 승리
   (집 계산 없음 / 캐주얼 룰) — 포획, 자살수 금지, 패(Ko) 규칙 적용
   ============================================================ */

(function (global) {
  const SIZE = 13;
  const EMPTY = 0, BLACK = 1, WHITE = 2; // BLACK = 플레이어, WHITE = AI
  const NB = [[-1, 0], [1, 0], [0, -1], [0, 1]];

  let board, turn, gameOver, passCount, cellEls, lastMoveEl, awarded;
  let capturedByBlack, capturedByWhite;
  let koPoint, koColor; // 패(Ko) 상태: koColor는 koPoint에 둘 수 없는 색

  function inBounds(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }
  function neighborsOf(r, c) { return NB.map(([dr, dc]) => [r + dr, c + dc]).filter(([rr, cc]) => inBounds(rr, cc)); }
  function key(r, c) { return r + ',' + c; }

  function getGroup(bd, r, c) {
    const color = bd[r][c];
    const stones = new Set(), liberties = new Set();
    const stack = [[r, c]], visited = new Set([key(r, c)]);
    while (stack.length) {
      const [cr, cc] = stack.pop();
      stones.add(key(cr, cc));
      for (const [nr, nc] of neighborsOf(cr, cc)) {
        if (bd[nr][nc] === EMPTY) liberties.add(key(nr, nc));
        else if (bd[nr][nc] === color && !visited.has(key(nr, nc))) {
          visited.add(key(nr, nc));
          stack.push([nr, nc]);
        }
      }
    }
    return { stones, liberties };
  }

  function cloneBoard(bd) { return bd.map(row => row.slice()); }

  /**
   * 보드(bd)에 color 돌을 (r,c)에 두는 시도.
   * 성공 시 bd를 직접 변형하고 결과 반환. 실패 시 bd는 변형하지 않고 ok:false.
   */
  function tryMove(bd, color, r, c, curKoPoint, curKoColor) {
    if (bd[r][c] !== EMPTY) return { ok: false, reason: 'occupied' };
    if (curKoPoint && curKoPoint[0] === r && curKoPoint[1] === c && curKoColor === color) {
      return { ok: false, reason: 'ko' };
    }
    const opponent = color === BLACK ? WHITE : BLACK;
    bd[r][c] = color;

    let captured = 0;
    const capturedCoords = [];
    for (const [nr, nc] of neighborsOf(r, c)) {
      if (bd[nr][nc] === opponent) {
        const grp = getGroup(bd, nr, nc);
        if (grp.liberties.size === 0) {
          for (const k of grp.stones) {
            const [rr, cc] = k.split(',').map(Number);
            bd[rr][cc] = EMPTY;
            captured++;
            capturedCoords.push([rr, cc]);
          }
        }
      }
    }

    const ownGroup = getGroup(bd, r, c);
    if (ownGroup.liberties.size === 0) {
      // 자살수: 되돌림
      bd[r][c] = EMPTY;
      for (const [rr, cc] of capturedCoords) bd[rr][cc] = opponent;
      return { ok: false, reason: 'suicide' };
    }

    let newKoPoint = null, newKoColor = null;
    if (captured === 1 && ownGroup.stones.size === 1 && ownGroup.liberties.size === 1) {
      newKoPoint = capturedCoords[0];
      newKoColor = opponent; // 상대가 즉시 되따낼 수 없음 (다음 한 턴만)
    }

    return {
      ok: true, captured, ownLiberties: ownGroup.liberties.size,
      koPoint: newKoPoint, koColor: newKoColor
    };
  }

  function setTurnUI() {
    const bPill = document.getElementById('go-turn-black');
    const wPill = document.getElementById('go-turn-white');
    if (!bPill) return;
    bPill.classList.toggle('active', turn === BLACK && !gameOver);
    wPill.classList.toggle('active', turn === WHITE && !gameOver);
    bPill.textContent = `⚫ 당신 (흑) · 포획 ${capturedByBlack}`;
    wPill.textContent = `⚪ AI (백) · 포획 ${capturedByWhite}`;
  }

  function setStatus(msg) {
    const el = document.getElementById('go-result');
    if (el) el.textContent = msg || '';
  }

  function setPointsMsg(msg) {
    const el = document.getElementById('go-points-msg');
    if (el) el.textContent = msg || '';
  }

  function renderBoard() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        const cell = cellEls[r][c];
        cell.innerHTML = '';
        if (board[r][c] !== EMPTY) {
          const stone = document.createElement('div');
          stone.className = 'stone ' + (board[r][c] === BLACK ? 'black' : 'white');
          cell.appendChild(stone);
        }
      }
    }
  }

  function markLastMove(r, c) {
    if (lastMoveEl) lastMoveEl.classList.remove('last-move');
    const stoneEl = cellEls[r][c].querySelector('.stone');
    if (stoneEl) { stoneEl.classList.add('last-move'); lastMoveEl = stoneEl; }
  }

  // ── AI 평가 ──
  function evaluateAiMove(r, c) {
    const sim = cloneBoard(board);
    const res = tryMove(sim, WHITE, r, c, koPoint, koColor);
    if (!res.ok) return null;

    let score = 0;
    score += res.captured * 600;
    score += res.ownLiberties * 15;

    // 상대 그룹을 단수(atari, liberties===1)로 몰면 가점
    for (const [nr, nc] of neighborsOf(r, c)) {
      if (sim[nr][nc] === BLACK) {
        const grp = getGroup(sim, nr, nc);
        if (grp.liberties.size === 1) score += 250;
        else if (grp.liberties.size === 2) score += 40;
      }
    }

    // 기존 돌 근처를 선호 (체비셰프 거리 2 이내 돌 수에 비례)
    let proximity = 0;
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && board[nr][nc] !== EMPTY) proximity += 1;
      }
    }
    score += proximity * 6;

    // 보드가 비어있으면 중앙 선호, 가장자리(1선)는 약간 감점
    const isEmptyBoard = proximity === 0;
    if (isEmptyBoard) {
      const center = (SIZE - 1) / 2;
      score -= (Math.abs(r - center) + Math.abs(c - center)) * 3;
    }
    if (r === 0 || c === 0 || r === SIZE - 1 || c === SIZE - 1) score -= 15;

    score += Math.random() * 8;
    return score;
  }

  function aiPickMove() {
    let best = -Infinity, bestCell = null;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] !== EMPTY) continue;
        const s = evaluateAiMove(r, c);
        if (s !== null && s > best) { best = s; bestCell = [r, c]; }
      }
    }
    return bestCell; // null이면 둘 곳이 없음 (패스)
  }

  function endGame() {
    gameOver = true;
    setTurnUI();
    let result;
    if (capturedByBlack > capturedByWhite) result = 'win';
    else if (capturedByBlack < capturedByWhite) result = 'lose';
    else result = 'draw';

    let pts;
    if (result === 'win') { setStatus(`🎉 승리! (포획 ${capturedByBlack} : ${capturedByWhite})`); pts = 30; }
    else if (result === 'lose') { setStatus(`AI 승리. (포획 ${capturedByBlack} : ${capturedByWhite})`); pts = 10; }
    else { setStatus(`무승부. (포획 ${capturedByBlack} : ${capturedByWhite})`); pts = 15; }

    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'go_' + result);
      setPointsMsg(
        r.capped
          ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
          : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`
      );
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function doAiTurn() {
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const mv = aiPickMove();
      if (!mv) {
        passCount++;
        global.ICOC_POINTS.showToast('AI가 패스했습니다.');
        if (passCount >= 2) { endGame(); return; }
        turn = BLACK;
        setStatus('');
        setTurnUI();
        return;
      }
      const res = tryMove(board, WHITE, mv[0], mv[1], koPoint, koColor);
      passCount = 0;
      capturedByWhite += res.captured;
      koPoint = res.koPoint; koColor = res.koColor;
      renderBoard();
      markLastMove(mv[0], mv[1]);
      turn = BLACK;
      setStatus('');
      setTurnUI();
    }, 500);
  }

  function onCellClick(r, c) {
    if (gameOver || turn !== BLACK) return;
    const res = tryMove(board, BLACK, r, c, koPoint, koColor);
    if (!res.ok) {
      const msgs = { occupied: '이미 돌이 있는 자리입니다.', suicide: '자살수는 둘 수 없습니다.', ko: '패(Ko) 규칙: 바로 되따낼 수 없습니다.' };
      global.ICOC_POINTS.showToast(msgs[res.reason] || '둘 수 없는 자리입니다.');
      return;
    }
    passCount = 0;
    capturedByBlack += res.captured;
    koPoint = res.koPoint; koColor = res.koColor;
    renderBoard();
    markLastMove(r, c);
    turn = WHITE;
    setTurnUI();
    doAiTurn();
  }

  function onPassClick() {
    if (gameOver || turn !== BLACK) return;
    passCount++;
    if (passCount >= 2) { endGame(); return; }
    turn = WHITE;
    setTurnUI();
    doAiTurn();
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
    passCount = 0;
    lastMoveEl = null;
    awarded = false;
    capturedByBlack = 0;
    capturedByWhite = 0;
    koPoint = null; koColor = null;
    setStatus('');
    setPointsMsg('당신은 흑, AI는 백입니다. 상대 돌을 더 많이 포획하면 승리합니다.');
    setTurnUI();
    if (cellEls) renderBoard();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="go-turn-black" class="game-turn-pill">⚫ 당신 (흑)</span>
        <span id="go-turn-white" class="game-turn-pill">⚪ AI (백)</span>
      </div>
      <div id="go-board-wrap"></div>
      <div id="go-result" class="game-result-msg"></div>
      <div id="go-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn ghost" id="go-pass-btn">패스</button>
        <button class="game-btn primary" id="go-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('go-board-wrap'));
    document.getElementById('go-restart-btn').addEventListener('click', reset);
    document.getElementById('go-pass-btn').addEventListener('click', onPassClick);
    reset();
  }

  global.GoGame = { start };
})(window);

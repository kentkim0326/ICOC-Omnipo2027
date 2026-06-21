/* ============================================================
   ICOC OMNIPO — 쿼리도 (Quoridor) vs AI
   9x9 보드. 먼저 반대편에 도착하면 승리. 벽으로 상대를 막을 수 있으나
   상대의 모든 길을 완전히 막는 벽은 둘 수 없음(항상 경로 보장).
   ============================================================ */

(function (global) {
  const SIZE = 9;
  const PLAYER = 'p', AI = 'a';
  let pawns, walls, turn, gameOver, awarded, wallsLeft;
  let mode, boardCellEls, vWallEls, hWallEls; // mode: 'move' | 'wall-h' | 'wall-v'

  function cloneWalls(w) { return { h: w.h.map(r => r.slice()), v: w.v.map(r => r.slice()) }; }

  // walls.h[r][c] = true면 (r,c)-(r+1,c) 사이를 가로 벽이 막음 (행 r과 r+1 사이, 열 c)
  // walls.v[r][c] = true면 (r,c)-(r,c+1) 사이를 세로 벽이 막음
  function isMoveBlocked(w, r, c, nr, nc) {
    if (nr === r - 1) return w.h[r - 1][c]; // 위로 이동
    if (nr === r + 1) return w.h[r][c];     // 아래로 이동
    if (nc === c - 1) return w.v[r][c - 1]; // 왼쪽 이동
    if (nc === c + 1) return w.v[r][c];     // 오른쪽 이동
    return false;
  }

  function inB(r, c) { return r >= 0 && r < SIZE && c >= 0 && c < SIZE; }

  function neighborsForPawn(w, r, c, otherPos) {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const result = [];
    for (const [dr, dc] of dirs) {
      const nr = r + dr, nc = c + dc;
      if (!inB(nr, nc) || isMoveBlocked(w, r, c, nr, nc)) continue;
      if (otherPos && otherPos[0] === nr && otherPos[1] === nc) {
        // 상대 말 점프 (간단화: 직선 점프만 지원, 대각 점프 생략)
        const jr = nr + dr, jc = nc + dc;
        if (inB(jr, jc) && !isMoveBlocked(w, nr, nc, jr, jc)) result.push([jr, jc]);
        continue;
      }
      result.push([nr, nc]);
    }
    return result;
  }

  // BFS로 해당 말이 목표 행에 도달 가능한지 확인 (자기 자신의 벽 배치 유효성 검사용)
  function canReachGoal(w, pos, goalRow) {
    const visited = new Set([pos.join(',')]);
    const queue = [pos];
    while (queue.length) {
      const [r, c] = queue.shift();
      if (r === goalRow) return true;
      for (const [nr, nc] of neighborsForPawn(w, r, c, null)) {
        const key = nr + ',' + nc;
        if (!visited.has(key)) { visited.add(key); queue.push([nr, nc]); }
      }
    }
    return false;
  }

  function canPlaceWall(w, type, r, c) {
    if (type === 'h') {
      if (r < 0 || r >= SIZE - 1 || c < 0 || c >= SIZE - 1) return false;
      if (w.h[r][c]) return false;
      // 같은 가로선에서 겹치는 칸 금지 (벽은 2칸 길이를 가로지르는 가정이 아니라 1교차점 단위)
    } else {
      if (r < 0 || r >= SIZE - 1 || c < 0 || c >= SIZE - 1) return false;
      if (w.v[r][c]) return false;
    }
    // 가로/세로 벽이 정확히 같은 십자점에서 겹치는 경우 금지
    if (type === 'h' && w.v[r][c]) return false;
    if (type === 'v' && w.h[r][c]) return false;
    return true;
  }

  function tryPlaceWall(type, r, c) {
    if (!canPlaceWall(walls, type, r, c)) return false;
    const sim = cloneWalls(walls);
    if (type === 'h') sim.h[r][c] = true; else sim.v[r][c] = true;
    // 두 말 모두 목표에 도달 가능한지 확인 (한쪽이라도 완전히 막히면 불법)
    if (!canReachGoal(sim, pawns[PLAYER], 0) || !canReachGoal(sim, pawns[AI], 8)) return false;
    walls = sim;
    return true;
  }

  // ── AI 평가: 자신과 상대의 BFS 최단거리 차이를 기준으로 판단 ──
  function bfsDist(w, pos, goalRow, otherPos) {
    const visited = new Set([pos.join(',')]);
    const queue = [[pos[0], pos[1], 0]];
    while (queue.length) {
      const [r, c, d] = queue.shift();
      if (r === goalRow) return d;
      for (const [nr, nc] of neighborsForPawn(w, r, c, otherPos)) {
        const key = nr + ',' + nc;
        if (!visited.has(key)) { visited.add(key); queue.push([nr, nc, d + 1]); }
      }
    }
    return 999;
  }

  function aiChooseAction() {
    const aiDist = bfsDist(walls, pawns[AI], 8, pawns[PLAYER]);
    const playerDist = bfsDist(walls, pawns[PLAYER], 0, pawns[AI]);

    // 후보 1: 이동 (자신의 최단거리를 줄이는 방향)
    let bestMove = null, bestMoveDist = Infinity;
    for (const [nr, nc] of neighborsForPawn(walls, pawns[AI][0], pawns[AI][1], pawns[PLAYER])) {
      const d = bfsDist(walls, [nr, nc], 8, pawns[PLAYER]);
      if (d < bestMoveDist) { bestMoveDist = d; bestMove = [nr, nc]; }
    }

    // 후보 2: 상대 진행을 늦추는 벽 (남은 벽 있을 때만, 그리고 자신이 너무 불리하지 않을 때 우선)
    let bestWall = null, bestWallScore = -Infinity;
    if (wallsLeft[AI] > 0) {
      const candidates = [];
      for (let r = 0; r < SIZE - 1; r++) for (let c = 0; c < SIZE - 1; c++) {
        candidates.push(['h', r, c]);
        candidates.push(['v', r, c]);
      }
      // 성능을 위해 상대 말 근처 벽만 우선 평가
      const pr = pawns[PLAYER][0], pc = pawns[PLAYER][1];
      const nearCandidates = candidates.filter(([t, r, c]) => Math.abs(r - pr) <= 2 && Math.abs(c - pc) <= 2);
      const pool = nearCandidates.length ? nearCandidates : candidates.slice(0, 20);
      for (const [type, r, c] of pool) {
        if (!canPlaceWall(walls, type, r, c)) continue;
        const sim = cloneWalls(walls);
        if (type === 'h') sim.h[r][c] = true; else sim.v[r][c] = true;
        if (!canReachGoal(sim, pawns[PLAYER], 0) || !canReachGoal(sim, pawns[AI], 8)) continue;
        const newPlayerDist = bfsDist(sim, pawns[PLAYER], 0, pawns[AI]);
        const newAiDist = bfsDist(sim, pawns[AI], 8, pawns[PLAYER]);
        const score = (newPlayerDist - playerDist) * 20 - (newAiDist - aiDist) * 15 + Math.random() * 3;
        if (score > bestWallScore) { bestWallScore = score; bestWall = [type, r, c]; }
      }
    }

    // 상대가 AI보다 한참 앞서가고 있고(거의 도착) 벽으로 막을 가치가 충분히 크면 벽, 아니면 이동
    if (bestWall && bestWallScore > 8 && playerDist <= aiDist + 2) {
      return { kind: 'wall', type: bestWall[0], r: bestWall[1], c: bestWall[2] };
    }
    return { kind: 'move', r: bestMove ? bestMove[0] : pawns[AI][0], c: bestMove ? bestMove[1] : pawns[AI][1] };
  }

  // ── UI ──
  function setTurnUI() {
    const pPill = document.getElementById('qd-turn-p');
    const aPill = document.getElementById('qd-turn-a');
    if (!pPill) return;
    pPill.classList.toggle('active', turn === PLAYER && !gameOver);
    aPill.classList.toggle('active', turn === AI && !gameOver);
    pPill.textContent = `🔵 당신 · 벽 ${wallsLeft[PLAYER]}개`;
    aPill.textContent = `🔴 AI · 벽 ${wallsLeft[AI]}개`;
  }
  function setStatus(msg) { const el = document.getElementById('qd-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('qd-points-msg'); if (el) el.textContent = msg || ''; }

  function render() {
    for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) {
      const cell = boardCellEls[r][c];
      cell.innerHTML = '';
      cell.classList.remove('qd-hint');
      if (pawns[PLAYER][0] === r && pawns[PLAYER][1] === c) {
        const p = document.createElement('div'); p.className = 'stone white'; cell.appendChild(p);
      }
      if (pawns[AI][0] === r && pawns[AI][1] === c) {
        const p = document.createElement('div'); p.className = 'stone black'; cell.appendChild(p);
      }
    }
    for (let r = 0; r < SIZE - 1; r++) for (let c = 0; c < SIZE - 1; c++) {
      hWallEls[r][c].classList.toggle('qd-wall-active', !!walls.h[r][c]);
      vWallEls[r][c].classList.toggle('qd-wall-active', !!walls.v[r][c]);
    }
    if (mode === 'move' && turn === PLAYER && !gameOver) {
      neighborsForPawn(walls, pawns[PLAYER][0], pawns[PLAYER][1], pawns[AI]).forEach(([r, c]) => {
        boardCellEls[r][c].classList.add('qd-hint');
      });
    }
  }

  function endGame(result) {
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 먼저 도착했습니다! 승리!'); pts = 30; }
    else { setStatus('AI가 먼저 도착했습니다.'); pts = 10; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'quoridor_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function doAiTurn() {
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const action = aiChooseAction();
      if (action.kind === 'move') {
        pawns[AI] = [action.r, action.c];
      } else {
        if (action.type === 'h') walls.h[action.r][action.c] = true; else walls.v[action.r][action.c] = true;
        wallsLeft[AI]--;
      }
      render();
      if (pawns[AI][0] === 8) { endGame('lose'); return; }
      turn = PLAYER;
      setStatus('');
      setTurnUI();
      render();
    }, 500);
  }

  function onCellClick(r, c) {
    if (gameOver || turn !== PLAYER) return;
    if (mode === 'move') {
      const legal = neighborsForPawn(walls, pawns[PLAYER][0], pawns[PLAYER][1], pawns[AI]);
      if (!legal.some(([rr, cc]) => rr === r && cc === c)) return;
      pawns[PLAYER] = [r, c];
      render();
      if (pawns[PLAYER][0] === 0) { endGame('win'); return; }
      turn = AI;
      setTurnUI();
      render();
      doAiTurn();
    }
  }

  function onWallClick(type, r, c) {
    if (gameOver || turn !== PLAYER || wallsLeft[PLAYER] <= 0) return;
    if (!tryPlaceWall(type, r, c)) { global.ICOC_POINTS.showToast('그 자리에는 벽을 둘 수 없습니다 (경로가 막히거나 중첩됩니다).'); return; }
    wallsLeft[PLAYER]--;
    render();
    turn = AI;
    setTurnUI();
    render();
    doAiTurn();
  }

  function buildBoardDOM(container) {
    const wrap = document.createElement('div');
    wrap.className = 'qd-wrap';
    const grid = document.createElement('div');
    grid.className = 'qd-grid';
    boardCellEls = []; hWallEls = []; vWallEls = [];

    for (let r = 0; r < SIZE; r++) {
      const cellRow = [];
      for (let c = 0; c < SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'qd-cell';
        cell.style.gridRow = (r * 2 + 1);
        cell.style.gridColumn = (c * 2 + 1);
        cell.addEventListener('click', () => onCellClick(r, c));
        grid.appendChild(cell);
        cellRow.push(cell);
      }
      boardCellEls.push(cellRow);
    }
    for (let r = 0; r < SIZE - 1; r++) {
      const hRow = [], vRow = [];
      for (let c = 0; c < SIZE - 1; c++) {
        const hSlot = document.createElement('div');
        hSlot.className = 'qd-wall-slot qd-wall-h';
        hSlot.style.gridRow = (r * 2 + 2);
        hSlot.style.gridColumn = (c * 2 + 1) + ' / span 3';
        hSlot.addEventListener('click', () => onWallClick('h', r, c));
        grid.appendChild(hSlot);
        hRow.push(hSlot);

        const vSlot = document.createElement('div');
        vSlot.className = 'qd-wall-slot qd-wall-v';
        vSlot.style.gridRow = (r * 2 + 1) + ' / span 3';
        vSlot.style.gridColumn = (c * 2 + 2);
        vSlot.addEventListener('click', () => onWallClick('v', r, c));
        grid.appendChild(vSlot);
        vRow.push(vSlot);
      }
      hWallEls.push(hRow);
      vWallEls.push(vRow);
    }
    wrap.appendChild(grid);
    container.appendChild(wrap);
  }

  function setMode(m) {
    mode = m;
    document.querySelectorAll('.qd-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === m));
    render();
  }

  function reset() {
    pawns = { [PLAYER]: [8, 4], [AI]: [0, 4] };
    // h[r][c]: r in 0..SIZE-2 (행 경계), c in 0..SIZE-1 (전체 열) — (r,c)-(r+1,c) 차단
    // v[r][c]: r in 0..SIZE-1 (전체 행), c in 0..SIZE-2 (열 경계) — (r,c)-(r,c+1) 차단
    // 말은 0..SIZE-1 전체 칸을 오갈 수 있으므로 이동 차단 검사 시 배열 범위를 벽 배치 가능 범위(0..SIZE-2)보다 넉넉하게 잡아야 함
    walls = { h: Array.from({ length: SIZE - 1 }, () => Array(SIZE).fill(false)), v: Array.from({ length: SIZE }, () => Array(SIZE - 1).fill(false)) };
    wallsLeft = { [PLAYER]: 10, [AI]: 10 };
    turn = PLAYER; gameOver = false; awarded = false; mode = 'move';
    setStatus('');
    setPointsMsg('당신(흰색)은 아래에서 위로, AI(검정)는 위에서 아래로 진행합니다. 먼저 반대편에 도착하세요.');
    setTurnUI();
    if (boardCellEls) render();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="qd-turn-p" class="game-turn-pill">🔵 당신</span>
        <span id="qd-turn-a" class="game-turn-pill">🔴 AI</span>
      </div>
      <div class="qd-mode-bar">
        <button class="qd-mode-btn active" data-mode="move">이동</button>
        <button class="qd-mode-btn" data-mode="wall">벽 놓기</button>
      </div>
      <div id="qd-board-wrap"></div>
      <div id="qd-result" class="game-result-msg"></div>
      <div id="qd-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="qd-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('qd-board-wrap'));
    document.getElementById('qd-restart-btn').addEventListener('click', reset);
    document.querySelectorAll('.qd-mode-btn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    reset();
  }

  global.QuoridorGame = { start };
})(window);

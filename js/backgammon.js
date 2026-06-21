/* ============================================================
   ICOC OMNIPO — 백개먼 (Backgammon) vs AI
   24포인트(0~23 인덱스). 당신(PLAYER)은 23→0 방향, AI는 0→23 방향으로 진행.
   상대 블롯(1개) 히트, 바 복귀(강제), 베어오프(말 빼기) 전부 구현.
   ============================================================ */

(function (global) {
  const SIZE = 24;
  const PLAYER = 'player', AI = 'ai';
  const PLAYER_HOME = [0, 1, 2, 3, 4, 5];
  const AI_HOME = [18, 19, 20, 21, 22, 23];

  let board, bar, off, turn, gameOver, awarded;
  let dice, diceUsed, selectedFrom, legalFromPoints;

  function opp(o) { return o === PLAYER ? AI : PLAYER; }
  function cloneState(b, barObj, offObj) {
    return { board: b.map(s => s ? { ...s } : null), bar: { ...barObj }, off: { ...offObj } };
  }

  function initBoard() {
    const b = Array(SIZE).fill(null);
    b[23] = { owner: PLAYER, count: 2 };
    b[12] = { owner: PLAYER, count: 5 };
    b[7] = { owner: PLAYER, count: 3 };
    b[5] = { owner: PLAYER, count: 5 };
    b[0] = { owner: AI, count: 2 };
    b[11] = { owner: AI, count: 5 };
    b[16] = { owner: AI, count: 3 };
    b[18] = { owner: AI, count: 5 };
    return b;
  }

  function rollDice() {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    return d1 === d2 ? [d1, d1, d1, d1] : [d1, d2];
  }

  function isOpen(b, owner, idx) {
    if (idx < 0 || idx >= SIZE) return false;
    const slot = b[idx];
    if (!slot) return true;
    if (slot.owner === owner) return true;
    return slot.count === 1; // 적 블롯이면 히트 가능 (열려있음)
  }

  function targetIndex(owner, from, die) { return owner === PLAYER ? from - die : from + die; }
  function barEntryIndex(owner, die) { return owner === PLAYER ? 24 - die : die - 1; }

  function allCheckersHome(b, barObj, owner) {
    if (barObj[owner] > 0) return false;
    const home = owner === PLAYER ? PLAYER_HOME : AI_HOME;
    for (let i = 0; i < SIZE; i++) {
      if (b[i] && b[i].owner === owner && !home.includes(i)) return false;
    }
    return true;
  }

  function highestHomePoint(b, owner) {
    // "가장 먼 칸"(베어오프에 가장 먼) 의미: PLAYER는 인덱스가 큰 쪽(5에 가까운 점수), AI는 인덱스가 작은 쪽
    const home = owner === PLAYER ? PLAYER_HOME : AI_HOME;
    if (owner === PLAYER) {
      for (let i = 5; i >= 0; i--) if (b[i] && b[i].owner === PLAYER) return i;
    } else {
      for (let i = 18; i <= 23; i++) if (b[i] && b[i].owner === AI) return i;
    }
    return -1;
  }

  function pointValue(owner, idx) { return owner === PLAYER ? idx + 1 : 24 - idx; }

  // ── 특정 die 값에 대해 가능한 모든 수 생성 ──
  function legalMovesForDie(b, barObj, owner, die) {
    const moves = [];
    if (barObj[owner] > 0) {
      const entry = barEntryIndex(owner, die);
      if (isOpen(b, owner, entry)) moves.push({ type: 'enter', to: entry, die });
      return moves; // 바에 있으면 다른 수는 절대 불가
    }
    const homeReady = allCheckersHome(b, barObj, owner);
    for (let i = 0; i < SIZE; i++) {
      if (!b[i] || b[i].owner !== owner) continue;
      const to = targetIndex(owner, i, die);
      if (to >= 0 && to < SIZE) {
        if (isOpen(b, owner, to)) moves.push({ type: 'move', from: i, to, die });
      } else if (homeReady) {
        // 보드 밖으로 나가는 수 -> 베어오프 후보
        const pv = pointValue(owner, i);
        if (pv === die) {
          moves.push({ type: 'bearoff', from: i, die });
        } else if (pv < die) {
          // die가 더 크면, "더 멀리 나간 칸"이 없을 때만 (즉 i가 가장 먼 칸일 때) 베어오프 허용
          if (i === highestHomePoint(b, owner)) moves.push({ type: 'bearoff', from: i, die });
        }
      }
    }
    return moves;
  }

  function applyMove(b, barObj, offObj, owner, move) {
    if (move.type === 'enter') {
      const dest = b[move.to];
      if (dest && dest.owner !== owner) { bar[opp(owner)] = (bar[opp(owner)] || 0) + 1; b[move.to] = { owner, count: 1 }; }
      else if (dest) dest.count++;
      else b[move.to] = { owner, count: 1 };
      barObj[owner]--;
    } else if (move.type === 'move') {
      b[move.from].count--;
      if (b[move.from].count === 0) b[move.from] = null;
      const dest = b[move.to];
      if (dest && dest.owner !== owner) { barObj[opp(owner)] = (barObj[opp(owner)] || 0) + 1; b[move.to] = { owner, count: 1 }; }
      else if (dest) dest.count++;
      else b[move.to] = { owner, count: 1 };
    } else if (move.type === 'bearoff') {
      b[move.from].count--;
      if (b[move.from].count === 0) b[move.from] = null;
      offObj[owner] = (offObj[owner] || 0) + 1;
    }
  }

  // ── UI ──
  function setStatus(msg) { const el = document.getElementById('bg-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('bg-points-msg'); if (el) el.textContent = msg || ''; }
  function setTurnUI() {
    document.getElementById('bg-turn-p').classList.toggle('active', turn === PLAYER && !gameOver);
    document.getElementById('bg-turn-a').classList.toggle('active', turn === AI && !gameOver);
    document.getElementById('bg-off-p').textContent = `빼낸 말: ${off[PLAYER] || 0}/15`;
    document.getElementById('bg-off-a').textContent = `빼낸 말: ${off[AI] || 0}/15`;
  }

  function renderDice() {
    const el = document.getElementById('bg-dice');
    el.innerHTML = '';
    dice.forEach((d, i) => {
      const span = document.createElement('span');
      span.className = 'bg-die' + (diceUsed[i] ? ' bg-die-used' : '');
      span.textContent = d;
      el.appendChild(span);
    });
  }

  function renderBoard() {
    const top = document.getElementById('bg-row-top');
    const bot = document.getElementById('bg-row-bot');
    top.innerHTML = ''; bot.innerHTML = '';

    // 위쪽 행: 인덱스 23→12 (오른쪽에서 보면 12~23), 아래쪽 행: 0~11
    for (let i = 23; i >= 12; i--) top.appendChild(pointEl(i));
    for (let i = 0; i <= 11; i++) bot.appendChild(pointEl(i));

    document.getElementById('bg-bar-p').textContent = `바: ${bar[PLAYER] || 0}`;
    document.getElementById('bg-bar-a').textContent = `바: ${bar[AI] || 0}`;
    setTurnUI();
  }

  function pointEl(i) {
    const cell = document.createElement('div');
    cell.className = 'bg-point' + (selectedFrom === i ? ' bg-point-selected' : '') + (legalFromPoints && legalFromPoints.includes(i) ? ' bg-point-hint' : '');
    cell.dataset.idx = i;
    const slot = board[i];
    if (slot) {
      const stack = document.createElement('div');
      stack.className = 'bg-stack';
      const shown = Math.min(slot.count, 5);
      for (let k = 0; k < shown; k++) {
        const chk = document.createElement('div');
        chk.className = 'bg-checker ' + (slot.owner === PLAYER ? 'bg-checker-p' : 'bg-checker-a');
        stack.appendChild(chk);
      }
      if (slot.count > 5) {
        const more = document.createElement('div');
        more.className = 'bg-checker-count';
        more.textContent = '+' + (slot.count - 5);
        stack.appendChild(more);
      }
      cell.appendChild(stack);
    }
    cell.addEventListener('click', () => onPointClick(i));
    return cell;
  }

  function currentAvailableDice() {
    return dice.map((d, i) => ({ d, i })).filter(x => !diceUsed[x.i]);
  }

  function anyLegalMoveExists(owner) {
    for (const { d } of currentAvailableDice()) {
      if (legalMovesForDie(board, bar, owner, d).length > 0) return true;
    }
    return false;
  }

  function onPointClick(i) {
    if (gameOver || turn !== PLAYER) return;
    if (bar[PLAYER] > 0) { global.ICOC_POINTS.showToast('바에 있는 말을 먼저 들여놓아야 합니다. 바를 클릭하세요.'); return; }
    const slot = board[i];
    if (selectedFrom === null) {
      if (!slot || slot.owner !== PLAYER) return;
      const avail = currentAvailableDice();
      const dests = [];
      for (const { d } of avail) {
        for (const m of legalMovesForDie(board, bar, PLAYER, d)) {
          if (m.from === i || (m.type === 'enter')) dests.push(m);
        }
      }
      const fromMoves = dests.filter(m => m.type !== 'enter' && m.from === i);
      if (fromMoves.length === 0) return;
      selectedFrom = i;
      legalFromPoints = fromMoves.map(m => m.type === 'bearoff' ? -1 : m.to).filter(x => x >= 0);
      renderBoard();
    } else {
      tryMoveSelected(i);
    }
  }

  function onBarClick() {
    if (gameOver || turn !== PLAYER || bar[PLAYER] <= 0) return;
    const avail = currentAvailableDice();
    for (const { d, i } of avail) {
      const entry = barEntryIndex(PLAYER, d);
      if (isOpen(board, PLAYER, entry)) {
        applyMove(board, bar, off, PLAYER, { type: 'enter', to: entry, die: d });
        diceUsed[i] = true;
        afterPlayerAction();
        return;
      }
    }
    global.ICOC_POINTS.showToast('지금 가진 주사위로는 들여놓을 수 없습니다.');
  }

  function tryMoveSelected(toIdx) {
    const avail = currentAvailableDice();
    for (const { d, i } of avail) {
      const to = targetIndex(PLAYER, selectedFrom, d);
      if (to === toIdx && isOpen(board, PLAYER, to)) {
        applyMove(board, bar, off, PLAYER, { type: 'move', from: selectedFrom, to, die: d });
        diceUsed[i] = true;
        selectedFrom = null; legalFromPoints = null;
        afterPlayerAction();
        return;
      }
    }
    selectedFrom = null; legalFromPoints = null;
    renderBoard();
  }

  function onBearOffClick() {
    if (gameOver || turn !== PLAYER || selectedFrom === null) return;
    if (!allCheckersHome(board, bar, PLAYER)) { global.ICOC_POINTS.showToast('모든 말이 홈에 들어와야 베어오프할 수 있습니다.'); return; }
    const avail = currentAvailableDice();
    for (const { d, i } of avail) {
      const moves = legalMovesForDie(board, bar, PLAYER, d).filter(m => m.type === 'bearoff' && m.from === selectedFrom);
      if (moves.length > 0) {
        applyMove(board, bar, off, PLAYER, moves[0]);
        diceUsed[i] = true;
        selectedFrom = null; legalFromPoints = null;
        afterPlayerAction();
        return;
      }
    }
    global.ICOC_POINTS.showToast('이 말은 지금 베어오프할 수 없습니다.');
  }

  function afterPlayerAction() {
    renderDice(); renderBoard();
    if ((off[PLAYER] || 0) >= 15) { endGame('win'); return; }
    if (diceUsed.every(Boolean) || !anyLegalMoveExists(PLAYER)) {
      turn = AI;
      setStatus('AI 차례입니다...');
      renderBoard();
      setTimeout(aiTurn, 700);
    } else {
      setStatus('남은 주사위로 계속 이동하세요.');
    }
  }

  function endGame(result) {
    gameOver = true;
    renderBoard();
    let pts;
    if (result === 'win') { setStatus('🎉 15개 말을 모두 빼냈습니다! 승리!'); pts = 30; }
    else { setStatus('AI가 먼저 말을 모두 빼냈습니다. 패배입니다.'); pts = 10; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'backgammon_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  // ── AI ──
  function scoreAiMove(m) {
    let score = 0;
    if (m.type === 'bearoff') score += 100;
    const destSlot = m.type !== 'bearoff' ? board[m.type === 'enter' ? m.to : m.to] : null;
    if (destSlot && destSlot.owner === PLAYER && destSlot.count === 1) score += 60; // 히트
    if (destSlot && destSlot.owner === AI && destSlot.count === 1) score += 15; // 포인트 메이킹(2개로 안전)
    if (m.type === 'move') {
      const fromSlot = board[m.from];
      if (fromSlot && fromSlot.count === 2) score -= 8; // 블롯을 만들면 약간 감점
    }
    score += (m.die || 0) * 2;
    score += Math.random() * 5;
    return score;
  }

  function aiTurn() {
    if (gameOver) return;
    const avail = currentAvailableDice();
    if (avail.length === 0) { finishAiTurn(); return; }

    let best = null, bestScore = -Infinity, bestDieSlot = null;
    for (const { d, i } of avail) {
      const moves = legalMovesForDie(board, bar, AI, d);
      for (const m of moves) {
        const s = scoreAiMove(m);
        if (s > bestScore) { bestScore = s; best = m; bestDieSlot = i; }
      }
    }
    if (!best) { diceUsed = diceUsed.map(() => true); finishAiTurn(); return; }

    setTimeout(() => {
      applyMove(board, bar, off, AI, best);
      diceUsed[bestDieSlot] = true;
      renderDice(); renderBoard();
      if ((off[AI] || 0) >= 15) { endGame('lose'); return; }
      aiTurn();
    }, 550);
  }

  function finishAiTurn() {
    turn = PLAYER;
    setStatus('');
    startPlayerTurn();
  }

  function startPlayerTurn() {
    dice = rollDice();
    diceUsed = dice.map(() => false);
    selectedFrom = null; legalFromPoints = null;
    renderDice(); renderBoard();
    if (!anyLegalMoveExists(PLAYER) && bar[PLAYER] === 0) {
      setStatus('이번 턴엔 둘 수 있는 수가 없습니다. AI에게 넘어갑니다.');
      setTimeout(() => { turn = AI; aiTurn(); }, 900);
    } else if (bar[PLAYER] > 0) {
      setStatus('바에 있는 말을 먼저 들여놓으세요. 바를 클릭하세요.');
    } else {
      setStatus('말을 클릭해서 이동하세요.');
    }
  }

  function reset() {
    board = initBoard();
    bar = { [PLAYER]: 0, [AI]: 0 };
    off = { [PLAYER]: 0, [AI]: 0 };
    gameOver = false; awarded = false; turn = PLAYER;
    setPointsMsg('15개 말을 모두 먼저 빼내면(베어오프) 승리합니다.');
    startPlayerTurn();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="bg-turn-a" class="game-turn-pill">⚫ AI</span>
        <span id="bg-off-a" class="bg-off-pill"></span>
        <span id="bg-turn-p" class="game-turn-pill">⚪ 당신</span>
        <span id="bg-off-p" class="bg-off-pill"></span>
      </div>
      <div id="bg-dice" class="bg-dice"></div>
      <div class="bg-board">
        <div id="bg-row-top" class="bg-row"></div>
        <div class="bg-bar-row">
          <span id="bg-bar-a" class="bg-bar-pill"></span>
          <button class="game-btn ghost" id="bg-bearoff-btn" style="font-size:11px;padding:6px 14px;">베어오프</button>
          <span id="bg-bar-p" class="bg-bar-pill"></span>
        </div>
        <div id="bg-row-bot" class="bg-row"></div>
      </div>
      <div id="bg-result" class="game-result-msg"></div>
      <div id="bg-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="bg-restart-btn">새 게임</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('bg-bar-p').addEventListener('click', onBarClick);
    document.getElementById('bg-bearoff-btn').addEventListener('click', onBearOffClick);
    document.getElementById('bg-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.BackgammonGame = { start };
})(window);

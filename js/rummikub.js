/* ============================================================
   ICOC OMNIPO — 루미큐브 (Rummikub) vs AI
   104개 타일(1~13 x 4색 x 2벌 + 조커 2개). 손패를 모두 비우면 승리.
   유효한 조합: 런(run, 같은 색 연속 숫자 3개 이상) 또는 그룹(group, 같은 숫자 다른 색 3~4개).
   (단순화: 테이블에 이미 깔린 조합을 재배열하는 룰은 생략 — 새 조합을 내거나
    기존 런 끝에 이어붙이는 것만 가능. 첫 턴 30점 이상 규칙도 생략.)
   ============================================================ */

(function (global) {
  const COLORS = ['red', 'blue', 'black', 'yellow'];
  const COLOR_LABEL = { red: '🔴', blue: '🔵', black: '⚫', yellow: '🟡' };
  const PLAYER = 'player', AI = 'ai';

  let deck, playerHand, aiHand, table; // table = [[tile,...], [tile,...], ...] 그룹들의 배열
  let turn, gameOver, awarded, selectedIds, pendingPlacement;

  function freshDeck() {
    const d = [];
    let id = 0;
    for (let copy = 0; copy < 2; copy++) {
      for (const c of COLORS) for (let n = 1; n <= 13; n++) d.push({ id: id++, color: c, num: n, joker: false });
    }
    d.push({ id: id++, color: null, num: null, joker: true });
    d.push({ id: id++, color: null, num: null, joker: true });
    return d;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ── 조합 유효성 검사 ──
  function isValidGroup(tiles) {
    // 같은 숫자, 서로 다른 색 3~4개 (조커는 어떤 색으로든 대체 가능)
    if (tiles.length < 3 || tiles.length > 4) return false;
    const nonJokers = tiles.filter(t => !t.joker);
    if (nonJokers.length === 0) return false;
    const num = nonJokers[0].num;
    if (!nonJokers.every(t => t.num === num)) return false;
    const colorsUsed = new Set(nonJokers.map(t => t.color));
    if (colorsUsed.size !== nonJokers.length) return false; // 같은 색 중복 금지
    return true;
  }

  function isValidRun(tiles) {
    // 같은 색, 연속된 숫자 3개 이상 (조커는 빈 자리를 대체)
    if (tiles.length < 3) return false;
    const nonJokers = tiles.filter(t => !t.joker);
    if (nonJokers.length === 0) return false;
    const color = nonJokers[0].color;
    if (!nonJokers.every(t => t.color === color)) return false;
    // 조커를 어디에 둘지 몰라도, 순서대로 늘어놓고 빈틈을 조커가 메울 수 있는지 검사
    // tiles는 이미 "놓을 순서대로" 주어진다고 가정 (UI에서 순서 보장)
    let expectedStart = null;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].joker) continue;
      const slotNum = tiles[i].num - i;
      if (expectedStart === null) expectedStart = slotNum;
      else if (slotNum !== expectedStart) return false;
    }
    if (expectedStart === null) return false;
    if (expectedStart < 1 || expectedStart + tiles.length - 1 > 13) return false;
    return true;
  }

  function isValidCombo(tiles) {
    return isValidGroup(tiles) || isValidRun(tiles);
  }

  function tileValue(t) { return t.joker ? 0 : t.num; }

  // ── 기존 런 끝에 이어붙일 수 있는지 체크 (단순화된 유일한 "테이블 조작") ──
  function canAppendToRun(group, tile) {
    if (!isValidRun(group)) return null;
    const nonJokers = group.filter(t => !t.joker);
    if (nonJokers.length === 0 || tile.joker) return null;
    if (tile.color !== nonJokers[0].color) return null;
    let expectedStart = null;
    for (let i = 0; i < group.length; i++) {
      if (group[i].joker) continue;
      const slotNum = group[i].num - i;
      if (expectedStart === null) expectedStart = slotNum;
    }
    const lowEnd = expectedStart, highEnd = expectedStart + group.length - 1;
    if (tile.num === highEnd + 1 && highEnd + 1 <= 13) return 'end';
    if (tile.num === lowEnd - 1 && lowEnd - 1 >= 1) return 'start';
    return null;
  }

  function setStatus(msg) { const el = document.getElementById('rk-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('rk-points-msg'); if (el) el.textContent = msg || ''; }

  function tileEl(t, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'rk-tile' + (t.joker ? ' rk-tile-joker' : ' rk-tile-' + t.color) + (opts.selected ? ' rk-tile-selected' : '') + (opts.clickable ? ' om-pickable' : '');
    el.textContent = t.joker ? '★' : t.num;
    if (opts.onClick) el.addEventListener('click', opts.onClick);
    return el;
  }

  function renderTable() {
    const el = document.getElementById('rk-table');
    el.innerHTML = '';
    table.forEach((group, gi) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'rk-group';
      group.forEach(t => groupEl.appendChild(tileEl(t)));
      if (pendingPlacement && pendingPlacement.mode === 'append') {
        const appendable = canAppendToRun(group, playerHand.find(t => t.id === selectedIds[0]));
        if (appendable) {
          groupEl.classList.add('rk-group-targetable');
          groupEl.addEventListener('click', () => onAppendToGroup(gi));
        }
      }
      el.appendChild(groupEl);
    });
    if (table.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'rk-table-empty';
      empty.textContent = '테이블이 비어있습니다.';
      el.appendChild(empty);
    }
  }

  function renderHand() {
    const el = document.getElementById('rk-hand');
    el.innerHTML = '';
    const sorted = playerHand.slice().sort((a, b) => (a.joker ? 99 : a.num) - (b.joker ? 99 : b.num) || (a.color || '').localeCompare(b.color || ''));
    sorted.forEach(t => {
      const clickable = turn === PLAYER && !gameOver;
      el.appendChild(tileEl(t, {
        clickable, selected: selectedIds.includes(t.id),
        onClick: clickable ? () => onToggleSelect(t) : null
      }));
    });
    document.getElementById('rk-hand-count').textContent = playerHand.length;
    document.getElementById('rk-ai-count').textContent = aiHand.length;
    document.getElementById('rk-deck-count').textContent = deck.length;
  }

  function renderActionState() {
    const selectedTiles = playerHand.filter(t => selectedIds.includes(t.id));
    const playBtn = document.getElementById('rk-play-btn');
    const appendBtn = document.getElementById('rk-append-btn');
    playBtn.disabled = !(turn === PLAYER && !gameOver && selectedTiles.length >= 3 && isValidCombo(selectedTiles));
    appendBtn.disabled = !(turn === PLAYER && !gameOver && selectedTiles.length === 1 && table.some(g => canAppendToRun(g, selectedTiles[0])));
    document.getElementById('rk-turn-p').classList.toggle('active', turn === PLAYER && !gameOver);
    document.getElementById('rk-turn-a').classList.toggle('active', turn === AI && !gameOver);
  }

  function renderAll() { renderTable(); renderHand(); renderActionState(); }

  function onToggleSelect(t) {
    if (turn !== PLAYER || gameOver) return;
    pendingPlacement = null;
    if (selectedIds.includes(t.id)) selectedIds = selectedIds.filter(id => id !== t.id);
    else selectedIds = selectedIds.concat([t.id]);
    renderAll();
  }

  function onPlayCombo() {
    const tiles = playerHand.filter(t => selectedIds.includes(t.id));
    if (tiles.length < 3 || !isValidCombo(tiles)) { global.ICOC_POINTS.showToast('유효한 조합이 아닙니다 (같은 숫자 다른 색 3~4개, 또는 같은 색 연속 숫자 3개 이상).'); return; }
    table.push(tiles);
    playerHand = playerHand.filter(t => !selectedIds.includes(t.id));
    selectedIds = [];
    setStatus('새 조합을 테이블에 냈습니다.');
    afterPlayerAction();
  }

  function onStartAppend() {
    const tiles = playerHand.filter(t => selectedIds.includes(t.id));
    if (tiles.length !== 1) { global.ICOC_POINTS.showToast('이어붙일 타일을 하나만 선택하세요.'); return; }
    const hasTarget = table.some(g => canAppendToRun(g, tiles[0]));
    if (!hasTarget) { global.ICOC_POINTS.showToast('이 타일을 이어붙일 수 있는 런이 테이블에 없습니다.'); return; }
    pendingPlacement = { mode: 'append' };
    setStatus('이어붙일 런(연속 숫자 묶음)을 테이블에서 클릭하세요.');
    renderAll();
  }

  function onAppendToGroup(groupIndex) {
    const tile = playerHand.find(t => t.id === selectedIds[0]);
    const side = canAppendToRun(table[groupIndex], tile);
    if (!side) return;
    if (side === 'end') table[groupIndex].push(tile);
    else table[groupIndex].unshift(tile);
    playerHand = playerHand.filter(t => t.id !== tile.id);
    selectedIds = []; pendingPlacement = null;
    setStatus('런에 타일을 이어붙였습니다.');
    afterPlayerAction();
  }

  function onDraw() {
    if (turn !== PLAYER || gameOver) return;
    if (deck.length === 0) { global.ICOC_POINTS.showToast('더 이상 뽑을 타일이 없습니다.'); return; }
    playerHand.push(deck.pop());
    setStatus('타일을 한 개 뽑았습니다. AI 차례입니다.');
    selectedIds = []; pendingPlacement = null;
    renderAll();
    if (playerHand.length === 0) { endGame('win'); return; }
    turn = AI;
    renderAll();
    setTimeout(aiTurn, 700);
  }

  function afterPlayerAction() {
    pendingPlacement = null;
    renderAll();
    if (playerHand.length === 0) { endGame('win'); return; }
  }

  // ── AI ──
  function findAnyValidComboFromHand(hand) {
    // 숫자별 그룹 후보
    const byNum = {};
    hand.forEach(t => { if (!t.joker) (byNum[t.num] = byNum[t.num] || []).push(t); });
    for (const num in byNum) {
      const cands = byNum[num];
      const uniqueColors = [];
      const seen = new Set();
      cands.forEach(t => { if (!seen.has(t.color)) { seen.add(t.color); uniqueColors.push(t); } });
      if (uniqueColors.length >= 3) return uniqueColors.slice(0, 4);
    }
    // 색별 런 후보
    const byColor = {};
    hand.forEach(t => { if (!t.joker) (byColor[t.color] = byColor[t.color] || []).push(t); });
    for (const color in byColor) {
      const nums = byColor[color].map(t => t.num).sort((a, b) => a - b);
      for (let i = 0; i + 2 < nums.length; i++) {
        if (nums[i + 1] === nums[i] + 1 && nums[i + 2] === nums[i] + 2) {
          let run = [nums[i], nums[i + 1], nums[i + 2]];
          let j = i + 3;
          while (j < nums.length && nums[j] === run[run.length - 1] + 1) { run.push(nums[j]); j++; }
          return run.map(n => byColor[color].find(t => t.num === n));
        }
      }
    }
    return null;
  }

  function findAnyAppend(hand, tableGroups) {
    for (const t of hand) {
      if (t.joker) continue;
      for (let gi = 0; gi < tableGroups.length; gi++) {
        const side = canAppendToRun(tableGroups[gi], t);
        if (side) return { tile: t, groupIndex: gi, side };
      }
    }
    return null;
  }

  function aiTurn() {
    if (gameOver) return;
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const combo = findAnyValidComboFromHand(aiHand);
      if (combo) {
        table.push(combo);
        aiHand = aiHand.filter(t => !combo.includes(t));
        setStatus('AI가 새 조합을 냈습니다.');
        renderAll();
        if (aiHand.length === 0) { endGame('lose'); return; }
        setTimeout(aiTurn, 600); // 추가로 더 낼 수 있으면 계속 (단순화: 1턴에 최대 2회 시도)
        return;
      }
      const appendMove = findAnyAppend(aiHand, table);
      if (appendMove) {
        if (appendMove.side === 'end') table[appendMove.groupIndex].push(appendMove.tile);
        else table[appendMove.groupIndex].unshift(appendMove.tile);
        aiHand = aiHand.filter(t => t.id !== appendMove.tile.id);
        setStatus('AI가 런에 타일을 이어붙였습니다.');
        renderAll();
        if (aiHand.length === 0) { endGame('lose'); return; }
        finishAiTurn();
        return;
      }
      if (deck.length > 0) { aiHand.push(deck.pop()); setStatus('AI가 타일을 뽑았습니다.'); }
      finishAiTurn();
    }, 700);
  }

  function finishAiTurn() {
    turn = PLAYER;
    renderAll();
    if (deck.length === 0 && handsStuck()) { resolveDeckExhausted(); return; }
    setStatus('당신의 차례입니다.');
  }

  function handsStuck() {
    return findAnyValidComboFromHand(playerHand) === null && findAnyAppend(playerHand, table) === null &&
      findAnyValidComboFromHand(aiHand) === null && findAnyAppend(aiHand, table) === null;
  }

  function resolveDeckExhausted() {
    const pCount = playerHand.length, aCount = aiHand.length;
    if (pCount < aCount) endGame('win');
    else if (aCount < pCount) endGame('lose');
    else endGame('draw');
  }

  function endGame(result) {
    gameOver = true;
    renderAll();
    let pts;
    if (result === 'win') { setStatus('🎉 손패를 먼저 비웠습니다! 승리!'); pts = 30; }
    else if (result === 'lose') { setStatus('AI가 먼저 손패를 비웠습니다. 패배입니다.'); pts = 15; }
    else { setStatus('더 이상 진행할 수 없어 무승부로 종료되었습니다.'); pts = 20; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'rummikub_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function reset() {
    deck = shuffle(freshDeck());
    playerHand = deck.splice(0, 14);
    aiHand = deck.splice(0, 14);
    table = [];
    turn = PLAYER; gameOver = false; awarded = false; selectedIds = []; pendingPlacement = null;
    setStatus('타일을 선택해서 조합을 내거나, 기존 런에 이어붙이세요.');
    setPointsMsg('손패를 먼저 모두 비우면 승리합니다.');
    renderAll();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="rk-turn-a" class="game-turn-pill">🤖 AI · <span id="rk-ai-count"></span>개</span>
        <span id="rk-turn-p" class="game-turn-pill">😊 당신 · <span id="rk-hand-count"></span>개</span>
      </div>
      <div class="gs-panel">
        <div class="gs-panel-header">
          <span class="gs-panel-title">🀫 테이블</span>
          <span class="gs-panel-meta">덱 <span id="rk-deck-count"></span>개</span>
        </div>
        <div id="rk-table" class="rk-table"></div>
      </div>
      <div class="gs-panel">
        <div class="gs-panel-header">
          <span class="gs-panel-title">😊 내 타일</span>
        </div>
        <div id="rk-hand" class="rk-table"></div>
      </div>
      <div id="rk-result" class="game-result-msg"></div>
      <div id="rk-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="rk-play-btn">조합 내기</button>
        <button class="game-btn ghost" id="rk-append-btn">런에 이어붙이기</button>
        <button class="game-btn ghost" id="rk-draw-btn">타일 뽑기</button>
      </div>
      <div class="game-actions">
        <button class="game-btn primary" id="rk-restart-btn">새 게임</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('rk-play-btn').addEventListener('click', onPlayCombo);
    document.getElementById('rk-append-btn').addEventListener('click', onStartAppend);
    document.getElementById('rk-draw-btn').addEventListener('click', onDraw);
    document.getElementById('rk-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.RummikubGame = { start };
})(window);

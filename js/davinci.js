/* ============================================================
   ICOC OMNIPO — 다빈치 코드 (Da Vinci Code) vs AI
   0~11 숫자 x 흑/백 2색 = 24개 타일. 각자 4개씩 받아 오름차순 정렬.
   상대 타일의 숫자+색을 맞히면 공개되고 한 번 더 추측 가능, 틀리면 턴 종료.
   상대의 타일 전부를 공개시키면 승리.
   (단순화: 카드 더미에서 추가로 뽑는 단계는 생략 — 각자 4개로 한 판 승부)
   ============================================================ */

(function (global) {
  const NUMS = Array.from({ length: 12 }, (_, i) => i); // 0~11
  const COLORS = ['B', 'W'];
  const PLAYER = 'player', AI = 'ai';

  let playerHand, aiHand, turn, gameOver, awarded, pendingGuessSlot;

  function tileKey(t) { return t.num + t.color; }

  function fullTileSet() {
    const tiles = [];
    for (const n of NUMS) for (const c of COLORS) tiles.push({ num: n, color: c, revealed: false });
    return tiles;
  }

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function sortHand(hand) {
    hand.sort((a, b) => a.num - b.num || (a.color === b.color ? 0 : a.color === 'B' ? -1 : 1));
  }

  // ── 추론: 정렬 순서 제약 + 이미 알고 있는 타일(자기 손패/공개된 타일) 제외 ──
  function computeCandidates(hand, slotIndex, knownElsewhereKeys) {
    let lower = 0, upper = 11;
    for (let i = slotIndex - 1; i >= 0; i--) {
      if (hand[i].revealed) { lower = hand[i].num; break; }
    }
    for (let i = slotIndex + 1; i < hand.length; i++) {
      if (hand[i].revealed) { upper = hand[i].num; break; }
    }
    const candidates = [];
    for (const n of NUMS) {
      if (n < lower || n > upper) continue;
      for (const c of COLORS) {
        const key = n + c;
        if (knownElsewhereKeys.has(key)) continue;
        candidates.push({ num: n, color: c });
      }
    }
    return candidates;
  }

  function allRevealedKeys() {
    const keys = new Set();
    [...playerHand, ...aiHand].forEach(t => { if (t.revealed) keys.add(tileKey(t)); });
    return keys;
  }

  function isFullyRevealed(hand) { return hand.every(t => t.revealed); }

  function setStatus(msg) { const el = document.getElementById('dv-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('dv-points-msg'); if (el) el.textContent = msg || ''; }

  function colorLabel(c) { return c === 'B' ? '흑' : '백'; }

  function tileFaceEl(t) {
    const el = document.createElement('div');
    el.className = 'dv-tile dv-tile-' + (t.color === 'B' ? 'black' : 'white');
    el.innerHTML = `<span>${t.num}</span>`;
    return el;
  }

  function closeGuessPicker() {
    const picker = document.getElementById('dv-picker');
    if (picker) picker.remove();
    pendingGuessSlot = null;
  }

  function openGuessPicker(slotIndex) {
    closeGuessPicker();
    pendingGuessSlot = slotIndex;
    const knownKeys = new Set();
    playerHand.forEach(t => knownKeys.add(tileKey(t)));
    allRevealedKeys().forEach(k => knownKeys.add(k));

    const picker = document.createElement('div');
    picker.id = 'dv-picker';
    picker.className = 'dv-picker';
    NUMS.forEach(n => {
      COLORS.forEach(c => {
        const key = n + c;
        const btn = document.createElement('button');
        btn.className = 'dv-picker-btn dv-picker-' + (c === 'B' ? 'black' : 'white');
        btn.textContent = n;
        if (knownKeys.has(key)) { btn.disabled = true; btn.classList.add('dv-picker-disabled'); }
        else btn.addEventListener('click', () => onPlayerGuess(slotIndex, n, c));
        picker.appendChild(btn);
      });
    });
    document.getElementById('dv-ai-row').insertAdjacentElement('afterend', picker);
  }

  function renderHands() {
    const aiRow = document.getElementById('dv-ai-row');
    const pRow = document.getElementById('dv-player-row');
    aiRow.innerHTML = ''; pRow.innerHTML = '';

    aiHand.forEach((t, i) => {
      if (t.revealed) {
        aiRow.appendChild(tileFaceEl(t));
      } else {
        const back = document.createElement('div');
        back.className = 'dv-tile dv-tile-back';
        back.textContent = '?';
        if (turn === PLAYER && !gameOver) {
          back.classList.add('dv-pickable');
          back.addEventListener('click', () => openGuessPicker(i));
        }
        aiRow.appendChild(back);
      }
    });

    playerHand.forEach(t => pRow.appendChild(tileFaceEl(t)));

    document.getElementById('dv-turn-p').classList.toggle('active', turn === PLAYER && !gameOver);
    document.getElementById('dv-turn-a').classList.toggle('active', turn === AI && !gameOver);
  }

  function endGame(result) {
    gameOver = true;
    closeGuessPicker();
    renderHands();
    let pts;
    if (result === 'win') { setStatus('🎉 AI의 모든 타일을 맞혔습니다! 승리!'); pts = 30; }
    else { setStatus('당신의 모든 타일이 공개되었습니다. 패배입니다.'); pts = 10; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'davinci_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function onPlayerGuess(slotIndex, num, color) {
    closeGuessPicker();
    const tile = aiHand[slotIndex];
    if (tile.num === num && tile.color === color) {
      tile.revealed = true;
      renderHands();
      if (isFullyRevealed(aiHand)) { endGame('win'); return; }
      setStatus(`정답! (${colorLabel(color)} ${num}) 한 번 더 추측할 수 있습니다.`);
      global.ICOC_POINTS.showToast('정답입니다! 계속 추측하세요.');
    } else {
      setStatus(`오답입니다. (${colorLabel(color)} ${num}이 아닙니다) AI 차례로 넘어갑니다.`);
      turn = AI;
      renderHands();
      setTimeout(aiTurn, 700);
    }
  }

  function aiTurn() {
    if (gameOver) return;
    setStatus('AI가 추측 중...');
    setTimeout(() => {
      const knownKeys = new Set();
      aiHand.forEach(t => knownKeys.add(tileKey(t)));
      allRevealedKeys().forEach(k => knownKeys.add(k));

      // 플레이어의 숨겨진 슬롯들에 대해 후보 수를 계산, 가장 후보가 적은 슬롯을 공략
      let bestSlot = -1, bestCandidates = null;
      for (let i = 0; i < playerHand.length; i++) {
        if (playerHand[i].revealed) continue;
        const cands = computeCandidates(playerHand, i, knownKeys);
        if (bestCandidates === null || cands.length < bestCandidates.length) {
          bestCandidates = cands; bestSlot = i;
        }
      }
      if (bestSlot === -1 || !bestCandidates || bestCandidates.length === 0) {
        // 안전장치: 후보가 없으면(이론상 발생 안 함) 턴 종료
        turn = PLAYER; setStatus(''); renderHands();
        return;
      }
      const guess = bestCandidates[Math.floor(Math.random() * bestCandidates.length)];
      const tile = playerHand[bestSlot];
      if (tile.num === guess.num && tile.color === guess.color) {
        tile.revealed = true;
        renderHands();
        if (isFullyRevealed(playerHand)) { endGame('lose'); return; }
        setStatus(`AI가 정답을 맞혔습니다! (${colorLabel(tile.color)} ${tile.num}) AI가 계속합니다.`);
        setTimeout(aiTurn, 900);
      } else {
        setStatus('AI가 오답을 말했습니다. 당신의 차례입니다.');
        turn = PLAYER;
        renderHands();
      }
    }, 600);
  }

  function reset() {
    const tiles = shuffle(fullTileSet());
    playerHand = tiles.slice(0, 4).map(t => ({ ...t }));
    aiHand = tiles.slice(4, 8).map(t => ({ ...t }));
    sortHand(playerHand); sortHand(aiHand);
    turn = PLAYER; gameOver = false; awarded = false;
    closeGuessPicker();
    setStatus('AI의 숨겨진 타일을 클릭해서 숫자와 색을 추측하세요.');
    setPointsMsg('상대의 타일 4개를 모두 맞히면 승리합니다.');
    renderHands();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="dv-turn-a" class="game-turn-pill">🔢 AI</span>
        <span id="dv-turn-p" class="game-turn-pill">🔢 당신</span>
      </div>
      <div class="bj-hand-area">
        <div class="bj-hand-label">AI 타일</div>
        <div id="dv-ai-row" class="dv-tile-row"></div>
      </div>
      <div class="bj-hand-area">
        <div class="bj-hand-label">당신의 타일</div>
        <div id="dv-player-row" class="dv-tile-row"></div>
      </div>
      <div id="dv-result" class="game-result-msg"></div>
      <div id="dv-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="dv-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('dv-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.DaVinciGame = { start };
})(window);

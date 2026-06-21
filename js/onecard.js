/* ============================================================
   ICOC OMNIPO — 원카드 (One Card) vs AI
   표준 52매. 던지는 카드는 직전 카드와 같은 숫자(rank) 또는 같은 모양(suit)일 때만 낼 수 있음.
   낼 카드가 없으면 1장 뽑고 턴 종료. 손패를 먼저 비우면 승리.
   ============================================================ */

(function (global) {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const PLAYER = 'player', AI = 'ai';

  let deck, discard, playerHand, aiHand, turn, gameOver, awarded;

  function freshDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function topDiscard() { return discard[discard.length - 1]; }

  function canPlay(card) {
    const top = topDiscard();
    return card.rank === top.rank || card.suit === top.suit;
  }

  function drawCard() {
    if (deck.length === 0) {
      // 버린 카드 더미(맨 위 카드 제외)를 다시 섞어 새 더미로 사용
      const top = discard.pop();
      deck = discard;
      discard = [top];
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
    }
    if (deck.length === 0) return null; // 안전장치: 정말 카드가 없으면 null
    return deck.pop();
  }

  function setStatus(msg) { const el = document.getElementById('oc-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('oc-points-msg'); if (el) el.textContent = msg || ''; }

  function cardFaceEl(card, clickable) {
    const el = document.createElement('div');
    el.className = 'bj-card oc-card' + (card.suit === '♥' || card.suit === '♦' ? ' bj-red' : '') + (clickable ? ' om-pickable' : '');
    el.innerHTML = `<span>${card.rank}</span><span class="bj-suit">${card.suit}</span>`;
    return el;
  }

  function renderAll() {
    const pEl = document.getElementById('oc-player-cards');
    const aEl = document.getElementById('oc-ai-cards');
    const dEl = document.getElementById('oc-discard');
    pEl.innerHTML = ''; aEl.innerHTML = ''; dEl.innerHTML = '';

    playerHand.forEach((c, i) => {
      const playable = turn === PLAYER && !gameOver && canPlay(c);
      const el = cardFaceEl(c, playable);
      if (playable) el.addEventListener('click', () => onPlayerPlay(i));
      else if (turn === PLAYER && !gameOver) el.classList.add('oc-card-disabled');
      pEl.appendChild(el);
    });

    aiHand.forEach(() => {
      const back = document.createElement('div');
      back.className = 'bj-card bj-card-back oc-card';
      aEl.appendChild(back);
    });

    dEl.appendChild(cardFaceEl(topDiscard(), false));

    document.getElementById('oc-player-count').textContent = `${playerHand.length}장`;
    document.getElementById('oc-ai-count').textContent = `${aiHand.length}장`;
    document.getElementById('oc-deck-count').textContent = `${deck.length}장`;
    document.getElementById('oc-turn-p').classList.toggle('active', turn === PLAYER && !gameOver);
    document.getElementById('oc-turn-a').classList.toggle('active', turn === AI && !gameOver);

    const anyPlayable = playerHand.some(canPlay);
    document.getElementById('oc-draw-btn').disabled = !(turn === PLAYER && !gameOver && !anyPlayable);
  }

  function endGame(result) {
    gameOver = true;
    renderAll();
    let pts;
    if (result === 'win') { setStatus('🎉 손패를 먼저 비웠습니다! 승리!'); pts = 30; }
    else { setStatus('AI가 먼저 손패를 비웠습니다. 패배입니다.'); pts = 10; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'onecard_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function onPlayerPlay(index) {
    if (gameOver || turn !== PLAYER) return;
    const card = playerHand[index];
    if (!canPlay(card)) return;
    playerHand.splice(index, 1);
    discard.push(card);
    if (playerHand.length === 0) { endGame('win'); return; }
    turn = AI;
    setStatus('');
    renderAll();
    setTimeout(aiTurn, 600);
  }

  function onPlayerDraw() {
    if (gameOver || turn !== PLAYER) return;
    if (playerHand.some(canPlay)) return; // 낼 수 있으면 뽑기 불가 (강제 아님, 그냥 막음)
    const card = drawCard();
    if (card) playerHand.push(card);
    turn = AI;
    setStatus('카드를 뽑았습니다. AI 차례입니다.');
    renderAll();
    setTimeout(aiTurn, 600);
  }

  function aiTurn() {
    if (gameOver) return;
    setStatus('AI가 생각 중...');
    setTimeout(() => {
      const playable = aiHand.filter(canPlay);
      if (playable.length > 0) {
        const choice = playable[Math.floor(Math.random() * playable.length)];
        const idx = aiHand.indexOf(choice);
        aiHand.splice(idx, 1);
        discard.push(choice);
        if (aiHand.length === 0) { endGame('lose'); return; }
        setStatus('');
      } else {
        const card = drawCard();
        if (card) aiHand.push(card);
        setStatus('AI가 카드를 뽑았습니다.');
      }
      turn = PLAYER;
      renderAll();
    }, 500);
  }

  function reset() {
    deck = freshDeck();
    playerHand = []; aiHand = [];
    for (let i = 0; i < 7; i++) { playerHand.push(deck.pop()); aiHand.push(deck.pop()); }
    discard = [deck.pop()];
    turn = PLAYER; gameOver = false; awarded = false;
    setStatus('직전 카드와 같은 숫자 또는 같은 모양의 카드를 내세요.');
    setPointsMsg('손패를 먼저 모두 비우면 승리합니다.');
    renderAll();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="oc-turn-a" class="game-turn-pill">🂠 AI · <span id="oc-ai-count"></span></span>
        <span id="oc-turn-p" class="game-turn-pill">🂠 당신 · <span id="oc-player-count"></span></span>
      </div>
      <div class="bj-hand-area">
        <div class="bj-hand-label">AI 손패</div>
        <div id="oc-ai-cards" class="bj-cards"></div>
      </div>
      <div class="bj-hand-area">
        <div class="bj-hand-label">버린 카드 더미 · 남은 카드 <span id="oc-deck-count"></span></div>
        <div id="oc-discard" class="bj-cards"></div>
      </div>
      <div class="bj-hand-area">
        <div class="bj-hand-label">당신의 손패</div>
        <div id="oc-player-cards" class="bj-cards"></div>
      </div>
      <div id="oc-result" class="game-result-msg"></div>
      <div id="oc-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="oc-draw-btn">카드 뽑기</button>
        <button class="game-btn ghost" id="oc-restart-btn">새 게임</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('oc-draw-btn').addEventListener('click', onPlayerDraw);
    document.getElementById('oc-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.OneCardGame = { start };
})(window);

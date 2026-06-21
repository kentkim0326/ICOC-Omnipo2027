/* ============================================================
   ICOC OMNIPO — 블랙잭 (Blackjack) vs AI 딜러
   표준 룰: 21 초과시 버스트, 딜러는 17 이상까지 무조건 히트.
   베팅 없음 — 승/무/패에 따라 고정 포인트만 지급 (게임머니 전용).
   ============================================================ */

(function (global) {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  let deck, playerHand, dealerHand, gameOver, awarded, phase; // phase: 'player' | 'dealer' | 'done'

  function freshDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function cardValue(card) {
    if (card.rank === 'A') return 11;
    if (['J', 'Q', 'K'].includes(card.rank)) return 10;
    return parseInt(card.rank, 10);
  }

  function handValue(hand) {
    let total = hand.reduce((s, c) => s + cardValue(c), 0);
    let aces = hand.filter(c => c.rank === 'A').length;
    while (total > 21 && aces > 0) { total -= 10; aces--; }
    return total;
  }

  function isBlackjack(hand) { return hand.length === 2 && handValue(hand) === 21; }

  function draw() {
    if (deck.length === 0) deck = freshDeck();
    return deck.pop();
  }

  function setStatus(msg) { const el = document.getElementById('bj-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('bj-points-msg'); if (el) el.textContent = msg || ''; }

  function cardEl(card, faceDown) {
    const el = document.createElement('div');
    el.className = 'bj-card' + (faceDown ? ' bj-card-back' : '') + (!faceDown && (card.suit === '♥' || card.suit === '♦') ? ' bj-red' : '');
    if (!faceDown) el.innerHTML = `<span>${card.rank}</span><span class="bj-suit">${card.suit}</span>`;
    return el;
  }

  function renderHands() {
    const pEl = document.getElementById('bj-player-cards');
    const dEl = document.getElementById('bj-dealer-cards');
    pEl.innerHTML = ''; dEl.innerHTML = '';
    playerHand.forEach(c => pEl.appendChild(cardEl(c, false)));
    dealerHand.forEach((c, i) => dEl.appendChild(cardEl(c, phase === 'player' && i === 1)));

    document.getElementById('bj-player-total').textContent = `합계: ${handValue(playerHand)}`;
    const dealerVisibleTotal = phase === 'player' ? cardValue(dealerHand[0]) + (dealerHand[0].rank === 'A' ? 0 : 0) : handValue(dealerHand);
    document.getElementById('bj-dealer-total').textContent = phase === 'player' ? `합계: ${cardValue(dealerHand[0])} + ?` : `합계: ${handValue(dealerHand)}`;
  }

  function setActionsEnabled(enabled) {
    document.getElementById('bj-hit-btn').disabled = !enabled;
    document.getElementById('bj-stand-btn').disabled = !enabled;
    document.getElementById('bj-double-btn').disabled = !enabled || playerHand.length !== 2;
  }

  function endRound(result, label) {
    gameOver = true; phase = 'done';
    renderHands();
    setActionsEnabled(false);
    setStatus(label);
    let pts;
    if (result === 'win') pts = 30;
    else if (result === 'lose') pts = 10;
    else pts = 15;
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'blackjack_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function dealerPlay() {
    phase = 'dealer';
    renderHands();
    setStatus('딜러가 카드를 뽑는 중...');
    setTimeout(function step() {
      const dv = handValue(dealerHand);
      if (dv < 17) {
        dealerHand.push(draw());
        renderHands();
        setTimeout(step, 600);
        return;
      }
      resolveRound();
    }, 600);
  }

  function resolveRound() {
    const pv = handValue(playerHand), dv = handValue(dealerHand);
    const playerBJ = isBlackjack(playerHand);
    if (dv > 21) { endRound('win', `🎉 딜러 버스트(${dv})! 승리했습니다.`); return; }
    if (pv > dv) { endRound('win', `🎉 승리! (${pv} : ${dv})`); return; }
    if (pv < dv) { endRound('lose', `패배. (${pv} : ${dv})`); return; }
    if (playerBJ && !isBlackjack(dealerHand)) { endRound('win', `🎉 블랙잭! 승리했습니다.`); return; }
    endRound('draw', `푸시(무승부). (${pv} : ${dv})`);
  }

  function onHit() {
    if (gameOver || phase !== 'player') return;
    playerHand.push(draw());
    renderHands();
    const pv = handValue(playerHand);
    if (pv > 21) { endRound('lose', `버스트! (${pv}) 패배입니다.`); return; }
    if (pv === 21) onStand();
    else setActionsEnabled(true);
  }

  function onStand() {
    if (gameOver || phase !== 'player') return;
    setActionsEnabled(false);
    dealerPlay();
  }

  function onDouble() {
    if (gameOver || phase !== 'player' || playerHand.length !== 2) return;
    playerHand.push(draw());
    renderHands();
    const pv = handValue(playerHand);
    if (pv > 21) { endRound('lose', `더블 다운 후 버스트! (${pv}) 패배입니다. (포인트는 2배 차감되지 않습니다)`); return; }
    setActionsEnabled(false);
    dealerPlay();
  }

  function reset() {
    deck = freshDeck();
    playerHand = [draw(), draw()];
    dealerHand = [draw(), draw()];
    gameOver = false; awarded = false; phase = 'player';
    setStatus('');
    setPointsMsg('카드 합이 21을 넘지 않으면서 딜러보다 높으면 승리합니다.');
    renderHands();
    setActionsEnabled(true);

    if (isBlackjack(playerHand)) {
      setTimeout(() => {
        if (isBlackjack(dealerHand)) { phase = 'dealer'; endRound('draw', '둘 다 블랙잭! 푸시(무승부)입니다.'); }
        else { phase = 'dealer'; endRound('win', '🎉 블랙잭! 승리했습니다.'); }
      }, 400);
      setActionsEnabled(false);
    }
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="bj-table">
        <div class="bj-hand-area">
          <div class="bj-hand-label">딜러 (AI) <span id="bj-dealer-total" class="bj-total"></span></div>
          <div id="bj-dealer-cards" class="bj-cards"></div>
        </div>
        <div class="bj-hand-area">
          <div class="bj-hand-label">당신 <span id="bj-player-total" class="bj-total"></span></div>
          <div id="bj-player-cards" class="bj-cards"></div>
        </div>
      </div>
      <div id="bj-result" class="game-result-msg"></div>
      <div id="bj-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="bj-hit-btn">히트</button>
        <button class="game-btn primary" id="bj-stand-btn">스탠드</button>
        <button class="game-btn ghost" id="bj-double-btn">더블다운</button>
      </div>
      <div class="game-actions">
        <button class="game-btn ghost" id="bj-restart-btn">새 게임</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('bj-hit-btn').addEventListener('click', onHit);
    document.getElementById('bj-stand-btn').addEventListener('click', onStand);
    document.getElementById('bj-double-btn').addEventListener('click', onDouble);
    document.getElementById('bj-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.BlackjackGame = { start };
})(window);

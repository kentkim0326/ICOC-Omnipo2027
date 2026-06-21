/* ============================================================
   ICOC OMNIPO — 도둑잡기 (Old Maid) vs AI
   표준 52매 + 조커 1매(53매). 짝을 맞춰 버리고, 마지막까지 조커를
   들고 있는 쪽이 패배. 상대 패에서 무작위로 한 장 뽑는 방식 그대로 구현
   (실제 게임처럼 상대 카드를 볼 수 없으므로 양쪽 모두 무작위 선택).
   ============================================================ */

(function (global) {
  const SUITS = ['♠', '♥', '♦', '♣'];
  const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const JOKER = { rank: 'JOKER', suit: '' };

  let playerHand, aiHand, turn, gameOver, awarded, drawTargetMode;
  const PLAYER = 'player', AI = 'ai';

  function freshDeck() {
    const d = [];
    for (const s of SUITS) for (const r of RANKS) d.push({ rank: r, suit: s });
    d.push(JOKER);
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function cardKey(c) { return c.rank + c.suit; }

  // 같은 숫자(rank)인 카드 두 장을 찾아 전부 제거 (조커는 절대 페어 불가)
  function discardPairs(hand) {
    const byRank = {};
    hand.forEach(c => { if (c.rank !== 'JOKER') (byRank[c.rank] = byRank[c.rank] || []).push(c); });
    const toRemove = new Set();
    for (const rank in byRank) {
      const cards = byRank[rank];
      let i = 0;
      while (i + 1 < cards.length) {
        toRemove.add(cardKey(cards[i])); toRemove.add(cardKey(cards[i + 1]));
        i += 2;
      }
    }
    return hand.filter(c => !toRemove.has(cardKey(c)));
  }

  function setStatus(msg) { const el = document.getElementById('om-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('om-points-msg'); if (el) el.textContent = msg || ''; }

  function cardFaceEl(card) {
    const el = document.createElement('div');
    const isJoker = card.rank === 'JOKER';
    el.className = 'bj-card om-card' + (!isJoker && (card.suit === '♥' || card.suit === '♦') ? ' bj-red' : '') + (isJoker ? ' om-joker' : '');
    el.innerHTML = isJoker ? `<span>JOKER</span>` : `<span>${card.rank}</span><span class="bj-suit">${card.suit}</span>`;
    return el;
  }

  function renderHands() {
    const pEl = document.getElementById('om-player-cards');
    const aEl = document.getElementById('om-ai-cards');
    pEl.innerHTML = ''; aEl.innerHTML = '';

    playerHand.forEach(c => pEl.appendChild(cardFaceEl(c)));
    aiHand.forEach((c, i) => {
      const back = document.createElement('div');
      back.className = 'bj-card bj-card-back om-card';
      if (drawTargetMode && turn === PLAYER) {
        back.classList.add('om-pickable');
        back.addEventListener('click', () => onPlayerDrawFromAi(i));
      }
      aEl.appendChild(back);
    });

    document.getElementById('om-player-count').textContent = `${playerHand.length}장`;
    document.getElementById('om-ai-count').textContent = `${aiHand.length}장`;
    setTurnUI();
  }

  function setTurnUI() {
    const pPill = document.getElementById('om-turn-p');
    const aPill = document.getElementById('om-turn-a');
    pPill.classList.toggle('active', turn === PLAYER && !gameOver);
    aPill.classList.toggle('active', turn === AI && !gameOver);
  }

  function endGame(result) {
    gameOver = true;
    setTurnUI();
    let pts;
    if (result === 'win') { setStatus('🎉 승리했습니다! 조커는 AI에게 남았습니다.'); pts = 30; }
    else { setStatus('패배했습니다. 조커가 당신 손에 남았습니다.'); pts = 10; }
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'oldmaid_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function checkEndOrContinue() {
    if (playerHand.length === 0) { renderHands(); endGame('win'); return true; }
    if (aiHand.length === 0) { renderHands(); endGame('lose'); return true; }
    return false;
  }

  function onPlayerDrawFromAi(index) {
    if (gameOver || turn !== PLAYER) return;
    const [card] = aiHand.splice(index, 1);
    playerHand.push(card);
    playerHand = discardPairs(playerHand);
    drawTargetMode = false;
    renderHands();
    if (checkEndOrContinue()) return;
    turn = AI;
    setTurnUI();
    setStatus('AI 차례입니다...');
    setTimeout(aiDrawFromPlayer, 600);
  }

  function aiDrawFromPlayer() {
    if (gameOver) return;
    const idx = Math.floor(Math.random() * playerHand.length);
    const [card] = playerHand.splice(idx, 1);
    aiHand.push(card);
    aiHand = discardPairs(aiHand);
    renderHands();
    if (checkEndOrContinue()) return;
    turn = PLAYER;
    drawTargetMode = true;
    setStatus('상대 카드 중 한 장을 클릭해서 뽑으세요.');
    renderHands();
  }

  function reset() {
    let deck = freshDeck();
    playerHand = []; aiHand = [];
    deck.forEach((c, i) => (i % 2 === 0 ? playerHand : aiHand).push(c));
    playerHand = discardPairs(playerHand);
    aiHand = discardPairs(aiHand);
    turn = PLAYER; gameOver = false; awarded = false; drawTargetMode = true;
    setStatus('상대(AI) 카드 중 한 장을 클릭해서 뽑으세요. 짝이 맞으면 자동으로 버려집니다.');
    setPointsMsg('마지막까지 조커를 들고 있는 쪽이 패배합니다.');
    renderHands();

    if (checkEndOrContinue()) return; // 드물게 초기 분배에서 한쪽이 바로 0장이 되는 경우 처리
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="om-turn-a" class="game-turn-pill">🂠 AI · <span id="om-ai-count"></span></span>
        <span id="om-turn-p" class="game-turn-pill">🂠 당신 · <span id="om-player-count"></span></span>
      </div>
      <div class="bj-hand-area">
        <div class="bj-hand-label">AI 손패 (뒷면)</div>
        <div id="om-ai-cards" class="bj-cards"></div>
      </div>
      <div class="bj-hand-area">
        <div class="bj-hand-label">당신의 손패</div>
        <div id="om-player-cards" class="bj-cards"></div>
      </div>
      <div id="om-result" class="game-result-msg"></div>
      <div id="om-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="om-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('om-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.OldMaidGame = { start };
})(window);

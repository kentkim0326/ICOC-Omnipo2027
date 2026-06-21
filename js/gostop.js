/* ============================================================
   ICOC OMNIPO — 고스톱 (맞고, Go-Stop) vs AI
   화투 48매(실제 화투 이미지, hwatu-cards.webp 스프라이트 사용).
   월(月) 매칭으로 따먹기, 3장 쓸기, 점수 3점 이상시 고/스톱 선택.
   점수 체계(광/고도리/홍단·청단·초단/띠/피, 12월 광 예외) 정식 룰 반영.
   (단순화: 흔들기/뻑/따닥/폭탄 등 고급 규칙은 생략)
   ============================================================ */

(function (global) {
  const MONTH_KR = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
  const SPR_CW = 64, SPR_CH = 96; // 표시 카드 크기(px) - 손패/바닥
  const SPR_CW_SMALL = 42, SPR_CH_SMALL = 63; // 획득 패(작게 표시)

  // sprite: hwatu-cards.webp 내 (col,row) 위치, 8열x6행. 실제 이미지로 검증된 정확한 매핑.
  const RAW_CARDS = [
    { m: 1, t: "gwang", col: 0, row: 0 },
    { m: 1, t: "ribbon", color: "hong", col: 1, row: 0 },
    { m: 1, t: "junk", col: 2, row: 0 },
    { m: 1, t: "junk", col: 3, row: 0 },
    { m: 2, t: "animal", godori: true, col: 4, row: 0 },
    { m: 2, t: "ribbon", color: "hong", col: 5, row: 0 },
    { m: 2, t: "junk", col: 6, row: 0 },
    { m: 2, t: "junk", col: 7, row: 0 },
    { m: 3, t: "gwang", col: 0, row: 1 },
    { m: 3, t: "ribbon", color: "hong", col: 1, row: 1 },
    { m: 3, t: "junk", col: 2, row: 1 },
    { m: 3, t: "junk", col: 3, row: 1 },
    { m: 4, t: "animal", godori: true, col: 4, row: 1 },
    { m: 4, t: "ribbon", color: "grass", col: 5, row: 1 },
    { m: 4, t: "junk", col: 6, row: 1 },
    { m: 4, t: "junk", col: 7, row: 1 },
    { m: 5, t: "animal", col: 0, row: 2 },
    { m: 5, t: "ribbon", color: "grass", col: 1, row: 2 },
    { m: 5, t: "junk", col: 2, row: 2 },
    { m: 5, t: "junk", col: 3, row: 2 },
    { m: 6, t: "animal", col: 4, row: 2 },
    { m: 6, t: "ribbon", color: "blue", col: 5, row: 2 },
    { m: 6, t: "junk", col: 6, row: 2 },
    { m: 6, t: "junk", col: 7, row: 2 },
    { m: 7, t: "animal", col: 0, row: 3 },
    { m: 7, t: "ribbon", color: "grass", col: 1, row: 3 },
    { m: 7, t: "junk", col: 2, row: 3 },
    { m: 7, t: "junk", col: 3, row: 3 },
    { m: 8, t: "gwang", col: 4, row: 3 },
    { m: 8, t: "animal", godori: true, col: 5, row: 3 },
    { m: 8, t: "junk", col: 6, row: 3 },
    { m: 8, t: "junk", col: 7, row: 3 },
    { m: 9, t: "junk2", col: 0, row: 4 },
    { m: 9, t: "ribbon", color: "blue", col: 1, row: 4 },
    { m: 9, t: "junk", col: 2, row: 4 },
    { m: 9, t: "junk", col: 3, row: 4 },
    { m: 10, t: "animal", col: 4, row: 4 },
    { m: 10, t: "ribbon", color: "blue", col: 5, row: 4 },
    { m: 10, t: "junk", col: 6, row: 4 },
    { m: 10, t: "junk", col: 7, row: 4 },
    { m: 11, t: "gwang", col: 0, row: 5 },
    { m: 11, t: "junk", col: 1, row: 5 },
    { m: 11, t: "junk", col: 2, row: 5 },
    { m: 11, t: "junk", col: 3, row: 5 },
    { m: 12, t: "gwang", col: 4, row: 5 },
    { m: 12, t: "animal", col: 5, row: 5 },
    { m: 12, t: "ribbon", color: "grass", col: 6, row: 5 },
    { m: 12, t: "junk2", col: 7, row: 5 },
  ];
  const CARDS = RAW_CARDS.map((c, i) => ({ ...c, id: i, junkPts: c.t === "junk" ? 1 : c.t === "junk2" ? 2 : 0 }));

  const PLAYER = 'player', AI = 'ai';

  let G; // 전체 게임 상태
  let soundCtx = null;

  // ── 사운드 (Web Audio API로 직접 합성, 별도 음원 파일 불필요) ──
  function playTone(freqs, durMs, type, gainPeak) {
    try {
      if (!soundCtx) soundCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (soundCtx.state === 'suspended') soundCtx.resume();
      const ctx = soundCtx;
      const now = ctx.currentTime;
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(f, now + i * 0.085);
        gain.gain.setValueAtTime(0.0001, now + i * 0.085);
        gain.gain.linearRampToValueAtTime(gainPeak || 0.16, now + i * 0.085 + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.085 + durMs / 1000);
        osc.connect(gain); gain.connect(ctx.destination);
        osc.start(now + i * 0.085);
        osc.stop(now + i * 0.085 + durMs / 1000 + 0.02);
      });
    } catch (e) { /* 오디오 미지원 환경에서는 조용히 무시 */ }
  }
  function sfxSelect() { playTone([920], 70, 'sine', 0.1); }
  function sfxCapture() { playTone([523, 659, 784, 1047], 110, 'triangle', 0.16); } // 신나는 상승 아르페지오
  function sfxSweep() { playTone([523, 659, 784, 1047, 1318], 130, 'triangle', 0.18); } // 3장 쓸기, 더 화려하게
  function sfxMiss() { playTone([320, 230], 200, 'sawtooth', 0.1); } // 못 먹음, 실망
  function sfxDoubleMiss() { playTone([240, 190, 140], 320, 'sawtooth', 0.13); } // 똥(쌍으로 못 먹음), 더 실망

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function calcScore(cap) {
    let s = 0;
    const g = cap.filter(c => c.t === 'gwang');
    const a = cap.filter(c => c.t === 'animal');
    const r = cap.filter(c => c.t === 'ribbon');
    const jp = cap.filter(c => c.t === 'junk' || c.t === 'junk2').reduce((x, c) => x + c.junkPts, 0);

    if (g.length === 5) s += 15;
    else if (g.length === 4) s += 4;
    else if (g.length === 3) s += g.find(c => c.m === 12) ? 2 : 3;

    if (a.filter(c => c.godori).length >= 3) s += 5;
    if (a.length >= 5) s += (a.length - 4);

    const red = r.filter(c => c.color === 'hong');
    const blue = r.filter(c => c.color === 'blue');
    const grass = r.filter(c => c.color === 'grass');
    if (red.length >= 3) s += 3;
    if (blue.length >= 3) s += 3;
    if (grass.length >= 3) s += 3;
    if (r.length >= 5) s += (r.length - 4);

    if (jp >= 10) s += (jp - 9);
    return s;
  }

  function getBreakdown(cap) {
    const g = cap.filter(c => c.t === 'gwang');
    const a = cap.filter(c => c.t === 'animal');
    const r = cap.filter(c => c.t === 'ribbon');
    const jp = cap.filter(c => c.t === 'junk' || c.t === 'junk2').reduce((x, c) => x + c.junkPts, 0);
    const items = [];
    if (g.length >= 3) {
      const v = g.length === 5 ? 15 : g.length === 4 ? 4 : (g.find(c => c.m === 12) ? 2 : 3);
      items.push(`광 ${g.length}장 → ${v}점`);
    }
    if (a.filter(c => c.godori).length >= 3) items.push('고도리 → 5점');
    if (a.length >= 5) items.push(`열 ${a.length}장 → ${a.length - 4}점`);
    if (r.filter(c => c.color === 'hong').length >= 3) items.push('홍단 → 3점');
    if (r.filter(c => c.color === 'blue').length >= 3) items.push('청단 → 3점');
    if (r.filter(c => c.color === 'grass').length >= 3) items.push('초단 → 3점');
    if (r.length >= 5) items.push(`띠 ${r.length}장 → ${r.length - 4}점`);
    if (jp >= 10) items.push(`피 ${jp}장 → ${jp - 9}점`);
    return items;
  }

  // 카드 1장을 필드에 매칭: 0매치=버림, 1매치=따먹기, 2매치(필드에 같은 월 2장)=3장 쓸기
  function matchCards(card, field, cap) {
    const same = field.filter(c => c.m === card.m);
    if (same.length === 0) return { field: field.concat([card]), cap, matched: [] };
    const take = same.length >= 2 ? same : [same[0]];
    return {
      field: field.filter(c => !take.find(t => t.id === c.id)),
      cap: cap.concat([card], take),
      matched: [card].concat(take),
    };
  }

  // ── AI ──
  function aiPickCard(hand, field) {
    const fieldMonths = new Set(field.map(c => c.m));
    const matches = hand.filter(c => fieldMonths.has(c.m));
    if (matches.length > 0) {
      const priority = { gwang: 4, animal: 3, ribbon: 2, junk2: 1.5, junk: 1 };
      matches.sort((a, b) => (priority[b.t] || 0) - (priority[a.t] || 0));
      return matches[0];
    }
    const junk = hand.find(c => c.t === 'junk' || c.t === 'junk2');
    return junk || hand[0];
  }

  function aiDecideStop(cap, goCount) {
    const sc = calcScore(cap);
    if (sc < 3) return false;
    return sc >= 5 && Math.random() < 0.75;
  }

  function dealGame() {
    const deck = shuffle(CARDS.map(c => ({ ...c })));
    const field = deck.splice(0, 6);
    const playerHand = deck.splice(0, 7);
    const aiHand = deck.splice(0, 7);
    return {
      deck, field, playerHand, aiHand,
      playerCap: [], aiCap: [],
      phase: 'player_select', goCount: 0, selected: null, turnMissCount: 0,
      lastWinner: null, gameOver: false, awarded: false,
    };
  }

  // ── UI 헬퍼 ──
  function setStatus(msg) { const el = document.getElementById('gs-result'); if (el) el.textContent = msg || ''; }
  function setLog(msg) { const el = document.getElementById('gs-log'); if (el && msg) el.textContent = msg; }
  function setPointsMsg(msg) { const el = document.getElementById('gs-points-msg'); if (el) el.textContent = msg || ''; }

  function spriteStyle(card, small) {
    const cw = small ? SPR_CW_SMALL : SPR_CW, ch = small ? SPR_CH_SMALL : SPR_CH;
    const sheetW = cw * 8, sheetH = ch * 6;
    return `background-image:url('assets/hwatu-cards.webp');background-size:${sheetW}px ${sheetH}px;background-position:-${card.col * cw}px -${card.row * ch}px;`;
  }

  function cardEl(card, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'gs-card' + (opts.small ? ' gs-card-small' : '') + (opts.clickable ? ' om-pickable' : '') + (opts.selected ? ' gs-card-selected' : '');
    el.setAttribute('style', spriteStyle(card, opts.small));
    if (opts.onClick) el.addEventListener('click', opts.onClick);
    return el;
  }

  function renderCapBadges(containerId, cap) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    const g = cap.filter(c => c.t === 'gwang').length;
    const a = cap.filter(c => c.t === 'animal').length;
    const r = cap.filter(c => c.t === 'ribbon').length;
    const p = cap.filter(c => c.t === 'junk' || c.t === 'junk2').reduce((s, c) => s + c.junkPts, 0);
    const defs = [['gwang', '광', g], ['animal', '열', a], ['ribbon', '띠', r], ['junk', '피', p]];
    defs.forEach(([cls, label, n]) => {
      if (n <= 0) return;
      const pill = document.createElement('span');
      pill.className = 'gs-badge gs-badge-' + cls;
      pill.textContent = `${label} ${n}`;
      el.appendChild(pill);
    });
  }

  function renderCapCards(containerId, cap) {
    const el = document.getElementById(containerId);
    el.innerHTML = '';
    cap.forEach(c => el.appendChild(cardEl(c, { small: true })));
  }

  function render() {
    document.getElementById('gs-hand').innerHTML = '';
    const handEl = document.getElementById('gs-hand');
    G.playerHand.forEach(c => {
      const clickable = G.phase === 'player_select' && !G.gameOver;
      handEl.appendChild(cardEl(c, {
        clickable, selected: G.selected === c.id,
        onClick: clickable ? () => onSelectCard(c) : null
      }));
    });
    document.getElementById('gs-hand-count').textContent = G.playerHand.length;

    const fieldEl = document.getElementById('gs-field');
    fieldEl.innerHTML = '';
    G.field.forEach(c => fieldEl.appendChild(cardEl(c)));

    document.getElementById('gs-deck-count').textContent = G.deck.length;
    renderCapBadges('gs-ai-cap-badges', G.aiCap);
    renderCapBadges('gs-player-cap-badges', G.playerCap);
    renderCapCards('gs-ai-cap-cards', G.aiCap);
    renderCapCards('gs-player-cap-cards', G.playerCap);
    document.getElementById('gs-ai-count').textContent = G.aiCap.length;
    document.getElementById('gs-player-count').textContent = G.playerCap.length;
    document.getElementById('gs-player-score').textContent = `${calcScore(G.playerCap)}점`;
    document.getElementById('gs-ai-score').textContent = `${calcScore(G.aiCap)}점`;

    const turnLabel = G.phase === 'ai_turn' ? AI : PLAYER;
    document.getElementById('gs-turn-p').classList.toggle('active', turnLabel === PLAYER && !G.gameOver);
    document.getElementById('gs-turn-a').classList.toggle('active', turnLabel === AI && !G.gameOver);

    const gostopBox = document.getElementById('gs-gostop-box');
    gostopBox.style.display = G.phase === 'gostop' ? 'flex' : 'none';
    if (G.phase === 'gostop') {
      const items = getBreakdown(G.playerCap);
      document.getElementById('gs-gostop-text').textContent = `${calcScore(G.playerCap)}점 달성! (${items.join(', ')}) ${G.goCount > 0 ? `고 ${G.goCount}회 ` : ''}고? 스톱?`;
    }

    const confirmBox = document.getElementById('gs-confirm-box');
    if (G.selected !== null && G.phase === 'player_select') {
      const card = G.playerHand.find(c => c.id === G.selected);
      const willMatch = card ? G.field.filter(c => c.m === card.m).length : 0;
      confirmBox.style.display = 'flex';
      confirmBox.innerHTML = `
        <div class="gs-confirm-text">${card ? MONTH_KR[card.m - 1] : ''} 카드를 내시겠습니까?${willMatch > 0 ? ' (바닥에서 따올 수 있습니다!)' : ''}</div>
        <div class="gs-confirm-btns">
          <button class="game-btn primary" id="gs-confirm-play-btn">내기</button>
          <button class="game-btn ghost" id="gs-cancel-play-btn">취소</button>
        </div>
      `;
      document.getElementById('gs-confirm-play-btn').addEventListener('click', onConfirmPlay);
      document.getElementById('gs-cancel-play-btn').addEventListener('click', onCancelSelect);
    } else {
      confirmBox.style.display = 'none';
      confirmBox.innerHTML = '';
    }
  }

  function onSelectCard(card) {
    if (G.phase !== 'player_select' || G.gameOver) return;
    const wasSelected = G.selected === card.id;
    G.selected = wasSelected ? null : card.id;
    if (!wasSelected) sfxSelect();
    render();
  }

  function onCancelSelect() {
    G.selected = null;
    render();
  }

  function onConfirmPlay() {
    const card = G.playerHand.find(c => c.id === G.selected);
    if (!card) return;
    confirmPlay(card);
  }

  function confirmPlay(card) {
    const newHand = G.playerHand.filter(c => c.id !== card.id);
    const same = G.field.filter(c => c.m === card.m);
    const { field, cap, matched } = matchCards(card, G.field, G.playerCap);
    G.playerHand = newHand; G.field = field; G.playerCap = cap; G.selected = null;
    G.turnMissCount = matched.length === 0 ? 1 : 0;
    if (matched.length >= 3) { sfxSweep(); setLog(`✨ ${MONTH_KR[card.m - 1]} 3장 쓸기!`); }
    else if (matched.length === 2) { sfxCapture(); setLog(`${MONTH_KR[card.m - 1]} 매칭!`); }
    else { setLog(`${MONTH_KR[card.m - 1]} 버림`); }
    render();
    setTimeout(playerDrawPhase, matched.length === 0 ? 350 : 550);
  }

  function playerDrawPhase() {
    if (G.deck.length === 0) { finishGame('deck_empty'); return; }
    const drawn = G.deck.shift();
    const { field, cap, matched } = matchCards(drawn, G.field, G.playerCap);
    G.field = field; G.playerCap = cap;

    if (matched.length === 0) {
      G.turnMissCount = (G.turnMissCount || 0) + 1;
      if (G.turnMissCount >= 2) { sfxDoubleMiss(); setLog(`💩 똥! 뒤집기: ${MONTH_KR[drawn.m - 1]} → 바닥 (이번 턴 두 번 다 못 먹었습니다)`); }
      else { sfxMiss(); setLog(`뒤집기: ${MONTH_KR[drawn.m - 1]} → 바닥`); }
    } else if (matched.length >= 3) { sfxSweep(); setLog(`✨ 뒤집기: ${MONTH_KR[drawn.m - 1]} 3장 쓸기!`); }
    else { sfxCapture(); setLog(`뒤집기: ${MONTH_KR[drawn.m - 1]} 매칭!`); }

    const sc = calcScore(G.playerCap);
    const handEmpty = G.playerHand.length === 0;
    const deckEmpty = G.deck.length === 0;
    if (handEmpty || deckEmpty) { render(); finishGame(handEmpty ? 'hand_empty' : 'deck_empty'); return; }
    if (sc >= 3) { G.phase = 'gostop'; render(); return; }
    G.phase = 'ai_turn';
    render();
    setTimeout(aiTurn, 800);
  }

  function onGo() {
    if (G.phase !== 'gostop') return;
    G.goCount++;
    setLog(`🔥 고! (${G.goCount}회)`);
    G.phase = 'ai_turn';
    render();
    setTimeout(aiTurn, 800);
  }

  function onStop() {
    if (G.phase !== 'gostop') return;
    G.lastWinner = 'player_stop';
    render();
    finishGame('player_stop');
  }

  function aiTurn() {
    if (G.gameOver) return;
    setStatus('AI가 패를 내는 중...');
    setTimeout(() => {
      if (G.aiHand.length === 0 || G.deck.length === 0) { finishGame('deck_empty'); return; }

      const card = aiPickCard(G.aiHand, G.field);
      G.aiHand = G.aiHand.filter(c => c.id !== card.id);
      const r1 = matchCards(card, G.field, G.aiCap);
      setLog(r1.matched.length === 0 ? `🤖 AI: ${MONTH_KR[card.m - 1]} 버림` : r1.matched.length >= 3 ? `🤖 AI: ${MONTH_KR[card.m - 1]} 3장 쓸기!` : `🤖 AI: ${MONTH_KR[card.m - 1]} 매칭!`);

      if (G.deck.length === 0) { G.field = r1.field; G.aiCap = r1.cap; render(); finishGame('deck_empty'); return; }
      const drawn = G.deck.shift();
      const r2 = matchCards(drawn, r1.field, r1.cap);
      G.field = r2.field; G.aiCap = r2.cap;
      render();

      if (aiDecideStop(G.aiCap, G.goCount)) {
        G.lastWinner = 'ai';
        finishGame('ai_stop');
        return;
      }
      const handEmpty = G.playerHand.length === 0;
      const deckEmpty = G.deck.length === 0;
      const aiHandEmpty = G.aiHand.length === 0;
      if (handEmpty || deckEmpty || aiHandEmpty) { finishGame('hand_empty'); return; }
      G.phase = 'player_select';
      setStatus('');
      render();
    }, 700);
  }

  function finishGame(reason) {
    G.gameOver = true;
    const pSc = calcScore(G.playerCap), aSc = calcScore(G.aiCap);
    const mult = G.goCount > 0 ? 1 + G.goCount * 0.5 : 1;
    const pFinal = Math.round(pSc * mult);
    const aFinal = Math.round(aSc * (G.lastWinner === 'ai' ? mult : 1));
    const result = pFinal > aFinal ? 'win' : aFinal > pFinal ? 'lose' : 'draw';
    render();

    let label;
    if (result === 'win') label = `🎉 승리! (${pFinal}점 : ${aFinal}점)${G.goCount > 0 ? ` · 고 ${G.goCount}회 ×${mult.toFixed(1)}배` : ''}`;
    else if (result === 'lose') label = `패배. (${pFinal}점 : ${aFinal}점)`;
    else label = `무승부. (${pFinal}점 : ${aFinal}점)`;
    setStatus(label);

    // 승자 2배 / 패자 1배 보상 구조 (상대 포인트를 뺏는 게 아니라 시스템이 각각 지급)
    let pts;
    if (result === 'win') pts = 30; else if (result === 'lose') pts = 15; else pts = 20;
    if (!G.awarded) {
      G.awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'gostop_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function reset() {
    G = dealGame();
    setStatus('');
    setLog('🎴 게임 시작! 손패에서 화투를 골라 내세요.');
    setPointsMsg('점수가 더 높으면 승리합니다. 3점 이상이면 고(계속)/스톱을 선택할 수 있습니다.');
    render();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="gs-turn-a" class="game-turn-pill">🤖 AI</span>
        <span id="gs-turn-p" class="game-turn-pill">😊 당신</span>
      </div>

      <div class="gs-panel">
        <div class="gs-panel-header">
          <span class="gs-panel-title">📦 AI 획득</span>
          <span class="gs-panel-meta"><span id="gs-ai-score">0점</span> · <span id="gs-ai-count">0</span>장</span>
        </div>
        <div id="gs-ai-cap-badges" class="gs-badge-row"></div>
        <div id="gs-ai-cap-cards" class="gs-card-row"></div>
      </div>

      <div class="gs-panel">
        <div class="gs-panel-header">
          <span class="gs-panel-title">🀫 바닥</span>
          <span class="gs-panel-meta">덱 <span id="gs-deck-count">0</span>장</span>
        </div>
        <div id="gs-field" class="gs-card-row"></div>
        <div id="gs-log" class="gs-log"></div>
      </div>

      <div class="gs-panel">
        <div class="gs-panel-header">
          <span class="gs-panel-title">📦 내 획득</span>
          <span class="gs-panel-meta"><span id="gs-player-score">0점</span> · <span id="gs-player-count">0</span>장</span>
        </div>
        <div id="gs-player-cap-badges" class="gs-badge-row"></div>
        <div id="gs-player-cap-cards" class="gs-card-row"></div>
      </div>

      <div class="gs-panel">
        <div class="gs-panel-header">
          <span class="gs-panel-title">😊 내 손패</span>
          <span class="gs-panel-meta"><span id="gs-hand-count">0</span>장</span>
        </div>
        <div id="gs-hand" class="gs-card-row"></div>
      </div>

      <div id="gs-confirm-box" class="gs-confirm-box" style="display:none;"></div>
      <div id="gs-gostop-box" class="gs-gostop-box" style="display:none;">
        <div id="gs-gostop-text" class="gs-gostop-text"></div>
        <div class="gs-gostop-btns">
          <button class="game-btn primary" id="gs-go-btn">고!</button>
          <button class="game-btn ghost" id="gs-stop-btn">스톱!</button>
        </div>
      </div>

      <div id="gs-result" class="game-result-msg"></div>
      <div id="gs-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="gs-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('gs-go-btn').addEventListener('click', onGo);
    document.getElementById('gs-stop-btn').addEventListener('click', onStop);
    document.getElementById('gs-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.GoStopGame = { start };
})(window);

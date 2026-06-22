/* ============================================================
   ICOC OMNIPO — 텍사스 홀덤 1v1 vs AI (성인부 — 포인트 경쟁, 베팅 없음)
   칩 500개 시작. 최대 20핸드, 많은 칩 보유자가 승리.
   ============================================================ */

(function (global) {
  'use strict';

  // ── 카드 덱 ──
  const SUITS   = ['♠','♥','♦','♣'];
  const RANKS   = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const R_VAL   = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,
                    '10':10,'J':11,'Q':12,'K':13,'A':14 };
  const RED     = new Set(['♥','♦']);

  function makeDeck() {
    const d = [];
    SUITS.forEach(s => RANKS.forEach(r => d.push({ r, s, v: R_VAL[r] })));
    for (let i = d.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  // ── 핸드 평가 (5장) ──
  function eval5(hand) {
    const v  = hand.map(c => c.v).sort((a,b) => b - a);
    const s  = hand.map(c => c.s);
    const fl = s.every(x => x === s[0]);

    const aceLow = v.join() === '14,5,4,3,2';
    const str    = aceLow || (v[0] - v[4] === 4 && new Set(v).size === 5);

    const cnt = {};
    v.forEach(x => cnt[x] = (cnt[x] || 0) + 1);
    const g = Object.entries(cnt).map(([x,c]) => ({x:+x,c}))
                    .sort((a,b) => b.c - a.c || b.x - a.x);

    if (fl && str) {
      const hi = aceLow ? 5 : v[0];
      return { sc: 8e10 + hi, nm: hi === 14 ? '로얄 플러시' : '스트레이트 플러시' };
    }
    if (g[0].c === 4) return { sc: 7e10 + g[0].x*1e8, nm: '포카드' };
    if (g[0].c === 3 && g[1].c === 2) return { sc: 6e10 + g[0].x*1e8 + g[1].x*1e6, nm: '풀하우스' };
    if (fl)  return { sc: 5e10 + v.reduce((a,x,i) => a + x*Math.pow(15,4-i), 0), nm: '플러시' };
    if (str) return { sc: 4e10 + (aceLow ? 5 : v[0]), nm: '스트레이트' };
    if (g[0].c === 3) return { sc: 3e10 + g[0].x*1e8, nm: '트리플' };
    if (g[0].c === 2 && g[1].c === 2) return { sc: 2e10 + g[0].x*1e8 + g[1].x*1e6, nm: '투페어' };
    if (g[0].c === 2) return { sc: 1e10 + g[0].x*1e8, nm: '원페어' };
    return { sc: v.reduce((a,x,i) => a + x*Math.pow(15,4-i), 0), nm: '하이카드' };
  }

  function best7(cards) {
    let best = null;
    for (let i = 0; i < cards.length; i++)
      for (let j = i + 1; j < cards.length; j++) {
        const r = eval5(cards.filter((_, k) => k !== i && k !== j));
        if (!best || r.sc > best.sc) best = r;
      }
    return best;
  }

  // ── AI 강도 평가 (0~1) ──
  function aiStrength(aiCards, community) {
    if (community.length === 0) {
      const [a, b] = aiCards.map(c => c.v);
      const hi = Math.max(a,b), lo = Math.min(a,b);
      const suited = aiCards[0].s === aiCards[1].s;
      if (a === b && hi >= 10) return 0.90;
      if (a === b && hi >= 7)  return 0.70;
      if (a === b)             return 0.50;
      if (hi === 14 && lo >= 11) return 0.80;
      if (hi === 14 && lo >= 8)  return suited ? 0.65 : 0.50;
      if (hi >= 13 && lo >= 10)  return 0.60;
      if (suited && hi - lo <= 4) return 0.40;
      return 0.22;
    }
    const sc = best7([...aiCards, ...community]).sc;
    if (sc >= 8e10) return 1.00;
    if (sc >= 7e10) return 0.97;
    if (sc >= 6e10) return 0.92;
    if (sc >= 5e10) return 0.82;
    if (sc >= 4e10) return 0.72;
    if (sc >= 3e10) return 0.62;
    if (sc >= 2e10) return 0.46;
    if (sc >= 1e10) return 0.30;
    return 0.12;
  }

  // decide: toCall=0이면 check/raise, >0이면 fold/call/raise
  function aiDecide(toCall, strength, raised) {
    const r = Math.random();
    if (toCall === 0) {
      if (!raised && (strength > 0.58 || r < 0.28)) return 'raise';
      return 'check';
    }
    if (!raised && strength > 0.72) return 'raise';
    if (strength > 0.38 || r < 0.22) return 'call';
    return 'fold';
  }

  // ── 상수 ──
  const START = 500, SB = 10, BB = 20, BET = 40, MAX_HANDS = 20;
  const PHASE_KO = { preflop:'프리플롭', flop:'플롭', turn:'턴', river:'리버', showdown:'쇼다운' };

  // ── 상태 ──
  let S;

  function initState() {
    S = {
      phase: 'waiting',
      deck: [], ph: [], ah: [], comm: [],
      pot: 0, pc: START, ac: START,
      rb: { p: 0, a: 0, raised: false },
      hand: 0, over: false, awarded: false,
      showAI: false, playerTurn: true,
    };
  }

  // ── 핸드 시작 ──
  function newHand() {
    S.hand++;
    S.deck = makeDeck();
    S.ph = [S.deck.pop(), S.deck.pop()];
    S.ah = [S.deck.pop(), S.deck.pop()];
    S.comm = [];
    S.phase = 'preflop';
    S.showAI = false;
    S.playerTurn = true;

    // 블라인드
    const pSB = Math.min(SB, S.pc), aBB = Math.min(BB, S.ac);
    S.pc -= pSB; S.ac -= aBB;
    S.pot = pSB + aBB;
    S.rb = { p: pSB, a: aBB, raised: false };

    updHandNum();
    render();
    setStatus('프리플롭 — 당신 차례 (SB)');
    showActions(BB - pSB, false, false, false);
  }

  // ── 페이즈 전환 ──
  function advancePhase() {
    S.rb = { p: 0, a: 0, raised: false };
    if      (S.phase === 'preflop') { S.phase = 'flop';  deal(3); }
    else if (S.phase === 'flop')    { S.phase = 'turn';  deal(1); }
    else if (S.phase === 'turn')    { S.phase = 'river'; deal(1); }
    else if (S.phase === 'river')   { showdown(); return; }
    S.playerTurn = true;
    render();
    setStatus(PHASE_KO[S.phase] + ' — 당신 차례');
    showActions(0, false, false, false);
  }

  function deal(n) { for (let i=0;i<n;i++) S.comm.push(S.deck.pop()); }

  // ── 쇼다운 ──
  function showdown() {
    S.phase = 'showdown';
    S.showAI = true;
    const pr = best7([...S.ph, ...S.comm]);
    const ar = best7([...S.ah, ...S.comm]);
    render();
    let win;
    if (pr.sc > ar.sc)      { win = 'p'; setStatus(`🎉 당신 승! ${pr.nm} vs AI ${ar.nm}`); }
    else if (ar.sc > pr.sc) { win = 'a'; setStatus(`😓 AI 승! AI ${ar.nm} vs 당신 ${pr.nm}`); }
    else                    { win = 't'; setStatus(`🤝 무승부! ${pr.nm}`); }
    setTimeout(() => {
      if (win === 'p') S.pc += S.pot;
      else if (win === 'a') S.ac += S.pot;
      else { S.pc += Math.floor(S.pot/2); S.ac += Math.ceil(S.pot/2); }
      S.pot = 0;
      afterHand();
    }, 2000);
  }

  function afterHand() {
    render();
    if (S.pc <= 0) { endGame(false); return; }
    if (S.ac <= 0) { endGame(true);  return; }
    if (S.hand >= MAX_HANDS) { endGame(S.pc >= START); return; }
    showActions(0, true, false, false); // Next Hand 버튼
  }

  function endGame(win) {
    if (S.awarded) return;
    S.over = true; S.awarded = true;
    const pts = win ? 30 : 15;
    setStatus(win
      ? `🏆 승리! ${S.hand}핸드 결과 칩 ${S.pc} (시작 ${START})`
      : `💸 패배! 칩이 모두 소진됐습니다.`);
    const res = window.ICOC_POINTS.addPoints(pts, 'holdem_' + (win ? 'win' : 'lose'));
    const pEl = document.getElementById('hd-pts');
    if (pEl) pEl.textContent = res.capped
      ? `+${res.added}P 적립 (오늘 한도 · 보유 ${res.total.toLocaleString()}P)`
      : `+${res.added}P 적립 · 보유 ${res.total.toLocaleString()}P`;
    window.ICOC_POINTS.showToast(`+${res.added}P 적립되었습니다.`);
    showActions(0, false, true, false);
  }

  // ── 플레이어 액션 ──
  function actFold() {
    setStatus('폴드 — AI가 팟을 가져갑니다.');
    S.ac += S.pot; S.pot = 0;
    render();
    setTimeout(afterHand, 1200);
  }

  function actCall(toCall) {
    const amt = Math.min(toCall, S.pc);
    S.pc -= amt; S.pot += amt; S.rb.p += amt;
    render();
    // 콜 후 AI 체크 없이 다음 페이즈로 (단순화)
    setTimeout(advancePhase, 700);
  }

  function actCheck() {
    // 체크 후 AI 응답
    setAIThinking();
    setTimeout(() => aiRespond(), 700);
  }

  function actRaise() {
    const toCall = Math.max(0, S.rb.a - S.rb.p);
    const amt    = Math.min(toCall + BET, S.pc);
    S.pc -= amt; S.pot += amt; S.rb.p += amt;
    S.rb.raised = true;
    render();
    setAIThinking();
    setTimeout(() => aiRespondToRaise(), 900);
  }

  // ── AI 응답 ──
  function aiRespond() {
    const str  = aiStrength(S.ah, S.comm);
    const dec  = aiDecide(0, str, S.rb.raised);

    if (dec === 'check') {
      setStatus('AI 체크.');
      setTimeout(advancePhase, 600);
    } else { // raise
      const amt = Math.min(BET, S.ac);
      S.ac -= amt; S.pot += amt; S.rb.a += amt;
      S.rb.raised = true;
      render();
      setStatus(`AI 베팅 ${BET}! 콜 또는 폴드.`);
      S.playerTurn = true;
      showActions(S.rb.a - S.rb.p, false, false, true); // callFoldOnly
    }
  }

  function aiRespondToRaise() {
    const str = aiStrength(S.ah, S.comm);
    if (str > 0.42 || Math.random() < 0.20) {
      const toCallAI = Math.max(0, S.rb.p - S.rb.a);
      const amt = Math.min(toCallAI, S.ac);
      S.ac -= amt; S.pot += amt; S.rb.a += amt;
      render();
      setStatus('AI 콜.');
      setTimeout(advancePhase, 700);
    } else {
      setStatus('AI 폴드 — 당신이 팟을 가져갑니다!');
      S.pc += S.pot; S.pot = 0;
      render();
      setTimeout(afterHand, 1200);
    }
  }

  // ── 렌더링 ──
  function cardHTML(c, back) {
    if (back) return '<div class="hd-card hd-back"></div>';
    const cl = RED.has(c.s) ? ' hd-red' : '';
    return `<div class="hd-card${cl}"><span class="hd-cr">${c.r}</span><span class="hd-cs">${c.s}</span></div>`;
  }

  function emptyCard() { return '<div class="hd-card hd-empty"></div>'; }

  function render() {
    const t = document.getElementById('hd-table');
    if (!t) return;

    const aiCards   = S.ah.map(c => cardHTML(c, !S.showAI)).join('');
    const plCards   = S.ph.map(c => cardHTML(c, false)).join('');
    const commCards = Array(5).fill(0).map((_, i) =>
      i < S.comm.length ? cardHTML(S.comm[i], false) : emptyCard()
    ).join('');

    t.innerHTML = `
      <div class="hd-ai-row">
        <div class="hd-tag">AI</div>
        <div class="hd-cards">${aiCards}</div>
        <div class="hd-chip-badge">🪙 ${S.ac}</div>
      </div>
      <div class="hd-comm-row">
        <div class="hd-tag">커뮤니티</div>
        <div class="hd-cards">${commCards}</div>
        <div class="hd-pot-badge">팟 🪙 ${S.pot}</div>
      </div>
      <div class="hd-pl-row">
        <div class="hd-chip-badge">🪙 ${S.pc}</div>
        <div class="hd-cards">${plCards}</div>
        <div class="hd-tag">당신</div>
      </div>
    `;
  }

  function setStatus(msg) { const e = document.getElementById('hd-status'); if (e) e.textContent = msg; }
  function setAIThinking() {
    S.playerTurn = false;
    showActions(0, false, false, false);
    setStatus('AI 생각 중...');
  }
  function updHandNum() {
    const e = document.getElementById('hd-hand');
    if (e) e.textContent = `핸드 ${S.hand} / ${MAX_HANDS}`;
  }

  // showActions: 버튼 상태 제어
  // toCall: 콜하려면 필요한 칩 / next: 다음핸드 / end: 게임끝 / cfo: 콜/폴드만
  function showActions(toCall, next, end, cfo) {
    const e = document.getElementById('hd-actions');
    if (!e) return;

    if (end) {
      e.innerHTML = `
        <button class="game-btn primary" id="hd-restart">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>`;
      document.getElementById('hd-restart').addEventListener('click', () => {
        initState();
        document.getElementById('hd-pts').textContent = '';
        setStatus('');
        newHand();
      });
      return;
    }
    if (next) {
      e.innerHTML = `<button class="game-btn primary" id="hd-next">다음 핸드 ▶</button>`;
      document.getElementById('hd-next').addEventListener('click', newHand);
      return;
    }
    if (!S.playerTurn || S.over) { e.innerHTML = `<span class="hd-wait">AI 생각 중...</span>`; return; }

    let html = `<button class="game-btn ghost hd-fold" id="hd-fold">폴드</button>`;
    if (cfo) {
      html += `<button class="game-btn primary" id="hd-call">콜 ${toCall}</button>`;
    } else if (toCall === 0) {
      html += `<button class="game-btn primary" id="hd-check">체크</button>`;
      if (!S.rb.raised)
        html += `<button class="game-btn hd-raise" id="hd-raise">베팅 ${BET}</button>`;
    } else {
      html += `<button class="game-btn primary" id="hd-call">콜 ${toCall}</button>`;
      if (!S.rb.raised)
        html += `<button class="game-btn hd-raise" id="hd-raise">레이즈 +${BET}</button>`;
    }
    e.innerHTML = html;

    const fold  = document.getElementById('hd-fold');
    const call  = document.getElementById('hd-call');
    const check = document.getElementById('hd-check');
    const raise = document.getElementById('hd-raise');
    if (fold)  fold.addEventListener('click',  () => actFold());
    if (call)  call.addEventListener('click',  () => actCall(toCall));
    if (check) check.addEventListener('click', () => actCheck());
    if (raise) raise.addEventListener('click', () => actRaise());
  }

  // ── 시작 ──
  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="hd-topbar">
        <span id="hd-hand" class="hd-hand-info">핸드 0 / ${MAX_HANDS}</span>
        <span class="hd-blind-info">블라인드 ${SB}/${BB} · 시작 칩 ${START}</span>
      </div>
      <div id="hd-table" class="hd-table"></div>
      <div id="hd-status" class="hd-status-msg">준비 중...</div>
      <div id="hd-actions" class="hd-actions"></div>
      <div id="hd-pts"    class="game-points-earned"></div>
      <button class="game-btn ghost hd-x" onclick="ICOC_GAMES.closeGame()">닫기</button>
    `;
    initState();
    newHand();
  }

  global.HoldemGame = { start };
})(window);

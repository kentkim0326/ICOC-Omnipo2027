/* ============================================================
   ICOC OMNIPO — 진 러미 (Gin Rummy) 1v1 vs AI
   10장 패, 드로우→버리기 반복, 족보(런/세트)로 데드우드 최소화
   데드우드 ≤ 10 → 노크 | 0 → GIN
   ============================================================ */

(function (global) {
  'use strict';

  const SUITS = ['♠','♥','♦','♣'];
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const RV = {A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13};
  const DW = {A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:10,Q:10,K:10};
  const RED = new Set(['♥','♦']);
  const SO  = {'♠':0,'♥':1,'♦':2,'♣':3};
  let _uid  = 0;

  function makeDeck() {
    const d = [];
    SUITS.forEach(s => RANKS.forEach(r => d.push({ r, s, rv:RV[r], dw:DW[r], id:_uid++ })));
    for (let i=d.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]];
    }
    return d;
  }

  function sortHand(h) {
    return [...h].sort((a,b) => SO[a.s]-SO[b.s] || a.rv-b.rv);
  }

  function dwTotal(cards) { return cards.reduce((a,c) => a+c.dw, 0); }

  // ── 족보 탐지 ──
  function findMelds(hand) {
    const melds = [];
    // 세트 (같은 숫자 3~4장)
    const byR = {};
    hand.forEach(c => (byR[c.r]=byR[c.r]||[]).push(c));
    Object.values(byR).forEach(g => {
      if (g.length >= 3) melds.push(g.slice(0,3));
      if (g.length >= 4) melds.push([...g]);
    });
    // 런 (같은 무늬 연속 3장+)
    const byS = {};
    hand.forEach(c => (byS[c.s]=byS[c.s]||[]).push(c));
    Object.values(byS).forEach(g => {
      const sg = [...g].sort((a,b) => a.rv-b.rv);
      for (let i=0; i<sg.length-2; i++) {
        for (let j=i+2; j<sg.length; j++) {
          let ok = true;
          for (let k=i+1; k<=j; k++) if (sg[k].rv !== sg[k-1].rv+1) { ok=false; break; }
          if (ok) melds.push(sg.slice(i, j+1));
        }
      }
    });
    return melds;
  }

  // ── 최적 족보 배치 (데드우드 최소화) ──
  function bestArrangement(hand) {
    const melds = findMelds(hand);
    let bestDW = dwTotal(hand), bestM = [];

    function search(idx, used, cur) {
      const rem = hand.filter(c => !used.has(c.id));
      const dw  = dwTotal(rem);
      if (dw < bestDW) { bestDW = dw; bestM = [...cur]; }
      for (let i=idx; i<melds.length; i++) {
        const m = melds[i];
        if (m.some(c => used.has(c.id))) continue;
        const nu = new Set(used); m.forEach(c => nu.add(c.id));
        search(i+1, nu, [...cur, m]);
      }
    }
    search(0, new Set(), []);
    return { melds: bestM, deadwood: bestDW };
  }

  function meldIds(melds) {
    const s = new Set(); melds.forEach(m => m.forEach(c => s.add(c.id))); return s;
  }

  // ── 상태 ──
  let G;

  function newGame() {
    const deck = makeDeck();
    G = {
      pH: deck.slice(0,10),        // 플레이어 패
      aH: deck.slice(10,20),       // AI 패
      stock: deck.slice(21),        // 덱 (31장)
      discard: [deck[20]],          // 버림패
      phase: 'DRAW',               // DRAW | DISCARD | AI | DONE
      sel: null,                    // 선택된 카드
      awarded: false,
    };
  }

  function shuffle(a) {
    const b=[...a];
    for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}
    return b;
  }
  function reshuffleIfNeeded() {
    if (G.stock.length) return;
    if (G.discard.length <= 1) return;
    const top = G.discard.pop();
    G.stock = shuffle(G.discard);
    G.discard = [top];
  }

  // ── 플레이어 액션 ──
  function drawStock() {
    if (G.phase !== 'DRAW') return;
    reshuffleIfNeeded();
    if (!G.stock.length) { setMsg('덱이 비었습니다.'); return; }
    G.pH.push(G.stock.pop());
    G.sel = null; G.phase = 'DISCARD';
    render(); setMsg('버릴 카드를 선택하세요.');
  }

  function drawDiscard() {
    if (G.phase !== 'DRAW' || !G.discard.length) return;
    const card = G.discard.pop();
    G.pH.push(card);
    G.sel = null; G.phase = 'DISCARD';
    render(); setMsg(`${card.r}${card.s} 집었습니다. 버릴 카드를 선택하세요.`);
  }

  function selectCard(card) {
    if (G.phase !== 'DISCARD') return;
    G.sel = (G.sel?.id === card.id) ? null : card;
    render();
  }

  function doDiscard() {
    if (!G.sel || G.phase !== 'DISCARD') return;
    const card = G.sel;
    G.pH = G.pH.filter(c => c.id !== card.id);
    G.discard.push(card);
    G.sel = null; G.phase = 'AI';
    render(); setMsg('AI 차례...');
    setTimeout(doAI, 900);
  }

  function doKnock() {
    if (!G.sel || G.phase !== 'DISCARD') return;
    const after = G.pH.filter(c => c.id !== G.sel.id);
    const { deadwood } = bestArrangement(after);
    if (deadwood > 10) return;
    G.pH = after; G.discard.push(G.sel); G.sel = null;
    G.phase = 'DONE'; render(); endRound('player_knock');
  }

  function doGin() {
    if (!G.sel || G.phase !== 'DISCARD') return;
    const after = G.pH.filter(c => c.id !== G.sel.id);
    if (bestArrangement(after).deadwood !== 0) return;
    G.pH = after; G.discard.push(G.sel); G.sel = null;
    G.phase = 'DONE'; render(); endRound('player_gin');
  }

  // ── AI ──
  function doAI() {
    if (G.phase !== 'AI') return;

    // Draw decision
    const topD = G.discard.at(-1);
    let draw;
    if (topD) {
      const { deadwood: before } = bestArrangement(G.aH);
      const { deadwood: after  } = bestArrangement([...G.aH, topD]);
      if (after < before) { draw = G.discard.pop(); }
    }
    if (!draw) {
      reshuffleIfNeeded();
      draw = G.stock.pop();
    }
    if (!draw) { G.phase = 'DRAW'; render(); return; }
    G.aH.push(draw);

    const { melds, deadwood } = bestArrangement(G.aH);
    const mIds = meldIds(melds);

    // GIN?
    if (deadwood === 0) {
      G.phase = 'DONE'; render(); endRound('ai_gin'); return;
    }
    // Knock? (dw ≤ 10, ~65% chance)
    if (deadwood <= 10 && Math.random() < 0.65) {
      const disc = [...G.aH].filter(c=>!mIds.has(c.id)).sort((a,b)=>b.dw-a.dw)[0] || G.aH.at(-1);
      G.aH = G.aH.filter(c=>c.id!==disc.id);
      G.discard.push(disc);
      G.phase = 'DONE'; render(); endRound('ai_knock'); return;
    }

    // Discard highest deadwood
    const disc = [...G.aH].filter(c=>!mIds.has(c.id)).sort((a,b)=>b.dw-a.dw)[0] || G.aH.at(-1);
    G.aH = G.aH.filter(c=>c.id!==disc.id);
    G.discard.push(disc);
    G.phase = 'DRAW'; G.sel = null;
    render(); setMsg('AI가 카드를 냈습니다. 당신 차례입니다.');
  }

  // ── 라운드 종료 ──
  function endRound(result) {
    const { deadwood: pDW } = bestArrangement(G.pH);
    const { deadwood: aDW } = bestArrangement(G.aH);
    let win = false, msg = '';

    if (result === 'player_gin') {
      win = true;
      msg = `🎴 GIN! 당신 데드우드 0 · AI ${aDW} → 승리!`;
    } else if (result === 'player_knock') {
      if (aDW <= pDW) {
        win = false;
        msg = `😮 언더컷! AI(${aDW}) ≤ 당신(${pDW}) → 패배`;
      } else {
        win = true;
        msg = `✅ 노크! 당신 ${pDW} · AI ${aDW} → 승리!`;
      }
    } else if (result === 'ai_gin') {
      win = false;
      msg = `😱 AI GIN! 당신 데드우드 ${pDW} → 패배`;
    } else if (result === 'ai_knock') {
      if (pDW <= aDW) {
        win = true;
        msg = `🎉 언더컷 성공! 당신(${pDW}) ≤ AI(${aDW}) → 승리!`;
      } else {
        win = false;
        msg = `😅 AI 노크. AI ${aDW} · 당신 ${pDW} → 패배`;
      }
    }

    setMsg(msg);
    if (!G.awarded) {
      G.awarded = true;
      const pts = win ? 30 : 15;
      const res = window.ICOC_POINTS.addPoints(pts, 'rummy_'+(win?'win':'lose'));
      const pEl = document.getElementById('rm-pts');
      if (pEl) pEl.textContent = res.capped
        ? `+${res.added}P 적립 (한도 · 보유 ${res.total.toLocaleString()}P)`
        : `+${res.added}P 적립 · 보유 ${res.total.toLocaleString()}P`;
      window.ICOC_POINTS.showToast(`+${res.added}P 적립되었습니다.`);
    }

    const ac = document.getElementById('rm-actions');
    if (ac) ac.innerHTML = `
      <button class="game-btn primary" id="rm-restart">다시하기</button>
      <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>`;
    document.getElementById('rm-restart')?.addEventListener('click', () => {
      document.getElementById('rm-pts').textContent = '';
      newGame(); render();
      setMsg('덱 또는 버림패에서 드로우하세요.');
    });
  }

  // ── 렌더링 ──
  function cardEl(c, opts={}) {
    const { pick=false, sel=false, melded=false, back=false, sm=false } = opts;
    if (back) return `<div class="rm-card rm-back${sm?' rm-sm':''}"></div>`;
    const red   = RED.has(c.s) ? ' rm-red' : '';
    const selCl = sel    ? ' rm-sel'    : '';
    const mldCl = melded ? ' rm-melded' : '';
    const pCl   = pick   ? ' rm-pick'   : '';
    return `<div class="rm-card${red}${selCl}${mldCl}${pCl}" data-id="${c.id}">
      <span class="rm-r">${c.r}</span><span class="rm-s">${c.s}</span>
    </div>`;
  }

  function render() {
    const el = document.getElementById('rm-content');
    if (!el) return;

    const sorted = sortHand(G.pH);
    const { melds: pMelds, deadwood: pDW } = bestArrangement(G.pH);
    const pMIds = meldIds(pMelds);

    // 버릴 카드 선택 시 그 카드 제외한 데드우드
    const afterSelDW = G.sel
      ? bestArrangement(G.pH.filter(c=>c.id!==G.sel.id)).deadwood
      : pDW;
    const canKnock = G.phase === 'DISCARD' && G.sel && afterSelDW <= 10;
    const canGin   = G.phase === 'DISCARD' && G.sel && afterSelDW === 0;

    const topDiscard = G.discard.at(-1);
    const drawPhase  = G.phase === 'DRAW';
    const discPhase  = G.phase === 'DISCARD';

    // AI 패 (종료 시 공개)
    const aiSection = G.phase === 'DONE' ? (() => {
      const { melds:am } = bestArrangement(G.aH);
      const amid = meldIds(am);
      return `<div class="rm-ai-reveal">
        ${sortHand(G.aH).map(c=>cardEl(c,{melded:amid.has(c.id)})).join('')}
      </div>`;
    })() : `<div class="rm-ai-row">
      ${G.aH.map(()=>'<div class="rm-card rm-back rm-sm"></div>').join('')}
      <span class="rm-ai-cnt">AI ${G.aH.length}장</span>
    </div>`;

    el.innerHTML = `
      <div class="rm-piles">
        <div class="rm-pile-wrap">
          <div class="rm-pile${drawPhase?' rm-pile-on':''}" id="rm-stock">
            <div class="rm-card rm-back rm-pile-card"></div>
          </div>
          <span class="rm-pile-lbl">덱 ${G.stock.length}</span>
        </div>
        <div class="rm-pile-wrap">
          <div class="rm-pile${drawPhase&&topDiscard?' rm-pile-on':''}">
            ${topDiscard
              ? cardEl(topDiscard, {pick:drawPhase}).replace('class="rm-card', 'id="rm-disc-top" class="rm-card rm-pile-card')
              : '<div class="rm-card rm-empty rm-pile-card"></div>'}
          </div>
          <span class="rm-pile-lbl">버림패</span>
        </div>
        <div class="rm-spacer"></div>
        ${aiSection}
      </div>

      <div class="rm-player-bar">
        <span class="rm-hand-lbl">당신 ${G.pH.length}장</span>
        <span class="rm-dw${pDW<=10?' rm-dw-low':''}">데드우드 ${pDW}</span>
      </div>
      <div class="rm-hand" id="rm-hand">
        ${sorted.map(c => cardEl(c, {
          pick:  discPhase,
          sel:   G.sel?.id === c.id,
          melded: pMIds.has(c.id),
        })).join('')}
      </div>

      ${discPhase && G.sel ? `
        <div class="rm-sel-bar">
          <span>${G.sel.r}${G.sel.s} 선택됨 ${afterSelDW<=10?'· 데드우드 '+afterSelDW:''}</span>
          <button class="game-btn rm-act-btn" id="rm-discard-btn">버리기</button>
          ${canKnock&&!canGin ? `<button class="game-btn rm-act-btn rm-knock" id="rm-knock-btn">노크 🤙</button>` : ''}
          ${canGin ? `<button class="game-btn primary rm-act-btn" id="rm-gin-btn">GIN! 🎴</button>` : ''}
        </div>` : ''}

      <div id="rm-actions" class="rm-actions"></div>
    `;

    // 이벤트
    document.getElementById('rm-stock')?.addEventListener('click', drawStock);
    document.getElementById('rm-disc-top')?.addEventListener('click', drawDiscard);
    document.querySelectorAll('#rm-hand .rm-pick').forEach(e => {
      e.addEventListener('click', () => {
        const c = G.pH.find(x=>x.id===+e.dataset.id);
        if (c) selectCard(c);
      });
    });
    document.getElementById('rm-discard-btn')?.addEventListener('click', doDiscard);
    document.getElementById('rm-knock-btn')?.addEventListener('click', doKnock);
    document.getElementById('rm-gin-btn')?.addEventListener('click', doGin);
  }

  function setMsg(m) { const e=document.getElementById('rm-msg'); if(e) e.textContent=m; }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="rm-topbar">
        <span>🃏 진 러미 (Gin Rummy)</span>
        <span class="rm-sub">데드우드 ≤10 → 노크 &nbsp;|&nbsp; 0 → GIN</span>
      </div>
      <div id="rm-content" class="rm-content"></div>
      <div id="rm-msg" class="rm-msg-line"></div>
      <div id="rm-pts" class="game-points-earned"></div>
    `;
    newGame();
    render();
    setMsg('덱(↑) 또는 버림패를 클릭해 드로우하세요.');
  }

  global.RummyGame = { start };
})(window);

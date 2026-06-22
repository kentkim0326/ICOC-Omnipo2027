/* ============================================================
   ICOC OMNIPO — 브릿지 (Bridge) 선언자 모드
   플레이어: South (선언자) + North (더미, 직접 조작)
   AI: East + West (수비)
   규칙: 합산 HCP로 계약 결정 → 트럼프 선택 → 13트릭 대결
   ============================================================ */

(function (global) {
  'use strict';

  // ── 카드 ──
  const SUITS   = ['♠','♥','♦','♣'];
  const RANKS   = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
  const R_VAL   = {A:14,K:13,Q:12,J:11,10:10,9:9,8:8,7:7,6:6,5:5,4:4,3:3,2:2};
  const HCP_MAP = {A:4,K:3,Q:2,J:1};
  const RED     = new Set(['♥','♦']);

  function makeDeck() {
    const d = [];
    SUITS.forEach(s => RANKS.forEach(r => d.push({ r, s, v:R_VAL[r], hcp:HCP_MAP[r]||0 })));
    for (let i=d.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [d[i],d[j]]=[d[j],d[i]]; }
    return d;
  }
  function sortHand(h) {
    const O = {'♠':0,'♥':1,'♦':2,'♣':3};
    return [...h].sort((a,b) => O[a.s]-O[b.s] || b.v-a.v);
  }
  function sumHCP(h) { return h.reduce((a,c) => a+c.hcp, 0); }

  // ── 게임 상태 ──
  let G;

  function deal() {
    const deck = makeDeck();
    const hands = {
      S: sortHand(deck.slice(0,13)),
      N: sortHand(deck.slice(13,26)),
      E: sortHand(deck.slice(26,39)),
      W: sortHand(deck.slice(39,52)),
    };
    const nsHCP = sumHCP(hands.S) + sumHCP(hands.N);
    // 계약 (트릭 목표)
    const contract = nsHCP >= 33 ? 12 : nsHCP >= 29 ? 10 : nsHCP >= 25 ? 9 : 7;
    const contractName = contract===12?'스몰 슬램':contract===10?'게임 (4♠/♥)':contract===9?'게임 (3NT)':'파셜 게임';

    G = {
      hands, nsHCP, contract, contractName,
      trump: null,
      trick: {S:null,N:null,E:null,W:null},
      trickNum: 0, tricksNS: 0, tricksEW: 0,
      lead: 'W',     // West가 첫 선공 (선언자 왼쪽)
      turn: 'W',
      phase: 'DECLARE',
      awarded: false,
    };
  }

  // ── 트릭 승자 판정 ──
  function getLedSuit() {
    const ORDER = rotateTo(['S','W','N','E'], G.lead);
    for (const pos of ORDER) { if (G.trick[pos]) return G.trick[pos].s; }
    return null;
  }
  function rotateTo(arr, start) {
    const i = arr.indexOf(start);
    return [...arr.slice(i), ...arr.slice(0,i)];
  }
  function trickWinner() {
    const led = getLedSuit();
    const positions = ['S','W','N','E'].filter(p => G.trick[p]);
    let win = positions[0];
    positions.forEach(p => {
      const c = G.trick[p], wc = G.trick[win];
      const ct = G.trump && c.s===G.trump, wt = G.trump && wc.s===G.trump;
      if (ct && !wt) { win=p; return; }
      if (!ct && wt) return;
      if (c.s===led && wc.s!==led) { win=p; return; }
      if (c.s!==led && wc.s===led) return;
      if (c.v > wc.v) win=p;
    });
    return win;
  }

  // ── AI 플레이 ──
  function aiLead(pos) {
    const h = G.hands[pos];
    const byS = {};
    h.forEach(c => { (byS[c.s]||(byS[c.s]=[])).push(c); });
    let best = null, bestLen = 0;
    Object.entries(byS).forEach(([s,cs]) => {
      if (s!==G.trump && cs.length>bestLen) { bestLen=cs.length; best=s; }
    });
    const suit = best ? byS[best].sort((a,b)=>b.v-a.v) : h.sort((a,b)=>a.v-b.v);
    return suit.length>=4 ? suit[3] : suit[0];
  }
  function aiFollow(pos, ledSuit) {
    const h = G.hands[pos];
    const inSuit = h.filter(c=>c.s===ledSuit);
    if (inSuit.length) return inSuit.reduce((lo,c)=>c.v<lo.v?c:lo); // lowest in suit
    const trumps = G.trump ? h.filter(c=>c.s===G.trump) : [];
    if (trumps.length) return trumps.reduce((lo,c)=>c.v<lo.v?c:lo); // lowest trump
    return h.reduce((lo,c)=>c.v<lo.v?c:lo); // discard lowest
  }

  // ── 카드 플레이 ──
  function playCard(pos, card) {
    const idx = G.hands[pos].findIndex(c=>c.r===card.r&&c.s===card.s);
    if (idx===-1) return false;
    G.hands[pos].splice(idx,1);
    G.trick[pos] = card;

    const order = rotateTo(['S','W','N','E'], G.lead);
    const next = order.indexOf(pos)+1;

    if (next < 4) {
      G.turn = order[next];
      render();
      if (G.turn==='E'||G.turn==='W') setTimeout(doAI, 650);
    } else {
      const win = trickWinner();
      G.trickNum++;
      const ns = win==='S'||win==='N';
      if (ns) G.tricksNS++; else G.tricksEW++;
      G.lead = win; G.turn = win;
      G.trick = {S:null,N:null,E:null,W:null};
      render();
      setMsg(`${win} 획득 ▶ N/S ${G.tricksNS}  E/W ${G.tricksEW}`);
      if (G.trickNum>=13) { setTimeout(endHand, 1100); return; }
      if (win==='E'||win==='W') setTimeout(doAI, 1000);
    }
    return true;
  }
  function doAI() {
    if (G.phase!=='PLAY') return;
    const pos = G.turn;
    if (pos!=='E'&&pos!=='W') return;
    const led = getLedSuit();
    const card = led ? aiFollow(pos,led) : aiLead(pos);
    playCard(pos, card);
  }

  // ── 핸드 종료 ──
  function endHand() {
    G.phase = 'DONE';
    const made = G.tricksNS >= G.contract;
    const diff = G.tricksNS - G.contract;
    setMsg(made
      ? `🎉 계약 달성! ${G.tricksNS}트릭 (목표 ${G.contract}) — 성공`
      : `😅 ${G.tricksNS}트릭 획득 (목표 ${G.contract}, ${-diff}트릭 부족)`);
    if (!G.awarded) {
      G.awarded = true;
      const pts = made ? 30 : 15;
      const res = window.ICOC_POINTS.addPoints(pts, 'bridge_'+(made?'win':'lose'));
      const pEl = document.getElementById('br-pts');
      if (pEl) pEl.textContent = res.capped
        ? `+${res.added}P 적립 (한도 · 보유 ${res.total.toLocaleString()}P)`
        : `+${res.added}P 적립 · 보유 ${res.total.toLocaleString()}P`;
      window.ICOC_POINTS.showToast(`+${res.added}P 적립되었습니다.`);
    }
    const ac = document.getElementById('br-actions');
    if (ac) ac.innerHTML = `
      <button class="game-btn primary" id="br-restart">다시하기</button>
      <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>`;
    document.getElementById('br-restart')?.addEventListener('click', () => {
      document.getElementById('br-pts').textContent = '';
      deal(); renderDeclare();
    });
  }

  // ── 선언 화면 ──
  function renderDeclare() {
    G.phase = 'DECLARE';
    const c = document.getElementById('br-content');
    if (!c) return;

    const hcpLine = `N/S 합산 ${G.nsHCP}점 HCP → 계약: <b>${G.contractName} (${G.contract}트릭)</b>`;
    const handRow = (hand) => sortHand(hand).map(({r,s}) => {
      const red = RED.has(s) ? ' br-red' : '';
      return `<div class="br-card${red}"><span class="br-cr">${r}</span><span class="br-cs">${s}</span></div>`;
    }).join('');

    c.innerHTML = `
      <div class="br-info-box">${hcpLine}</div>
      <div class="br-declare-hands">
        <div class="br-handrow-label">N (더미 파트너)</div>
        <div class="br-handrow">${handRow(G.hands.N)}</div>
        <div class="br-handrow-label">S (당신)</div>
        <div class="br-handrow">${handRow(G.hands.S)}</div>
      </div>
      <div class="br-trump-row">
        <span class="br-trump-lbl">트럼프 선택 →</span>
        ${['♠','♥','♦','♣','NT'].map(t=>`<button class="br-tb" data-t="${t}">${t}</button>`).join('')}
      </div>`;

    c.querySelectorAll('.br-tb').forEach(btn => {
      btn.addEventListener('click', () => {
        G.trump = btn.dataset.t==='NT' ? null : btn.dataset.t;
        G.phase = 'PLAY';
        render();
        setMsg(`트럼프: ${G.trump||'NT'} · ${G.contract}트릭 목표 · West 선공`);
        // West leads first
        setTimeout(doAI, 800);
      });
    });
  }

  // ── 플레이 화면 ──
  function cardEl(c, clickable) {
    const red = RED.has(c.s) ? ' br-red' : '';
    const sel = clickable ? ' br-pick' : '';
    return `<div class="br-card${red}${sel}" data-r="${c.r}" data-s="${c.s}">
      <span class="br-cr">${c.r}</span><span class="br-cs">${c.s}</span>
    </div>`;
  }
  function backCard() { return '<div class="br-card br-back"></div>'; }
  function emptySlot(label) { return `<div class="br-trick-slot">${label}</div>`; }

  function render() {
    const c = document.getElementById('br-content');
    if (!c || G.phase==='DECLARE') return;

    const led = getLedSuit();
    const pTurn = G.turn==='S'||G.turn==='N';

    const hand = (pos, face, isControl) => {
      const h = sortHand(G.hands[pos]);
      const canClick = isControl && G.phase==='PLAY' && G.turn===pos;
      if (!face) return h.map(()=>backCard()).join('');
      return h.map(c2 => {
        const legal = !led || !G.hands[pos].some(x=>x.s===led) || c2.s===led;
        return cardEl(c2, canClick && legal);
      }).join('');
    };

    const trickSlot = (pos, label) => {
      const card = G.trick[pos];
      if (!card) return emptySlot(label);
      const red = RED.has(card.s) ? ' br-red' : '';
      return `<div class="br-card${red} br-tc"><span class="br-cr">${card.r}</span><span class="br-cs">${card.s}</span></div>`;
    };

    const sLabel = G.turn==='S' ? '← 선택' : '';
    const nLabel = G.turn==='N' ? '← 선택' : '';

    c.innerHTML = `
      <div class="br-score">
        <span>N/S <b>${G.tricksNS}</b>/${G.contract}</span>
        <span>E/W <b>${G.tricksEW}</b></span>
        <span>트럼프 <b>${G.trump||'NT'}</b></span>
        <span>${G.trickNum}/13트릭</span>
      </div>
      <div class="br-label">N 더미 ${nLabel}</div>
      <div class="br-handrow">${hand('N',true,true)}</div>
      <div class="br-middle">
        <div class="br-side">
          <div class="br-label">W</div>
          <div class="br-opp-hand">${hand('W',false,false)}</div>
        </div>
        <div class="br-trick-grid">
          <div></div>${trickSlot('N','N')}<div></div>
          ${trickSlot('W','W')}<div class="br-tc-center">제${G.trickNum+1}트릭</div>${trickSlot('E','E')}
          <div></div>${trickSlot('S','S')}<div></div>
        </div>
        <div class="br-side">
          <div class="br-label">E</div>
          <div class="br-opp-hand">${hand('E',false,false)}</div>
        </div>
      </div>
      <div class="br-label">S 당신 ${sLabel}</div>
      <div class="br-handrow">${hand('S',true,true)}</div>
    `;

    c.querySelectorAll('.br-pick').forEach(el => {
      el.addEventListener('click', () => {
        const card = G.hands[G.turn].find(x=>x.r===el.dataset.r&&x.s===el.dataset.s);
        if (card) { playCard(G.turn, card); }
      });
    });
  }

  function setMsg(m) { const e=document.getElementById('br-msg'); if(e) e.textContent=m; }

  // ── 시작 ──
  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="br-topbar">
        <span>♠♥ 브릿지 — 선언자(N/S) vs AI(E/W)</span>
        <span class="br-rule-hint">N/S 합산 HCP 기준으로 계약 자동 설정</span>
      </div>
      <div id="br-content" class="br-content"></div>
      <div id="br-msg" class="br-msg-line"></div>
      <div id="br-actions" class="br-actions"></div>
      <div id="br-pts" class="game-points-earned"></div>
    `;
    deal();
    renderDeclare();
  }

  global.BridgeGame = { start };
})(window);

/* ============================================================
   ICOC OMNIPO — 하트 (Hearts) 1P vs 3 AI
   트릭테이킹: 하트(-1점) · Q♠(-13점) 피하기
   슈팅 더 문: 하트13+Q♠ 전부 → 상대방 3명 각 26점
   100점 도달 시 게임 종료, 최저 점수 플레이어 승리
   ============================================================ */

(function (global) {
  'use strict';

  const SUITS  = ['♠','♥','♦','♣'];
  const RANKS  = ['2','3','4','5','6','7','8','9','10','J','Q','K','A'];
  const RV     = {'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13,A:14};
  const RED    = new Set(['♥','♦']);
  const SO     = {'♠':0,'♥':1,'♦':2,'♣':3};
  const NAMES  = ['당신','West','North','East'];
  let _uid     = 0;

  function makeDeck() {
    const d=[];
    SUITS.forEach(s=>RANKS.forEach(r=>d.push({r,s,v:RV[r],id:_uid++})));
    for(let i=d.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[d[i],d[j]]=[d[j],d[i]];}
    return d;
  }
  function sortHand(h) {
    return [...h].sort((a,b)=>SO[a.s]-SO[b.s]||a.v-b.v);
  }
  function cardPenalty(c) {
    if (c.s==='♥') return 1;
    if (c.r==='Q'&&c.s==='♠') return 13;
    return 0;
  }

  // ── 트릭 승자 ──
  function trickWinner(trick, lead) {
    const ledSuit = trick[lead].s;
    let winner=lead;
    const seats=[0,1,2,3];
    seats.forEach(i=>{
      const c=trick[i], wc=trick[winner];
      if(!c||!wc) return;
      if(c.s===ledSuit && wc.s!==ledSuit){winner=i;return;}
      if(c.s!==ledSuit&&wc.s===ledSuit) return;
      if(c.s===ledSuit && c.v>wc.v) winner=i;
    });
    return winner;
  }

  // ── 카드 패싱 (3장씩 왼쪽으로) ──
  function passCards(hands) {
    // 플레이어(0)는 UI에서 선택, AI는 자동 선택
    // 간단화: 모두 최고 감점 카드 3장 pass
    const passed = hands.map(h=>{
      return [...h].sort((a,b)=>cardPenalty(b)-cardPenalty(a)||b.v-a.v).slice(0,3);
    });
    // 왼쪽(인덱스+1)으로 패스
    const newHands = hands.map(h=>[...h]);
    for(let i=0;i<4;i++){
      const from=i, to=(i+1)%4;
      passed[from].forEach(c=>{
        newHands[from]=newHands[from].filter(x=>x.id!==c.id);
        newHands[to].push(c);
      });
    }
    return newHands;
  }

  // ── AI 카드 선택 ──
  function aiPlay(hand, trickSoFar, lead, heartsBroken, trickNum) {
    const ledSuit = lead !== null ? (trickSoFar[lead]?.s ?? null) : null;
    let playable;

    if (ledSuit) {
      const inSuit = hand.filter(c=>c.s===ledSuit);
      playable = inSuit.length ? inSuit : hand;
    } else {
      // Leading: can't lead hearts unless broken or only hearts left
      const nonHeart = hand.filter(c=>c.s!=='♥'&&!(c.r==='Q'&&c.s==='♠'));
      playable = (!heartsBroken && nonHeart.length) ? nonHeart : hand;
      // First trick: no penalty cards
      if (trickNum===0) {
        const safe = playable.filter(c=>cardPenalty(c)===0);
        if (safe.length) playable = safe;
      }
    }

    // Strategy: dump high penalty cards when possible
    const penalties = playable.filter(c=>cardPenalty(c)>0);
    if (penalties.length && ledSuit) {
      // If we can't follow suit, dump highest penalty
      const cantFollow = !hand.some(c=>c.s===ledSuit);
      if (cantFollow) return penalties.sort((a,b)=>cardPenalty(b)-cardPenalty(a))[0];
    }

    // Otherwise play lowest non-penalty card, or lowest penalty
    const safe = playable.filter(c=>cardPenalty(c)===0);
    if (safe.length) return safe.sort((a,b)=>a.v-b.v)[0];
    return playable.sort((a,b)=>a.v-b.v)[0];
  }

  // ── 게임 상태 ──
  let G;

  function newRound() {
    const deck = makeDeck();
    const hands = [
      sortHand(deck.slice(0,13)),
      sortHand(deck.slice(13,26)),
      sortHand(deck.slice(26,39)),
      sortHand(deck.slice(39,52)),
    ];

    // 2♣ 가진 플레이어가 선공
    let firstLead = 0;
    for(let i=0;i<4;i++) if(hands[i].some(c=>c.r==='2'&&c.s==='♣')){firstLead=i;break;}

    G.hands     = hands;
    G.trick     = [null,null,null,null];
    G.trickNum  = 0;
    G.roundTricks = [[],[],[],[]]; // tricks won per player
    G.lead      = firstLead;
    G.turn      = firstLead;
    G.phase     = 'PLAY';
    G.heartsBroken = false;
    G.roundScores  = [0,0,0,0];
    G.sel       = null;
  }

  function newGame() {
    G = {
      scores:   [0,0,0,0],  // 누적 점수
      round:    1,
      phase:    'PLAY',
      hands:    [[],[],[],[]],
      trick:    [null,null,null,null],
      trickNum: 0,
      roundTricks: [[],[],[],[]],
      lead:     0,
      turn:     0,
      heartsBroken: false,
      roundScores:  [0,0,0,0],
      sel:      null,
      awarded:  false,
    };
    newRound();
  }

  // ── 플레이어 카드 선택 ──
  function selectCard(card) {
    if (G.phase!=='PLAY'||G.turn!==0) return;
    const led = G.lead!==null && G.trickSoFar ? G.trick[G.lead]?.s : null;
    // 첫 트릭: 2♣ 강제
    if (G.trickNum===0 && G.trick.every(c=>c===null)) {
      if (!(card.r==='2'&&card.s==='♣')) { setMsg('첫 수는 2♣을 내야 합니다.'); return; }
    }
    G.sel = (G.sel?.id===card.id) ? null : card;
    render();
  }

  function playSelected() {
    if (!G.sel||G.phase!=='PLAY'||G.turn!==0) return;
    const card = G.sel;

    // 수트 추종 검증
    const ledCard = ([0,1,2,3].map(i=>G.trick[i]).find(c=>c!==null));
    const ledSuit = ledCard?.s;
    if (ledSuit && G.hands[0].some(c=>c.s===ledSuit) && card.s!==ledSuit) {
      setMsg(`${ledSuit} 수트를 따라야 합니다!`); return;
    }
    // 하트 브레이크 전 하트 선공 금지
    if (!ledCard && !G.heartsBroken && card.s==='♥') {
      const onlyHearts = G.hands[0].every(c=>c.s==='♥');
      if (!onlyHearts) { setMsg('하트가 아직 브레이크되지 않았습니다.'); return; }
    }
    // 첫 트릭 감점 카드 금지
    if (G.trickNum===0 && !ledCard && cardPenalty(card)>0) {
      setMsg('첫 트릭에는 감점 카드를 낼 수 없습니다.'); return;
    }

    doPlay(0, card);
  }

  function doPlay(seat, card) {
    G.hands[seat] = G.hands[seat].filter(c=>c.id!==card.id);
    G.trick[seat] = card;
    if (card.s==='♥') G.heartsBroken = true;
    if (card.r==='Q'&&card.s==='♠') G.heartsBroken = true;
    G.sel = null;

    // 다음 차례
    const order = rotateTo([0,1,2,3], G.lead);
    const nextIdx = order.indexOf(seat)+1;

    if (nextIdx < 4) {
      G.turn = order[nextIdx];
      render();
      if (G.turn!==0) setTimeout(doAITurn, 600);
    } else {
      completeTrick();
    }
  }

  function rotateTo(arr, start) {
    const i=arr.indexOf(start);
    return [...arr.slice(i),...arr.slice(0,i)];
  }

  function doAITurn() {
    if (G.phase!=='PLAY'||G.turn===0) return;
    const seat = G.turn;
    const card  = aiPlay(G.hands[seat], G.trick, G.lead, G.heartsBroken, G.trickNum);
    doPlay(seat, card);
  }

  function completeTrick() {
    const winner = trickWinner(G.trick, G.lead);
    // 이 트릭 감점 합산
    let pts = G.trick.reduce((a,c)=>a+(c?cardPenalty(c):0),0);
    G.roundTricks[winner].push([...G.trick.filter(c=>c)]);
    G.roundScores[winner] += pts;
    G.trickNum++;
    G.lead = winner;
    G.turn = winner;
    G.trick = [null,null,null,null];
    render();
    setMsg(`${NAMES[winner]} 획득 (${pts}점)`);

    if (G.trickNum >= 13) {
      setTimeout(endRound, 1000);
    } else {
      if (winner !== 0) setTimeout(doAITurn, 900);
    }
  }

  function endRound() {
    // 슈팅 더 문 체크
    for (let i=0;i<4;i++) {
      if (G.roundScores[i]===26) {
        // 이 플레이어가 문샷
        setMsg(`🌕 ${NAMES[i]} 슈팅 더 문! 나머지 3명 각 +26점`);
        for(let j=0;j<4;j++) G.roundScores[j] = (j===i ? 0 : 26);
        break;
      }
    }
    // 누적
    for(let i=0;i<4;i++) G.scores[i]+=G.roundScores[i];
    render();
    updateScoreboard();

    // 100점 넘으면 게임 끝
    if (G.scores.some(s=>s>=100)) {
      setTimeout(endGame, 1500);
    } else {
      G.round++;
      const ac=document.getElementById('ht-actions');
      if(ac) ac.innerHTML=`<button class="game-btn primary" id="ht-nextround">다음 라운드 ▶</button>`;
      document.getElementById('ht-nextround')?.addEventListener('click',()=>{
        newRound(); render(); setMsg('');
      });
    }
  }

  function endGame() {
    if (G.awarded) return;
    G.awarded = true;
    const minScore = Math.min(...G.scores);
    const win = G.scores[0]===minScore;
    const pts = win ? 30 : 15;
    setMsg(win
      ? `🏆 승리! 최저 점수 ${G.scores[0]}점`
      : `😅 패배. 당신 ${G.scores[0]}점 (1위: ${minScore}점)`);
    const res = window.ICOC_POINTS.addPoints(pts,'hearts_'+(win?'win':'lose'));
    const pEl=document.getElementById('ht-pts');
    if(pEl) pEl.textContent=res.capped
      ?`+${res.added}P 적립 (한도 · 보유 ${res.total.toLocaleString()}P)`
      :`+${res.added}P 적립 · 보유 ${res.total.toLocaleString()}P`;
    window.ICOC_POINTS.showToast(`+${res.added}P 적립되었습니다.`);
    const ac=document.getElementById('ht-actions');
    if(ac) ac.innerHTML=`
      <button class="game-btn primary" id="ht-restart">다시하기</button>
      <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>`;
    document.getElementById('ht-restart')?.addEventListener('click',()=>{
      document.getElementById('ht-pts').textContent='';
      newGame(); render(); setMsg('');
    });
  }

  // ── 렌더링 ──
  function cardEl(c,opts={}) {
    const{pick=false,sel=false,penalty=false,back=false,sm=false,played=false}=opts;
    if(back) return `<div class="ht-card ht-back${sm?' ht-sm':''}"></div>`;
    const red=RED.has(c.s)?' ht-red':'';
    const selCl=sel?' ht-sel':'';
    const penCl=penalty?' ht-penalty':'';
    const pCl=pick?' ht-pick':'';
    const plCl=played?' ht-played':'';
    return `<div class="ht-card${red}${selCl}${penCl}${pCl}${plCl}" data-id="${c.id}">
      <span class="ht-r">${c.r}</span><span class="ht-s">${c.s}</span>
    </div>`;
  }

  function trickSlot(seat, label) {
    const c=G.trick[seat];
    if(!c) return `<div class="ht-trick-slot"><span>${label}</span></div>`;
    const red=RED.has(c.s)?' ht-red':'';
    const pen=cardPenalty(c)>0?' ht-penalty':'';
    return `<div class="ht-card${red}${pen} ht-tc">
      <span class="ht-r">${c.r}</span><span class="ht-s">${c.s}</span>
    </div>`;
  }

  function updateScoreboard() {
    NAMES.forEach((n,i)=>{
      const el=document.getElementById(`ht-score-${i}`);
      if(el) el.textContent=G.scores[i];
    });
  }

  function render() {
    const el=document.getElementById('ht-content');
    if(!el) return;

    const playerH=sortHand(G.hands[0]);
    const isMyTurn=G.phase==='PLAY'&&G.turn===0;
    const ledCard=[0,1,2,3].map(i=>G.trick[i]).find(c=>c!==null);
    const ledSuit=ledCard?.s;

    // 따라야 할 수트 있는지
    const mustFollow = ledSuit && G.hands[0].some(c=>c.s===ledSuit);

    el.innerHTML=`
      <div class="ht-score-bar">
        ${NAMES.map((n,i)=>`
          <div class="ht-score-item${i===0?' ht-score-me':''}">
            <span class="ht-score-name">${n}</span>
            <span class="ht-score-val" id="ht-score-${i}">${G.scores[i]}</span>
          </div>`).join('')}
        <span class="ht-round-lbl">R${G.round}</span>
      </div>

      <div class="ht-table">
        <div class="ht-opp-row">
          <div class="ht-opp">
            <div class="ht-opp-cards">${G.hands[1].map(()=>'<div class="ht-card ht-back ht-sm"></div>').join('')}</div>
            <span class="ht-opp-lbl">West ${G.roundScores[1]}pts</span>
          </div>
          <div class="ht-trick-grid">
            <div></div>${trickSlot(2,'N')}<div></div>
            ${trickSlot(1,'W')}<div class="ht-tc-center">제${G.trickNum+1}트릭<br><small>${G.heartsBroken?'♥브레이크':'♥미브레이크'}</small></div>${trickSlot(3,'E')}
            <div></div>${trickSlot(0,'나')}<div></div>
          </div>
          <div class="ht-opp">
            <div class="ht-opp-cards">${G.hands[3].map(()=>'<div class="ht-card ht-back ht-sm"></div>').join('')}</div>
            <span class="ht-opp-lbl">East ${G.roundScores[3]}pts</span>
          </div>
        </div>
        <div class="ht-north">
          <div class="ht-opp-cards">${G.hands[2].map(()=>'<div class="ht-card ht-back ht-sm"></div>').join('')}</div>
          <span class="ht-opp-lbl">North ${G.roundScores[2]}pts</span>
        </div>
      </div>

      <div class="ht-player-bar">
        <span>당신 ${playerH.length}장 · 이번 라운드 ${G.roundScores[0]}pts</span>
        ${isMyTurn?'<span class="ht-your-turn">← 카드 선택</span>':''}
      </div>
      <div class="ht-hand" id="ht-hand">
        ${playerH.map(c=>{
          const firstLead = G.trickNum===0 && G.trick.every(x=>x===null);
          const legal = isMyTurn && (
            firstLead
              ? (c.r==='2'&&c.s==='♣')
              : (!mustFollow || c.s===ledSuit || !G.hands[0].some(x=>x.s===ledSuit))
          );
          const isPenalty = cardPenalty(c)>0;
          return cardEl(c,{pick:isMyTurn&&legal,sel:G.sel?.id===c.id,penalty:isPenalty});
        }).join('')}
      </div>
      ${isMyTurn&&G.sel?`
        <div class="ht-sel-bar">
          <span>${G.sel.r}${G.sel.s} 선택</span>
          <button class="game-btn primary ht-play-btn" id="ht-play">내기</button>
        </div>`:''}
      <div id="ht-actions" class="ht-actions"></div>
    `;

    document.querySelectorAll('#ht-hand .ht-pick').forEach(e=>{
      e.addEventListener('click',()=>{
        const c=G.hands[0].find(x=>x.id===+e.dataset.id);
        if(c) selectCard(c);
      });
    });
    document.getElementById('ht-play')?.addEventListener('click', playSelected);
    updateScoreboard();
  }

  function setMsg(m){const e=document.getElementById('ht-msg');if(e)e.textContent=m;}

  function start() {
    const body=document.getElementById('game-modal-body');
    body.innerHTML=`
      <div class="ht-topbar">
        <span>♥ 하트 (Hearts)</span>
        <span class="ht-sub">하트·Q♠ 피하기 · 슈팅 더 문 · 100점 도달 시 최저점 승</span>
      </div>
      <div id="ht-content" class="ht-content"></div>
      <div id="ht-msg" class="ht-msg-line"></div>
      <div id="ht-pts" class="game-points-earned"></div>
    `;
    newGame(); render();
    setMsg('2♣ 부터 시작합니다. 하트와 Q♠를 피하세요!');
    if(G.turn!==0) setTimeout(doAITurn,800);
  }

  global.HeartsGame={start};
})(window);

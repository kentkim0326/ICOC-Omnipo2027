/* ICOC Go AI v2.0 — 50-playout MCTS + heuristic rollout */
/* ============================================================
   ICOC OMNIPO — 바둑 (Go / Baduk) vs AI  v2
   19×19 보드 · 개선된 AI (후보 추출 + 몬테카를로 경량 평가)
   포획 우선 판정 · 자살수 금지 · 패(Ko) 규칙
   ============================================================ */

(function (global) {
/* ── 효과음 래퍼 (ICOC_SFX 뮤트 연동) ── */
function sfx(type) {
  if (window.ICOC_SFX && window.ICOC_SFX.isMuted()) return;
  const S = window.ICOC_SFX;
  if (!S) return;
  const map = {
    place:   () => S.stone(),
    stone:   () => S.stone(),
    capture: () => S.capture(),
    invalid: () => S.click(),
    win:     () => S.win(),
    lose:    () => S.lose(),
    draw:    () => S.draw(),
    pass:    () => S.pass(),
    atari:   () => S.atari(),
  };
  if (map[type]) map[type]();
}

  'use strict';

  const SIZE   = 19;
  const EMPTY  = 0, BLACK = 1, WHITE = 2;
  const NB     = [[-1,0],[1,0],[0,-1],[0,1]];

  // 19×19 화점 위치 (0-indexed)
  const STAR_POINTS_19 = [
    [3,3],[3,9],[3,15],
    [9,3],[9,9],[9,15],
    [15,3],[15,9],[15,15],
  ];

  let board, turn, gameOver, passCount, boardUI, lastMoveEl, awarded;
  let capturedByBlack, capturedByWhite, koPoint, koColor;

  /* ── 유틸 ── */
  function inB(r,c){ return r>=0&&r<SIZE&&c>=0&&c<SIZE; }
  function nbOf(r,c){ return NB.map(([dr,dc])=>[r+dr,c+dc]).filter(([rr,cc])=>inB(rr,cc)); }
  function key(r,c){ return r*SIZE+c; }

  function getGroup(bd,r,c){
    const color=bd[r][c], stones=new Set(), liberties=new Set();
    const stack=[[r,c]], visited=new Set([key(r,c)]);
    while(stack.length){
      const [cr,cc]=stack.pop(); stones.add(key(cr,cc));
      for(const [nr,nc] of nbOf(cr,cc)){
        if(bd[nr][nc]===EMPTY) liberties.add(key(nr,nc));
        else if(bd[nr][nc]===color&&!visited.has(key(nr,nc))){
          visited.add(key(nr,nc)); stack.push([nr,nc]);
        }
      }
    }
    return {stones,liberties};
  }

  function clone(bd){ return bd.map(r=>r.slice()); }

  function tryMove(bd,color,r,c,koPt,koCol){
    if(bd[r][c]!==EMPTY) return {ok:false};
    if(koPt!==null&&koPt===key(r,c)&&koCol===color) return {ok:false};
    const sim=clone(bd); sim[r][c]=color;
    const opp=color===BLACK?WHITE:BLACK;
    let captured=0, newKo=null;
    const removedGroups=[];
    for(const [nr,nc] of nbOf(r,c)){
      if(sim[nr][nc]===opp){
        const g=getGroup(sim,nr,nc);
        if(g.liberties.size===0){
          if(g.stones.size===1) removedGroups.push({stones:g.stones,r:nr,nc});
          g.stones.forEach(k=>{ const rr=Math.floor(k/SIZE),cc=k%SIZE; sim[rr][cc]=EMPTY; captured++; });
        }
      }
    }
    const myG=getGroup(sim,r,c);
    if(myG.liberties.size===0) return {ok:false}; // 자살수
    if(captured===1&&removedGroups.length===1) newKo={pt:key(r,c),col:opp};
    return {ok:true,bd:sim,captured,ownLiberties:myG.liberties.size,newKo};
  }

  /* ═══════════════════════════════════════════════════════════
     개선된 AI — 3단계:
     1) 즉각 포획·구출·단수 후보 추출
     2) 영향권(Influence) 기반 좋은 자리 후보
     3) 경량 몬테카를로(각 후보 8회 랜덤 플레이아웃) 평가
  ═══════════════════════════════════════════════════════════ */

  function aiHeuristic(r,c){
    const res=tryMove(board,WHITE,r,c,koPoint,koColor);
    if(!res.ok) return null;
    const sim=res.bd;
    let score=0;

    // ① 즉각 포획 (매우 중요)
    score += res.captured * 1200;

    // ② 내 돌 구하기 (단수/이단수 위기)
    for(const [nr,nc] of nbOf(r,c)){
      if(board[nr][nc]===WHITE){
        const g=getGroup(board,nr,nc);
        if(g.liberties.size===1) score+=1000; // 단수 구출
        else if(g.liberties.size===2) score+=150;
      }
    }

    // ③ 상대 단수(아타리) - 포획 위협
    for(const [nr,nc] of nbOf(r,c)){
      if(sim[nr][nc]===BLACK){
        const g=getGroup(sim,nr,nc);
        if(g.liberties.size===1) score+=900; // 상대 단수
        else if(g.liberties.size===2) score+=120;
      }
    }

    // ④ 자살수 방지
    const myGroup=getGroup(sim,r,c);
    if(myGroup.liberties.size===0) return null; // 자살수
    if(myGroup.liberties.size===1) score-=300; // 즉각 단수 위험

    // ⑤ 연결성 (균형: 연결+분산)
    const totalStones = countStones(board);
    let myNeighbors=0, emptyNeighbors=0, blackNeighbors=0;
    for(const [nr,nc] of nbOf(r,c)){
      if(board[nr][nc]===WHITE) myNeighbors++;
      else if(board[nr][nc]===EMPTY) emptyNeighbors++;
      else if(board[nr][nc]===BLACK) blackNeighbors++;
    }
    // 클러스터 방지: 인접 내 돌 2개 이상이면 페널티 (뭉치지 않게)
    if(myNeighbors === 1) score += 50;       // 한 개 연결: 좋음
    else if(myNeighbors === 2) score += 20;  // 두 개 연결: 보통
    else if(myNeighbors >= 3) score -= 80;   // 세 개 이상: 클러스터 페널티
    score += emptyNeighbors * 25;

    // ⑥ 활로 수 (많을수록 좋음)
    score += myGroup.liberties.size * 45;

    // ⑦ 포석 전략 (초반: 영역 확장, 후반: 국지전)
    if(totalStones < 30){
      // 초반: 분산 포석 선호 (넓게 퍼지기)
      const dr = Math.abs(r - (SIZE-1)/2);
      const dc = Math.abs(c - (SIZE-1)/2);
      const dist = Math.max(dr,dc);
      // 3~6선 선호 (너무 가장자리도, 너무 중앙도 아닌)
      const idealDist = 5;
      score += Math.max(0, 200 - Math.abs(dist - idealDist) * 40);
    } else if(totalStones < 80) {
      // 중반: 상대 돌에 압박
      score += blackNeighbors * 50;
    }

    // ⑧ 화점(스타포인트) 선호 - 초반 20수 이내
    const starPts = [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]];
    if(totalStones < 20 && starPts.some(([sr,sc])=>sr===r&&sc===c)) score+=250;

    // ⑨ 양쪽 끝(1선) 회피 - 초반
    if(totalStones < 40 && (r===0||r===SIZE-1||c===0||c===SIZE-1)) score -= 120;
    if(totalStones < 20 && (r<=1||r>=SIZE-2||c<=1||c>=SIZE-2)) score -= 80;

    // ⑩ 상대 눈 훼방
    if(blackNeighbors>=2) score+=100;

    return score;
  }

  function countStones(bd){
    let n=0;
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++) if(bd[r][c]!==EMPTY) n++;
    return n;
  }

  // 롤아웃 정책: 휴리스틱 기반 랜덤 (완전 랜덤보다 강함)
  function rolloutMove(bd,color,lastCaptures){
    const empties=[];
    const urgent=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(bd[r][c]!==EMPTY) continue;
      const opp=color===BLACK?WHITE:BLACK;
      // 즉각 포획 우선
      let caps=0;
      for(const [nr,nc] of nbOf(r,c)){
        if(bd[nr][nc]===opp){
          const g=getGroup(bd,nr,nc);
          if(g.liberties.size===1) caps+=g.cells.size;
        }
      }
      if(caps>0){ urgent.push([r,c,caps]); continue; }
      // 눈(eye) 제외: 완전히 둘러싸인 빈 칸은 스킵
      let ownNb=0;
      for(const [nr,nc] of nbOf(r,c)) if(bd[nr][nc]===color) ownNb++;
      if(ownNb===nbOf(r,c).length) continue;
      empties.push([r,c]);
    }
    if(urgent.length){
      urgent.sort((a,b)=>b[2]-a[2]);
      return [urgent[0][0],urgent[0][1]];
    }
    if(!empties.length) return null;
    return empties[Math.floor(Math.random()*empties.length)];
  }


  function mcEval(r,c,n){
    let wins=0;
    for(let t=0;t<n;t++){
      const simBd=clone(board);
      const firstRes=tryMove(simBd,WHITE,r,c,koPoint,koColor);
      if(!firstRes.ok) return -Infinity;
      let bd2=firstRes.bd;
      let curColor=BLACK;
      let capB=capturedByBlack, capW=capturedByWhite+firstRes.captured;
      let passes=0;
      // 더 긴 롤아웃: 60수 (기존 30수)
      for(let step=0;step<60&&passes<2;step++){
        const mv=rolloutMove(bd2,curColor,null);
        if(!mv){ passes++; curColor=curColor===BLACK?WHITE:BLACK; continue; }
        passes=0;
        const res=tryMove(bd2,curColor,mv[0],mv[1],null,null);
        if(!res.ok){ passes++; curColor=curColor===BLACK?WHITE:BLACK; continue; }
        bd2=res.bd;
        if(curColor===BLACK) capB+=res.captured;
        else capW+=res.captured;
        curColor=curColor===BLACK?WHITE:BLACK;
      }
      // 점수: 포획 + 영토 추정
      let wScore=capW, bScore=capB;
      for(let rr=0;rr<SIZE;rr++) for(let cc=0;cc<SIZE;cc++){
        if(bd2[rr][cc]===WHITE) wScore+=1;
        else if(bd2[rr][cc]===BLACK) bScore+=1;
        else{
          // 빈점 영토 추정: 주변 돌의 색
          let wb=0,bb=0;
          for(const [nr,nc] of nbOf(rr,cc)){
            if(bd2[nr][nc]===WHITE) wb++;
            else if(bd2[nr][nc]===BLACK) bb++;
          }
          if(wb>bb) wScore+=0.5;
          else if(bb>wb) bScore+=0.5;
        }
      }
      if(wScore>bScore) wins++;
    }
    return wins/n;
  }


  function aiPickMove(){
    const scored = [];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(board[r][c]!==EMPTY) continue;
      try {
        const h = aiHeuristic(r,c);
        if(h===null) continue;
        scored.push({r,c,h});
      } catch(e){}
    }
    if(!scored.length) return null;
    scored.sort((a,b)=>b.h-a.h);

    // 즉각 포획/구출 → 바로 실행
    if(scored[0].h >= 1000) return [scored[0].r, scored[0].c];

    // 상위 12후보 × 10플레이아웃 × 30수 = 3600 시뮬레이션
    const top = scored.slice(0, 12);
    let best = -Infinity, bestCell = null;
    for(const {r,c,h} of top){
      try {
        const mc = lightMCEval(r, c, 10, 30);
        const combined = h * 0.35 + mc * 800;
        if(combined > best){ best = combined; bestCell = [r,c]; }
      } catch(e){
        if(h > best){ best = h; bestCell = [r,c]; }
      }
    }
    return bestCell || [scored[0].r, scored[0].c];
  }

  // 경량 MCTS: 포획 + 석수 + 활로 종합 평가
  function lightMCEval(r, c, n, maxDepth){
    let totalScore = 0;
    const initCapW = capturedByWhite, initCapB = capturedByBlack;

    for(let t=0;t<n;t++){
      const firstRes = tryMove(board, WHITE, r, c, null, null);
      if(!firstRes.ok) return -1;
      let bd = firstRes.bd;
      let color = BLACK;
      let capW = firstRes.captured, capB = 0;
      let passes = 0;

      for(let step=0;step<maxDepth && passes<2;step++){
        const mv = rolloutMove(bd, color, null);
        if(!mv){ passes++; color = color===BLACK?WHITE:BLACK; continue; }
        passes = 0;
        const res = tryMove(bd, color, mv[0], mv[1], null, null);
        if(!res.ok){ color = color===BLACK?WHITE:BLACK; continue; }
        bd = res.bd;
        if(color===BLACK) capB += res.captured;
        else capW += res.captured;
        color = color===BLACK ? WHITE : BLACK;
      }

      // 종합 평가: 포획 + 석수 + 활로 우세
      let wStones=0, bStones=0;
      let wLibs = new Set(), bLibs = new Set();
      for(let rr=0;rr<SIZE;rr++) for(let cc=0;cc<SIZE;cc++){
        if(bd[rr][cc]===WHITE){
          wStones++;
          for(const [nr,nc] of nbOf(rr,cc))
            if(bd[nr][nc]===EMPTY) wLibs.add(nr*SIZE+nc);
        } else if(bd[rr][cc]===BLACK){
          bStones++;
          for(const [nr,nc] of nbOf(rr,cc))
            if(bd[nr][nc]===EMPTY) bLibs.add(nr*SIZE+nc);
        }
      }
      const capScore = (capW - capB) * 2.5;
      const stoneScore = (wStones - bStones) * 0.8;
      const libScore = (wLibs.size - bLibs.size) * 0.4;
      const val = capScore + stoneScore + libScore;
      totalScore += val > 0 ? 1 : val < -4 ? 0 : 0.5 + val * 0.08;
    }
    return totalScore / n;
  }


  function lightMCEval(r, c, n, depth){
    let wins = 0;
    for(let t=0;t<n;t++){
      // 첫 수: AI(백) 착수
      const firstRes = tryMove(board, WHITE, r, c, null, null);
      if(!firstRes.ok) return -1;
      let bd = firstRes.bd;
      let color = BLACK;
      let capW = firstRes.captured, capB = 0;

      // 빠른 랜덤 롤아웃
      for(let step=0;step<depth;step++){
        const mv = rolloutMove(bd, color, null);
        if(!mv) break;
        const res = tryMove(bd, color, mv[0], mv[1], null, null);
        if(!res.ok){ color = color===BLACK?WHITE:BLACK; continue; }
        bd = res.bd;
        if(color===BLACK) capB += res.captured;
        else capW += res.captured;
        color = color===BLACK ? WHITE : BLACK;
      }
      // 포획 수로 승패 판단 (단순하지만 빠름)
      if(capW > capB) wins++;
    }
    return wins / n;
  }


  function doAiTurn(){
    console.log('[Go] doAiTurn running, board:', board[9][9]);
    setStatus('AI가 생각 중...');
    setTimeout(()=>{
      let mv;
      try { mv=aiPickMove(); } catch(e){ console.error('[Go] aiPickMove error:',e); mv=null; }
      console.log('[Go] AI picked move:', mv);
      if(!mv){
        passCount++;
        sfx('pass');
        setStatus('AI가 패스했습니다.');
        if(passCount>=2){ endGame(); return; }
        turn=BLACK; setTurnUI(); setStatus('');
        return;
      }
      const [r,c]=mv;
      const res=tryMove(board,WHITE,r,c,koPoint,koColor);
      if(!res.ok){ passCount++; turn=BLACK; setTurnUI(); return; }
      board=res.bd;
      capturedByWhite+=res.captured;
      if(res.newKo){ koPoint=res.newKo.pt; koColor=res.newKo.col; } else { koPoint=null; koColor=null; }
      // 내 단수 그룹 경고
      let myAtari=false;
      for(let rr=0;rr<SIZE;rr++) for(let cc=0;cc<SIZE;cc++){
        if(board[rr][cc]===BLACK){ const g=getGroup(board,rr,cc); if(g.liberties.size===1){ myAtari=true; break; } }
      }
      if(res.captured>0) sfx('capture');
      else sfx('stone');
      if(myAtari) setTimeout(()=>sfx('atari'),200);
      passCount=0;
      renderBoard(); markLastMove(r,c); setTurnUI(); setStatus('');
      turn=BLACK;
    }, 100);
  }

  function onPassClick(){
    if(gameOver||turn!==BLACK) return;
    sfx('pass');
    passCount++;
    if(passCount>=2){ endGame(); return; }
    setStatus('패스했습니다. AI 차례...');
    turn=WHITE; setTurnUI();
    setTimeout(doAiTurn,300);
  }

  function endGame(){
    gameOver=true; setTurnUI();
    const diff=capturedByBlack-capturedByWhite;
    let result = diff>0?'win':(diff<0?'lose':'draw');
    if(result==='win'){ setStatus(`🎉 승리! (포획 흑 ${capturedByBlack} : 백 ${capturedByWhite})`); sfx('win'); }
    else if(result==='lose'){ setStatus(`😔 AI 승리. (포획 흑 ${capturedByBlack} : 백 ${capturedByWhite})`); sfx('lose'); }
    else { setStatus(`무승부 (포획 ${capturedByBlack} : ${capturedByWhite})`); sfx('draw'); }
    if(!awarded){
      awarded=true;
      const isLoggedIn = !!(global.ICOC_AUTH?.currentUser || global.currentUser);
      if(isLoggedIn && global.ICOC_POINTS){
        if(result==='win') global.ICOC_POINTS.onGameWin('바둑');
        else if(result==='lose') global.ICOC_POINTS.onGameLoss('바둑');
        setPointsMsg('포인트가 적립되었습니다.');
      } else if(!isLoggedIn) {
        setPointsMsg('⚡ 구글 로그인 시 포인트 적립 & 국가대표 등록 가능');
      }
    }
  }


  /* ── DOM 헬퍼 ── */


  /* ── DOM 헬퍼 함수 ── */

  function setStatus(msg) {
    const el = document.getElementById('go-status');
    if (el) el.textContent = msg;
  }

  function setPointsMsg(msg) {
    const el = document.getElementById('go-points-msg');
    if (el) el.textContent = msg;
  }

  function setTurnUI() {
    const bEl = document.getElementById('go-turn-black');
    const wEl = document.getElementById('go-turn-white');
    if (bEl) {
      bEl.style.opacity = (turn === BLACK && !gameOver) ? '1' : '0.45';
      bEl.textContent = '⚫ 당신 (흑) · 포획 ' + capturedByBlack;
    }
    if (wEl) {
      wEl.style.opacity = (turn === WHITE && !gameOver) ? '1' : '0.45';
      wEl.textContent = '⚪ AI (백) · 포획 ' + capturedByWhite;
    }
  }

  function renderBoard() {
    if (!boardUI) return;
    boardUI.clearAll();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (board[r][c] === BLACK) boardUI.placeStone(r, c, 'go-black');
        else if (board[r][c] === WHITE) boardUI.placeStone(r, c, 'go-white');
      }
    }
  }

  function markLastMove(r, c) {
    // 이전 마지막 수 표시 제거
    if (lastMoveEl) { lastMoveEl.classList.remove('go-last'); lastMoveEl = null; }
    // 새 마지막 수 표시
    const slot = boardUI && boardUI.cellEls && boardUI.cellEls[r] && boardUI.cellEls[r][c];
    if (slot) {
      const stone = slot.querySelector('.stone');
      if (stone) { stone.classList.add('go-last'); lastMoveEl = stone; }
    }
  }

  function checkWinAfterMove(color) {
    // 바둑: 두 번 연속 패스로만 종료.
    // 첫 수 직후 흰돌 0개 → 즉시종료 버그 방지.
    return false;
  }

  function reset(){
    board=Array.from({length:SIZE},()=>Array(SIZE).fill(EMPTY));
    turn=BLACK; gameOver=false; passCount=0;
    lastMoveEl=null; awarded=false;
    capturedByBlack=0; capturedByWhite=0;
    koPoint=null; koColor=null;
    setStatus('');
    setPointsMsg('당신은 흑, AI는 백입니다. 포획을 더 많이 하면 승리합니다.');
    setTurnUI();
    if(boardUI) renderBoard();
  }

  function buildBoardDOM(container){
    function onCellClick(r,c){
      // 온라인 모드
      if(window.ICOC_ONLINE?.active){
        const myColor = ICOC_ONLINE.myRole==='host' ? BLACK : WHITE;
        if(!ICOC_ONLINE.isMyTurn || turn!==myColor || gameOver) return;
        const res=tryMove(board,myColor,r,c,koPoint,koColor);
        if(!res.ok) return;
        board=res.bd;
        if(myColor===BLACK) capturedByBlack+=res.captured;
        else capturedByWhite+=res.captured;
        if(res.newKo){koPoint=res.newKo.pt;koColor=res.newKo.col;}else{koPoint=null;}
        passCount=0; renderBoard(); markLastMove(r,c);
        setTurnUI();
        ICOC_ONLINE.sendMove({r,c});
        ICOC_ONLINE.showTurnIndicator(false);
        return;
      }
      // AI 모드 (기존 로직)
      if(turn!==BLACK||gameOver) return;
      const res=tryMove(board,BLACK,r,c,koPoint,koColor);
      if(!res.ok){sfx('invalid');return;}
      board=res.bd; capturedByBlack+=res.captured;
      if(res.newKo){koPoint=res.newKo.pt;koColor=res.newKo.col;}else{koPoint=null;}
      passCount=0; renderBoard(); markLastMove(r,c); sfx(res.captured>0?'capture':'place');
      if(checkWinAfterMove(BLACK)){return;}
      turn=WHITE; setTurnUI(); console.log('[Go] AI turn starting...'); setTimeout(doAiTurn,400);
    }
    boardUI=global.BoardUI.createGoban(container, SIZE, {
      onIntersectionClick: onCellClick,
      starPoints: STAR_POINTS_19,
    });
  }

  function start(){
    const body=document.getElementById('game-modal-body');
    body.innerHTML=`
      <div class="game-status-bar">
        <span id="go-turn-black" class="game-turn-pill">⚫ 당신 (흑) · 포획 0</span>
        <span id="go-turn-white" class="game-turn-pill">⚪ AI (백) · 포획 0</span>
      </div>
      <div id="go-status" class="go-status-text"></div>
      <div id="go-board-wrap" class="go-board-wrap-19"></div>
      <div id="go-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn ghost" id="go-pass-btn">패스</button>
        <button class="game-btn primary" id="go-restart-btn">다시하기</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    buildBoardDOM(document.getElementById('go-board-wrap'));
    document.getElementById('go-restart-btn').addEventListener('click',reset);
    document.getElementById('go-pass-btn').addEventListener('click',onPassClick);
    reset();
  }

  
  function applyOpponentMove(payload){
    if(!payload||gameOver) return;
    const oppColor = ICOC_ONLINE?.myRole==='host' ? WHITE : BLACK;
    const res=tryMove(board,oppColor,payload.r,payload.c,koPoint,koColor);
    if(!res.ok) return;
    board=res.bd;
    if(oppColor===BLACK) capturedByBlack+=res.captured;
    else capturedByWhite+=res.captured;
    if(res.newKo){koPoint=res.newKo.pt;koColor=res.newKo.col;}else{koPoint=null;}
    passCount=0; turn = ICOC_ONLINE?.myRole==='host' ? BLACK : WHITE;
    renderBoard(); markLastMove(payload.r,payload.c); sfx('place'); setTurnUI();
    ICOC_ONLINE?.showTurnIndicator(true);
  }

  global.GoGame = {start, applyOpponentMove};
})(window);

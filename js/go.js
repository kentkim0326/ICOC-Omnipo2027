/* ============================================================
   ICOC OMNIPO — 바둑 (Go / Baduk) vs AI  v2
   19×19 보드 · 개선된 AI (후보 추출 + 몬테카를로 경량 평가)
   포획 우선 판정 · 자살수 금지 · 패(Ko) 규칙
   ============================================================ */

(function (global) {
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

    // ① 즉각 포획
    score += res.captured * 800;

    // ② 내 단수 구출 (1활로 그룹 구하기)
    for(const [nr,nc] of nbOf(r,c)){
      if(board[nr][nc]===WHITE){
        const g=getGroup(board,nr,nc);
        if(g.liberties.size===1) score+=600; // 생사 위기 구출
        else if(g.liberties.size===2) score+=80;
      }
    }

    // ③ 상대 단수(아타리) 위협
    for(const [nr,nc] of nbOf(r,c)){
      if(sim[nr][nc]===BLACK){
        const g=getGroup(sim,nr,nc);
        if(g.liberties.size===1) score+=400;
        else if(g.liberties.size===2) score+=60;
      }
    }

    // ④ 활로 수
    score += res.ownLiberties * 12;

    // ⑤ 근처 돌 밀도 (3선 반경)
    let prox=0;
    for(let dr=-3;dr<=3;dr++) for(let dc=-3;dc<=3;dc++){
      const nr=r+dr,nc=c+dc;
      if(inB(nr,nc)&&board[nr][nc]!==EMPTY) prox++;
    }
    score += prox * 8;

    // ⑥ 1선 감점, 2선 약감점
    if(r===0||c===0||r===SIZE-1||c===SIZE-1) score-=30;
    else if(r===1||c===1||r===SIZE-2||c===SIZE-2) score-=10;

    // ⑦ 화점 근처 가산
    for(const [sr,sc] of STAR_POINTS_19){
      const d=Math.abs(r-sr)+Math.abs(c-sc);
      if(d===0) score+=25;
      else if(d<=2) score+=8;
    }

    score += Math.random()*12;
    return score;
  }

  // 경량 몬테카를로: candidate 위치에 대해 n번 랜덤 플레이아웃
  function mcEval(r,c,n){
    let wins=0;
    for(let t=0;t<n;t++){
      const simBd=clone(board);
      const firstRes=tryMove(simBd,WHITE,r,c,koPoint,koColor);
      if(!firstRes.ok) return -Infinity;
      let bd2=firstRes.bd;
      let curColor=BLACK, capB=capturedByBlack, capW=capturedByWhite+firstRes.captured;
      let passes=0;
      for(let step=0;step<30&&passes<2;step++){
        const empties=[];
        for(let rr=0;rr<SIZE;rr++) for(let cc=0;cc<SIZE;cc++){
          if(bd2[rr][cc]===EMPTY) empties.push([rr,cc]);
        }
        if(!empties.length){ passes++; curColor=curColor===BLACK?WHITE:BLACK; continue; }
        // 랜덤 후보 8개만 평가
        const sample=empties.sort(()=>Math.random()-0.5).slice(0,8);
        let moved=false;
        for(const [rr,cc] of sample){
          const res2=tryMove(bd2,curColor,rr,cc,null,null);
          if(res2.ok){
            bd2=res2.bd;
            if(curColor===BLACK) capB+=res2.captured;
            else capW+=res2.captured;
            curColor=curColor===BLACK?WHITE:BLACK;
            passes=0; moved=true; break;
          }
        }
        if(!moved){ passes++; curColor=curColor===BLACK?WHITE:BLACK; }
      }
      if(capW>capB) wins++;
    }
    return wins/n;
  }

  function aiPickMove(){
    // 1단계: 전체 휴리스틱 스코어
    const candidates=[];
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      if(board[r][c]!==EMPTY) continue;
      const s=aiHeuristic(r,c);
      if(s!==null) candidates.push({r,c,h:s});
    }
    if(!candidates.length) return null;
    candidates.sort((a,b)=>b.h-a.h);

    // 2단계: 상위 20후보에 대해 몬테카를로 평가 (8 플레이아웃씩)
    const top=candidates.slice(0,20);
    let best=-Infinity, bestCell=null;
    for(const {r,c,h} of top){
      const mc=mcEval(r,c,8);
      const combined=h*0.4+mc*1000;
      if(combined>best){ best=combined; bestCell=[r,c]; }
    }
    return bestCell;
  }

  /* ── UI helpers ── */
  function sfx(name){ if(global.ICOC_SFX) global.ICOC_SFX[name]?.(); }
  function setStatus(t){ const el=document.getElementById('go-status'); if(el) el.textContent=t; }
  function setPointsMsg(t){ const el=document.getElementById('go-points-msg'); if(el) el.textContent=t; }

  function setTurnUI(){
    const bPill=document.getElementById('go-turn-black');
    const wPill=document.getElementById('go-turn-white');
    if(!bPill) return;
    bPill.classList.toggle('active', turn===BLACK&&!gameOver);
    wPill.classList.toggle('active', turn===WHITE&&!gameOver);
    // 포획 수 업데이트
    bPill.innerHTML=`⚫ 당신 (흑) · 포획 ${capturedByBlack}`;
    wPill.innerHTML=`⚪ AI (백) · 포획 ${capturedByWhite}`;
  }

  function renderBoard(){
    if(!boardUI) return;
    for(let r=0;r<SIZE;r++) for(let c=0;c<SIZE;c++){
      const cell=boardUI.getCell(r,c);
      if(!cell) continue;
      const v=board[r][c];
      if(v===BLACK) cell.innerHTML='<div class="go-stone go-black"></div>';
      else if(v===WHITE) cell.innerHTML='<div class="go-stone go-white"></div>';
      else cell.innerHTML='';
    }
    if(lastMoveEl){ lastMoveEl.classList.remove('last-move'); lastMoveEl=null; }
  }

  function markLastMove(r,c){
    if(!boardUI) return;
    const cell=boardUI.getCell(r,c);
    if(cell){ cell.querySelector('.go-stone')?.classList.add('last-move'); lastMoveEl=cell.querySelector('.go-stone'); }
  }

  /* ── 게임 로직 ── */
  function onCellClick(r,c){
    if(gameOver||turn!==BLACK) return;
    const res=tryMove(board,BLACK,r,c,koPoint,koColor);
    if(!res.ok){ sfx('click'); return; }
    board=res.bd;
    capturedByBlack+=res.captured;
    if(res.newKo){ koPoint=res.newKo.pt; koColor=res.newKo.col; } else { koPoint=null; koColor=null; }
    if(res.captured>0) sfx('capture'); else sfx('stone');
    passCount=0;
    renderBoard(); markLastMove(r,c); setTurnUI();
    turn=WHITE;
    setTimeout(doAiTurn, 280);
  }

  function doAiTurn(){
    setStatus('AI가 생각 중...');
    setTimeout(()=>{
      const mv=aiPickMove();
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
      if(global.ICOC_POINTS){
        if(result==='win') global.ICOC_POINTS.onGameWin();
        else if(result==='lose') global.ICOC_POINTS.onGameLoss();
      }
    }
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

  global.GoGame={start};
})(window);

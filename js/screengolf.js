/* ============================================================
   ICOC OMNIPO — 스크린 골프 (Screen Golf)
   Canvas 2D + 커스텀 물리 (포물선·바람·바운스·롤링)
   3홀 (Par4·Par3·Par3) · 클럽 4종 · 바람 랜덤
   ============================================================ */

(function (global) {
  'use strict';

  const G = 9.8; // 중력 m/s²

  // ── 홀 정의 ──
  const HOLES = [
    { par:4, dist:270, name:'1번 홀' },
    { par:3, dist:140, name:'2번 홀' },
    { par:3, dist:165, name:'3번 홀' },
  ];

  // ── 클럽 ──
  const CLUBS = [
    { id:'driver', name:'드라이버', max:68, defA:15, minA:8,  maxA:22, icon:'🏌️' },
    { id:'iron',   name:'아이언',   max:50, defA:25, minA:15, maxA:38, icon:'⛳'  },
    { id:'wedge',  name:'웨지',    max:36, defA:50, minA:35, maxA:65, icon:'🏌️' },
    { id:'putter', name:'퍼터',    max:6,  defA:0,  minA:0,  maxA:2,  icon:'🏌️', putter:true },
  ];

  // ── 상태 ──
  let S, cvs, ctx;

  function init() {
    S = {
      hi: 0,                          // 현재 홀 인덱스
      scores: [],
      strokes: 0,
      ball: { x:0, y:0, vx:0, vy:0 },
      trail: [],
      state: 'AIM',                   // AIM|POWER|FLIGHT|PAUSE|DONE
      club: CLUBS[0],
      angle: 15,
      wind: 0,
      pmV: 0, pmDir: 1, pmTimer: null,
      animId: null,
      awarded: false,
    };
  }

  // ── Canvas 세팅 ──
  function setup() {
    cvs = document.getElementById('sg-cvs');
    if (!cvs) return;
    cvs.width  = Math.min(480, (cvs.parentElement?.clientWidth || 480) - 4);
    cvs.height = 250;
    ctx = cvs.getContext('2d');
  }

  const TEE = 44;       // tee x-offset (px)
  const GY  = 0.70;     // ground y ratio
  const YSC = 1.35;     // vertical exaggeration (visual appeal)

  function hole()    { return HOLES[S.hi]; }
  function gndY()    { return cvs.height * GY; }
  function scX()     { return (cvs.width - TEE - 28) / hole().dist; }
  function toBX(x)   { return TEE + x * scX(); }
  function toBY(y)   { return gndY() - y * scX() * YSC; }

  // ── 보드 드로우 ──
  function draw() {
    if (!ctx) return;
    const W = cvs.width, H = cvs.height, gy = gndY();

    // 하늘
    const sk = ctx.createLinearGradient(0,0,0,gy);
    sk.addColorStop(0,'#1a5a8c'); sk.addColorStop(1,'#8cc8e8');
    ctx.fillStyle = sk; ctx.fillRect(0,0,W,gy);

    // 구름
    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    [[70,32,26,11],[220,50,17,8],[380,26,30,13]].forEach(([cx,cy,rx,ry])=>{
      ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); ctx.fill();
    });

    // 지면(러프)
    const gr = ctx.createLinearGradient(0,gy,0,H);
    gr.addColorStop(0,'#2a6018'); gr.addColorStop(1,'#1a4010');
    ctx.fillStyle = gr; ctx.fillRect(0,gy,W,H-gy);

    // 페어웨이
    const fw2 = toBX(hole().dist * 0.88);
    ctx.fillStyle = '#3a8824';
    ctx.fillRect(toBX(0),gy, fw2-toBX(0), H-gy);

    // 그린
    const gx1 = toBX(hole().dist - 18), gx2 = toBX(hole().dist + 8);
    ctx.fillStyle = '#50c838';
    ctx.fillRect(gx1, gy, gx2-gx1, H-gy);

    // 벙커
    const sbx = toBX(hole().dist * 0.58);
    ctx.fillStyle = '#cfc052';
    ctx.beginPath();
    ctx.ellipse(sbx, gy+6, 15, 6, 0, 0, Math.PI);
    ctx.fill();

    // 거리 눈금
    ctx.fillStyle = 'rgba(255,255,255,0.38)';
    ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    [50,100,150,200,250].forEach(d => {
      if (d < hole().dist) ctx.fillText(d+'m', toBX(d), H-3);
    });

    // 티 마커
    ctx.fillStyle = '#eee';
    ctx.fillRect(TEE-3, gy-3, 6, 3);

    // 핀
    const px = toBX(hole().dist);
    ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, gy); ctx.lineTo(px, gy-26); ctx.stroke();
    ctx.fillStyle = '#e22';
    ctx.beginPath();
    ctx.moveTo(px, gy-26); ctx.lineTo(px+12, gy-20); ctx.lineTo(px, gy-14);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.ellipse(px, gy+1, 4, 2.5, 0, 0, Math.PI*2); ctx.fill();

    // 궤적
    S.trail.forEach((pt, i) => {
      const a = 0.12 + 0.55*(i/S.trail.length);
      ctx.fillStyle = `rgba(255,255,160,${a})`;
      ctx.beginPath(); ctx.arc(toBX(pt.x), toBY(pt.y), 1.8, 0, Math.PI*2);
      ctx.fill();
    });

    // 공
    if (S.state !== 'DONE') {
      const bx = toBX(S.ball.x), by2 = toBY(S.ball.y);
      // 그림자
      const sa = Math.max(0, 0.28 - S.ball.y*0.004);
      ctx.fillStyle = `rgba(0,0,0,${sa})`;
      ctx.beginPath(); ctx.ellipse(bx, gy+2, 5.5*Math.max(0.2,1-S.ball.y*0.015), 2.5, 0, 0, Math.PI*2); ctx.fill();
      // 공 본체
      const bg = ctx.createRadialGradient(bx-1.5, by2-1.5, 1, bx, by2, 5);
      bg.addColorStop(0,'#fff'); bg.addColorStop(1,'#ccc');
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(bx, by2, 5, 0, Math.PI*2);
      ctx.fill();
      ctx.strokeStyle = '#aaa'; ctx.lineWidth = 0.5; ctx.stroke();
    }

    // 조준 화살표 (AIM 상태)
    if (S.state === 'AIM') {
      const ar = S.angle * Math.PI / 180;
      const aLen = 52;
      const ax = toBX(S.ball.x) + aLen * Math.cos(ar);
      const ay = gndY() - aLen * Math.sin(ar) - S.ball.y * scX() * YSC;
      ctx.strokeStyle = 'rgba(255,210,0,0.88)'; ctx.lineWidth = 2;
      ctx.setLineDash([5,3]);
      ctx.beginPath(); ctx.moveTo(toBX(S.ball.x), toBY(S.ball.y)); ctx.lineTo(ax, ay);
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,210,0,0.9)';
      ctx.beginPath(); ctx.arc(ax, ay, 4, 0, Math.PI*2); ctx.fill();
    }
  }

  // ── HUD ──
  function hud() {
    const h = hole();
    const w = h.wind;
    const wd = w > 0 ? '→' : w < 0 ? '←' : '·';
    const el = (id) => document.getElementById(id);
    if (el('sg-hole'))   el('sg-hole').textContent = `${h.name}  Par ${h.par}  ${h.dist}m`;
    if (el('sg-wind'))   el('sg-wind').textContent = `🌬 ${wd} ${Math.abs(w).toFixed(1)}m/s`;
    const rem = Math.max(0, h.dist - S.ball.x);
    if (el('sg-dist'))   el('sg-dist').textContent = `핀까지 ${rem.toFixed(0)}m · ${S.strokes}타`;
  }

  // ── 홀 시작 ──
  function startHole() {
    const h = hole();
    h.wind = parseFloat((Math.random() * 5.4 - 2.7).toFixed(1));
    S.ball = { x:0, y:0, vx:0, vy:0 };
    S.trail = [];
    S.strokes = 0;
    S.club = autoClub(h.dist);
    S.angle = S.club.defA;
    S.state = 'AIM';
    hud(); ctrlAim(); draw();
    setMsg('');
  }

  function autoClub(d) {
    if (d > 155) return CLUBS[0];
    if (d > 72)  return CLUBS[1];
    if (d > 18)  return CLUBS[2];
    return CLUBS[3];
  }

  // ── 컨트롤: AIM ──
  function ctrlAim() {
    const c = document.getElementById('sg-ctrl');
    if (!c) return;
    c.innerHTML = `
      <div class="sg-clubs">
        ${CLUBS.map((cl,i) => `<button class="sg-cb${S.club===CLUBS[i]?' sg-cb-on':''}" data-i="${i}">${cl.name}</button>`).join('')}
      </div>
      <div class="sg-aim-row">
        <button class="sg-ab" id="sg-adn">▼</button>
        <span id="sg-angv" class="sg-angv">${S.angle}°</span>
        <button class="sg-ab" id="sg-aup">▲</button>
        <button class="game-btn primary sg-swing" id="sg-ready">🏌️ 스윙 준비</button>
      </div>`;

    c.querySelectorAll('.sg-cb').forEach(btn => {
      btn.addEventListener('click', () => {
        S.club = CLUBS[+btn.dataset.i];
        S.angle = S.club.defA;
        ctrlAim(); draw();
      });
    });
    document.getElementById('sg-aup').addEventListener('click', () => {
      S.angle = Math.min(S.club.maxA, S.angle + 2);
      document.getElementById('sg-angv').textContent = S.angle + '°';
      draw();
    });
    document.getElementById('sg-adn').addEventListener('click', () => {
      S.angle = Math.max(S.club.minA, S.angle - 2);
      document.getElementById('sg-angv').textContent = S.angle + '°';
      draw();
    });
    document.getElementById('sg-ready').addEventListener('click', startPM);
  }

  // ── 파워 미터 ──
  function startPM() {
    S.state = 'POWER';
    S.pmV = 0; S.pmDir = 1;
    const c = document.getElementById('sg-ctrl');
    if (!c) return;
    c.innerHTML = `
      <div class="sg-pm-area">
        <div class="sg-pm-bar"><div class="sg-pm-fill" id="sg-pmf"></div><span class="sg-pm-lbl">파워</span></div>
        <button class="game-btn primary sg-swing" id="sg-hit">⛳ 지금!</button>
      </div>`;
    document.getElementById('sg-hit').addEventListener('click', swing);

    S.pmTimer = setInterval(() => {
      S.pmV += S.pmDir * 1.8;
      if (S.pmV >= 100) { S.pmV = 100; S.pmDir = -1; }
      if (S.pmV <= 0)   { S.pmV = 0;   S.pmDir = 1;  }
      const f = document.getElementById('sg-pmf');
      if (f) {
        f.style.height = S.pmV + '%';
        f.style.background = `hsl(${115 - S.pmV}, 72%, 44%)`;
      }
    }, 16);
  }

  // ── 스윙! ──
  function swing() {
    clearInterval(S.pmTimer);
    S.strokes++;
    const v0 = S.club.max * (S.pmV / 100);
    const ar = S.angle * Math.PI / 180;
    S.ball.vx = v0 * Math.cos(ar) + hole().wind * 0.25;
    S.ball.vy = v0 * Math.sin(ar);
    S.trail = [];
    S.state = 'FLIGHT';

    const c = document.getElementById('sg-ctrl');
    if (c) c.innerHTML = '<div class="sg-flying">✈️ 비행 중...</div>';

    const DT = 1/60;
    let last = null;

    function step(ts) {
      if (!last) last = ts;
      const dt = Math.min((ts - last) / 1000, 0.05);
      last = ts;

      const n = Math.max(1, Math.round(dt / DT));
      for (let i = 0; i < n; i++) {
        if (S.state !== 'FLIGHT') break;
        S.ball.x += S.ball.vx * DT;
        S.ball.y += S.ball.vy * DT;
        S.ball.vy -= G * DT;

        // 궤적 포인트
        if (!S.trail.length ||
            Math.hypot(S.ball.x-S.trail.at(-1).x, S.ball.y-S.trail.at(-1).y) > 2.5) {
          S.trail.push({ x:S.ball.x, y:S.ball.y });
          if (S.trail.length > 70) S.trail.shift();
        }

        // 지면 충돌
        if (S.ball.y <= 0) {
          S.ball.y = 0;
          if (S.club.putter || Math.abs(S.ball.vy) < 1.2) {
            S.ball.vy = 0;
            S.ball.vx *= S.club.putter ? 0.91 : 0.86;
            if (Math.abs(S.ball.vx) < 0.3) { S.ball.vx = 0; S.state = 'PAUSE'; break; }
          } else {
            S.ball.vy = -S.ball.vy * 0.30;
            S.ball.vx *= 0.76;
          }
        }
        // 오버/아웃
        if (S.ball.x > hole().dist * 1.45 || S.ball.x < -6) {
          S.ball.x = Math.max(0, Math.min(S.ball.x, hole().dist * 1.3));
          S.ball.y = 0; S.state = 'PAUSE'; break;
        }
      }

      draw(); hud();

      if (S.state === 'FLIGHT') {
        S.animId = requestAnimationFrame(step);
      } else {
        onLanded();
      }
    }
    S.animId = requestAnimationFrame(step);
  }

  // ── 착지 처리 ──
  function onLanded() {
    const dist = hole().dist - S.ball.x;
    const absD = Math.abs(dist);
    const maxS = hole().par + 3;

    hud();

    if (absD <= 2.2 || S.strokes >= maxS) {
      const msg = absD <= 2.2 ? '⛳ 홀인!' : '📍 아웃 처리';
      setMsg(msg);
      setTimeout(finishHole, 1700);
      return;
    }

    if (absD <= 22) {
      setMsg(`🟢 그린! 핀까지 ${absD.toFixed(1)}m — 퍼팅`);
      setTimeout(() => {
        S.club = CLUBS[3]; S.angle = 0;
        S.state = 'AIM';
        ctrlAim(); draw(); setMsg('');
      }, 1500);
    } else {
      setMsg(`착지 · 핀까지 ${Math.max(0,dist).toFixed(0)}m`);
      setTimeout(() => {
        S.club = autoClub(Math.max(0, dist));
        S.angle = S.club.defA;
        S.state = 'AIM';
        ctrlAim(); draw(); setMsg('');
      }, 1500);
    }
  }

  // ── 홀 완료 ──
  function finishHole() {
    const diff = S.strokes - hole().par;
    const nm = {'-3':'알바트로스','-2':'이글','-1':'버디','0':'파','1':'보기','2':'더블보기'}[diff]
              || (diff < 0 ? '이글↑' : '트리플+');
    const em = diff <= -1 ? '🎉' : diff === 0 ? '👍' : '😅';
    S.scores.push(S.strokes);

    // 스코어카드 업데이트
    const td = document.querySelector(`[data-hsc="${S.hi}"]`);
    if (td) {
      td.innerHTML = `<b>${S.strokes}</b><br><small class="${diff<0?'sg-under':diff===0?'sg-even':'sg-over'}">${diff>0?'+'+diff:diff===0?'E':diff}</small>`;
    }
    const totEl = document.getElementById('sg-total');
    if (totEl) {
      const tot = S.scores.reduce((a,b)=>a+b,0);
      const pd  = tot - HOLES.slice(0,S.scores.length).reduce((a,h)=>a+h.par,0);
      totEl.textContent = `${tot} (${pd>0?'+'+pd:pd===0?'E':pd})`;
    }

    setMsg(`${em} ${S.strokes}타 — ${nm}`);
    S.hi++;
    if (S.hi >= HOLES.length) {
      setTimeout(endGame, 2200);
    } else {
      setTimeout(() => { setMsg(''); startHole(); }, 2200);
    }
  }

  // ── 게임 종료 ──
  function endGame() {
    if (S.awarded) return;
    S.awarded = true;
    const total = S.scores.reduce((a,b)=>a+b,0);
    const par   = HOLES.reduce((a,h)=>a+h.par,0);
    const diff  = total - par;
    const win   = diff <= 0;
    const pts   = win ? 30 : 15;

    const diffStr = diff>0 ? `+${diff}` : diff===0 ? 'E' : `${diff}`;
    setMsg(`🏆 최종: ${total}타 (${diffStr}) — ${win?'파 이하 달성! 🎉':'보기 이상 😅'}`);
    S.state = 'DONE';

    const res = window.ICOC_POINTS.addPoints(pts, 'screengolf_'+(win?'win':'lose'));
    const pEl = document.getElementById('sg-pts');
    if (pEl) pEl.textContent = res.capped
      ? `+${res.added}P 적립 (오늘 한도 · 보유 ${res.total.toLocaleString()}P)`
      : `+${res.added}P 적립 · 보유 ${res.total.toLocaleString()}P`;
    window.ICOC_POINTS.showToast(`+${res.added}P 적립되었습니다.`);

    const c = document.getElementById('sg-ctrl');
    if (c) c.innerHTML = `
      <button class="game-btn primary" id="sg-restart">다시하기</button>
      <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>`;
    document.getElementById('sg-restart')?.addEventListener('click', () => {
      document.getElementById('sg-pts').textContent = '';
      init(); setup(); startHole();
    });
  }

  function setMsg(m) {
    const e = document.getElementById('sg-msg');
    if (e) e.textContent = m;
  }

  // ── 시작 ──
  function start() {
    const body = document.getElementById('game-modal-body');
    const parTot = HOLES.reduce((a,h)=>a+h.par,0);
    body.innerHTML = `
      <div class="sg-topbar">
        <span id="sg-hole" class="sg-hole-lbl">1번 홀  Par 4  270m</span>
        <span id="sg-wind" class="sg-wind-lbl">🌬 준비 중</span>
      </div>
      <div class="sg-cvs-wrap">
        <canvas id="sg-cvs"></canvas>
      </div>
      <div id="sg-msg"  class="sg-msg-line"></div>
      <div id="sg-dist" class="sg-dist-line">핀까지 270m · 0타</div>
      <div id="sg-ctrl" class="sg-ctrl-area"></div>
      <table class="sg-card">
        <tr><th></th>${HOLES.map((_,i)=>`<th>${i+1}</th>`).join('')}<th>합계</th></tr>
        <tr><td>Par</td>${HOLES.map(h=>`<td>${h.par}</td>`).join('')}<td>${parTot}</td></tr>
        <tr><td>타수</td>${HOLES.map((_,i)=>`<td data-hsc="${i}">-</td>`).join('')}<td id="sg-total">-</td></tr>
      </table>
      <div id="sg-pts" class="game-points-earned"></div>
    `;
    setup();
    init();
    startHole();
  }

  global.ScreenGolfGame = { start };
})(window);

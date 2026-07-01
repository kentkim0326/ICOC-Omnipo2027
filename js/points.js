/* ============================================================
   ICOC OMNIPO — Points System v2
   - AI 대전: 승리 +100P / 패배 -100P
   - 시간 체크인: 평일 1000P / 주말 2000P (1시간마다)
   - 친구 추천: 추천인+피추천인 각 10,000P
   - localStorage 기반 (서버 불필요)
   ============================================================ */

(function (global) {
  'use strict';

  const KEY       = 'icoc_pts_v2';
  const CHECKIN_KEY = 'icoc_checkin_v2';
  const REF_KEY   = 'icoc_ref_done';

  /* ── helpers ── */
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function isWeekend() { const d = new Date().getDay(); return d===0||d===6; }
  function nowHourKey() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
  }

  /* ── state ── */
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      const def = { total:0, day:todayStr(), earnedToday:0 };
      if (!raw) return def;
      const data = JSON.parse(raw);
      if (data.day !== todayStr()) { data.day=todayStr(); data.earnedToday=0; }
      return data;
    } catch(e) { return { total:0, day:todayStr(), earnedToday:0 }; }
  }
  function save(data) { localStorage.setItem(KEY, JSON.stringify(data)); }

  /* ── core: add/subtract ── */
  function changePoints(delta, reason) {
    const data = load();
    data.total = Math.max(0, (data.total||0) + delta);
    if (delta > 0) data.earnedToday = (data.earnedToday||0) + delta;
    save(data);
    renderBadge();
    if (delta !== 0) showToast(
      delta > 0
        ? `+${delta.toLocaleString()}P — ${reason} 🎉`
        : `${delta.toLocaleString()}P — ${reason}`
    );
    return { delta, total: data.total };
  }

  /* ── AI 대전 결과 ── */
  function onGameWin(sport)  {
    const pts = changePoints(+100, 'AI 대전 승리: ' + (sport||''));
    // Supabase 기록 + 로컬 기록
    if (sport && window.ICOC_AUTH) window.ICOC_AUTH.recordGameResult(sport, true, 100);
    return pts;
  }
  function onGameLoss(sport) {
    const pts = changePoints(-100, 'AI 대전 패배: ' + (sport||''));
    if (sport && window.ICOC_AUTH) window.ICOC_AUTH.recordGameResult(sport, false, 0);
    return pts;
  }
  function addPoints(amount, reason) { return changePoints(amount, reason||'포인트 적립'); }

  /* ── 시간 체크인 ── */
  function tryHourlyCheckin() {
    const hk = nowHourKey();
    const last = localStorage.getItem(CHECKIN_KEY) || '';
    if (last === hk) return false;                 // 이미 이 시간에 받음
    const pts = isWeekend() ? 2000 : 1000;
    localStorage.setItem(CHECKIN_KEY, hk);
    changePoints(pts, isWeekend() ? '주말 시간 보너스 ⚡' : '시간 접속 보너스');
    return true;
  }

  /* ── 친구 추천 ── */
  function buildReferralLink() {
    const uid = getReferralUID();
    return `${location.origin}${location.pathname.replace(/[^/]*$/, '')}referral.html?ref=${uid}`;
  }

  function getReferralUID() {
    let uid = localStorage.getItem('icoc_uid');
    if (!uid) {
      uid = 'U' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,5).toUpperCase();
      localStorage.setItem('icoc_uid', uid);
    }
    return uid;
  }

  function processIncomingReferral() {
    const ref = new URLSearchParams(location.search).get('ref');
    if (!ref) return;
    if (localStorage.getItem(REF_KEY)) return;   // 이미 처리됨
    const myUID = getReferralUID();
    if (ref === myUID) return;                    // 자기 자신 추천 불가
    localStorage.setItem(REF_KEY, ref);
    // 피추천인에게 10,000P
    changePoints(10000, '친구 추천 가입 보너스 🎁');
    // 추천인 보상은 서버 없이는 직접 줄 수 없으므로 localStorage에 pending 기록
    // (Supabase 연동 시 서버에서 처리)
    localStorage.setItem('icoc_ref_pending_for', ref);
  }

  /* ── UI ── */
  function getState() {
    const d = load();
    return { total: d.total||0, earnedToday: d.earnedToday||0 };
  }

  function renderBadge() {
    const el = document.getElementById('points-badge-num');
    if (!el) return;
    const s = getState();
    el.textContent = s.total.toLocaleString();
  }

  function showToast(msg, ms) {
    ms = ms || 2800;
    let t = document.getElementById('icoc-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'icoc-toast';
      t.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
        background:rgba(11,31,58,0.96);border:1px solid rgba(201,168,76,0.5);
        border-radius:12px;padding:12px 22px;z-index:9999;
        color:#E8C97A;font-size:13px;font-weight:600;
        backdrop-filter:blur(16px);text-align:center;
        box-shadow:0 8px 32px rgba(0,0,0,0.4);
        opacity:0;transition:opacity 0.3s,transform 0.3s;
        pointer-events:none;white-space:nowrap;
        font-family:'Noto Sans KR',sans-serif;
      `;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => { t.style.opacity='1'; t.style.transform='translateX(-50%) translateY(0)'; });
    clearTimeout(t._t);
    t._t = setTimeout(() => {
      t.style.opacity='0'; t.style.transform='translateX(-50%) translateY(10px)';
    }, ms);
  }

  /* ── init ── */
  document.addEventListener('DOMContentLoaded', () => {
    renderBadge();
    processIncomingReferral();
    tryHourlyCheckin();
    // 매 분마다 정각 체크 (새 시간이 되면 자동 지급)
    setInterval(tryHourlyCheckin, 60_000);
  });

  global.ICOC_POINTS = {
    addPoints, onGameWin, onGameLoss,
    getState, renderBadge, showToast,
    buildReferralLink, getReferralUID, tryHourlyCheckin,
  };

})(window);

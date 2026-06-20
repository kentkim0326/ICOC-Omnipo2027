/* ============================================================
   ICOC OMNIPO — Points & Daily Cap System
   - 로그인 불필요 (브라우저 localStorage 기반)
   - 출금/환전 불가. 사이트 내 게임머니(참가권 등) 용도로만 사용.
   - 1일 획득 한도(Daily Cap) 적용으로 과도한 파밍 방지
   ============================================================ */

(function (global) {
  const STORAGE_KEY = 'icoc_points_v1';
  const DAILY_CAP = 500; // 하루 최대 획득 가능 포인트

  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { total: 0, day: todayStr(), earnedToday: 0 };
      const data = JSON.parse(raw);
      if (data.day !== todayStr()) {
        // 날짜가 바뀌면 일일 누적치 초기화
        data.day = todayStr();
        data.earnedToday = 0;
      }
      return data;
    } catch (e) {
      return { total: 0, day: todayStr(), earnedToday: 0 };
    }
  }

  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * 포인트 적립 시도. Daily Cap을 초과하는 양은 잘려서 적립됨.
   * @returns {{added:number, total:number, capped:boolean}}
   */
  function addPoints(amount, reason) {
    const data = load();
    const remainingCap = Math.max(0, DAILY_CAP - data.earnedToday);
    const added = Math.min(amount, remainingCap);
    data.total += added;
    data.earnedToday += added;
    save(data);
    renderBadge();
    return { added, total: data.total, capped: added < amount };
  }

  function getState() {
    const data = load();
    return {
      total: data.total,
      earnedToday: data.earnedToday,
      remainingToday: Math.max(0, DAILY_CAP - data.earnedToday),
      cap: DAILY_CAP
    };
  }

  function renderBadge() {
    const el = document.getElementById('points-badge-num');
    const elCap = document.getElementById('points-badge-cap');
    if (!el) return;
    const s = getState();
    el.textContent = s.total.toLocaleString();
    if (elCap) elCap.textContent = `(${s.remainingToday}/${s.cap} 남음)`;
  }

  function showToast(msg, ms = 2200) {
    let t = document.getElementById('icoc-toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'icoc-toast';
      t.className = 'icoc-toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), ms);
  }

  global.ICOC_POINTS = { addPoints, getState, renderBadge, showToast, DAILY_CAP };

  document.addEventListener('DOMContentLoaded', renderBadge);
})(window);

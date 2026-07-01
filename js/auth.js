/* ============================================================
   ICOC OMNIPO — 인증 & 프로필 시스템 (Supabase + Google OAuth)
   기능:
     - Google 로그인 / 로그아웃
     - 최초 로그인 시 프로필 설정 (닉네임·국가·도시·세대)
     - 포인트 및 게임 전적 DB 연동
     - 마이페이지 모달
   ============================================================ */

(function () {
  'use strict';

  // ── Supabase 클라이언트 초기화 ──
  // js/config.js 에서 ICOC_CONFIG 로드
  let supabase = null;

  function initSupabase() {
    const cfg = window.ICOC_CONFIG;
    if (!cfg || cfg.SUPABASE_URL === 'YOUR_SUPABASE_URL') {
      console.warn('[ICOC Auth] Supabase 미설정 — js/config.js 를 수정하세요.');
      return false;
    }
    supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON);
    return true;
  }

  // ── 현재 사용자 ──
  let currentUser  = null;  // Supabase Auth user
  let currentProfile = null; // profiles 테이블 row

  // ── 국가 목록 (간단 버전, 확장 가능) ──
  const COUNTRIES = [
    '대한민국','미국','일본','중국','영국','프랑스','독일','캐나다','호주','브라질',
    '인도','러시아','인도네시아','멕시코','스페인','이탈리아','네덜란드','스웨덴','노르웨이','폴란드',
    '태국','베트남','필리핀','말레이시아','싱가포르','홍콩','대만','아르헨티나','터키','이집트',
    '사우디아라비아','남아프리카공화국','나이지리아','케냐','기타',
  ];

  const GENERATIONS = ['10대','20대','30대','40대','50대','60대','70대 이상'];

  const MAIN_SPORTS = [
    '바둑','체스','장기','쇼기','오목','체커','백개먼','리버시','커넥트4',
    '텍사스홀덤','블랙잭','고스톱','마작','브릿지','하트','진러미',
    '당구','볼링','스크린골프','파크골프','다트',
    '스도쿠','루빅스큐브','노노그램','카탄','루미큐브','다빈치코드',
  ];

  // ── 포인트 동기화 (로그인 후 DB에서 불러오기) ──
  async function syncPointsFromDB() {
    if (!supabase || !currentProfile) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('points')
        .eq('id', currentUser.id)
        .single();
      if (data && data.points !== undefined) {
        // 로컬 포인트가 DB보다 낮으면 DB 기준으로 업데이트
        const localPts = parseInt(localStorage.getItem('icoc_points') || '0');
        const dbPts = data.points;
        if (dbPts > localPts) {
          localStorage.setItem('icoc_points', String(dbPts));
          // 포인트 UI 업데이트
          const el = document.getElementById('points-badge-num');
          if (el) el.textContent = dbPts.toLocaleString();
        }
      }
    } catch (e) { /* 무시 */ }
  }

  // 포인트 획득 시 DB 업데이트
  async function updatePointsInDB(newTotal) {
    if (!supabase || !currentUser) return;
    try {
      await supabase
        .from('profiles')
        .update({ points: newTotal, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id);
    } catch (e) { /* 무시 */ }
  }

  // ── Google 로그인 ──
  async function signInWithGoogle() {
    if (!supabase) { alert('인증 서비스가 준비되지 않았습니다.'); return; }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) console.error('Login error:', error);
  }

  // ── 로그아웃 ──
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    currentUser = null;
    currentProfile = null;
    updateNavbar(null);
    closeMyPage();
  }

  // ── 프로필 로드 ──
  async function loadProfile(userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Profile load error:', error);
      return null;
    }
    return data;
  }

  // ── 프로필 저장 (최초 설정) ──
  async function saveProfile(profileData) {
    const localPts = parseInt(localStorage.getItem('icoc_points') || '0');
    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id:          currentUser.id,
        email:       currentUser.email,
        nickname:    profileData.nickname,
        country:     profileData.country,
        city:        profileData.city || '',
        district:    profileData.district || '',
        dong:        profileData.dong || '',
        generation:  profileData.generation,
        main_sports: profileData.main_sports || [],
        avatar_url:  currentUser.user_metadata?.avatar_url || '',
        points:      localPts,
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'id' })
      .select()
      .single();
    if (error) { console.error('Profile save error:', error); return null; }
    return data;
  }

  // ── 닉네임 중복 체크 ──
  async function checkNicknameAvailable(nickname) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('nickname', nickname)
      .neq('id', currentUser.id)
      .single();
    return !data; // data 없으면 사용 가능
  }

  // ── 네비바 UI 업데이트 ──
  function updateNavbar(profile) {
    const loginBtn = document.getElementById('nav-login-btn');
    const userArea = document.getElementById('nav-user-area');
    if (!loginBtn || !userArea) return;

    if (profile) {
      loginBtn.style.display = 'none';
      userArea.style.display = 'flex';
      document.getElementById('nav-nickname').textContent = profile.nickname;
      document.getElementById('nav-flag').textContent = countryFlag(profile.country);
    } else {
      loginBtn.style.display = '';
      userArea.style.display = 'none';
    }
  }

  function countryFlag(country) {
    const flags = {
      '대한민국':'🇰🇷','미국':'🇺🇸','일본':'🇯🇵','중국':'🇨🇳','영국':'🇬🇧',
      '프랑스':'🇫🇷','독일':'🇩🇪','캐나다':'🇨🇦','호주':'🇦🇺','브라질':'🇧🇷',
      '인도':'🇮🇳','러시아':'🇷🇺','태국':'🇹🇭','베트남':'🇻🇳','싱가포르':'🇸🇬',
    };
    return flags[country] || '🌍';
  }

  // ── 프로필 설정 모달 ──
  function openProfileSetup() {
    const overlay = document.createElement('div');
    overlay.id = 'profile-setup-overlay';
    overlay.innerHTML = `
      <div class="ps-modal">
        <h2 class="ps-title">🎓 ICOC 프로필 설정</h2>
        <p class="ps-sub">최초 1회만 설정합니다. 국가는 이후 변경이 불가합니다.</p>
        <div class="ps-form">
          <label class="ps-label">닉네임 *</label>
          <div class="ps-input-row">
            <input type="text" id="ps-nickname" class="ps-input" placeholder="게임 닉네임 (2~16자)" maxlength="16">
            <button class="ps-check-btn" id="ps-check-nick">중복확인</button>
          </div>
          <div id="ps-nick-msg" class="ps-msg"></div>

          <label class="ps-label">국가 * <span class="ps-note">(이후 변경 불가)</span></label>
          <select id="ps-country" class="ps-input ps-select">
            <option value="">국가 선택...</option>
            ${COUNTRIES.map(c => `<option value="${c}">${countryFlag(c)} ${c}</option>`).join('')}
          </select>

          <label class="ps-label">도시 / 지역</label>
          <input type="text" id="ps-city" class="ps-input" placeholder="예: 서울, Tokyo, New York">

          <label class="ps-label">구/군 · 동</label>
          <div class="ps-input-row">
            <input type="text" id="ps-district" class="ps-input" placeholder="구/군 (예: 강남구)">
            <input type="text" id="ps-dong" class="ps-input" placeholder="동 (예: 역삼동)">
          </div>

          <label class="ps-label">세대 *</label>
          <div class="ps-gen-row">
            ${GENERATIONS.map(g => `<button class="ps-gen-btn" data-gen="${g}">${g}</button>`).join('')}
          </div>
          <input type="hidden" id="ps-generation">

          <label class="ps-label">주요 종목 (최대 3개)</label>
          <div class="ps-sport-grid">
            ${MAIN_SPORTS.map(s => `<button class="ps-sport-btn" data-sport="${s}">${s}</button>`).join('')}
          </div>
          <input type="hidden" id="ps-sports">

          <button class="ps-submit-btn" id="ps-submit">프로필 저장 →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 세대 선택
    let selectedSports = [];
    overlay.querySelectorAll('.ps-gen-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        overlay.querySelectorAll('.ps-gen-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('ps-generation').value = btn.dataset.gen;
      });
    });

    // 종목 선택 (최대 3개)
    overlay.querySelectorAll('.ps-sport-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sp = btn.dataset.sport;
        if (btn.classList.contains('active')) {
          btn.classList.remove('active');
          selectedSports = selectedSports.filter(s => s !== sp);
        } else {
          if (selectedSports.length >= 3) return;
          btn.classList.add('active');
          selectedSports.push(sp);
        }
        document.getElementById('ps-sports').value = selectedSports.join(',');
      });
    });

    // 닉네임 중복 확인
    document.getElementById('ps-check-nick').addEventListener('click', async () => {
      const nick = document.getElementById('ps-nickname').value.trim();
      const msg  = document.getElementById('ps-nick-msg');
      if (nick.length < 2) { msg.textContent = '닉네임은 2자 이상이어야 합니다.'; msg.className='ps-msg ps-err'; return; }
      const avail = await checkNicknameAvailable(nick);
      msg.textContent  = avail ? '✓ 사용 가능한 닉네임입니다.' : '✗ 이미 사용 중인 닉네임입니다.';
      msg.className    = 'ps-msg ' + (avail ? 'ps-ok' : 'ps-err');
    });

    // 저장
    document.getElementById('ps-submit').addEventListener('click', async () => {
      const nickname   = document.getElementById('ps-nickname').value.trim();
      const country    = document.getElementById('ps-country').value;
      const city       = document.getElementById('ps-city').value.trim();
      const district   = document.getElementById('ps-district').value.trim();
      const dong       = document.getElementById('ps-dong').value.trim();
      const generation = document.getElementById('ps-generation').value;

      if (!nickname || !country || !generation) {
        alert('닉네임·국가·세대는 필수 입력 항목입니다.'); return;
      }
      const nickMsg = document.getElementById('ps-nick-msg');
      if (!nickMsg.classList.contains('ps-ok')) {
        alert('닉네임 중복 확인을 먼저 해주세요.'); return;
      }

      document.getElementById('ps-submit').textContent = '저장 중...';
      const profile = await saveProfile({ nickname, country, city, district, dong, generation, main_sports: selectedSports });
      if (profile) {
        currentProfile = profile;
        updateNavbar(profile);
        overlay.remove();
        syncPointsFromDB();
      } else {
        alert('프로필 저장 실패. 다시 시도해주세요.');
        document.getElementById('ps-submit').textContent = '프로필 저장 →';
      }
    });
  }

  // ── 마이페이지 모달 ──
  function openMyPage() {
    if (!currentProfile) return;
    const p = currentProfile;
    const localPts = parseInt(localStorage.getItem('icoc_points') || '0');

    const overlay = document.createElement('div');
    overlay.id = 'mypage-overlay';
    overlay.innerHTML = `
      <div class="mp-modal">
        <button class="mp-close" id="mp-close">✕</button>
        <div class="mp-header">
          <img src="${currentUser?.user_metadata?.avatar_url || 'assets/logo-nav.png'}" class="mp-avatar" alt="avatar">
          <div>
            <div class="mp-nickname">${p.nickname}</div>
            <div class="mp-meta">${countryFlag(p.country)} ${p.country} · ${p.city || ''} ${p.district || ''} ${p.dong || ''}</div>
            <div class="mp-gen">${p.generation} · 주종목: ${(p.main_sports||[]).join(', ') || '미설정'}</div>
          </div>
        </div>
        <div class="mp-points-box">
          <span class="mp-pts-label">보유 포인트</span>
          <span class="mp-pts-val">🪙 ${localPts.toLocaleString()} P</span>
        </div>
        <div class="mp-section-title">게임 전적</div>
        <div id="mp-records" class="mp-records">불러오는 중...</div>
        <div class="mp-actions">
          <button class="game-btn ghost" id="mp-signout">로그아웃</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target===overlay) closeMyPage(); });
    document.getElementById('mp-close').addEventListener('click', closeMyPage);
    document.getElementById('mp-signout').addEventListener('click', signOut);

    // 전적 로드
    loadGameRecords(currentUser.id).then(records => {
      const el = document.getElementById('mp-records');
      if (!el) return;
      if (!records || !records.length) {
        el.textContent = '아직 게임 기록이 없습니다.'; return;
      }
      el.innerHTML = records.map(r => `
        <div class="mp-record-row">
          <span class="mp-rec-sport">${r.sport}</span>
          <span class="mp-rec-stat">${r.wins}승 ${r.losses}패</span>
          <span class="mp-rec-rate">${r.wins+r.losses>0?Math.round(r.wins/(r.wins+r.losses)*100):0}%</span>
        </div>
      `).join('');
    });
  }

  function closeMyPage() {
    const el = document.getElementById('mypage-overlay');
    if (el) el.remove();
  }

  // ── 게임 전적 ──
  async function loadGameRecords(userId) {
    if (!supabase) return [];
    const { data } = await supabase
      .from('game_records')
      .select('*')
      .eq('user_id', userId)
      .order('wins', { ascending: false });
    return data || [];
  }

  async function recordGameResult(sport, won) {
    if (!supabase || !currentUser) return;
    try {
      // upsert: 있으면 wins/losses 증가, 없으면 새 row
      const { data: existing } = await supabase
        .from('game_records')
        .select('id, wins, losses')
        .eq('user_id', currentUser.id)
        .eq('sport', sport)
        .single();

      if (existing) {
        await supabase
          .from('game_records')
          .update({
            wins:   won ? existing.wins+1   : existing.wins,
            losses: won ? existing.losses   : existing.losses+1,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase
          .from('game_records')
          .insert({
            user_id: currentUser.id,
            sport,
            wins:   won ? 1 : 0,
            losses: won ? 0 : 1,
            updated_at: new Date().toISOString(),
          });
      }
    } catch (e) { /* 무시 */ }
  }

  // ── 메인 초기화 ──
  async function init() {
    if (!initSupabase()) {
      // Supabase 미설정 → 로그인 버튼 비활성화
      const loginBtn = document.getElementById('nav-login-btn');
      if (loginBtn) { loginBtn.style.opacity = '0.4'; loginBtn.title = 'Supabase 설정 필요'; }
      return;
    }

    // 이벤트 핸들러
    document.getElementById('nav-login-btn')?.addEventListener('click', signInWithGoogle);
    document.getElementById('nav-user-area')?.addEventListener('click', openMyPage);

    // 세션 확인
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      currentUser = session.user;
      const profile = await loadProfile(session.user.id);
      if (!profile) {
        openProfileSetup();
      } else {
        currentProfile = profile;
        updateNavbar(profile);
        syncPointsFromDB();
      }
    }

    // 로그인 상태 변화 감지
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        currentUser = session.user;
        const profile = await loadProfile(session.user.id);
        if (!profile) {
          openProfileSetup();
        } else {
          currentProfile = profile;
          updateNavbar(profile);
          syncPointsFromDB();
        }
      } else if (event === 'SIGNED_OUT') {
        currentUser = null; currentProfile = null;
        updateNavbar(null);
      }
    });
  }

  // 전역 노출
  window.ICOC_AUTH = {
    signIn:  signInWithGoogle,
    signOut,
    openMyPage,
    recordGameResult,
    updatePointsInDB,
    getCurrentUser:    () => currentUser,
    getCurrentProfile: () => currentProfile,
  };

  // DOM 로드 후 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

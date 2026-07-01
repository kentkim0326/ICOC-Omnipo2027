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
    try {
      supabase = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON);
      console.log('[ICOC] Supabase 초기화 완료');
      return true;
    } catch(e) {
      console.error('[ICOC] Supabase 초기화 실패:', e);
      return false;
    }
  }

  // ── 현재 사용자 ──
  let currentUser  = null;  // Supabase Auth user
  let currentProfile = null; // profiles 테이블 row

  // ── 국가 목록 (간단 버전, 확장 가능) ──
  // 195개국 [한국어명, ISO2, 영어명]
  const COUNTRIES_ALL = [
    ['대한민국','kr','South Korea'],['미국','us','USA'],['일본','jp','Japan'],['중국','cn','China'],
    ['영국','gb','UK'],['프랑스','fr','France'],['독일','de','Germany'],['캐나다','ca','Canada'],
    ['호주','au','Australia'],['브라질','br','Brazil'],['인도','in','India'],['러시아','ru','Russia'],
    ['인도네시아','id','Indonesia'],['멕시코','mx','Mexico'],['스페인','es','Spain'],['이탈리아','it','Italy'],
    ['네덜란드','nl','Netherlands'],['스웨덴','se','Sweden'],['노르웨이','no','Norway'],['폴란드','pl','Poland'],
    ['태국','th','Thailand'],['베트남','vn','Vietnam'],['필리핀','ph','Philippines'],['말레이시아','my','Malaysia'],
    ['싱가포르','sg','Singapore'],['대만','tw','Taiwan'],['아르헨티나','ar','Argentina'],['터키','tr','Turkey'],
    ['이집트','eg','Egypt'],['사우디아라비아','sa','Saudi Arabia'],['남아프리카공화국','za','South Africa'],
    ['나이지리아','ng','Nigeria'],['케냐','ke','Kenya'],['우크라이나','ua','Ukraine'],['벨기에','be','Belgium'],
    ['스위스','ch','Switzerland'],['오스트리아','at','Austria'],['포르투갈','pt','Portugal'],['그리스','gr','Greece'],
    ['체코','cz','Czech Republic'],['헝가리','hu','Hungary'],['루마니아','ro','Romania'],['핀란드','fi','Finland'],
    ['덴마크','dk','Denmark'],['뉴질랜드','nz','New Zealand'],['칠레','cl','Chile'],['콜롬비아','co','Colombia'],
    ['페루','pe','Peru'],['베네수엘라','ve','Venezuela'],['에콰도르','ec','Ecuador'],['이란','ir','Iran'],
    ['이라크','iq','Iraq'],['이스라엘','il','Israel'],['아랍에미리트','ae','UAE'],['카타르','qa','Qatar'],
    ['파키스탄','pk','Pakistan'],['방글라데시','bd','Bangladesh'],['스리랑카','lk','Sri Lanka'],['네팔','np','Nepal'],
    ['미얀마','mm','Myanmar'],['캄보디아','kh','Cambodia'],['라오스','la','Laos'],['몽골','mn','Mongolia'],
    ['카자흐스탄','kz','Kazakhstan'],['우즈베키스탄','uz','Uzbekistan'],['아제르바이잔','az','Azerbaijan'],
    ['조지아','ge','Georgia'],['아르메니아','am','Armenia'],['벨라루스','by','Belarus'],['슬로바키아','sk','Slovakia'],
    ['슬로베니아','si','Slovenia'],['크로아티아','hr','Croatia'],['세르비아','rs','Serbia'],['불가리아','bg','Bulgaria'],
    ['에스토니아','ee','Estonia'],['라트비아','lv','Latvia'],['리투아니아','lt','Lithuania'],['아이슬란드','is','Iceland'],
    ['아일랜드','ie','Ireland'],['룩셈부르크','lu','Luxembourg'],['몰타','mt','Malta'],['키프로스','cy','Cyprus'],
    ['모로코','ma','Morocco'],['알제리','dz','Algeria'],['튀니지','tn','Tunisia'],['에티오피아','et','Ethiopia'],
    ['가나','gh','Ghana'],['카메룬','cm','Cameroon'],['앙골라','ao','Angola'],['탄자니아','tz','Tanzania'],
    ['우간다','ug','Uganda'],['르완다','rw','Rwanda'],['세네갈','sn','Senegal'],['코트디부아르','ci','Ivory Coast'],
    ['파푸아뉴기니','pg','Papua New Guinea'],['피지','fj','Fiji'],['쿠바','cu','Cuba'],
    ['도미니카공화국','do','Dominican Republic'],['과테말라','gt','Guatemala'],['온두라스','hn','Honduras'],
    ['코스타리카','cr','Costa Rica'],['파나마','pa','Panama'],['자메이카','jm','Jamaica'],
    ['브루나이','bn','Brunei'],['동티모르','tl','Timor-Leste'],['모리셔스','mu','Mauritius'],
    ['기타','','Other'],
  ];
  const COUNTRIES = COUNTRIES_ALL.map(c => c[0]);

  const GENERATIONS = ['10대','20대','30대','40대','50대','60대','70대 이상'];

  const MAIN_SPORTS = {
    '전략 보드': ['바둑','체스','장기','쇼기','오목','체커','백개먼','리버시','커넥트4','쿼리도','헥스','다빈치코드','루미큐브','윷놀이','샹치','중국체커','나인맨스모리스','만칼라','아발론','블로커스'],
    '현대 보드': ['카탄','티켓투라이드','스플렌더','코드네임','7원더스','카르카손','도미노','젠가','시퀀스','딕싯','스크래블','알까기','펜토미노','아줄'],
    '카드게임':  ['브릿지','하트','진러미','원카드','도둑잡기','두라크','마이티','스페이드','훌라','페이지원','텍사스홀덤','블랙잭','고스톱','마작'],
    '액티브':   ['당구(8볼)','당구(3구)','당구(4구)','스누커','9볼','볼링','스크린골프','파크골프','다트','에어하키'],
    '퍼즐·수리': ['스도쿠','루빅스큐브','노노그램','크로스워드','카쿠로','스피드수학'],
  };

  // ── 포인트 동기화 (로그인 후 DB에서 불러오기) ──
  async function syncPointsFromDB() {
    if (!supabase || !currentProfile) return;
    try {
      const { data } = await supabase
        .from('icoc_profiles')
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
        .from('icoc_profiles')
        .update({ points: newTotal, updated_at: new Date().toISOString() })
        .eq('id', currentUser.id);
    } catch (e) { /* 무시 */ }
  }

  // ── Google 로그인 ──
  async function signInWithGoogle() {
    if (!supabase) {
      alert('인증 서비스가 준비되지 않았습니다. 페이지를 새로고침해주세요.');
      console.error('[ICOC] supabase not initialized');
      return;
    }
    try {
      const redirectTo = window.location.origin + window.location.pathname;
      console.log('[ICOC] OAuth 시작, redirectTo:', redirectTo);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo },
      });
      if (error) {
        console.error('[ICOC] OAuth 오류:', error);
        alert('로그인 오류: ' + error.message);
      }
    } catch(e) {
      console.error('[ICOC] 로그인 예외:', e);
      alert('로그인 중 오류가 발생했습니다: ' + e.message);
    }
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
      .from('icoc_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (error) {
      console.error('Profile load error:', error);
      return null;
    }
    return data; // null이면 프로필 없음 → 설정 모달 표시
  }

  // ── 프로필 저장 (최초 설정) ──
  async function saveProfile(profileData) {
    const localPts = parseInt(localStorage.getItem('icoc_points') || '0');
    const { data, error } = await supabase
      .from('icoc_profiles')
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
      .from('icoc_profiles')
      .select('id')
      .eq('nickname', nickname)
      .neq('id', currentUser.id)
      .maybeSingle();
    return !data; // data 없으면 사용 가능
  }

  // ── 네비바 UI 업데이트 ──
  function updateNavbar(profile) {
    const loginBtn = document.getElementById('nav-login-btn');
    const userArea = document.getElementById('nav-user-area');
    if (loginBtn && userArea) {
      if (profile) {
        loginBtn.style.display = 'none';
        userArea.style.display = 'flex';
        document.getElementById('nav-nickname').textContent = profile.nickname;
        document.getElementById('nav-flag').innerHTML = countryFlag(profile.country);
      } else {
        loginBtn.style.display = '';
        userArea.style.display = 'none';
      }
    }

    // 히어로 영역 업데이트
    const heroAuth = document.getElementById('hero-auth-area');
    const heroUser = document.getElementById('hero-user-area');
    if (heroAuth && heroUser) {
      if (profile) {
        heroAuth.style.display = 'none';
        heroUser.style.display = 'block';
        const avatar = document.getElementById('hero-avatar');
        if (avatar && currentUser?.user_metadata?.avatar_url) {
          avatar.src = currentUser.user_metadata.avatar_url;
        }
        const el = document.getElementById('hero-nickname');
        if (el) el.textContent = profile.nickname;
        const meta = document.getElementById('hero-user-meta');
        if (meta) meta.innerHTML = countryFlag(profile.country) + ' ' + profile.country + ' · ' + profile.generation;
      } else {
        heroAuth.style.display = 'flex';
        heroUser.style.display = 'none';
      }
    }
  }

  function countryIso(country) {
    const c = COUNTRIES_ALL.find(x => x[0] === country);
    return c ? c[1] : '';
  }
  function countryFlag(country) {
    const iso = countryIso(country);
    if (!iso) return '🌍';
    return `<img src="https://flagcdn.com/w40/${iso}.png" style="width:22px;height:15px;object-fit:cover;border-radius:2px;vertical-align:middle;" alt="${country}">`;
  }
  function countryFlagImg(country, size) {
    const iso = countryIso(country);
    if (!iso) return '<span style="font-size:20px;">🌍</span>';
    return `<img src="https://flagcdn.com/w${size||40}/${iso}.png" style="width:${size?size*1.5:30}px;height:${size?size:20}px;object-fit:cover;border-radius:3px;" alt="${country}" loading="lazy">`;
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

          <label class="ps-label">국가 * <span class="ps-note">(이후 변경 불가)</span> <span id="ps-country-selected" style="color:#E8C97A;font-size:12px;"></span></label>
          <input type="hidden" id="ps-country" value="">
          <input type="text" id="country-search-input" class="ps-input" placeholder="🔍 국가명 검색 (한국어 또는 영어)..." style="margin-bottom:6px;">
          <div id="country-grid-wrap" style="max-height:220px;overflow-y:auto;border:1px solid rgba(201,168,76,0.2);border-radius:8px;background:rgba(0,0,0,0.2);padding:4px;scrollbar-width:thin;scrollbar-color:rgba(201,168,76,0.3) transparent;">
            <div id="country-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:5px;"></div>
          </div>

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
          <div class="ps-sport-cats">
            ${Object.entries(MAIN_SPORTS).map(([cat, sports]) => `
              <div class="ps-sport-cat-label">${cat}</div>
              <div class="ps-sport-grid">
                ${sports.map(s => `<button class="ps-sport-btn" data-sport="${s}">${s}</button>`).join('')}
              </div>
            `).join('')}
          </div>
          <input type="hidden" id="ps-sports">

          <button class="ps-submit-btn" id="ps-submit">프로필 저장 →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // ── 195개국 그리드 ──
    const cgrid = document.getElementById('country-grid');
    const csearch = document.getElementById('country-search-input');
    let _selCountry = '';
    function buildCGrid(q) {
      cgrid.innerHTML = '';
      COUNTRIES_ALL.filter(([n,,en]) => !q || n.includes(q) || en.toLowerCase().includes(q.toLowerCase()))
      .forEach(([name, iso]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;padding:7px 4px;border-radius:7px;border:1px solid transparent;background:rgba(255,255,255,0.04);cursor:pointer;font-size:10px;color:rgba(245,240,232,0.75);font-family:inherit;transition:all 0.15s;';
        b.innerHTML = iso
          ? `<img src="https://flagcdn.com/w40/${iso}.png" loading="lazy" style="width:30px;height:20px;object-fit:cover;border-radius:2px;" alt="${name}"><span>${name}</span>`
          : `<span style="font-size:18px;">🌍</span><span>${name}</span>`;
        b.addEventListener('click', () => {
          _selCountry = name;
          document.getElementById('ps-country').value = name;
          document.getElementById('ps-country-selected').textContent = name;
          cgrid.querySelectorAll('button').forEach(x => x.style.borderColor='transparent');
          b.style.cssText = b.style.cssText.replace('transparent','#C9A84C') + ';background:rgba(201,168,76,0.18);color:#E8C97A;font-weight:700;';
          b.scrollIntoView({behavior:'smooth',block:'nearest'});
        });
        cgrid.appendChild(b);
      });
    }
    buildCGrid('');
    csearch && csearch.addEventListener('input', () => buildCGrid(csearch.value.trim()));

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
          if (selectedSports.length >= 3) { 
            setMsg('주요 종목은 최대 3개까지 선택 가능합니다.'); return; 
          }
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
        <div class="mp-section-title">게임별 전적 & AI 레벨</div>
        <div id="mp-records" class="mp-records">
          <div class="mp-loading">📊 전적 불러오는 중...</div>
        </div>
        <div class="mp-actions">
          <button class="game-btn ghost" id="mp-signout">🚪 로그아웃</button>
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
      // 로컬 스탯도 병합 (포인트 적립 내역)
      const SPORT_ICONS = {
        '바둑':'⚫','체스':'♟️','장기':'🈴','쇼기':'🎌','오목':'⚪',
        '마작':'🀄','체커':'🔴','백개먼':'🎲','리버시':'🟢','커넥트4':'🔵',
        '당구':'🎱','볼링':'🎳','스크린골프':'⛳','홀덤':'🃏','브릿지':'🎴',
        '진러미':'🃏','하츠':'♥️','다트':'🎯',
      };
      el.innerHTML = \`<div class="mp-stat-grid">\${records.map(r => {
        const local = JSON.parse(localStorage.getItem('icoc_stat_'+r.sport)||'{"ai_wins":0,"ai_losses":0,"pts":0}');
        const aiW = Math.max(r.wins||0, local.ai_wins||0);
        const aiL = Math.max(r.losses||0, local.ai_losses||0);
        const total = aiW + aiL;
        const rate = total>0 ? Math.round(aiW/total*100) : 0;
        const threshold = ({바둑:5,체스:5,장기:5,쇼기:5,오목:3,체커:3,마작:3,당구:5,볼링:3,홀덤:5,브릿지:10,진러미:5,하츠:5,다트:3})[r.sport] || 3;
        const proUnlocked = aiW >= threshold;
        const pts = r.points_earned || local.pts || 0;
        const icon = SPORT_ICONS[r.sport] || '🎮';
        const pct = Math.min(100, Math.round(aiW/threshold*100));
        return \`<div class="mp-game-card \${proUnlocked?'mp-pro':''}">
          <div class="mp-game-top">
            <span class="mp-game-icon">\${icon}</span>
            <div class="mp-game-info">
              <span class="mp-game-name">\${r.sport}</span>
              <span class="mp-game-badge \${proUnlocked?'badge-pro':'badge-ai'}">
                \${proUnlocked?'🏆 PRO':'🤖 AI 수련 중'}
              </span>
            </div>
            <div class="mp-game-pts">🪙 \${pts.toLocaleString()}P</div>
          </div>
          <div class="mp-game-stats">
            <span class="mp-stat-w">\${aiW}승</span>
            <span class="mp-stat-l">\${aiL}패</span>
            <span class="mp-stat-rate">\${rate}%</span>
          </div>
          \${!proUnlocked ? \`<div class="mp-prog-wrap">
            <div class="mp-prog-bar" style="width:\${pct}%"></div>
          </div>
          <div class="mp-prog-label">AI \${aiW}/\${threshold}승 달성 시 인간 대전 해금 🔓</div>\` : \`
          <div class="mp-unlocked-msg">✅ 인간 대전 해금 완료 — 국가대표 도전 가능!</div>\`}
        </div>\`;
      }).join('')}</div>\`;
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
      .from('icoc_game_records')
      .select('*')
      .eq('user_id', userId)
      .order('wins', { ascending: false });
    return data || [];
  }

  // ── AI 승수 threshold (초보 → Pro 해금 기준) ──
  const PRO_THRESHOLD = {
    '바둑':5,'체스':5,'장기':5,'쇼기':5,'오목':3,'체커':3,'백개먼':3,
    '리버시':3,'커넥트4':3,'마작':3,'당구':5,'볼링':3,'스크린골프':3,
    '홀덤':5,'브릿지':10,'진러미':5,'하츠':5,'다트':3,
    'default':3,
  };
  function getProThreshold(sport) {
    return PRO_THRESHOLD[sport] || PRO_THRESHOLD['default'];
  }
  // localStorage 로컬 스탯 (오프라인 / 로그인 전 포함)
  function getLocalStat(sport) {
    const k = 'icoc_stat_' + sport;
    return JSON.parse(localStorage.getItem(k) || '{"ai_wins":0,"ai_losses":0,"pts":0}');
  }
  function updateLocalStat(sport, won, ptsEarned) {
    const s = getLocalStat(sport);
    if (won) s.ai_wins++; else s.ai_losses++;
    s.pts = (s.pts||0) + (ptsEarned||0);
    localStorage.setItem('icoc_stat_' + sport, JSON.stringify(s));
    return s;
  }
  // Pro 해금 여부 확인
  function isProUnlocked(sport, aiWins) {
    return (aiWins||0) >= getProThreshold(sport);
  }

  async function recordGameResult(sport, won, ptsEarned) {
    // 로컬 스탯 항상 저장 (로그인 여부 무관)
    const localStat = updateLocalStat(sport, won, ptsEarned||0);

    if (!supabase || !currentUser) return localStat;
    try {
      const { data: existing } = await supabase
        .from('icoc_game_records')
        .select('id, wins, losses, points_earned')
        .eq('user_id', currentUser.id)
        .eq('sport', sport)
        .maybeSingle();

      const newWins   = (existing?.wins   ||0) + (won?1:0);
      const newLosses = (existing?.losses ||0) + (won?0:1);
      const newPts    = (existing?.points_earned||0) + (ptsEarned||0);

      if (existing) {
        await supabase.from('icoc_game_records')
          .update({ wins:newWins, losses:newLosses,
            points_earned:newPts, updated_at:new Date().toISOString() })
          .eq('id', existing.id);
      } else {
        await supabase.from('icoc_game_records')
          .insert({ user_id:currentUser.id, sport,
            wins:newWins, losses:newLosses,
            points_earned:newPts, updated_at:new Date().toISOString() });
      }
    } catch(e) { /* 무시 */ }
    return localStat;
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
    document.getElementById('hero-login-btn')?.addEventListener('click', signInWithGoogle);
    document.getElementById('hero-mypage-btn')?.addEventListener('click', openMyPage);

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

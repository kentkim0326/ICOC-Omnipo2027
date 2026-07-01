/* ============================================================
   ICOC OMNIPO — 경기장 지도 (MapLibre GL JS)
   타일: OpenFreeMap (무료, API키 불필요)
   데이터: 샘플 + Supabase icoc_venues 연동
   ============================================================ */

(function () {
  'use strict';

  // ── 경기장 타입 정의 ──
  const TYPES = {
    'go':        { label: '기원',        icon: '⚫', color: '#3a6b3a' },
    'billiards': { label: '당구장',      icon: '🎱', color: '#1a4a7a' },
    'bowling':   { label: '볼링장',      icon: '🎳', color: '#7a3a1a' },
    'screengolf':{ label: '스크린골프',  icon: '⛳', color: '#2a7a2a' },
    'board':     { label: '보드카페',    icon: '🎯', color: '#6a1a7a' },
    'parkgolf':  { label: '파크골프',    icon: '🌿', color: '#3a7a1a' },
    'chess':     { label: '체스클럽',    icon: '♟️', color: '#7a6a1a' },
  };

  // ── 샘플 데이터 (전국 주요 시설) ──
  const SAMPLE_VENUES = [
    // 기원
    { id:1, name:'한국기원 (강남점)',     type:'go',        lat:37.5172, lng:127.0473, city:'서울 강남구',  addr:'서울 강남구 봉은사로' },
    { id:2, name:'사이버오로 기원',        type:'go',        lat:37.5703, lng:126.9785, city:'서울 종로구',  addr:'서울 종로구 인사동길' },
    { id:3, name:'부산기원',              type:'go',        lat:35.1796, lng:129.0756, city:'부산 동구',    addr:'부산 동구 중앙대로' },
    { id:4, name:'대구기원',              type:'go',        lat:35.8714, lng:128.6014, city:'대구 중구',    addr:'대구 중구 동성로' },
    // 당구장
    { id:5, name:'빌리어즈 강남',          type:'billiards', lat:37.5012, lng:127.0276, city:'서울 강남구',  addr:'서울 강남구 역삼동' },
    { id:6, name:'PBA 당구클럽 홍대',      type:'billiards', lat:37.5574, lng:126.9249, city:'서울 마포구',  addr:'서울 마포구 홍대입구' },
    { id:7, name:'수원 당구장',            type:'billiards', lat:37.2636, lng:127.0286, city:'수원 팔달구',  addr:'경기 수원시 팔달구' },
    // 볼링장
    { id:8, name:'코엑스 볼링장',          type:'bowling',   lat:37.5128, lng:127.0592, city:'서울 강남구',  addr:'서울 강남구 영동대로 513' },
    { id:9, name:'신도림 테크노마트 볼링',  type:'bowling',   lat:37.5085, lng:126.8912, city:'서울 구로구',  addr:'서울 구로구 경인로 661' },
    { id:10,name:'부산 실내볼링장',         type:'bowling',   lat:35.1540, lng:129.1185, city:'부산 해운대구',addr:'부산 해운대구 우동' },
    // 스크린골프
    { id:11,name:'골프존 강남센터',         type:'screengolf',lat:37.4969, lng:127.0278, city:'서울 강남구',  addr:'서울 강남구 테헤란로' },
    { id:12,name:'카카오VX 스크린골프 홍대',type:'screengolf',lat:37.5543, lng:126.9251, city:'서울 마포구',  addr:'서울 마포구 와우산로' },
    { id:13,name:'SG골프 수원점',           type:'screengolf',lat:37.2783, lng:127.0435, city:'수원 영통구',  addr:'경기 수원시 영통구' },
    { id:14,name:'광주 스크린골프',          type:'screengolf',lat:35.1595, lng:126.8526, city:'광주 서구',    addr:'광주 서구 상무대로' },
    // 보드카페
    { id:15,name:'다이스앤더스토리 홍대',    type:'board',     lat:37.5559, lng:126.9236, city:'서울 마포구',  addr:'서울 마포구 어울마당로' },
    { id:16,name:'보드피아 강남',            type:'board',     lat:37.5047, lng:127.0242, city:'서울 강남구',  addr:'서울 강남구 강남대로' },
    { id:17,name:'퀸즈카페 신촌',            type:'board',     lat:37.5554, lng:126.9366, city:'서울 서대문구',addr:'서울 서대문구 신촌로' },
    { id:18,name:'부산 보드게임 카페',        type:'board',     lat:35.1573, lng:129.0594, city:'부산 부산진구',addr:'부산 부산진구 서면로' },
    // 파크골프
    { id:19,name:'한강 파크골프장',           type:'parkgolf',  lat:37.5245, lng:126.9303, city:'서울 영등포구',addr:'서울 영등포구 여의도동' },
    { id:20,name:'올림픽공원 파크골프',        type:'parkgolf',  lat:37.5213, lng:127.1228, city:'서울 송파구',  addr:'서울 송파구 올림픽로' },
    { id:21,name:'부산 파크골프장',            type:'parkgolf',  lat:35.2271, lng:129.0878, city:'부산 금정구',  addr:'부산 금정구 북구로' },
    // 체스
    { id:22,name:'서울 체스클럽',             type:'chess',     lat:37.5660, lng:126.9784, city:'서울 종로구',  addr:'서울 종로구 관철동' },
    { id:23,name:'체스코리아 강남',            type:'chess',     lat:37.5100, lng:127.0600, city:'서울 강남구',  addr:'서울 강남구 삼성동' },
  ];

  let map = null;
  let markers = [];
  let activeType = 'all';

  const MAPBOX_TOKEN = window.ICOC_CONFIG?.MAPBOX_TOKEN || '';

  function initMap() {
    const container = document.getElementById('icoc-map');
    if (!container) return;

    // Mapbox GL JS 사용
    if (window.mapboxgl) {
      mapboxgl.accessToken = MAPBOX_TOKEN;
      map = new mapboxgl.Map({
        container: 'icoc-map',
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [127.024612, 37.532600],
        zoom: 11,
        pitch: 52,
        bearing: -18,
        antialias: true,
      });
      map.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.addControl(new mapboxgl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }), 'top-right');
      map.on('load', () => {
        // Mapbox v3 3D 건물 — 'building' 레이어 존재 시 extrusion 적용
        try {
          const layers = map.getStyle().layers;
          // composite source의 building layer 찾기
          const bldLayer = layers.find(l => l['source-layer']==='building' || l.id==='building');
          if (bldLayer) {
            // 기존 fill 레이어 뒤에 extrusion 추가
            map.addLayer({
              id:'icoc-3d-buildings',
              type:'fill-extrusion',
              source: bldLayer.source || 'composite',
              'source-layer': bldLayer['source-layer'] || 'building',
              minzoom: 11,
              filter: ['==', 'extrude', 'true'],
              paint: {
                'fill-extrusion-color': '#0d2244',
                'fill-extrusion-height': ['interpolate',['linear'],['zoom'],11,0,11.5,['get','height']],
                'fill-extrusion-base':   ['interpolate',['linear'],['zoom'],11,0,11.5,['get','min_height']],
                'fill-extrusion-opacity': 0.82,
              }
            });
          }
        } catch(e) { console.log('3D buildings skip:', e.message); }
        loadVenues(SAMPLE_VENUES); loadSupabaseVenues();
      });
    } else if (window.maplibregl) {
      // 폴백: MapLibre
      map = new maplibregl.Map({
        container: 'icoc-map',
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: [127.024612, 37.532600],
        zoom: 11,
        pitch: 52,
        bearing: -18,
        antialias: true,
      });
      map.addControl(new maplibregl.NavigationControl(), 'top-right');
      map.on('load', () => {
        // Mapbox v3 3D 건물 — 'building' 레이어 존재 시 extrusion 적용
        try {
          const layers = map.getStyle().layers;
          // composite source의 building layer 찾기
          const bldLayer = layers.find(l => l['source-layer']==='building' || l.id==='building');
          if (bldLayer) {
            // 기존 fill 레이어 뒤에 extrusion 추가
            map.addLayer({
              id:'icoc-3d-buildings',
              type:'fill-extrusion',
              source: bldLayer.source || 'composite',
              'source-layer': bldLayer['source-layer'] || 'building',
              minzoom: 11,
              filter: ['==', 'extrude', 'true'],
              paint: {
                'fill-extrusion-color': '#0d2244',
                'fill-extrusion-height': ['interpolate',['linear'],['zoom'],11,0,11.5,['get','height']],
                'fill-extrusion-base':   ['interpolate',['linear'],['zoom'],11,0,11.5,['get','min_height']],
                'fill-extrusion-opacity': 0.82,
              }
            });
          }
        } catch(e) { console.log('3D buildings skip:', e.message); }
        loadVenues(SAMPLE_VENUES); loadSupabaseVenues();
      });
    }
  }

  function loadVenues(venues) {
    // 기존 마커 제거
    markers.forEach(m => m.remove());
    markers = [];

    venues
      .filter(v => activeType === 'all' || v.type === activeType)
      .forEach(v => {
        const t = TYPES[v.type] || { label: v.type, icon: '📍', color: '#888' };

        // 마커 엘리먼트
        const el = document.createElement('div');
        el.className = 'map-marker';
        el.style.cssText = `
          background:${t.color};
          width:32px;height:32px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-size:16px;cursor:pointer;
          border:2px solid rgba(255,255,255,0.8);
          box-shadow:0 2px 8px rgba(0,0,0,0.4);
          transition:transform 0.15s;
        `;
        el.textContent = t.icon;
        el.addEventListener('mouseenter', () => { el.style.transform='scale(1.2)'; });
        el.addEventListener('mouseleave', () => { el.style.transform='scale(1)'; });

        // 팝업 + 마커
        const MapLibP = window.mapboxgl || window.maplibregl;
        const vp = new URLSearchParams({
          id:v.id, name:v.name, type:v.type, lat:v.lat, lng:v.lng,
          addr:v.addr||'', city:v.city||''
        }).toString();
        const popup = new MapLibP.Popup({ offset: 20, closeButton: true, maxWidth: '260px' })
          .setHTML(`<div style="font-family:'Noto Sans KR',sans-serif;padding:4px 0;">
              <div style="color:${t.color};font-size:11px;font-weight:700;letter-spacing:.06em;margin-bottom:5px;">${t.icon} ${t.label}</div>
              <div style="font-size:15px;font-weight:700;color:#F5F0E8;margin-bottom:3px;">${v.name}</div>
              <div style="font-size:11px;color:rgba(245,240,232,0.5);margin-bottom:12px;">📍 ${v.addr}</div>
              <div style="display:flex;gap:7px;">
                <a href="venue.html?${vp}" style="flex:2;display:block;text-align:center;padding:9px 0;background:linear-gradient(135deg,#C9A84C,#E8C97A);border-radius:9px;font-size:12px;font-weight:700;color:#0B1F3A;text-decoration:none;">🗺️ 상세 지도</a>
                <a href="games.html?type=${v.type}" style="flex:1;display:block;text-align:center;padding:9px 0;background:rgba(201,168,76,0.1);border:1px solid rgba(201,168,76,0.3);border-radius:9px;font-size:12px;font-weight:600;color:#E8C97A;text-decoration:none;">🎮 플레이</a>
              </div>
            </div>`);
        const marker = new MapLibP.Marker({ element: el })
          .setLngLat([v.lng, v.lat])
          .setPopup(popup)
          .addTo(map);
        markers.push(marker);
      });

    updateCount(markers.length);
  }

  async function loadSupabaseVenues() {
    if (!window.ICOC_CONFIG || !window.supabase) return;
    try {
      const sb = window.supabase.createClient(
        window.ICOC_CONFIG.SUPABASE_URL,
        window.ICOC_CONFIG.SUPABASE_ANON
      );
      const { data } = await sb.from('icoc_venues').select('*').limit(200);
      if (data && data.length > 0) {
        loadVenues([...SAMPLE_VENUES, ...data]);
      }
    } catch(e) { /* Supabase 미연결 시 무시 */ }
  }

  function updateCount(n) {
    const el = document.getElementById('map-venue-count');
    if (el) el.textContent = `${n}개 장소`;
  }

  function filterType(type) {
    activeType = type;
    // 버튼 활성화
    document.querySelectorAll('.map-filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.type === type);
    });
    loadVenues(SAMPLE_VENUES);
  }

  function renderMapSection() {
    const section = document.getElementById('map-section');
    if (!section) return;

    section.innerHTML = `
      <div class="section-wrap">
        <p class="section-label">Find Your Venue</p>
        <h2 class="section-title">내 주변 경기장 찾기</h2>
        <p class="section-body">전국 기원·당구장·볼링장·스크린골프·보드카페·파크골프장을 지도에서 확인하세요.</p>

        <div class="map-filter-bar">
          <button class="map-filter-btn active" data-type="all" onclick="ICOC_MAP.filter('all')">전체</button>
          ${Object.entries(TYPES).map(([k,v]) =>
            `<button class="map-filter-btn" data-type="${k}" onclick="ICOC_MAP.filter('${k}')">${v.icon} ${v.label}</button>`
          ).join('')}
          <span id="map-venue-count" class="map-count">24개 장소</span>
        </div>

        <div style="position:relative;"><div id="icoc-map" class="icoc-map-container"></div>
      </div>

        <div class="map-style-bar">
          <span style="font-size:11px;color:rgba(245,240,232,0.45);margin-right:8px;">🗺️ 지도 스타일:</span>
          <button class="map-style-btn active" onclick="ICOC_MAP.setStyle('dark')" data-style="dark">🌑 다크</button>
          <button class="map-style-btn" onclick="ICOC_MAP.setStyle('streets')" data-style="streets">🏙️ 도시</button>
          <button class="map-style-btn" onclick="ICOC_MAP.setStyle('satellite')" data-style="satellite">🛰️ 위성</button>
          <button class="map-style-btn" onclick="ICOC_MAP.setStyle('light')" data-style="light">☀️ 라이트</button>
          <button class="map-style-btn" onclick="ICOC_MAP.setStyle('outdoors')" data-style="outdoors">🌲 아웃도어</button>
        </div>
        <p class="map-note">
          📌 데이터는 지속 업데이트 중입니다.
          내 동네 경기장을 <a href="#" class="map-register-link">등록하기 →</a>
        </p>

        <!-- 연령대별 채팅방 (WiseMom 스타일 얇은 바) -->
        <div class="age-chat-bar">
          <span class="age-bar-label">💬 연령대별 커뮤니티</span>
          <div class="age-bar-btns">
            <button class="age-bar-btn" onclick="ICOC_MAP.openAgeChat('10대')">🧒 10대</button>
            <button class="age-bar-btn" onclick="ICOC_MAP.openAgeChat('20대')">🧑 20대</button>
            <button class="age-bar-btn" onclick="ICOC_MAP.openAgeChat('30대')">👨 30대</button>
            <button class="age-bar-btn" onclick="ICOC_MAP.openAgeChat('40대')">🧔 40대</button>
            <button class="age-bar-btn" onclick="ICOC_MAP.openAgeChat('50대')">👴 50대</button>
            <button class="age-bar-btn" onclick="ICOC_MAP.openAgeChat('60대+')">👵 60대+</button>
          </div>
        </div>
        <!-- 연령대 채팅 모달 -->
        <div id="age-chat-modal" style="display:none;position:fixed;inset:0;z-index:5000;background:rgba(5,12,24,0.85);align-items:center;justify-content:center;">
          <div style="background:rgba(10,28,55,0.98);border:1px solid rgba(201,168,76,0.28);border-radius:18px;padding:28px 24px;max-width:360px;width:90%;text-align:center;backdrop-filter:blur(20px);">
            <div id="age-modal-title" style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#C9A84C;margin-bottom:10px;"></div>
            <div style="font-size:14px;color:rgba(245,240,232,0.65);line-height:1.8;margin-bottom:20px;">
              같은 연령대 ICOC 플레이어들과<br>경기 신청 · 정모 약속 · 팀 빌딩!<br>
              <span style="font-size:12px;color:rgba(245,240,232,0.4);">🔔 채팅 기능 곧 오픈</span>
            </div>
            <button onclick="document.getElementById('age-chat-modal').style.display='none'" style="padding:10px 28px;background:linear-gradient(135deg,#C9A84C,#E8C97A);border:none;border-radius:8px;font-size:13px;font-weight:700;color:#0B1F3A;cursor:pointer;">닫기</button>
          </div>
        </div>
        <button id="map-chat-btn" onclick="document.getElementById('map-chat-modal').classList.toggle('open')" style="
          position:absolute; bottom:60px; right:20px;
          width:52px; height:52px; border-radius:50%;
          background:linear-gradient(135deg,#C9A84C,#E8C97A);
          border:none; cursor:pointer; font-size:22px;
          box-shadow:0 4px 18px rgba(201,168,76,0.5); z-index:10;
          display:flex; align-items:center; justify-content:center;
        " title="경기장 채팅">💬<span style="
          position:absolute; top:2px; right:2px; width:13px; height:13px;
          border-radius:50%; background:#4ade80; border:2px solid #0B1F3A;
        "></span></button>
        <!-- 채팅 모달 -->
        <div id="map-chat-modal" style="
          display:none; position:absolute; bottom:120px; right:16px;
          width:300px; background:rgba(10,26,52,0.97);
          border:1px solid rgba(201,168,76,0.25); border-radius:16px;
          backdrop-filter:blur(20px); z-index:20;
          box-shadow:0 12px 40px rgba(0,0,0,0.5); flex-direction:column; overflow:hidden;
        " class="">
          <div style="padding:14px 16px; border-bottom:1px solid rgba(201,168,76,0.1); display:flex; align-items:center; gap:10px;">
            <span style="font-size:18px;">💬</span>
            <div style="flex:1;"><strong style="font-size:13px; color:#F5F0E8;">경기장 커뮤니티</strong><br><span style="font-size:11px; color:rgba(245,240,232,0.4);">이 지역 ICOC 플레이어들과 소통</span></div>
            <button onclick="document.getElementById('map-chat-modal').classList.remove('open')" style="background:none;border:none;color:rgba(245,240,232,0.4);font-size:18px;cursor:pointer;">✕</button>
          </div>
          <div style="padding:20px 16px; text-align:center; color:rgba(245,240,232,0.4); font-size:12px; line-height:1.8;">
            <span style="font-size:30px; display:block; margin-bottom:8px;">🔔</span>
            <strong style="color:#C9A84C; display:block; margin-bottom:4px;">채팅 기능 준비 중</strong>
            경기장 채팅, 정모 약속,<br>국가대표 팀 빌딩 기능이<br>곧 오픈됩니다!
          </div>
        </div>
      </div>
    `;

    // MapLibre 초기화
    if (window.maplibregl) {
      initMap();
    } else {
      // SDK 로드 대기
      const check = setInterval(() => {
        if (window.maplibregl) { clearInterval(check); initMap(); }
      }, 200);
    }
  }

  // 전역 노출
  const MAPBOX_STYLES = {
    dark:      'mapbox://styles/mapbox/dark-v11',
    streets:   'mapbox://styles/mapbox/streets-v12',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v12',
    light:     'mapbox://styles/mapbox/light-v11',
    outdoors:  'mapbox://styles/mapbox/outdoors-v12',
  };

  function setMapStyle(styleName) {
    if (!map) return;
    const url = MAPBOX_STYLES[styleName];
    if (!url) return;
    // Update active button
    document.querySelectorAll('.map-style-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.style === styleName);
    });
    if (window.mapboxgl && map.setStyle) {
      map.setStyle(url);
      map.once('styledata', () => {
        loadVenues(SAMPLE_VENUES);
        try {
          const layers = map.getStyle().layers;
          const bldLayer = layers.find(l => l['source-layer']==='building');
          if (bldLayer && styleName === 'dark') {
            map.addLayer({
              id:'icoc-3d-buildings', type:'fill-extrusion',
              source: bldLayer.source || 'composite', 'source-layer': 'building',
              minzoom:11, filter:['==','extrude','true'],
              paint:{ 'fill-extrusion-color':'#0d2244',
                'fill-extrusion-height':['interpolate',['linear'],['zoom'],11,0,11.5,['get','height']],
                'fill-extrusion-base':['interpolate',['linear'],['zoom'],11,0,11.5,['get','min_height']],
                'fill-extrusion-opacity':0.82 }
            });
          }
        } catch(e){}
      });
    }
  }

/* ── MAP STYLE BAR CSS (injected at runtime) ── */
  const styleCSS = `
  .age-chat-bar{
    display:flex;align-items:center;flex-wrap:wrap;gap:10px;
    padding:12px 0 4px;margin-top:4px;
    border-top:1px solid rgba(201,168,76,0.12);
  }
  .age-bar-label{font-size:11px;font-weight:700;color:rgba(201,168,76,0.7);white-space:nowrap;}
  .age-bar-btns{display:flex;gap:5px;flex-wrap:wrap;}
  .age-bar-btn{
    padding:5px 11px;border:1px solid rgba(201,168,76,0.2);border-radius:16px;
    background:rgba(201,168,76,0.06);color:rgba(245,240,232,0.7);
    font-size:11px;font-weight:600;cursor:pointer;transition:all .18s;font-family:inherit;
  }
  .age-bar-btn:hover{background:rgba(201,168,76,0.18);border-color:#C9A84C;color:#E8C97A;}
.map-style-bar{
    display:flex;align-items:center;flex-wrap:wrap;gap:6px;
    padding:10px 0 12px;margin-top:6px;
  }
  .map-style-btn{
    padding:5px 12px;border-radius:20px;border:1px solid rgba(201,168,76,0.22);
    background:rgba(255,255,255,0.04);color:rgba(245,240,232,0.65);
    font-size:11px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .2s;
  }
  .map-style-btn:hover{border-color:rgba(201,168,76,0.45);color:#E8C97A;}
  .map-style-btn.active{background:rgba(201,168,76,0.15);border-color:var(--gold,#C9A84C);color:#E8C97A;font-weight:700;}
  `;
  if (!document.getElementById('map-style-css')) {
    const s = document.createElement('style'); s.id='map-style-css';
    s.textContent = styleCSS; document.head.appendChild(s);
  }
  function openAgeChat(age) {
    const modal = document.getElementById('age-chat-modal');
    const title = document.getElementById('age-modal-title');
    if(modal && title) {
      title.textContent = age + ' 연령대 채팅방';
      modal.style.display = 'flex';
    }
  }

  window.ICOC_MAP = {
    filter: filterType,
    init: renderMapSection,
    setStyle: setMapStyle,
    openAgeChat: openAgeChat,
  };

  // DOM 준비 후 초기화 — Mapbox GL JS 로드 기다리기
  function waitAndInit() {
    if (window.mapboxgl) {
      renderMapSection();
    } else if (window.maplibregl) {
      renderMapSection();
    } else {
      // 스크립트 로드 대기 (최대 5초)
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        if (window.mapboxgl || window.maplibregl || attempts > 50) {
          clearInterval(poll);
          renderMapSection();
        }
      }, 100);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitAndInit);
  } else {
    waitAndInit();
  }

})();

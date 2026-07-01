/* ============================================================
   ICOC OMNIPO — 브레인스포츠 뉴스 티커
   Google News RSS + allorigins CORS 프록시 (무료)
   검색어: 바둑, 장기, 체스, 당구, 볼링, 보드게임, 골프 등
   ============================================================ */

(function () {
  'use strict';

  const SEARCHES = [
    '바둑', '장기 대회', '체스', '당구 PBA', '볼링 대회',
    '보드게임', '스크린골프', '파크골프', '마작', '브레인스포츠',
  ];

  const CORS = 'https://api.allorigins.win/get?url=';

  let allNews = [];
  let tickerInterval = null;

  // RSS 파싱
  function parseRSS(xml) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    const items = doc.querySelectorAll('item');
    return Array.from(items).slice(0, 3).map(item => ({
      title: item.querySelector('title')?.textContent?.replace(/<[^>]+>/g,'').trim() || '',
      link:  item.querySelector('link')?.textContent?.trim() || '#',
      pub:   item.querySelector('pubDate')?.textContent?.trim() || '',
    })).filter(n => n.title.length > 5);
  }

  // Google News RSS URL
  function rssURL(query) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=ko&gl=KR&ceid=KR:ko`;
  }

  // 단일 쿼리 뉴스 로드
  async function fetchNews(query) {
    try {
      const url = CORS + encodeURIComponent(rssURL(query));
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const json = await res.json();
      return parseRSS(json.contents || '');
    } catch { return []; }
  }

  // 전체 뉴스 로드
  async function loadAllNews() {
    // 2개씩 병렬 로드
    const results = [];
    for (let i = 0; i < SEARCHES.length; i += 2) {
      const batch = await Promise.all(
        SEARCHES.slice(i, i+2).map(q => fetchNews(q))
      );
      batch.forEach(items => results.push(...items));
    }

    // 중복 제거 + 셔플
    const seen = new Set();
    allNews = results
      .filter(n => { if (seen.has(n.title)) return false; seen.add(n.title); return true; })
      .sort(() => Math.random() - 0.5);

    if (allNews.length === 0) {
      // 폴백: 샘플 뉴스
      allNews = FALLBACK_NEWS;
    }

    renderTicker();
  }

  // 폴백 샘플 뉴스
  const FALLBACK_NEWS = [
    { title: '신진서 9단, 세계바둑선수권 4연패 달성', link: '#', pub: '' },
    { title: 'PBA 당구 투어, 2027 ICOC 공식 파트너십 체결', link: '#', pub: '' },
    { title: '볼링 국가대표 선발전, 전국 8개 도시에서 개최', link: '#', pub: '' },
    { title: '스크린골프 골프존, 전 세계 100개국 진출 달성', link: '#', pub: '' },
    { title: '제44회 전국장기왕전, 참가 신청 접수 중', link: '#', pub: '' },
    { title: '보드게임 카페 시장, 연간 20% 성장세 지속', link: '#', pub: '' },
    { title: '파크골프 동호인 전국 50만 명 돌파', link: '#', pub: '' },
    { title: '국제체스연맹(FIDE), 한국 랭킹 선수 20명 돌파', link: '#', pub: '' },
    { title: 'ICOC 2027 서울 대회, 참가국 60개국 돌파', link: '#', pub: '' },
    { title: '마작 스포츠 리그, 서울·부산·대구 동시 개막', link: '#', pub: '' },
  ];

  // 티커 렌더링
  function renderTicker() {
    const track = document.getElementById('ticker-track');
    if (!track || allNews.length === 0) return;

    // 뉴스 아이템 생성 (무한 스크롤을 위해 2배 복제)
    const items = [...allNews, ...allNews];
    track.innerHTML = items.map((n, i) => `
      <a href="${n.link}" target="_blank" rel="noopener" class="ticker-item">
        <span class="ticker-bullet">▶</span>
        <span class="ticker-text">${n.title}</span>
      </a>
    `).join('');

    // 애니메이션 재시작
    track.style.animation = 'none';
    track.offsetHeight; // reflow
    const totalWidth = track.scrollWidth / 2;
    const speed = 60; // px/sec
    const duration = totalWidth / speed;
    track.style.animation = `tickerScroll ${duration}s linear infinite`;
  }

  // 초기화
  function init() {
    const ticker = document.getElementById('news-ticker');
    if (!ticker) return;

    // 로딩 상태
    const track = document.getElementById('ticker-track');
    if (track) {
      track.innerHTML = '<span class="ticker-item"><span class="ticker-bullet">⟳</span><span class="ticker-text">뉴스 불러오는 중...</span></span>';
    }

    loadAllNews();

    // 30분마다 갱신
    setInterval(loadAllNews, 30 * 60 * 1000);
  }

  window.ICOC_TICKER = { init, reload: loadAllNews };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

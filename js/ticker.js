/* ============================================================
   ICOC OMNIPO — 공식 뉴스 티커 (정적 ICOC 소식)
   ============================================================ */
(function () {
  'use strict';

  const ICOC_NEWS = [
    { title: '🎉 ICOC Brain Sports Omnipo 2027 공식 사이트 오픈!', link: '#' },
    { title: '🌐 전 세계 195개국 참가자 모집 시작 — 온라인 예선 진행 중', link: '#' },
    { title: '⚫ 오목 국가대표 선발전 1차 예선 시작 — 지금 바로 도전하세요', link: '#' },
    { title: '♟️ 체스 부문 AI 대전 시스템 업데이트 완료', link: '#' },
    { title: '🎁 친구 초대 이벤트 — 추천인·피추천인 각 10,000P 지급', link: 'referral.html' },
    { title: '🏆 글로벌 리더보드 오픈 — 국가·도시·동네 단위 실시간 랭킹 확인', link: 'leaderboard.html' },
    { title: '⛳ 스크린골프·볼링·당구 종목 공식 등록 완료 — ICOC 2027 정식 종목', link: '#' },
    { title: '🃏 텍사스 홀덤 부문 온라인 시범 대회 개최 예정', link: '#' },
    { title: '📍 전국 ICOC 공식 경기장 24개소 지도 등록 완료', link: 'venue.html' },
    { title: '🇰🇷 서울 2027 본선 개최 확정 — 50개국 1,000명 초청 목표', link: '#' },
    { title: '⚡ 매 시간 접속 체크인 보너스 — 평일 1,000P / 주말 2,000P 지급', link: '#' },
    { title: '🎮 66개 브레인스포츠 종목 AI 대전 순차 오픈 예정', link: 'games.html' },
    { title: '🌍 ICOC Omnipo 2027 — World First Multi-Sport Brain Olympics', link: '#' },
    { title: '📱 모바일 최적화 완료 — iOS / Android 어디서든 국가대표 선발전 참여 가능', link: '#' },
    { title: '🪅 윷놀이·마작·고스톱 전통 종목 공식 채택 확정', link: '#' },
  ];

  let idx = 0;

  function buildTicker() {
    const bar = document.getElementById('news-ticker-bar') || document.querySelector('.news-ticker');
    if (!bar) return;

    const inner = bar.querySelector('.ticker-inner') || bar;
    function show() {
      const item = ICOC_NEWS[idx % ICOC_NEWS.length];
      inner.innerHTML = `<a href="${item.link}" style="color:inherit;text-decoration:none;">${item.title}</a>`;
      idx++;
    }
    show();
    setInterval(show, 4500);
  }

  document.addEventListener('DOMContentLoaded', buildTicker);
})();

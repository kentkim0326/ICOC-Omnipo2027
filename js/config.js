/* ============================================================
   ICOC OMNIPO — Supabase 설정 (wisemom 프로젝트 임시 사용)
   추후 ICOC 전용 프로젝트로 마이그레이션 예정
   ============================================================ */

window.ICOC_CONFIG = {
   MAPBOX_TOKEN: 'pk.eyJ1IjoibWlsaXZlcnNlMTAwNCIsImEiOiJjbXF0NmltcjYwMWprMnpzaGFrdjF5YnA3In0.yqIA5e6OePYT65r-xZShLA',
   SUPABASE_URL:  'https://qxbxwggljdbaprkdufwh.supabase.co',
  SUPABASE_ANON: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF4Ynh3Z2dsamRiYXBya2R1ZndoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzODg1ODgsImV4cCI6MjA5Nzk2NDU4OH0.Labb_hliJi9VNkc0jeA0e567EIgg6_GbdVMrlywIco4',
};

/* ── 전역 단일 Supabase 인스턴스 (Multiple GoTrueClient 방지) ──
   supabase.min.js 로딩 직후 config.js가 실행되므로
   여기서 단 한 번만 createClient 하고 _ICOC_SB에 저장.
   auth.js / online.js / map.js 등 모든 파일은 window._ICOC_SB를 재사용.
*/
(function () {
  function tryInit() {
    if (window._ICOC_SB) return; // 이미 존재
    if (!window.supabase || !window.supabase.createClient) return; // SDK 미로딩
    try {
      var cfg = window.ICOC_CONFIG;
      window._ICOC_SB = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON);
      console.log('[ICOC] Supabase singleton created ✅');
    } catch (e) {
      console.error('[ICOC] Supabase init error:', e);
    }
  }
  // SDK가 sync 로딩이면 즉시, async이면 DOMContentLoaded 때
  tryInit();
  document.addEventListener('DOMContentLoaded', tryInit);
})();

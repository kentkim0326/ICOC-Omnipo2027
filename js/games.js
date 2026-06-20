/* ============================================================
   ICOC OMNIPO — Game Launcher
   카드 클릭 → 구현된 게임이면 모달 오픈, 아니면 "준비중" 토스트
   ============================================================ */

(function (global) {
  // 구현된 게임만 여기 등록. key는 sport-card의 data-game 값과 일치해야 함.
  const GAMES = {
    omok: {
      title: '오목 (Omok)',
      icon: '⬤',
      init: () => global.OmokGame && global.OmokGame.start()
    },
    go: {
      title: '바둑 (Go)',
      icon: '⚫',
      init: () => global.GoGame && global.GoGame.start()
    }
    // 추후 추가: chess, shogi, janggi, ...
  };

  function openGame(key) {
    const game = GAMES[key];
    if (!game) {
      ICOC_POINTS.showToast('이 종목은 곧 플레이할 수 있습니다. 조금만 기다려주세요!');
      return;
    }
    const modal = document.getElementById('game-modal');
    const titleEl = document.getElementById('game-modal-title-text');
    const iconEl = document.getElementById('game-modal-icon');
    if (titleEl) titleEl.textContent = game.title;
    if (iconEl) iconEl.textContent = game.icon;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
    game.init();
  }

  function closeGame() {
    const modal = document.getElementById('game-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    const body = document.getElementById('game-modal-body');
    if (body) body.innerHTML = '';
  }

  global.ICOC_GAMES = { GAMES, openGame, closeGame };
})(window);

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
    },
    chess: {
      title: '체스 (Chess)',
      icon: '♟',
      init: () => global.ChessGame && global.ChessGame.start()
    },
    connect4: {
      title: '커넥트4 (Connect 4)',
      icon: '🔴',
      init: () => global.Connect4Game && global.Connect4Game.start()
    },
    reversi: {
      title: '리버시 (Reversi)',
      icon: '⚪',
      init: () => global.ReversiGame && global.ReversiGame.start()
    },
    hex: {
      title: '헥스 (Hex)',
      icon: '⬡',
      init: () => global.HexGame && global.HexGame.start()
    },
    quoridor: {
      title: '쿼리도 (Quoridor)',
      icon: '🧱',
      init: () => global.QuoridorGame && global.QuoridorGame.start()
    },
    checkers: {
      title: '체커 (Checkers)',
      icon: '⚪',
      init: () => global.CheckersGame && global.CheckersGame.start()
    },
    blackjack: {
      title: '블랙잭 (Blackjack)',
      icon: '♠',
      init: () => global.BlackjackGame && global.BlackjackGame.start()
    },
    oldmaid: {
      title: '도둑잡기 (Old Maid)',
      icon: '🃏',
      init: () => global.OldMaidGame && global.OldMaidGame.start()
    },
    bowling: {
      title: '볼링 (Bowling)',
      icon: '🎳',
      init: () => global.BowlingGame && global.BowlingGame.start()
    },
    davinci: {
      title: '다빈치 코드 (Da Vinci Code)',
      icon: '🔢',
      init: () => global.DaVinciGame && global.DaVinciGame.start()
    },
    onecard: {
      title: '원카드 (One Card)',
      icon: '🂠',
      init: () => global.OneCardGame && global.OneCardGame.start()
    },
    backgammon: {
      title: '백개먼 (Backgammon)',
      icon: '⚀',
      init: () => global.BackgammonGame && global.BackgammonGame.start()
    }
    // 추후 추가: shogi, janggi, ...
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

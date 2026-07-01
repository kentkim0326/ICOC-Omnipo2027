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
    },
    gostop: {
      title: '고스톱 (Go-Stop)',
      icon: '🎴',
      init: () => global.GoStopGame && global.GoStopGame.start()
    },
    rummikub: {
      title: '루미큐브 (Rummikub)',
      icon: '🀫',
      init: () => global.RummikubGame && global.RummikubGame.start()
    },
    billiards: {
      title: '당구 (8-ball Pool)',
      icon: '🎱',
      init: () => global.BilliardsGame && global.BilliardsGame.start()
    },
    janggi: {
      title: '장기 (Janggi)',
      icon: '♟️',
      init: () => global.JanggiGame && global.JanggiGame.start()
    },
    shogi: {
      title: '쇼기 (Shogi)',
      icon: '🎴',
      init: () => global.ShogiGame && global.ShogiGame.start()
    },
    mahjong: {
      title: '마작 솔리테어 (Mahjong)',
      icon: '🀄',
      init: () => global.MahjongGame && global.MahjongGame.start()
    },
    holdem: {
      title: '텍사스 홀덤 (Hold\'em)',
      icon: '♠',
      init: () => global.HoldemGame && global.HoldemGame.start()
    },
    screengolf: {
      title: '스크린골프 (Screen Golf)',
      icon: '⛳',
      init: () => global.ScreenGolfGame && global.ScreenGolfGame.start()
    },
    bridge: {
      title: '브릿지 (Bridge)',
      icon: '🃏',
      init: () => global.BridgeGame && global.BridgeGame.start()
    },
    rummy: {
      title: '진 러미 (Gin Rummy)',
      icon: '🃏',
      init: () => global.RummyGame && global.RummyGame.start()
    },
    hearts: {
      title: '하트 (Hearts)',
      icon: '♥',
      init: () => global.HeartsGame && global.HeartsGame.start()
    }
    // 추후 추가: ...
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

    // 온라인 1:1 대전 버튼 (로그인 + 지원 종목만)
    const _onlineGames = ['omok','go','chess','janggi','shogi'];
    if (_onlineGames.includes(key) && window.ICOC_AUTH?.getCurrentUser?.()) {
      const _body = document.getElementById('game-modal-body');
      if (_body && !document.getElementById('online-btn-row')) {
        const _row = document.createElement('div');
        _row.id = 'online-btn-row';
        _row.style.cssText = 'padding:8px 12px;border-top:1px solid rgba(201,168,76,0.1);display:flex;align-items:center;gap:8px;justify-content:flex-end;';
        _row.innerHTML = '<span style="font-size:11px;color:rgba(245,240,232,0.35);">사람과 대전:</span>'
          + '<button onclick="if(window.ICOC_ONLINE)ICOC_ONLINE.injectMatchmakingUI(document.getElementById(\'game-modal\'),\''+key+'\')" '
          + 'style="padding:5px 14px;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:16px;color:#4ade80;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">🌐 온라인 1:1</button>';
        _body.appendChild(_row);
      }
    }
  }

  function closeGame() {
    const modal = document.getElementById('game-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    const body = document.getElementById('game-modal-body');
    if (body) body.innerHTML = '';
  }

  // 스피드 큐브 추가
  GAMES.speedcube = {
    title: '스피드 큐브 (Speed Cube)',
    icon: '🎲',
    init: () => global.SpeedCubeGame && global.SpeedCubeGame.start()
  };
  global.ICOC_GAMES = { GAMES, openGame, closeGame };
  // 전역 접근 (tryAutoOpenGame, go.js 등)
  global.openGame = openGame;
})(window);
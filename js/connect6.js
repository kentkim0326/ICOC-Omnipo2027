const BOARD_SIZE = 13;
let goBoard = [];
let isBlackTurn = true;
let isAiThinking = false;

// 🔍 js/connect6.js 파일 맨 위쪽을 열어서 아래와 같이 함수명을 바꿔주세요!

// 원래 이름: function openGoGame() { ... }
// 🛠️ 바뀐 이름:
function openConnect6Game() {
    const modal = document.getElementById('go-modal');
    if (modal) {
        modal.style.display = 'flex';
        // 모달 타이틀을 "Connect 6 (육목 대국)"으로 확실히 변경
        const title = modal.querySelector('.go-modal-title');
        if (title) title.innerText = "Connect 6 (육목 대국)";
        resetGoGame();
    }
}
function closeGoGame() { document.getElementById('go-modal').style.display = 'none'; }
function resetGoGame() {
  goBoard = Array(BOARD_SIZE).fill(null).map(() => Array(BOARD_SIZE).fill(0));
  isBlackTurn = true;
  isAiThinking = false;
  updateGoUI();
}
function updateGoUI() {
  const grid = document.getElementById('go-board-grid');
  if (!grid) return;
  grid.innerHTML = '';

  const turnBlackEl = document.getElementById('turn-black');
  const turnWhiteEl = document.getElementById('turn-white');
  if (isBlackTurn) {
    turnBlackEl.className = 'go-turn-box active'; turnBlackEl.innerText = '⚫ 당신의 차례 (흑)';
    turnWhiteEl.className = 'go-turn-box'; turnWhiteEl.innerText = '⚪ AI 대기 중';
  } else {
    turnBlackEl.className = 'go-turn-box'; turnBlackEl.innerText = '⚫ 당신 (대기)';
    turnWhiteEl.className = 'go-turn-box active'; turnWhiteEl.innerText = '⚪ AI 생각 중...';
  }

  const stars = [3, 6, 9];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'go-cell';
      if (stars.includes(r) && stars.includes(c)) cell.classList.add('go-star');
      if (isBlackTurn && !isAiThinking) cell.classList.add('hover-black');

      const stoneState = goBoard[r][c];
      if (stoneState !== 0) {
        cell.classList.add('has-stone');
        const stone = document.createElement('div');
        stone.className = `go-stone ${stoneState === 1 ? 'black' : 'white'}`;
        cell.appendChild(stone);
      }
      cell.onclick = () => handleGoClick(r, c);
      grid.appendChild(cell);
    }
  }
}
function handleGoClick(r, c) {
  if (!isBlackTurn || isAiThinking || goBoard[r][c] !== 0) return;
  const result = tryPlaceStone(r, c, 1);
  if (result.success) {
    goBoard = result.board; updateGoUI();
    if (result.win) {
      setTimeout(() => { alert("🎉 축하합니다! 육목을 완성하여 승리하셨습니다!"); resetGoGame(); }, 100);
      return;
    }
    isBlackTurn = false; isAiThinking = true;
    setTimeout(makeAiMove, 500);
  }
}
function tryPlaceStone(r, c, color, targetBoard = goBoard) {
  if (targetBoard[r][c] !== 0) return { success: false, board: targetBoard, win: false };
  let nextBoard = targetBoard.map(row => [...row]);
  nextBoard[r][c] = color;

  const dirs = [[0,1], [1,0], [1,1], [1,-1]];
  let isWin = false;
  for (let i = 0; i < dirs.length; i++) {
    let count = 1; const [dr, dc] = dirs[i];
    let nr = r + dr, nc = c + dc;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && nextBoard[nr][nc] === color) { count++; nr += dr; nc += dc; }
    nr = r - dr; nc = c - dc;
    while (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE && nextBoard[nr][nc] === color) { count++; nr -= dr; nc -= dc; }
    if (count >= 6) { isWin = true; break; }
  }
  return { success: true, board: nextBoard, win: isWin };
}
function makeAiMove() {
  let bestMove = null; let highestScore = -10000;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (goBoard[r][c] !== 0) continue;
      const simulation = tryPlaceStone(r, c, 2);
      if (!simulation.success) continue;
      let score = 0;
      if (simulation.win) score += 10000;
      const opponentSim = tryPlaceStone(r, c, 1);
      if (opponentSim.win) score += 5000;
      const nw = getNeighborWeights(r, c);
      score += nw.white * 20 + nw.black * 15;
      score += (24 - (Math.abs(r - 6) + Math.abs(c - 6))) * 1 + Math.random() * 2;
      if (score > highestScore) { highestScore = score; bestMove = { r, c, sim: simulation }; }
    }
  }
  if (bestMove) {
    goBoard = bestMove.sim.board; updateGoUI();
    if (bestMove.sim.win) {
      setTimeout(() => { alert("🤖 AI가 육목을 완성하여 승리했습니다!"); resetGoGame(); }, 100);
      return;
    }
  } else { alert("무승부입니다."); resetGoGame(); }
  isBlackTurn = true; isAiThinking = false; updateGoUI();
}
function getNeighborWeights(r, c) {
  let black = 0, white = 0; const dirs = [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
  for (let i = 0; i < dirs.length; i++) {
    const nr = r + dirs[i][0], nc = c + dirs[i][1];
    if (nr >= 0 && nr < BOARD_SIZE && nc >= 0 && nc < BOARD_SIZE) {
      if (goBoard[nr][nc] === 1) black++; else if (goBoard[nr][nc] === 2) white++;
    }
  }
  return { black, white };
}
/* ============================================================
   ICOC OMNIPO — 볼링 (Bowling) vs AI
   10프레임 정식 채점: 스트라이크(다음 2구 보너스), 스페어(다음 1구 보너스),
   10프레임 보너스 구(스트라이크시 2구, 스페어시 1구 추가) 전부 구현.
   ============================================================ */

(function (global) {
  const PLAYER = 'player', AI = 'ai';

  let frames, currentPlayer, gameOver, awarded; // frames[who] = [{rolls:[..]}...]

  function newFrames() { return { [PLAYER]: [], [AI]: [] }; }

  function randomPins(pinsStanding, skillBias) {
    // skillBias: 0~1, 높을수록 더 잘 침 (스트라이크/스페어 확률 ↑)
    const r = Math.random();
    if (pinsStanding === 10) {
      if (r < 0.32 + skillBias * 0.18) return 10; // 스트라이크
      return Math.floor(Math.random() * 8) + 1; // 1~8
    } else {
      if (r < 0.45 + skillBias * 0.15) return pinsStanding; // 스페어(남은 핀 전부)
      return Math.floor(Math.random() * pinsStanding);
    }
  }

  function isFrameDone(who, frameIndex) {
    const f = frames[who][frameIndex];
    if (!f) return false;
    if (frameIndex === 9) {
      // 10프레임: 스트라이크/스페어면 3구, 아니면 2구
      if (f.rolls[0] === 10 || (f.rolls.length >= 2 && f.rolls[0] + f.rolls[1] === 10)) return f.rolls.length >= 3;
      return f.rolls.length >= 2;
    }
    if (f.rolls[0] === 10) return true; // 스트라이크면 1구로 종료
    return f.rolls.length >= 2;
  }

  function currentFrameIndex(who) {
    for (let i = 0; i < 10; i++) {
      if (!frames[who][i] || !isFrameDone(who, i)) return i;
    }
    return 10; // 모두 완료
  }

  function rollFor(who, skillBias) {
    const idx = currentFrameIndex(who);
    if (idx >= 10) return null;
    if (!frames[who][idx]) frames[who][idx] = { rolls: [] };
    const f = frames[who][idx];

    let pinsStanding;
    if (idx === 9) {
      // 10프레임: 1구째는 항상 10핀, 2구째는 1구 결과에 따라, 3구째는 2구 결과에 따라
      if (f.rolls.length === 0) pinsStanding = 10;
      else if (f.rolls.length === 1) pinsStanding = f.rolls[0] === 10 ? 10 : 10 - f.rolls[0];
      else pinsStanding = (f.rolls[0] === 10) ? (f.rolls[1] === 10 ? 10 : 10 - f.rolls[1]) : 10; // 스페어 후 보너스구는 풀핀
    } else {
      pinsStanding = f.rolls.length === 0 ? 10 : 10 - f.rolls[0];
    }

    const knocked = randomPins(pinsStanding, skillBias);
    f.rolls.push(knocked);
    return knocked;
  }

  // 표준 볼링 점수 계산 (스트라이크/스페어 보너스 포함)
  function computeScore(who) {
    const allRolls = [];
    frames[who].forEach(f => { if (f) allRolls.push(...f.rolls); });
    let score = 0, ballIdx = 0;
    const frameBoundaries = []; // 각 프레임이 allRolls에서 시작하는 인덱스
    let cursor = 0;
    for (let i = 0; i < 10; i++) {
      const f = frames[who][i];
      frameBoundaries.push(cursor);
      if (!f) break;
      cursor += f.rolls.length;
    }
    for (let i = 0; i < 10; i++) {
      const f = frames[who][i];
      if (!f || f.rolls.length === 0) continue;
      const start = frameBoundaries[i];
      if (f.rolls[0] === 10) {
        score += 10 + (allRolls[start + 1] || 0) + (allRolls[start + 2] || 0);
      } else if (f.rolls.length >= 2 && f.rolls[0] + f.rolls[1] === 10) {
        score += 10 + (allRolls[start + 2] || 0);
      } else {
        score += f.rolls.reduce((s, v) => s + v, 0);
      }
    }
    return score;
  }

  function frameLabel(f, isTenth) {
    if (!f || f.rolls.length === 0) return '';
    const r = f.rolls;
    if (isTenth) {
      return r.map((v, i) => {
        if (v === 10) return 'X';
        if (i > 0 && r[i - 1] !== 10 && r[i - 1] + v === 10) return '/';
        return v === 0 ? '-' : v;
      }).join(' ');
    }
    if (r[0] === 10) return 'X';
    if (r.length === 2) {
      if (r[0] + r[1] === 10) return (r[0] === 0 ? '-' : r[0]) + ' /';
      return (r[0] === 0 ? '-' : r[0]) + ' ' + (r[1] === 0 ? '-' : r[1]);
    }
    return (r[0] === 0 ? '-' : r[0]) + ' ..';
  }

  function setStatus(msg) { const el = document.getElementById('bw-result'); if (el) el.textContent = msg || ''; }
  function setPointsMsg(msg) { const el = document.getElementById('bw-points-msg'); if (el) el.textContent = msg || ''; }

  function renderScoreboard() {
    for (const who of [PLAYER, AI]) {
      const row = document.getElementById('bw-frames-' + who);
      row.innerHTML = '';
      for (let i = 0; i < 10; i++) {
        const f = frames[who][i];
        const cell = document.createElement('div');
        cell.className = 'bw-frame-cell' + (currentFrameIndex(who) === i && !gameOver ? ' bw-frame-active' : '');
        cell.innerHTML = `<div class="bw-frame-num">${i + 1}</div><div class="bw-frame-rolls">${frameLabel(f, i === 9)}</div>`;
        row.appendChild(cell);
      }
      document.getElementById('bw-score-' + who).textContent = computeScore(who);
    }
    document.getElementById('bw-turn-p').classList.toggle('active', currentPlayer === PLAYER && !gameOver);
    document.getElementById('bw-turn-a').classList.toggle('active', currentPlayer === AI && !gameOver);
  }

  function pinsRemainingText(who) {
    const idx = currentFrameIndex(who);
    if (idx >= 10) return '';
    const f = frames[who][idx];
    if (!f || f.rolls.length === 0) return '10핀 모두 서 있음';
    if (idx === 9) {
      if (f.rolls[0] === 10 && f.rolls.length === 1) return '10핀 모두 서 있음 (보너스)';
      if (f.rolls.length === 1) return `${10 - f.rolls[0]}핀 남음`;
      return '10핀 모두 서 있음 (보너스)';
    }
    return `${10 - f.rolls[0]}핀 남음`;
  }

  function endGame() {
    gameOver = true;
    const pScore = computeScore(PLAYER), aScore = computeScore(AI);
    let result = pScore > aScore ? 'win' : pScore < aScore ? 'lose' : 'draw';
    let pts;
    if (result === 'win') { setStatus(`🎉 승리! (${pScore} : ${aScore})`); pts = 30; }
    else if (result === 'lose') { setStatus(`AI 승리. (${pScore} : ${aScore})`); pts = 10; }
    else { setStatus(`동점 무승부. (${pScore} : ${aScore})`); pts = 15; }
    renderScoreboard();
    if (!awarded) {
      awarded = true;
      const r = global.ICOC_POINTS.addPoints(pts, 'bowling_' + result);
      setPointsMsg(r.capped
        ? `+${r.added}P 적립 (오늘 획득 한도 도달, 보유 ${r.total.toLocaleString()}P)`
        : `+${r.added}P 적립 · 보유 ${r.total.toLocaleString()}P`);
      global.ICOC_POINTS.showToast(`+${r.added}P 적립되었습니다.`);
    }
  }

  function aiTurnLoop() {
    if (currentFrameIndex(AI) >= 10) { advanceAfterAi(); return; }
    setStatus('AI가 투구 중...');
    setTimeout(() => {
      rollFor(AI, 0.5);
      renderScoreboard();
      if (currentFrameIndex(AI) >= 10) { advanceAfterAi(); return; }
      aiTurnLoop();
    }, 500);
  }

  function advanceAfterAi() {
    if (currentFrameIndex(PLAYER) >= 10 && currentFrameIndex(AI) >= 10) { endGame(); return; }
    currentPlayer = PLAYER;
    setStatus('당신의 차례입니다. "투구하기"를 누르세요.');
    renderScoreboard();
  }

  function onRollClick() {
    if (gameOver || currentPlayer !== PLAYER) return;
    rollFor(PLAYER, 0.32);
    renderScoreboard();
    if (currentFrameIndex(PLAYER) >= 10) {
      currentPlayer = AI;
      setStatus('');
      renderScoreboard();
      aiTurnLoop();
    } else {
      setStatus(pinsRemainingText(PLAYER) + ' — 계속 투구하세요.');
    }
  }

  function reset() {
    frames = newFrames();
    currentPlayer = PLAYER; gameOver = false; awarded = false;
    setStatus('"투구하기"를 눌러 시작하세요.');
    setPointsMsg('10프레임 동안 더 높은 점수를 내면 승리합니다.');
    renderScoreboard();
  }

  function start() {
    const body = document.getElementById('game-modal-body');
    body.innerHTML = `
      <div class="game-status-bar">
        <span id="bw-turn-p" class="game-turn-pill">🎳 당신 · <span id="bw-score-player">0</span>점</span>
        <span id="bw-turn-a" class="game-turn-pill">🎳 AI · <span id="bw-score-ai">0</span>점</span>
      </div>
      <div class="bw-scoreboard">
        <div class="bw-scoreboard-label">당신</div>
        <div id="bw-frames-player" class="bw-frames-row"></div>
        <div class="bw-scoreboard-label">AI</div>
        <div id="bw-frames-ai" class="bw-frames-row"></div>
      </div>
      <div id="bw-result" class="game-result-msg"></div>
      <div id="bw-points-msg" class="game-points-earned"></div>
      <div class="game-actions">
        <button class="game-btn primary" id="bw-roll-btn">투구하기</button>
        <button class="game-btn ghost" id="bw-restart-btn">새 게임</button>
        <button class="game-btn ghost" onclick="ICOC_GAMES.closeGame()">닫기</button>
      </div>
    `;
    document.getElementById('bw-roll-btn').addEventListener('click', onRollClick);
    document.getElementById('bw-restart-btn').addEventListener('click', reset);
    reset();
  }

  global.BowlingGame = { start };
})(window);

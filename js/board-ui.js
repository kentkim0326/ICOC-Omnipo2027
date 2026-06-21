/* ============================================================
   ICOC OMNIPO — Goban (교차점 기반 보드) 공통 렌더러
   바둑/오목처럼 "줄의 교차점"에 돌을 놓는 게임 전용.
   체스/체커처럼 "칸 안"에 말을 놓는 게임은 board-grid(.board-cell)를 그대로 사용.
   ============================================================ */

(function (global) {
  /**
   * @param {HTMLElement} container 보드를 삽입할 부모 엘리먼트
   * @param {number} rows 가로줄(행) 개수 — 정사각형 보드면 기존처럼 size 하나만 써도 됨
   * @param {number|object} colsOrOpts 세로줄(열) 개수, 또는 (정사각형 보드인 경우) opts 객체
   * @param {object} [maybeOpts] { onIntersectionClick(r,c), starPoints: [[r,c], ...] }
   * @returns {{ cellEls, placeStone(r,c,colorClass), clearStone(r,c), clearAll() }}
   */
  function createGoban(container, rows, colsOrOpts, maybeOpts) {
    let cols, opts;
    if (typeof colsOrOpts === 'number') { cols = colsOrOpts; opts = maybeOpts || {}; }
    else { cols = rows; opts = colsOrOpts || {}; } // 기존 정사각형 호출 방식과 호환
    const { onIntersectionClick, starPoints = [], extraLines = [] } = opts;
    const spacingX = 100 / (cols - 1);
    const spacingY = 100 / (rows - 1);

    const goban = document.createElement('div');
    goban.className = 'goban';
    goban.style.aspectRatio = cols + ' / ' + rows;
    const inner = document.createElement('div');
    inner.className = 'goban-inner';
    goban.appendChild(inner);

    // 격자선
    for (let i = 0; i < rows; i++) {
      const hLine = document.createElement('div');
      hLine.className = 'grid-line grid-line-h';
      hLine.style.top = (i * spacingY) + '%';
      inner.appendChild(hLine);
    }
    for (let i = 0; i < cols; i++) {
      const vLine = document.createElement('div');
      vLine.className = 'grid-line grid-line-v';
      vLine.style.left = (i * spacingX) + '%';
      inner.appendChild(vLine);
    }

    // 추가 대각선 등 (예: 장기 궁성 사선) — [[r1,c1,r2,c2], ...] 형태로 두 교차점을 잇는 선
    extraLines.forEach(([r1, c1, r2, c2]) => {
      const x1 = c1 * spacingX, y1 = r1 * spacingY, x2 = c2 * spacingX, y2 = r2 * spacingY;
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;
      const line = document.createElement('div');
      line.className = 'grid-line grid-diag-line';
      line.style.left = x1 + '%';
      line.style.top = y1 + '%';
      line.style.width = len + '%';
      line.style.transform = `rotate(${angle}deg)`;
      inner.appendChild(line);
    });

    // 화점(별점)
    starPoints.forEach(([r, c]) => {
      const sp = document.createElement('div');
      sp.className = 'star-point';
      sp.style.top = (r * spacingY) + '%';
      sp.style.left = (c * spacingX) + '%';
      inner.appendChild(sp);
    });

    // 교차점(클릭 타겟 + 돌이 들어갈 슬롯)
    const cellEls = [];
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        const slot = document.createElement('div');
        slot.className = 'intersection';
        slot.style.top = (r * spacingY) + '%';
        slot.style.left = (c * spacingX) + '%';
        slot.style.width = spacingX + '%';
        slot.style.height = spacingY + '%';
        if (onIntersectionClick) slot.addEventListener('click', () => onIntersectionClick(r, c));
        inner.appendChild(slot);
        row.push(slot);
      }
      cellEls.push(row);
    }

    container.appendChild(goban);

    function placeStone(r, c, colorClass, extraClass = '') {
      const slot = cellEls[r][c];
      slot.innerHTML = '';
      const stone = document.createElement('div');
      stone.className = 'stone ' + colorClass + (extraClass ? ' ' + extraClass : '');
      slot.appendChild(stone);
      return stone;
    }
    function clearStone(r, c) { cellEls[r][c].innerHTML = ''; }
    function clearAll() { for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) clearStone(r, c); }

    return { cellEls, placeStone, clearStone, clearAll };
  }

  global.BoardUI = { createGoban };
})(window);

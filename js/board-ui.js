/* ============================================================
   ICOC OMNIPO — Goban (교차점 기반 보드) 공통 렌더러
   바둑/오목처럼 "줄의 교차점"에 돌을 놓는 게임 전용.
   체스/체커처럼 "칸 안"에 말을 놓는 게임은 board-grid(.board-cell)를 그대로 사용.
   ============================================================ */

(function (global) {
  /**
   * @param {HTMLElement} container 보드를 삽입할 부모 엘리먼트
   * @param {number} size 한 줄당 교차점 수 (예: 바둑 13, 오목 15)
   * @param {object} opts { onIntersectionClick(r,c), starPoints: [[r,c], ...] }
   * @returns {{ cellEls, placeStone(r,c,colorClass), clearStone(r,c), clearAll() }}
   */
  function createGoban(container, size, opts = {}) {
    const { onIntersectionClick, starPoints = [] } = opts;
    const spacing = 100 / (size - 1);

    const goban = document.createElement('div');
    goban.className = 'goban';
    const inner = document.createElement('div');
    inner.className = 'goban-inner';
    goban.appendChild(inner);

    // 격자선
    for (let i = 0; i < size; i++) {
      const hLine = document.createElement('div');
      hLine.className = 'grid-line grid-line-h';
      hLine.style.top = (i * spacing) + '%';
      inner.appendChild(hLine);

      const vLine = document.createElement('div');
      vLine.className = 'grid-line grid-line-v';
      vLine.style.left = (i * spacing) + '%';
      inner.appendChild(vLine);
    }

    // 화점(별점)
    starPoints.forEach(([r, c]) => {
      const sp = document.createElement('div');
      sp.className = 'star-point';
      sp.style.top = (r * spacing) + '%';
      sp.style.left = (c * spacing) + '%';
      inner.appendChild(sp);
    });

    // 교차점(클릭 타겟 + 돌이 들어갈 슬롯)
    const cellEls = [];
    for (let r = 0; r < size; r++) {
      const row = [];
      for (let c = 0; c < size; c++) {
        const slot = document.createElement('div');
        slot.className = 'intersection';
        slot.style.top = (r * spacing) + '%';
        slot.style.left = (c * spacing) + '%';
        slot.style.width = spacing + '%';
        slot.style.height = spacing + '%';
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
    function clearAll() { for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) clearStone(r, c); }

    return { cellEls, placeStone, clearStone, clearAll };
  }

  global.BoardUI = { createGoban };
})(window);

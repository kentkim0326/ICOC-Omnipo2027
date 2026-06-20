/**
 * Brain Sports Omnipo 2027 — Traditional Go (바둑) AI Engine
 * ----------------------------------------------------
 * 규칙: 순수 전통 바둑 규칙. 흑과 백이 번갈아가며 '1개씩' 돌을 놓습니다.
 * 상대방 돌의 숨길(활로)을 완전히 둘러싸면 상대방 돌을 따냅니다.
 */

const GO_SIZE = 13;
let goBoardState = []; // 0: 빈칸, 1: 흑(유저), 2: 백(AI)
let isUserTurn = true;
let userCaptured = 0;
let aiCaptured = 0;
let isGoGameActive = false;

// 바둑 모달 열기
function openGoGame() {
    const modal = document.getElementById('go-modal');
    if (modal) {
        modal.style.display = 'flex';
        // 모달 타이틀을 "Mini Baduk (13x13)"으로 변경
        const title = modal.querySelector('.go-modal-title');
        if (title) title.innerText = "Mini Baduk (13x13)";
        resetGoGame();
    }
}

// 바둑 초기화
function resetGoGame() {
    goBoardState = Array(GO_SIZE).fill(null).map(() => Array(GO_SIZE).fill(0));
    isUserTurn = true;
    userCaptured = 0;
    aiCaptured = 0;
    isGoGameActive = true;
    
    renderGoBoard();
    updateGoStatus();
}

// 바둑판 화면 그리기
function renderGoBoard() {
    const boardEl = document.getElementById('go-board-grid');
    if (!boardEl) return;
    boardEl.innerHTML = '';

    for (let r = 0; r < GO_SIZE; r++) {
        for (let c = 0; c < GO_SIZE; c++) {
            const cell = document.createElement('div');
            cell.className = 'go-cell';
            
            // 화점 표시 (3, 6, 9 라인)
            if ([3, 6, 9].includes(r) && [3, 6, 9].includes(c)) {
                cell.classList.add('go-star');
            }
            if (isUserTurn && isGoGameActive) {
                cell.classList.add('hover-black');
            }

            if (goBoardState[r][c] === 1) {
                cell.classList.add('has-stone');
                const stone = document.createElement('div');
                stone.className = 'go-stone black';
                cell.appendChild(stone);
            } else if (goBoardState[r][c] === 2) {
                cell.classList.add('has-stone');
                const stone = document.createElement('div');
                stone.className = 'go-stone white';
                cell.appendChild(stone);
            }

            cell.onclick = () => handleGoBoardClick(r, c);
            boardEl.appendChild(cell);
        }
    }
}

// 플레이어 바둑 착수
function handleGoBoardClick(r, c) {
    if (!isGoGameActive || !isUserTurn || goBoardState[r][c] !== 0) return;

    // 1. 착수 시뮬레이션
    let tempBoard = goBoardState.map(row => [...row]);
    tempBoard[r][c] = 1;

    // 2. 따낼 수 있는 상대 돌이 있는지 검사 및 획득
    let capturedCount = captureStones(tempBoard, 2);
    
    // 3. 자살수 금지 규칙 체크
    if (getLiberties(tempBoard, r, c, 1).size === 0 && capturedCount === 0) {
        alert("자살수는 둘 수 없습니다! (활로가 없는 자리에 착수 불가)");
        return;
    }

    // 착수 확정
    goBoardState = tempBoard;
    userCaptured += capturedCount;
    
    isUserTurn = false;
    renderGoBoard();
    updateGoStatus();

    // 0.6초 후 AI 응수
    setTimeout(makeGoAiMove, 600);
}

// AI 바둑 엔진 (가장 활로가 많거나 상대 돌을 공격하는 위치 탐색)
function makeGoAiMove() {
    if (!isGoGameActive) return;

    let bestMove = null;
    let maxWeight = -1;

    // 전제 판을 스캔하며 최적의 자리 찾기
    for (let r = 0; r < GO_SIZE; r++) {
        for (let c = 0; c < GO_SIZE; c++) {
            if (goBoardState[r][c] !== 0) continue;

            let tempBoard = goBoardState.map(row => [...row]);
            tempBoard[r][c] = 2;

            // 자살수 제외
            let aiCapturedCount = captureStones(tempBoard, 1);
            if (getLiberties(tempBoard, r, c, 2).size === 0 && aiCapturedCount === 0) {
                continue;
            }

            // 가중치 계산 (상대 돌을 따낼 수 있다면 최우선 가치 부여)
            let weight = aiCapturedCount * 50;
            
            // 내 돌의 활로 수 보장 및 적 주변 제어 가중치
            weight += getLiberties(tempBoard, r, c, 2).size * 2;
            weight += (GO_SIZE - Math.abs(r - 6) - Math.abs(c - 6)) * 0.1; // 중앙 선호

            if (weight > maxWeight) {
                maxWeight = weight;
                bestMove = { r, c, captured: aiCapturedCount };
            }
        }
    }

    if (bestMove) {
        goBoardState[bestMove.r][bestMove.c] = 2;
        let finalCapture = captureStones(goBoardState, 1); // 실제 판에서 플레이어 돌 제거
        aiCaptured += finalCapture;
    } else {
        alert("AI가 패스(Pass)했습니다. 대국이 종료되었습니다.");
        isGoGameActive = false;
        return;
    }

    isUserTurn = true;
    renderGoBoard();
    updateGoStatus();
}

// 활로(Liberties) 계산 및 포위 여부 판정 알고리즘
function getLiberties(boardState, startR, startC, color) {
    let visited = new Set();
    let liberties = new Set();
    let queue = [{ r: startR, c: startC }];
    visited.add(`${startR},${startC}`);

    while (queue.length > 0) {
        let { r, c } = queue.shift();
        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];

        for (let [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < GO_SIZE && nc >= 0 && nc < GO_SIZE) {
                if (boardState[nr][nc] === 0) {
                    liberties.add(`${nr},${nc}`);
                } else if (boardState[nr][nc] === color && !visited.has(`${nr},${nc}`)) {
                    visited.add(`${nr},${nc}`);
                    queue.push({ r: nr, c: nc });
                }
            }
        }
    }
    return liberties;
}

// 돌 따내기 메커니즘
function captureStones(boardState, opponentColor) {
    let totalCaptured = 0;
    let checked = new Set();

    for (let r = 0; r < GO_SIZE; r++) {
        for (let c = 0; c < GO_SIZE; c++) {
            if (boardState[r][c] === opponentColor && !checked.has(`${r},${c}`)) {
                // 특정 돌 무리의 활로를 측정
                let libertySet = getLiberties(boardState, r, c, opponentColor);
                
                // 활로 무리가 하나도 없다면(숨길이 막혔다면) 돌을 모두 제거(따냄)
                if (libertySet.size === 0) {
                    let queue = [{ r, c }];
                    let toRemove = [{ r, c }];
                    let groupVisited = new Set([`${r},${c}`]);

                    while (queue.length > 0) {
                        let curr = queue.shift();
                        const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
                        for (let [dr, dc] of dirs) {
                            let nr = curr.r + dr, nc = curr.c + dc;
                            if (nr >= 0 && nr < GO_SIZE && nc >= 0 && nc < GO_SIZE) {
                                if (boardState[nr][nc] === opponentColor && !groupVisited.has(`${nr},${nc}`)) {
                                    groupVisited.add(`${nr},${nc}`);
                                    queue.push({ r: nr, c: nc });
                                    toRemove.push({ r: nr, c: nc });
                                }
                            }
                        }
                    }

                    toRemove.forEach(stone => {
                        boardState[stone.r][stone.c] = 0;
                        totalCaptured++;
                    });
                }
                
                // 스캔 완료 기록 추가
                checked.add(`${r},${c}`);
            }
        }
    }
    return totalCaptured;
}

// 상단 인터페이스 글자 상태 동기화
function updateGoStatus() {
    const turnBlack = document.getElementById('turn-black');
    const turnWhite = document.getElementById('turn-white');

    if (!turnBlack || !turnWhite) return;

    if (isUserTurn) {
      turnBlack.className = 'go-turn-box active';
      turnBlack.innerText = `⚫ 당신의 차례 (흑)`;
      turnWhite.className = 'go-turn-box';
      turnWhite.innerText = `AI 대기 중`;
    } else {
      turnBlack.className = 'go-turn-box';
      turnBlack.innerText = `당신 대기 중`;
      turnWhite.className = 'go-turn-box active';
      turnWhite.innerText = `⚪ AI 대국 연산 중...`;
    }
}
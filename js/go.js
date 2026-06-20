/**
 * Brain Sports Omnipo 2027 — Advanced Go Engine
 */
const GO_SIZE = 13;
let goBoardState = []; 
let isUserTurn = true;
let userCaptured = 0;
let aiCaptured = 0;
let isGoGameActive = false;

function openGoGame() {
    const modal = document.getElementById('go-modal');
    if (modal) {
        modal.style.display = 'flex';
        const title = modal.querySelector('.go-modal-title');
        if (title) title.innerText = "Mini Baduk (13x13)";
        resetGoGame();
    }
}

function resetGoGame() {
    goBoardState = Array(GO_SIZE).fill(null).map(() => Array(GO_SIZE).fill(0));
    isUserTurn = true;
    userCaptured = 0;
    aiCaptured = 0;
    isGoGameActive = true;
    renderGoBoard();
    updateGoStatus();
}

// 기존 renderGoBoard 함수를 아래와 같이 보강
function renderGoBoard() {
    const boardEl = document.getElementById('go-grid'); // HTML ID와 정확히 일치해야 함!
    if (!boardEl) {
        console.error("ID가 'go-grid'인 태그를 찾을 수 없습니다. index.html을 확인하세요.");
        return;
    }
    boardEl.innerHTML = '';
    // renderGoBoard 함수 내 boardEl.innerHTML = ''; 바로 아래에 추가
boardEl.style.display = 'grid';
boardEl.style.gridTemplateColumns = 'repeat(13, 1fr)'; // 13x13 바둑판
boardEl.style.width = '100%';
boardEl.style.aspectRatio = '1/1';
boardEl.style.backgroundColor = '#C9A84C'; // 바둑판 색상

    for (let r = 0; r < GO_SIZE; r++) {
        for (let c = 0; c < GO_SIZE; c++) {
            const cell = document.createElement('div');
            // CSS 클래스 적용 (style.css에 .go-board-cell이 정의되어 있어야 합니다)
            cell.className = 'go-board-cell'; 
            cell.style.cursor = 'pointer';
            cell.style.border = '1px solid #997030'; // 눈에 보이게 테두리 추가
            
            // 돌 배치
            if (goBoardState[r][c] === 1) {
                cell.innerHTML = '<div class="go-stone go-black" style="width:80%; height:80%; border-radius:50%; background:#000; margin:auto;"></div>';
            } else if (goBoardState[r][c] === 2) {
                cell.innerHTML = '<div class="go-stone go-white" style="width:80%; height:80%; border-radius:50%; background:#fff; margin:auto;"></div>';
            }

            cell.onclick = () => handleGoBoardClick(r, c);
            boardEl.appendChild(cell);
        }
    }
}

function handleGoBoardClick(r, c) {
    if (!isGoGameActive || !isUserTurn || goBoardState[r][c] !== 0) return;

    let tempBoard = goBoardState.map(row => [...row]);
    tempBoard[r][c] = 1;

    let capturedCount = captureStones(tempBoard, 2);
    if (getLiberties(tempBoard, r, c, 1).size === 0 && capturedCount === 0) {
        alert("자살수는 둘 수 없습니다!");
        return;
    }

    goBoardState = tempBoard;
    userCaptured += capturedCount;
    isUserTurn = false;
    renderGoBoard();
    updateGoStatus();

    setTimeout(makeGoAiMove, 500);
}

// 🔥 고성능 바둑 AI 응수 로직
function makeGoAiMove() {
    if (!isGoGameActive) return;

    let bestMove = null;
    let maxWeight = -999999;

    for (let r = 0; r < GO_SIZE; r++) {
        for (let c = 0; c < GO_SIZE; c++) {
            if (goBoardState[r][c] !== 0) continue;

            let tempBoard = goBoardState.map(row => [...row]);
            tempBoard[r][c] = 2;

            let aiCapturedCount = captureStones(tempBoard, 1);
            let aiLiberties = getLiberties(tempBoard, r, c, 2).size;

            // 자살수 필터링
            if (aiLiberties === 0 && aiCapturedCount === 0) continue;

            // 전술적 가중치 결합 계산
            let weight = aiCapturedCount * 10000; // 1순위: 상대방 돌 따내기
            
            // 2순위: 내 활로가 위험하면(단수 상태 등) 긴급 대피 가중치
            if (aiLiberties === 1) weight -= 5000;
            else weight += aiLiberties * 100;

            // 3순위: 상대방 모양 방해 및 협공 (근접전 우대)
            let enemyNear = countNearStones(r, c, 1);
            let allyNear = countNearStones(r, c, 2);
            weight += enemyNear * 300; 
            weight += allyNear * 150;

            // 4순위: 중앙 가중치 적용
            weight += (GO_SIZE - Math.abs(r - 6) - Math.abs(c - 6)) * 10;

            if (weight > maxWeight) {
                maxWeight = weight;
                bestMove = { r, c };
            }
        }
    }

    if (bestMove) {
        goBoardState[bestMove.r][bestMove.c] = 2;
        aiCaptured += captureStones(goBoardState, 1);
    } else {
        alert("AI가 더 이상 둘 곳이 없어 패스합니다.");
        isGoGameActive = false;
        return;
    }

    isUserTurn = true;
    renderGoBoard();
    updateGoStatus();
}

function countNearStones(r, c, color) {
    let count = 0;
    const dirs = [[-1,0],[1,0],[0,-1],[0,1]];
    dirs.forEach(([dr, dc]) => {
        let nr = r + dr, nc = c + dc;
        if (nr >= 0 && nr < GO_SIZE && nc >= 0 && nc < GO_SIZE && goBoardState[nr][nc] === color) {
            count++;
        }
    });
    return count;
}

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

function captureStones(boardState, opponentColor) {
    let totalCaptured = 0;
    let checked = new Set();

    for (let r = 0; r < GO_SIZE; r++) {
        for (let c = 0; c < GO_SIZE; c++) {
            if (boardState[r][c] === opponentColor && !checked.has(`${r},${c}`)) {
                let libertySet = getLiberties(boardState, r, c, opponentColor);
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
                checked.add(`${r},${c}`);
            }
        }
    }
    return totalCaptured;
}

function updateGoStatus() {
    const turnBlack = document.getElementById('turn-black');
    const turnWhite = document.getElementById('turn-white');
    if (!turnBlack || !turnWhite) return;

    if (isUserTurn) {
        turnBlack.className = 'go-turn-box active';
        turnBlack.innerText = `⚫ 당신 (흑) [따낸 돌: ${userCaptured}]`;
        turnWhite.className = 'go-turn-box';
        turnWhite.innerText = `AI 대기 중 [따낸 돌: ${aiCaptured}]`;
    } else {
        turnBlack.className = 'go-turn-box';
        turnBlack.innerText = `당신 대기 중 [따낸 돌: ${userCaptured}]`;
        turnWhite.className = 'go-turn-box active';
        turnWhite.innerText = `⚪ AI 계산 중... [따낸 돌: ${aiCaptured}]`;
    }
}
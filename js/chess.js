/**
 * Brain Sports Omnipo 2027 — Playable Chess Engine
 */
const CHESS_SIZE = 8;
let chessBoardState = [];
let chessSelectedPiece = null;
let isPlayerWhiteTurn = true;

const CHESS_PIECES = {
    'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
    'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
};

function openChessGame() {
    const modal = document.getElementById('chess-modal');
    if (!modal) return;
    
    modal.style.display = 'flex';
    // 모달 내용이 이미 HTML에 있다면 굳이 innerHTML로 덮어쓰지 않는 것이 안전합니다.
    resetChessGame();
}

function closeChessGame() {
    const modal = document.getElementById('chess-modal');
    if (modal) modal.style.display = 'none';
}

function resetChessGame() {
    chessBoardState = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];
    
    chessSelectedPiece = null;
    isPlayerWhiteTurn = true;
    
    const statusBar = document.getElementById('chess-status-bar');
    if (statusBar) statusBar.innerText = "당신의 차례 (백)";
    
    renderChessBoard();
}

function renderChessBoard() {
    const gridEl = document.getElementById('chess-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';

    for (let r = 0; r < CHESS_SIZE; r++) {
        for (let c = 0; c < CHESS_SIZE; c++) {
            const cell = document.createElement('div');
            cell.style.width = '100%';
            cell.style.aspectRatio = '1/1';
            cell.style.display = 'flex';
            cell.style.justifyContent = 'center';
            cell.style.alignItems = 'center';
            cell.style.fontSize = '2.2rem';
            cell.style.cursor = 'pointer';

            const isLight = (r + c) % 2 === 0;
            cell.style.background = (chessSelectedPiece && chessSelectedPiece.r === r && chessSelectedPiece.c === c) 
                ? '#f7f785' 
                : (isLight ? '#eeeed2' : '#769656');

            const piece = chessBoardState[r][c];
            if (piece) {
                const color = (piece === piece.toLowerCase()) ? '#b51a1a' : '#1a252f';
                cell.innerHTML = `<span style="color: ${color};">${CHESS_PIECES[piece]}</span>`;
            }

            cell.onclick = () => handleChessCellClick(r, c);
            gridEl.appendChild(cell);
        }
    }
}

function handleChessCellClick(r, c) {
    if (!isPlayerWhiteTurn) return;

    const piece = chessBoardState[r][c];

    if (chessSelectedPiece) {
        if (chessSelectedPiece.r === r && chessSelectedPiece.c === c) {
            chessSelectedPiece = null;
            renderChessBoard();
            return;
        }

        if (piece && piece === piece.toUpperCase()) {
            chessSelectedPiece = { r, c };
            renderChessBoard();
            return;
        }

        chessBoardState[r][c] = chessBoardState[chessSelectedPiece.r][chessSelectedPiece.c];
        chessBoardState[chessSelectedPiece.r][chessSelectedPiece.c] = '';
        chessSelectedPiece = null;
        
        renderChessBoard();
        
        isPlayerWhiteTurn = false;
        const statusBar = document.getElementById('chess-status-bar');
        if (statusBar) statusBar.innerText = "AI가 전술 연산 중입니다...";
        setTimeout(makeChessAiMove, 600);
    } else {
        if (piece && piece === piece.toUpperCase()) {
            chessSelectedPiece = { r, c };
            renderChessBoard();
        }
    }
}

function makeChessAiMove() {
    let aiPieces = [];
    for (let r = 0; r < CHESS_SIZE; r++) {
        for (let c = 0; c < CHESS_SIZE; c++) {
            let p = chessBoardState[r][c];
            if (p && p === p.toLowerCase()) aiPieces.push({ r, c });
        }
    }

    if (aiPieces.length > 0) {
        let p = aiPieces[Math.floor(Math.random() * aiPieces.length)];
        let nr = p.r + 1, nc = p.c + (Math.random() > 0.5 ? 1 : -1);
        
        if (nr < CHESS_SIZE && nc >= 0 && nc < CHESS_SIZE) {
            chessBoardState[nr][nc] = chessBoardState[p.r][p.c];
            chessBoardState[p.r][p.c] = '';
        }
    }

    isPlayerWhiteTurn = true;
    const statusBar = document.getElementById('chess-status-bar');
    if (statusBar) statusBar.innerText = "당신의 차례 (백)";
    renderChessBoard();
}
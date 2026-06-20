/**
 * Brain Sports Omnipo 2027 — Chess (체스) Engine
 */

let chessGameActive = false;

// 체스 모달 열기
function openChessGame() {
    const modal = document.getElementById('chess-modal');
    if (modal) {
        modal.style.display = 'flex';
        resetChessGame();
    } else {
        // 혹시 index.html에 아이디가 다르게 되어 있을 경우를 위한 예외 처리
        const alternativeModal = document.getElementById('go-modal');
        if (alternativeModal) {
            alternativeModal.style.display = 'flex';
            const title = alternativeModal.querySelector('.go-modal-title');
            if (title) title.innerText = "Chess Game";
            // 임시 플레이 보드 표시
            const boardEl = document.getElementById('go-board-grid');
            if (boardEl) boardEl.innerHTML = '<div style="color:white; padding:20px; text-align:center; grid-column: span 13;">🧩 체스 게임 준비 중 (모듈 연결 완료)</div>';
        }
    }
}

// 체스 모달 닫기
function closeChessGame() {
    const modal = document.getElementById('chess-modal') || document.getElementById('go-modal');
    if (modal) {
        modal.style.display = 'none';
    }
    chessGameActive = false;
}

function resetChessGame() {
    chessGameActive = true;
    console.log("Chess game initialized.");
}
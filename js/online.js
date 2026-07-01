/* ============================================================
   ICOC ONLINE — Supabase Realtime 1:1 멀티플레이어
   오목 / 바둑 / 체스 / 장기 / 쇼기 지원
   ============================================================ */
(function(global) {
  'use strict';

  let channel = null;
  let roomId  = null;
  let myRole  = null; // 'host' | 'guest'
  let myColor = null; // 'black' | 'white' (or piece color)
  let gameKey = null; // 'omok' | 'go' | 'chess' | 'janggi' | 'shogi'
  let sb      = null;
  let onMoveCallback  = null;
  let onStartCallback = null;
  let onEndCallback   = null;
  let isMyTurn        = false;
  let active          = false;
  let opponentNick    = '상대방';

  // ── 초기화 ──
  function init() {
    if (sb) return true; // 이미 초기화됨 (Multiple GoTrueClient 방지)
    const cfg = window.ICOC_CONFIG;
    if (!cfg || cfg.SUPABASE_URL === 'YOUR_SUPABASE_URL') return false;
    // config.js singleton 재사용 — createClient 절대 재호출 안 함
    if (window._ICOC_SB) { sb = window._ICOC_SB; return true; }
    // fallback
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON);
    window._ICOC_SB = sb;
    return true;
  }

  // ── 방 생성 (Host) ──
  async function createRoom(game, callbacks) {
    if (!init()) return alert('Supabase 연결 필요');
    gameKey = game;
    onMoveCallback  = callbacks.onMove;
    onStartCallback = callbacks.onStart;
    onEndCallback   = callbacks.onEnd;

    roomId = Math.random().toString(36).slice(2, 8).toUpperCase();
    myRole = 'host';
    myColor = 'black'; // host = 흑/선공

    // DB에 방 저장
    const user = window.ICOC_AUTH?.getCurrentUser();
    await sb.from('icoc_game_rooms').insert({
      id: roomId, game: gameKey,
      host_id: user?.id,
      host_nick: user?.email?.split('@')[0] || 'Player1',
      status: 'waiting',
      created_at: new Date().toISOString()
    });

    _subscribeChannel();
    return roomId;
  }

  // ── 방 참가 (Guest) ──
  async function joinRoom(code, callbacks) {
    if (!init()) { alert('로그인 후 멀티플레이가 가능합니다.'); return; }
    onMoveCallback  = callbacks.onMove;
    onStartCallback = callbacks.onStart;
    onEndCallback   = callbacks.onEnd;

    // DB에서 방 찾기
    let room, joinError;
    try {
      const result = await sb.from('icoc_game_rooms')
        .select('*').eq('id', code.toUpperCase()).eq('status','waiting').maybeSingle();
      room = result.data; joinError = result.error;
    } catch(e) {
      alert('연결 오류: ' + (e.message || '알 수 없는 오류')); return '오류';
    }
    if (joinError || !room) {
      const msg = joinError?.message?.includes('does not exist')
        ? '❌ icoc_game_rooms 테이블이 없습니다. Supabase SQL을 실행하세요.'
        : '방을 찾을 수 없습니다. 코드를 다시 확인하세요. (방이 꽉 찼거나 이미 시작됨)';
      return msg;
    }

    roomId  = room.id;
    gameKey = room.game;
    myRole  = 'guest';
    myColor = 'white'; // guest = 백/후공
    opponentNick = room.host_nick;

    // 방 상태 업데이트
    const user = window.ICOC_AUTH?.getCurrentUser();
    await sb.from('icoc_game_rooms').update({
      guest_id:   user?.id,
      guest_nick: user?.email?.split('@')[0] || 'Player2',
      status: 'playing'
    }).eq('id', roomId);

    _subscribeChannel();
    return null; // null = 성공
  }

  // ── 채널 구독 ──
  function _subscribeChannel() {
    channel = sb.channel('icoc-game-' + roomId, {
      config: { presence: { key: myRole } }
    });

    // Presence: 상대 입장 감지
    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      const others = newPresences.filter(p => p.phx_ref !== undefined);
      if (myRole === 'host' && others.length > 0) {
        isMyTurn = true; active = true;
        injectSurrenderBtn(); _setupAbandonDetection();
        if (onStartCallback) onStartCallback({ myColor, myRole, roomId });
        _showStatus('게임 시작! 당신의 차례 (흑)');
      } else if (myRole === 'guest') {
        isMyTurn = false; active = true;
        injectSurrenderBtn(); _setupAbandonDetection();
        if (onStartCallback) onStartCallback({ myColor, myRole, roomId });
        _showStatus('게임 시작! 상대 차례 기다리는 중...');
      }
    });

    // Broadcast: 상대 수 수신
    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      isMyTurn = true;
      if (onMoveCallback) onMoveCallback(payload);
      _showStatus('당신의 차례!');
    });

    // Broadcast: 항복
    channel.on('broadcast', { event: 'surrender' }, ({ payload }) => {
      active = false;
      applyPoints('SURRENDER_WIN', '상대 항복');
      document.getElementById('surrender-btn')?.remove();
      document.getElementById('online-turn-bar')?.remove();
      alert(`상대방이 항복했습니다! +${PTS.SURRENDER_WIN}P`);
      if (onEndCallback) onEndCallback({ winner: myRole, reason: 'surrender' });
      _cleanup();
    });

    // Broadcast: 게임 종료
    channel.on('broadcast', { event: 'end' }, ({ payload }) => {
      active = false;
      // 결과에 따라 포인트
      if (payload.reason !== 'abandon') {
        const won = payload.winner === myRole;
        applyPoints(won ? 'WIN' : 'LOSE', won ? '승리' : '패배');
      }
      document.getElementById('surrender-btn')?.remove();
      document.getElementById('online-turn-bar')?.remove();
      if (onEndCallback) onEndCallback(payload);
      _cleanup();
    });

    // Broadcast: 상대 연결 끊김
    channel.on('presence', { event: 'leave' }, () => {
      if (active) {
        _showStatus('⚠️ 상대방이 연결을 끊었습니다.');
        active = false;
        if (onEndCallback) onEndCallback({ winner: myRole, reason: 'disconnect' });
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: myRole, game: gameKey });
      }
    });
  }

  // ── 수 전송 ──
  function sendMove(payload) {
    if (!channel || !active) return;
    isMyTurn = false;
    channel.send({ type: 'broadcast', event: 'move', payload });
    _showStatus('상대방 차례...');
  }


  // ── 포인트 룰 ──
  const PTS = {
    WIN:       200,  // 승리
    LOSE:     -100,  // 패배
    SURRENDER_WIN:  200,  // 상대 항복 시 승리자
    SURRENDER_LOSE: -100, // 항복한 쪽
    ABANDON:  -100,  // 도망/연결끊김 (도망간 쪽)
  };

  // 포인트 적용 함수
  function applyPoints(result, reason) {
    const pts = PTS[result] || 0;
    if (pts === 0) return;
    if (window.ICOC_POINTS) {
      ICOC_POINTS.changePoints(pts, `[온라인 1:1] ${gameKey} ${reason}`);
    }
    // localStorage 기록
    try {
      const hist = JSON.parse(localStorage.getItem('icoc_history') || '[]');
      hist.unshift({
        sport: gameKey, icon:'🌐', won: pts > 0,
        pts, time: Date.now(), online: true, reason
      });
      localStorage.setItem('icoc_history', JSON.stringify(hist.slice(0, 50)));
    } catch(e) {}
    // Supabase 기록
    if (window.ICOC_AUTH?.recordGameResult) {
      ICOC_AUTH.recordGameResult(gameKey, pts > 0, Math.abs(pts));
    }
  }

  // ── 항복 버튼 주입 ──
  function injectSurrenderBtn() {
    if (document.getElementById('surrender-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'surrender-btn';
    btn.textContent = '🏳️ 항복';
    btn.title = `항복: 상대 +${PTS.SURRENDER_WIN}P / 나 ${PTS.SURRENDER_LOSE}P`;
    btn.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:1000;padding:8px 20px;background:rgba(248,113,113,0.12);border:1px solid rgba(248,113,113,0.3);border-radius:20px;color:#f87171;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;backdrop-filter:blur(8px);';
    btn.onclick = () => {
      if (!confirm('정말 항복하시겠습니까? 상대에게 +200P, 나에게 -100P')) return;
      channel?.send({ type:'broadcast', event:'surrender', payload:{ by: myRole } });
      applyPoints('SURRENDER_LOSE', '항복');
      active = false;
      btn.remove();
      document.getElementById('online-turn-bar')?.remove();
      alert(`항복했습니다. ${PTS.SURRENDER_LOSE}P`);
      _cleanup();
    };
    document.body.appendChild(btn);
  }

  // ── 페이지 이탈 감지 (도망 패널티) ──
  function _setupAbandonDetection() {
    const handleLeave = (e) => {
      if (!active) return;
      // 도망: 즉시 -100P (비동기로 Supabase에 저장)
      applyPoints('ABANDON', '연결끊김/도망');
      channel?.send({ type:'broadcast', event:'end', payload:{ winner: myRole==='host'?'guest':'host', reason:'abandon' } });
    };
    window.addEventListener('beforeunload', handleLeave);
    window.addEventListener('pagehide', handleLeave);
  }

  // ── 게임 종료 전송 ──
  function sendEnd(winner) {
    if (!channel) return;
    active = false;
    channel.send({ type: 'broadcast', event: 'end', payload: { winner, game: gameKey } });
    _cleanup();
  }

  // ── 방 목록 조회 ──
  async function listRooms(game) {
    if (!sb && !init()) return [];
    const { data } = await sb.from('icoc_game_rooms')
      .select('*').eq('game', game).eq('status','waiting')
      .order('created_at', { ascending: false }).limit(10);
    return data || [];
  }

  // ── 정리 ──
  function _cleanup() {
    if (channel) { sb.removeChannel(channel); channel = null; }
    if (roomId) {
      sb.from('icoc_game_rooms').update({ status:'finished' }).eq('id', roomId);
      roomId = null;
    }
    active = false;
  }

  function _showStatus(msg) {
    const el = document.getElementById('online-status-bar');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  // ── 매치메이킹 UI 주입 ──
  function injectMatchmakingUI(gameModal, gameKey) {
    const existing = document.getElementById('online-panel');
    if (existing) existing.remove();

    const panel = document.createElement('div');
    panel.id = 'online-panel';
    panel.style.cssText = `
      position:absolute; top:0; left:0; right:0; bottom:0;
      background:rgba(8,20,44,0.97); z-index:200;
      display:flex; flex-direction:column; align-items:center; justify-content:center;
      gap:14px; padding:24px; border-radius:16px;
      overflow-y:auto;
    `;
    panel.innerHTML = `
      <div style="font-size:24px;">🌐</div>
      <h3 style="color:#E8C97A;font-size:18px;margin:0;">온라인 1:1 대전</h3>
      <p style="color:rgba(245,240,232,0.6);font-size:13px;text-align:center;margin:0;">
        친구에게 방 코드를 알려주거나,<br>코드를 입력해서 입장하세요.
      </p>

      <div style="display:flex;gap:10px;width:100%;max-width:320px;">
        <button id="btn-create-room" style="flex:1;padding:12px;background:rgba(201,168,76,0.12);border:1px solid rgba(201,168,76,0.4);border-radius:10px;color:#E8C97A;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">
          🏠 방 만들기
        </button>
        <button id="btn-join-panel" style="flex:1;padding:12px;background:rgba(74,222,128,0.08);border:1px solid rgba(74,222,128,0.3);border-radius:10px;color:#4ade80;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">
          🚪 입장하기
        </button>
      </div>

      <div id="join-code-area" style="display:none;flex-direction:column;gap:8px;width:100%;max-width:320px;">
        <input id="room-code-input" type="text" placeholder="방 코드 입력 (예: AB12CD)"
          style="padding:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(201,168,76,0.3);border-radius:10px;color:#F5F0E8;font-size:16px;text-align:center;letter-spacing:.2em;font-family:monospace;text-transform:uppercase;outline:none;width:100%;box-sizing:border-box;">
        <button id="btn-join-room" style="padding:12px;background:rgba(74,222,128,0.15);border:1px solid rgba(74,222,128,0.4);border-radius:10px;color:#4ade80;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">
          입장 →
        </button>
      </div>

      <div id="room-created-area" style="display:none;flex-direction:column;align-items:center;gap:8px;">
        <p style="color:rgba(245,240,232,0.6);font-size:12px;margin:0;">방 코드를 친구에게 알려주세요</p>
        <div id="room-code-display" style="font-size:32px;font-weight:900;letter-spacing:.3em;color:#C9A84C;font-family:monospace;background:rgba(201,168,76,0.08);padding:12px 24px;border-radius:12px;border:1px solid rgba(201,168,76,0.3);cursor:pointer;" title="클릭해서 복사"></div>
        <p style="color:rgba(245,240,232,0.4);font-size:11px;margin:0;">상대방 기다리는 중... ⏳</p>
      </div>

      <div id="online-status-bar" style="display:none;background:rgba(74,222,128,0.1);border:1px solid rgba(74,222,128,0.3);border-radius:8px;padding:8px 16px;color:#4ade80;font-size:13px;font-weight:600;"></div>

      <div style="display:flex;gap:8px;">
        <button onclick="document.getElementById('online-panel').remove()" style="padding:8px 16px;background:none;border:1px solid rgba(245,240,232,0.15);border-radius:8px;color:rgba(245,240,232,0.4);font-size:12px;cursor:pointer;font-family:inherit;">취소</button>
      </div>
    `;

    // game-modal-box에 패널 붙이기 (overlay가 아닌 내부 박스)
    const modalBox = gameModal.querySelector('.game-modal-box') || gameModal;
    modalBox.style.position = 'relative';
    modalBox.appendChild(panel);

    // 이벤트
    panel.querySelector('#btn-create-room').addEventListener('click', async () => {
      panel.querySelector('#btn-create-room').disabled = true;
      panel.querySelector('#btn-join-panel').style.display = 'none';
      const code = await ICOC_ONLINE.createRoom(gameKey, _getGameCallbacks(gameKey));
      if (code) {
        panel.querySelector('#room-created-area').style.display = 'flex';
        const disp = panel.querySelector('#room-code-display');
        disp.textContent = code;
        disp.onclick = () => {
          navigator.clipboard.writeText(code);
          disp.style.color = '#4ade80';
          setTimeout(() => disp.style.color = '#C9A84C', 800);
        };
      }
    });

    panel.querySelector('#btn-join-panel').addEventListener('click', () => {
      panel.querySelector('#join-code-area').style.display = 'flex';
    });

    panel.querySelector('#btn-join-room').addEventListener('click', async () => {
      const code = panel.querySelector('#room-code-input').value.trim().toUpperCase();
      if (!code || code.length < 4) return alert('방 코드를 입력하세요');
      const err = await ICOC_ONLINE.joinRoom(code, _getGameCallbacks(gameKey));
      if (err) return alert(err);
      _showStatus('연결 중...');
    });
  }

  // ── 각 게임별 콜백 반환 ──
  function _getGameCallbacks(key) {
    return {
      onStart: ({ myColor, myRole, roomId }) => {
        const panel = document.getElementById('online-panel');
        if (panel) {
          panel.style.opacity = '0';
          panel.style.pointerEvents = 'none';
          setTimeout(() => panel.remove(), 600);
        }
        _showTurnIndicator(myRole === 'host');
      },
      onMove: (payload) => {
        // 각 게임 전역 함수 호출
        const fns = {
          omok:   () => window.OmokGame?.applyOpponentMove?.(payload),
          go:     () => window.GoGame?.applyOpponentMove?.(payload),
          chess:  () => window.ChessGame?.applyOpponentMove?.(payload),
          janggi: () => window.JanggiGame?.applyOpponentMove?.(payload),
          shogi:  () => window.ShogiGame?.applyOpponentMove?.(payload),
        };
        if (fns[key]) fns[key]();
      },
      onEnd: (payload) => {
        const msg = payload.reason === 'disconnect'
          ? '상대방 연결 끊김 — 부전승!'
          : payload.winner === myRole ? '🎉 승리!' : '😔 패배';
        alert(msg);
      }
    };
  }

  function _showTurnIndicator(isMyTurn) {
    let bar = document.getElementById('online-turn-bar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'online-turn-bar';
      bar.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:2000;padding:6px 18px;border-radius:20px;font-size:12px;font-weight:700;transition:all .3s;';
      document.body.appendChild(bar);
    }
    bar.style.background = isMyTurn ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.12)';
    bar.style.border = isMyTurn ? '1px solid rgba(74,222,128,0.4)' : '1px solid rgba(248,113,113,0.3)';
    bar.style.color  = isMyTurn ? '#4ade80' : '#f87171';
    bar.textContent  = isMyTurn ? '🟢 당신의 차례' : '🔴 상대방 차례';
  }


  // ── AI 플레이 중 백그라운드 방 생성 (상대 기다리기) ──
  async function createRoomInBackground(game, callbacks) {
    if (!init()) return;
    gameKey = game;
    onMoveCallback  = callbacks.onMove;
    onStartCallback = callbacks.onStart;
    onEndCallback   = callbacks.onEnd;
    myRole  = 'host';
    myColor = 'black';
    roomId  = Math.random().toString(36).slice(2, 8).toUpperCase();

    const user = window.ICOC_AUTH?.getCurrentUser();
    if (!user) return;

    await sb.from('icoc_game_rooms').insert({
      id: roomId, game,
      host_id:   user.id,
      host_nick: user.email?.split('@')[0] || 'Player',
      status: 'waiting',
      created_at: new Date().toISOString()
    });

    // 조용히 채널 구독 (UI 없이)
    channel = sb.channel('icoc-game-' + roomId, {
      config: { presence: { key: 'host' } }
    });

    channel.on('presence', { event: 'join' }, ({ newPresences }) => {
      const guests = newPresences.filter(p => p.role === 'guest');
      if (guests.length > 0 && !active) {
        // 🎯 상대 입장! AI → 사람 전환
        active   = true;
        isMyTurn = true;
        opponentNick = guests[0].nick || '상대방';
        _showHandoffNotice(opponentNick);
        if (onStartCallback) onStartCallback({ myColor: 'black', myRole: 'host', roomId, handoff: true });
      }
    });

    channel.on('broadcast', { event: 'move' }, ({ payload }) => {
      isMyTurn = true;
      if (onMoveCallback) onMoveCallback(payload);
      _showStatus(`${opponentNick}의 수 — 당신 차례!`);
    });

    channel.on('broadcast', { event: 'end' }, ({ payload }) => {
      active = false;
      if (onEndCallback) onEndCallback(payload);
      _cleanup();
    });

    channel.on('presence', { event: 'leave' }, () => {
      if (active) {
        active = false;
        _showStatus('상대방 연결 끊김');
        if (onEndCallback) onEndCallback({ winner: 'host', reason: 'disconnect' });
      }
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: 'host', game, nick: user.email?.split('@')[0] });
        // 화면 오른쪽 하단에 작은 방 코드 배지 표시
        _showRoomCodeBadge(roomId);
      }
    });
  }

  // AI 게임 중 방 코드 배지
  function _showRoomCodeBadge(code) {
    let badge = document.getElementById('online-room-badge');
    if (!badge) {
      badge = document.createElement('div');
      badge.id = 'online-room-badge';
      badge.style.cssText = 'position:fixed;bottom:70px;right:12px;z-index:500;background:rgba(8,20,44,0.9);border:1px solid rgba(201,168,76,0.3);border-radius:10px;padding:6px 12px;font-size:11px;cursor:pointer;backdrop-filter:blur(10px);';
      badge.title = '클릭해서 코드 복사';
      badge.onclick = () => {
        navigator.clipboard.writeText(code);
        badge.style.borderColor = 'rgba(74,222,128,0.5)';
        setTimeout(() => badge.style.borderColor = 'rgba(201,168,76,0.3)', 800);
      };
      document.body.appendChild(badge);
    }
    badge.innerHTML = `<span style="color:rgba(245,240,232,0.5);">🌐 대전 코드 </span><span style="color:#E8C97A;font-weight:700;letter-spacing:.1em;">${code}</span>`;
  }

  // 상대 입장 알림 (핸드오프)
  function _showHandoffNotice(nick) {
    const notice = document.createElement('div');
    notice.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2000;background:rgba(8,20,44,0.97);border:1px solid rgba(74,222,128,0.4);border-radius:16px;padding:24px 32px;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,.6);';
    notice.innerHTML = `
      <div style="font-size:32px;margin-bottom:8px;">🌐</div>
      <div style="color:#4ade80;font-size:16px;font-weight:700;margin-bottom:4px;">${nick}님이 입장!</div>
      <div style="color:rgba(245,240,232,0.6);font-size:13px;">AI → 1:1 대전으로 전환됩니다</div>`;
    document.body.appendChild(notice);
    setTimeout(() => { notice.style.opacity='0'; notice.style.transition='opacity .5s'; setTimeout(()=>notice.remove(),500); }, 2500);

    // 방 코드 배지 제거
    document.getElementById('online-room-badge')?.remove();
  }

  global.ICOC_ONLINE = {
    createRoom, joinRoom, sendMove, sendEnd,
    createRoomInBackground, listRooms, injectMatchmakingUI,
    get active()   { return active; },
    get isMyTurn() { return isMyTurn; },
    get myColor()  { return myColor; },
    get myRole()   { return myRole; },
    showTurnIndicator: _showTurnIndicator,
  };

})(window);

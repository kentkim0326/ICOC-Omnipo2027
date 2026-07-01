/* ============================================================
   ICOC OMNIPO — SFX Engine (Web Audio API, 파일 불필요)
   모든 게임에서 공통으로 사용하는 사운드 모듈
   ============================================================ */
(function(global) {
  'use strict';

  const MUTE_KEY = 'icoc_sfx_muted';
  let ctx = null;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  function getCtx() {
    if (!ctx) {
      try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
    }
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  /* ── 기본 합성기 ── */
  function playTone(freq, type, duration, volume, delay, fadeOut) {
    const c = getCtx(); if (!c || muted) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain); gain.connect(c.destination);
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime + (delay||0));
    gain.gain.setValueAtTime(volume||0.3, c.currentTime + (delay||0));
    if (fadeOut !== false) {
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay||0) + duration);
    }
    osc.start(c.currentTime + (delay||0));
    osc.stop(c.currentTime + (delay||0) + duration + 0.05);
  }

  function playNoise(duration, volume, delay) {
    const c = getCtx(); if (!c || muted) return;
    const buf = c.createBuffer(1, c.sampleRate * duration, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    src.connect(gain); gain.connect(c.destination);
    gain.gain.setValueAtTime(volume||0.2, c.currentTime + (delay||0));
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (delay||0) + duration);
    src.start(c.currentTime + (delay||0));
  }

  /* ── 사운드 팔레트 ── */
  const SFX = {

    // 바둑돌 놓기: 나무 바둑판에 탁! 하는 소리
    stone() {
      playNoise(0.06, 0.4);
      playTone(800,  'square',  0.04, 0.15);
      playTone(1200, 'sine',    0.03, 0.08, 0.01);
    },

    // 장기/체스 말 이동
    piece() {
      playNoise(0.05, 0.3);
      playTone(600, 'square', 0.05, 0.12);
    },

    // 카드 놓기 (홀덤, 고스톱, 브릿지 등)
    card() {
      playNoise(0.04, 0.2);
      playTone(500,  'triangle', 0.06, 0.1);
      playTone(700,  'sine',     0.04, 0.06, 0.02);
    },

    // 카드 뒤집기
    flip() {
      playTone(400, 'sawtooth', 0.05, 0.1);
      playTone(600, 'sine',     0.04, 0.08, 0.03);
    },

    // 버튼/UI 클릭
    click() {
      playTone(1000, 'square', 0.03, 0.1);
    },

    // 볼링 투구
    bowl() {
      playTone(180, 'sawtooth', 0.3,  0.25);
      playTone(120, 'sine',     0.25, 0.15, 0.05);
    },

    // 볼링 핀 쓰러짐
    pins() {
      playNoise(0.4, 0.5);
      playTone(200, 'sawtooth', 0.2, 0.2);
      playTone(150, 'triangle', 0.3, 0.15, 0.05);
    },

    // 이기면 신나는 팡파레
    win() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((f, i) => playTone(f, 'sine', 0.22, 0.28, i * 0.14));
      playTone(1047, 'sine', 0.4, 0.35, notes.length * 0.14);
      // 화음
      setTimeout(() => {
        playTone(523,  'sine', 0.5, 0.2);
        playTone(659,  'sine', 0.5, 0.18);
        playTone(784,  'sine', 0.5, 0.16);
        playTone(1047, 'sine', 0.5, 0.22);
      }, 700);
    },

    // 지면 슬픈 사운드
    lose() {
      playTone(440, 'sine',     0.35, 0.2);
      playTone(370, 'sine',     0.35, 0.18, 0.28);
      playTone(330, 'sine',     0.35, 0.16, 0.56);
      playTone(294, 'triangle', 0.5,  0.2,  0.84);
    },

    // 무승부
    draw() {
      playTone(440, 'sine', 0.2, 0.15);
      playTone(440, 'sine', 0.2, 0.12, 0.25);
    },

    // 포획/잡기
    capture() {
      playNoise(0.08, 0.3);
      playTone(300, 'sawtooth', 0.1, 0.2);
    },

    // 단수(아타리) 경고
    atari() {
      playTone(880, 'square', 0.08, 0.15);
      playTone(660, 'square', 0.08, 0.12, 0.09);
    },

    // 패스
    pass() {
      playTone(440, 'triangle', 0.12, 0.1);
    },
  };

  /* ── 음소거 토글 UI ── */
  function buildToggleBtn() {
    // 게임 모달 내 사운드 버튼 (게임이 열릴 때마다 갱신)
    const existing = document.getElementById('sfx-toggle-btn');
    if (existing) { updateBtn(existing); return existing; }
    const btn = document.createElement('button');
    btn.id = 'sfx-toggle-btn';
    btn.title = '사운드 ON/OFF';
    btn.style.cssText = `
      position:fixed; bottom:24px; right:20px; z-index:9000;
      width:40px; height:40px; border-radius:50%;
      background:rgba(11,31,58,0.9); border:1px solid rgba(201,168,76,0.35);
      display:flex; align-items:center; justify-content:center;
      font-size:18px; cursor:pointer; backdrop-filter:blur(8px);
      transition:all .2s; box-shadow:0 2px 12px rgba(0,0,0,0.3);
    `;
    updateBtn(btn);
    btn.addEventListener('click', () => {
      muted = !muted;
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
      updateBtn(btn);
      if (!muted) SFX.click();
    });
    document.body.appendChild(btn);
    return btn;
  }

  function updateBtn(btn) {
    btn.textContent = muted ? '🔇' : '🔊';
    btn.style.opacity = muted ? '0.55' : '1';
  }

  function isMuted() { return muted; }

  document.addEventListener('DOMContentLoaded', buildToggleBtn);

  global.ICOC_SFX = { ...SFX, isMuted, buildToggleBtn };

})(window);

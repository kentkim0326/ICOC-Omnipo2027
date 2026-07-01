/* ============================================================
   ICOC OMNIPO — 20개 언어 토글 (국기 포함)
   ============================================================ */

(function(global) {
  'use strict';

  const LANGS = [
    { code:'ko', flag:'🇰🇷', label:'한국어',    short:'KO' },
    { code:'en', flag:'🇺🇸', label:'English',   short:'EN' },
    { code:'zh', flag:'🇨🇳', label:'中文',      short:'ZH' },
    { code:'ja', flag:'🇯🇵', label:'日本語',    short:'JA' },
    { code:'es', flag:'🇪🇸', label:'Español',   short:'ES' },
    { code:'fr', flag:'🇫🇷', label:'Français',  short:'FR' },
    { code:'de', flag:'🇩🇪', label:'Deutsch',   short:'DE' },
    { code:'pt', flag:'🇧🇷', label:'Português', short:'PT' },
    { code:'ru', flag:'🇷🇺', label:'Русский',   short:'RU' },
    { code:'ar', flag:'🇸🇦', label:'العربية',  short:'AR' },
    { code:'hi', flag:'🇮🇳', label:'हिन्दी',   short:'HI' },
    { code:'vi', flag:'🇻🇳', label:'Tiếng Việt',short:'VI' },
    { code:'th', flag:'🇹🇭', label:'ภาษาไทย',  short:'TH' },
    { code:'id', flag:'🇮🇩', label:'Indonesia', short:'ID' },
    { code:'ms', flag:'🇲🇾', label:'Melayu',    short:'MS' },
    { code:'tr', flag:'🇹🇷', label:'Türkçe',   short:'TR' },
    { code:'nl', flag:'🇳🇱', label:'Nederlands',short:'NL' },
    { code:'pl', flag:'🇵🇱', label:'Polski',    short:'PL' },
    { code:'sv', flag:'🇸🇪', label:'Svenska',   short:'SV' },
    { code:'it', flag:'🇮🇹', label:'Italiano',  short:'IT' },
  ];

  const SAVED_KEY = 'icoc_lang';

  /* ── DOM 주입 ── */
  function injectStyles() {
    if (document.getElementById('lang-toggle-style')) return;
    const s = document.createElement('style');
    s.id = 'lang-toggle-style';
    s.textContent = `
      .lang-toggle-wrap { position:relative; display:flex; align-items:center; }

      .lang-trigger {
        display:flex; align-items:center; gap:5px;
        padding:5px 12px 5px 8px;
        border:1px solid rgba(201,168,76,0.3);
        border-radius:20px;
        background:rgba(201,168,76,0.06);
        color:rgba(245,240,232,0.85);
        font-size:12px; font-weight:600; letter-spacing:0.04em;
        cursor:pointer; transition:all 0.2s;
        white-space:nowrap; user-select:none;
        font-family:inherit;
      }
      .lang-trigger:hover { border-color:rgba(201,168,76,0.6); background:rgba(201,168,76,0.12); color:#E8C97A; }
      .lang-trigger .lt-flag { font-size:16px; line-height:1; }
      .lang-trigger .lt-code { font-size:11px; }
      .lang-trigger .lt-caret { font-size:9px; opacity:0.5; transition:transform 0.2s; }
      .lang-toggle-wrap.open .lt-caret { transform:rotate(180deg); }

      /* Dropdown */
      .lang-dropdown {
        position:absolute; top:calc(100% + 8px); right:0;
        min-width:180px;
        background:rgba(10,28,55,0.98);
        border:1px solid rgba(201,168,76,0.25);
        border-radius:12px;
        box-shadow:0 12px 40px rgba(0,0,0,0.5);
        backdrop-filter:blur(20px);
        padding:6px;
        display:grid; grid-template-columns:1fr 1fr;
        gap:2px;
        opacity:0; pointer-events:none;
        transform:translateY(-6px);
        transition:opacity 0.18s, transform 0.18s;
        z-index:2000;
        max-height:360px; overflow-y:auto;
      }
      .lang-dropdown::-webkit-scrollbar { width:3px; }
      .lang-dropdown::-webkit-scrollbar-thumb { background:rgba(201,168,76,0.25); border-radius:2px; }
      .lang-toggle-wrap.open .lang-dropdown { opacity:1; pointer-events:all; transform:translateY(0); }

      .lang-option {
        display:flex; align-items:center; gap:7px;
        padding:7px 10px; border-radius:8px;
        cursor:pointer; transition:background 0.15s;
        text-decoration:none;
      }
      .lang-option:hover { background:rgba(201,168,76,0.12); }
      .lang-option.active { background:rgba(201,168,76,0.18); }
      .lang-option .lo-flag { font-size:18px; line-height:1; }
      .lang-option .lo-label { font-size:11px; font-weight:500; color:rgba(245,240,232,0.8); white-space:nowrap; }
      .lang-option.active .lo-label { color:#E8C97A; font-weight:700; }
    `;
    document.head.appendChild(s);
  }

  function buildWidget(targetEl) {
    injectStyles();

    const saved = localStorage.getItem(SAVED_KEY) || 'ko';
    const current = LANGS.find(l=>l.code===saved) || LANGS[0];

    const wrap = document.createElement('div');
    wrap.className = 'lang-toggle-wrap';

    // Trigger button
    const trigger = document.createElement('button');
    trigger.className = 'lang-trigger';
    trigger.type = 'button';
    trigger.innerHTML = `<span class="lt-flag">${current.flag}</span><span class="lt-code">${current.short}</span><span class="lt-caret">▼</span>`;

    // Dropdown
    const dd = document.createElement('div');
    dd.className = 'lang-dropdown';
    LANGS.forEach(l => {
      const opt = document.createElement('div');
      opt.className = 'lang-option' + (l.code===saved?' active':'');
      opt.dataset.code = l.code;
      opt.innerHTML = `<span class="lo-flag">${l.flag}</span><span class="lo-label">${l.label}</span>`;
      opt.addEventListener('click', () => selectLang(l, wrap, trigger, dd));
      dd.appendChild(opt);
    });

    wrap.appendChild(trigger);
    wrap.appendChild(dd);

    // Toggle open/close
    trigger.addEventListener('click', e => {
      e.stopPropagation();
      wrap.classList.toggle('open');
    });
    document.addEventListener('click', () => wrap.classList.remove('open'));

    targetEl.replaceWith(wrap);
    return wrap;
  }

  function selectLang(lang, wrap, trigger, dd) {
    localStorage.setItem(SAVED_KEY, lang.code);
    trigger.innerHTML = `<span class="lt-flag">${lang.flag}</span><span class="lt-code">${lang.short}</span><span class="lt-caret">▼</span>`;
    dd.querySelectorAll('.lang-option').forEach(o => o.classList.toggle('active', o.dataset.code===lang.code));
    wrap.classList.remove('open');
    // 기존 setLang 함수 호출 (index.html에 정의된 i18n)
    if (typeof global.setLang === 'function') {
      global.setLang(lang.code);
    } else {
      document.body.className = lang.code==='ko'?'':`lang-${lang.code}`;
      document.documentElement.lang = lang.code;
    }
  }

  /* ── 초기화: lang-btns div를 교체 ── */
  function init() {
    const existing = document.querySelector('.lang-btns');
    if (existing) {
      buildWidget(existing);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
  global.ICOC_LANG = { init, LANGS };

})(window);

/* ==========================================================
   우리 딸, 스무 살 — UI 로직
   ========================================================== */
(function () {
  'use strict';

  const E = window.PMEngine;
  if (!E) { document.body.innerHTML = '<p style="padding:24px">게임 엔진을 불러오지 못했어요.</p>'; return; }

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = E.clamp;
  const fmt = (n) => Number(n).toLocaleString('ko-KR');

  const SAVE_KEY = 'pm2026.save.v3';
  const ENDINGS_KEY = 'pm2026.endings.v3';
  const SOUND_KEY = 'pm2026.sound.v1';
  const SUGGEST_NAMES = ['서연', '하윤', '지우', '채원', '수아', '예린', '다온', '윤서', '가은', '민서'];

  let state = null;
  let setup = { name: SUGGEST_NAMES[0], blood: 'A', tempo: 'quarter' };
  let pickerSlot = 0;
  let pickerTab = 'class';
  let busy = false;

  /* ==========================================================
     사운드 (Web Audio API)
     ========================================================== */
  const Sound = {
    ctx: null, master: null, timer: null, step: 0,
    enabled: localStorage.getItem(SOUND_KEY) !== 'off',
    init() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.5;
        this.master.connect(this.ctx.destination);
      } catch (e) { return false; }
      return true;
    },
    resume() {
      if (this.ctx && this.ctx.state === 'suspended') { this.ctx.resume().catch(() => {}); }
    },
    tone(freq, dur, opts) {
      if (!this.enabled || !this.init()) return;
      const o = opts || {};
      const t = this.ctx.currentTime + (o.delay || 0);
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = o.type || 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(o.vol || 0.1, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.04);
    },
    sfx(name) {
      if (!this.enabled) return;
      switch (name) {
        case 'click': this.tone(680, 0.08, { type: 'triangle', vol: 0.05 }); break;
        case 'open': this.tone(520, 0.12, { vol: 0.07 }); this.tone(780, 0.16, { vol: 0.05, delay: 0.06 }); break;
        case 'ok': this.tone(587, 0.12, { type: 'triangle', vol: 0.07 }); this.tone(880, 0.2, { type: 'triangle', vol: 0.05, delay: 0.1 }); break;
        case 'great': [660, 830, 1100].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', vol: 0.06, delay: i * 0.09 })); break;
        case 'fail': this.tone(300, 0.18, { type: 'sawtooth', vol: 0.04 }); this.tone(210, 0.3, { type: 'sawtooth', vol: 0.04, delay: 0.12 }); break;
        case 'coin': this.tone(988, 0.09, { type: 'square', vol: 0.035 }); this.tone(1318, 0.15, { type: 'square', vol: 0.035, delay: 0.07 }); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.32, { type: 'triangle', vol: 0.07, delay: i * 0.13 })); break;
        default: break;
      }
    },
    startBgm() {
      if (!this.enabled || this.timer) return;
      if (!this.init()) return;
      this.resume();
      this.step = 0;
      const melody = [523.25, 659.25, 783.99, 659.25, 587.33, 698.46, 880.0, 698.46,
        523.25, 659.25, 783.99, 987.77, 880.0, 698.46, 587.33, 523.25];
      const bass = [130.81, 174.61, 146.83, 196.0];
      this.timer = setInterval(() => {
        if (!this.enabled) return;
        const i = this.step % melody.length;
        this.tone(melody[i], 0.95, { vol: 0.028 });
        if (i % 4 === 0) this.tone(bass[(this.step / 4 | 0) % bass.length], 1.7, { vol: 0.032 });
        this.step++;
      }, 540);
    },
    stopBgm() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },
    toggle() {
      this.enabled = !this.enabled;
      localStorage.setItem(SOUND_KEY, this.enabled ? 'on' : 'off');
      if (this.enabled) { this.sfx('open'); this.startBgm(); } else { this.stopBgm(); }
      updateSoundBtn();
      toast(this.enabled ? '소리를 켰어요' : '소리를 껐어요');
    },
  };

  function updateSoundBtn() {
    const b = $('#btn-sound');
    if (!b) return;
    b.textContent = Sound.enabled ? '🔊' : '🔇';
    b.setAttribute('aria-label', Sound.enabled ? '소리 끄기' : '소리 켜기');
  }

  /* ==========================================================
     저장
     ========================================================== */
  function save() {
    if (!state) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { /* 저장 공간 부족 등 무시 */ }
  }
  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || !s.stats || !s.name) return null;
      return s;
    } catch (e) { return null; }
  }
  function loadEndings() {
    try {
      const raw = localStorage.getItem(ENDINGS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function unlockEnding(id) {
    const arr = loadEndings();
    if (arr.some((x) => x.id === id)) return false;
    arr.push({ id: id, name: state ? state.name : '', date: new Date().toISOString().slice(0, 10) });
    try { localStorage.setItem(ENDINGS_KEY, JSON.stringify(arr)); } catch (e) { /* ignore */ }
    return true;
  }

  /* ==========================================================
     화면 전환 · 토스트
     ========================================================== */
  const SCREENS = ['title', 'setup', 'game', 'ending', 'collection'];
  function show(name) {
    SCREENS.forEach((n) => {
      const el = document.getElementById('screen-' + n);
      if (el) el.classList.toggle('is-active', n === name);
    });
    window.scrollTo(0, 0);
  }

  function toast(msg, kind) {
    const root = $('#toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 320);
    }, 2300);
  }

  /* ==========================================================
     타이틀 · 설정
     ========================================================== */
  function refreshTitle() {
    const save = readSave();
    const btn = $('#btn-continue');
    btn.disabled = !save;
    btn.style.opacity = save ? '1' : '.45';
    btn.textContent = save ? '이어하기 · ' + save.name : '이어하기';
    const count = $('#collection-count');
    const uniq = new Set(loadEndings().map((x) => x.id));
    count.textContent = uniq.size + '/' + E.ENDINGS.length;
  }

  function renderSetup() {
    $('#suggest-name').textContent = SUGGEST_NAMES[0];
    const nameInput = $('#input-name');
    if (!nameInput.value) nameInput.value = setup.name;

    const grid = $('#blood-grid');
    grid.innerHTML = '';
    const traits = { A: '계획형', B: '감각형', O: '활발형', AB: '분석형' };
    ['A', 'B', 'O', 'AB'].forEach((k) => {
      const b = E.BLOOD[k];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'blood-btn' + (setup.blood === k ? ' is-on' : '');
      btn.innerHTML = b.label + '<small>' + traits[k] + '</small>';
      btn.addEventListener('click', () => {
        setup.blood = k;
        Sound.sfx('click');
        renderSetup();
      });
      grid.appendChild(btn);
    });
    const b = E.BLOOD[setup.blood];
    const bonusText = Object.keys(b.bonus).map((key) => E.STAT_META[key].label + ' +' + b.bonus[key]).join(' · ');
    $('#blood-desc').textContent = b.desc + ' · ' + bonusText;

    const tlist = $('#tempo-list');
    tlist.innerHTML = '';
    Object.keys(E.TEMPO).forEach((key) => {
      const t = E.TEMPO[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tempo-btn' + (setup.tempo === key ? ' is-on' : '');
      btn.innerHTML = '<span class="tempo-emoji">' + (key === 'quarter' ? '🗓️' : '📅') + '</span>' +
        '<span class="tempo-body"><b>' + t.label + '</b><span>' + t.desc + '</span></span>';
      btn.addEventListener('click', () => {
        setup.tempo = key;
        Sound.sfx('click');
        renderSetup();
      });
      tlist.appendChild(btn);
    });

    // 시작 능력치 미리보기
    const preview = E.newState(setup.name, setup.blood, setup.tempo);
    const pp = E.periodInfo(preview);
    const statsHtml = E.STAT_KEYS.map((k) => {
      const m = E.STAT_META[k];
      return '<span>' + m.icon + ' ' + m.label + ' ' + preview.stats[k] + '</span>';
    }).join('');
    $('#setup-preview').innerHTML = '<span class="preview-title">시작 능력치 · ' + pp.age + '세 ' + pp.grade + ' · 보유 자산 ' + preview.money + '만 원</span><div class="preview-stats">' + statsHtml + '</div>';
  }

  function startGame() {
    const input = $('#input-name');
    const name = (input.value || '').trim().slice(0, 10) || SUGGEST_NAMES[0];
    state = E.newState(name, setup.blood, setup.tempo);
    state.recentEvents = [];
    save();
    enterGame();
  }

  function enterGame() {
    if (!Array.isArray(state.recentEvents)) state.recentEvents = [];
    show('game');
    buildStats();
    renderAll();
    Sound.startBgm();
    toast(state.name + ', 10살의 봄이 시작됐어요', 'good');
  }

  /* ==========================================================
     게임 화면 렌더링
     ========================================================== */
  function buildStats() {
    const wrap = $('#stats');
    if (!wrap) return;
    wrap.innerHTML = '';
    E.STAT_KEYS.forEach((k) => {
      const m = E.STAT_META[k];
      const el = document.createElement('div');
      el.className = 'stat';
      el.dataset.key = k;
      el.style.setProperty('--c', m.color);
      el.innerHTML = '<div class="stat-top"><span class="ico">' + m.icon + '</span><span>' + m.label + '</span>' +
        '<span class="stat-val" data-v="0">0</span></div><div class="bar"><i></i></div>';
      wrap.appendChild(el);
    });
  }

  function renderStats(animate) {
    if (!state) return;
    E.STAT_KEYS.forEach((k) => {
      const el = $('.stat[data-key="' + k + '"]');
      if (!el) return;
      const v = state.stats[k];
      const valEl = el.querySelector('.stat-val');
      const prev = Number(valEl.dataset.v || 0);
      valEl.textContent = v;
      valEl.dataset.v = v;
      el.querySelector('.bar i').style.width = Math.min(100, (v / 200) * 100) + '%';
      if (animate && v !== prev) {
        el.classList.remove('bump', 'bump-down');
        void el.offsetWidth;
        el.classList.add(v > prev ? 'bump' : 'bump-down');
      }
    });
  }

  function stressMood(st) {
    if (st >= 85) return '지금 꼭 안아줘야 해요';
    if (st >= 65) return '많이 지쳐 보여요';
    if (st >= 45) return '조금 피곤해 보여요';
    if (st >= 25) return '평범한 하루를 보내고 있어요';
    return '마음이 편안해 보여요';
  }

  function renderPortrait() {
    const p = E.periodInfo(state);
    $('#hud-date').textContent = p.label + ' ' + p.emoji;
    $('#hud-grade').textContent = p.grade;
    $('#hud-age').textContent = p.age + '살';
    $('#hud-money').textContent = fmt(state.money);
    $('#life-fill').style.width = Math.round(p.progress * 100) + '%';

    $('#daughter-name').textContent = state.name;
    $('#portrait-age').textContent = p.age;
    const img = $('#portrait-img');
    const src = p.age >= 14 ? 'assets/daughter-adult.jpg' : 'assets/daughter-child.jpg';
    if (img.getAttribute('src') !== src) img.setAttribute('src', src);
    img.style.filter = state.stress >= 80 ? 'saturate(.8) brightness(.97)' : 'none';

    $('#mood-text').textContent = stressMood(state.stress);
    $('#stress-val').textContent = state.stress;
    const fill = $('#stress-fill');
    fill.style.width = state.stress + '%';
    $('#stress-note').textContent = state.stress >= 85 ? '번아웃 위험! 꼭 쉬게 해주세요'
      : state.stress >= 65 ? '휴식이 필요한 시기예요' : '';
  }

  function gainText(act) {
    const parts = [];
    if (act.cost) parts.push('<span class="minus">-' + act.cost + '만</span>');
    if (act.money) parts.push('<span class="plus">+' + act.money + '만</span>');
    if (act.stress) parts.push('스트레스 ' + (act.stress > 0 ? '+' : '') + act.stress);
    Object.keys(act.gains || {}).forEach((k) => {
      const v = act.gains[k];
      if (v > 0) parts.push(E.STAT_META[k].label + ' +' + v);
      else if (v < 0) parts.push('<span class="minus">' + E.STAT_META[k].label + ' ' + v + '</span>');
    });
    return parts.join(' · ');
  }

  function renderSlots() {
    const wrap = $('#slots');
    if (!wrap) return;
    wrap.innerHTML = '';
    $('#period-label').textContent = E.TEMPO[state.tempo].unit;
    $('#slot-hint').textContent = state.slots.length + '칸까지 선택';
    state.slots.forEach((id, i) => {
      const act = id ? E.ACT_BY_ID[id] : null;
      const row = document.createElement('div');
      row.className = 'slot ' + (act ? 'is-filled' : 'is-empty');

      const main = document.createElement('button');
      main.type = 'button';
      main.className = 'slot-main';
      main.dataset.slot = i;
      if (act) {
        main.innerHTML = '<span class="slot-no">' + (i + 1) + '</span>' +
          '<span class="slot-icon">' + act.icon + '</span>' +
          '<span class="slot-body"><span class="slot-title">' + act.name + '</span>' +
          '<span class="slot-sub">' + gainText(act) + '</span></span>';
      } else {
        main.innerHTML = '<span class="slot-no">' + (i + 1) + '</span>' +
          '<span class="slot-icon" style="opacity:.45">＋</span>' +
          '<span class="slot-body"><span class="slot-title">일정을 선택하세요</span>' +
          '<span class="slot-sub">학원 · 알바 · 휴식에서 고르기</span></span>';
      }
      main.addEventListener('click', () => openPicker(i));
      row.appendChild(main);

      if (act) {
        const clr = document.createElement('button');
        clr.type = 'button';
        clr.className = 'slot-clear';
        clr.textContent = '✕';
        clr.setAttribute('aria-label', '일정 비우기');
        clr.addEventListener('click', (e) => {
          e.stopPropagation();
          state.slots[i] = null;
          save();
          renderAll();
        });
        row.appendChild(clr);
      }
      wrap.appendChild(row);
    });
  }

  function renderAll(animate) {
    if (!state) return;
    renderPortrait();
    renderStats(!!animate);
    renderSlots();
    const chosen = state.slots.filter(Boolean).length;
    const btn = $('#btn-run');
    btn.disabled = busy || chosen === 0;
    $('#run-note').textContent = busy
      ? '일정을 실행하는 중이에요…'
      : chosen === 0
        ? '칸을 눌러 이번 ' + E.TEMPO[state.tempo].unit + '에 할 일을 정해 주세요.'
        : '빈 칸은 자유시간이 되어 스트레스가 조금 줄어요.';
  }

  /* ==========================================================
     일정 선택 시트
     ========================================================== */
  function clearOverlay(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  function openPicker(index) {
    pickerSlot = index;
    const cur = state.slots[index];
    pickerTab = cur ? E.ACT_BY_ID[cur].cat : pickerTab || 'class';
    renderPicker();
    Sound.sfx('open');
  }

  function renderPicker() {
    clearOverlay('picker-overlay');
    const overlay = document.createElement('div');
    overlay.className = 'overlay bottom is-open';
    overlay.id = 'picker-overlay';

    const otherCost = state.slots.reduce((sum, id, idx) => {
      if (!id || idx === pickerSlot) return sum;
      return sum + (E.ACT_BY_ID[id].cost || 0);
    }, 0);
    const budget = state.money - otherCost;

    overlay.innerHTML = '<div class="sheet">' +
      '<div class="sheet-grip"></div>' +
      '<div class="sheet-head"><h3>' + (pickerSlot + 1) + '번째 일정</h3>' +
      '<button class="icon-btn" data-close aria-label="닫기">✕</button></div>' +
      '<div class="tabs" id="picker-tabs"></div>' +
      '<div class="act-list" id="picker-list"></div>' +
      '<div class="sheet-body" style="padding-top:0">' +
      '<button class="btn btn-soft btn-lg" id="picker-clear">선택 안 함 (자유시간)</button>' +
      '</div></div>';
    document.getElementById('overlay-root').appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.closest('[data-close]')) {
        overlay.remove();
      }
    });
    overlay.querySelector('#picker-clear').addEventListener('click', () => {
      state.slots[pickerSlot] = null;
      save();
      overlay.remove();
      renderAll();
      Sound.sfx('click');
    });

    const tabs = overlay.querySelector('#picker-tabs');
    Object.keys(E.CAT_META).forEach((cat) => {
      const t = document.createElement('button');
      t.type = 'button';
      t.className = 'tab' + (pickerTab === cat ? ' is-on' : '');
      t.textContent = E.CAT_META[cat].icon + ' ' + E.CAT_META[cat].label;
      t.addEventListener('click', () => {
        pickerTab = cat;
        renderPicker();
      });
      tabs.appendChild(t);
    });

    const list = overlay.querySelector('#picker-list');
    E.ACTIVITIES.filter((a) => a.cat === pickerTab).forEach((act) => {
      const disabled = (act.cost || 0) > budget;
      const selected = state.slots[pickerSlot] === act.id;
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'act-card' + (selected ? ' is-selected' : '') + (disabled ? ' is-disabled' : '');
      const tags = [];
      if (act.cost) tags.push('<span class="tag cost">-' + act.cost + '만</span>');
      if (act.money) tags.push('<span class="tag earn">+' + act.money + '만</span>');
      tags.push('<span class="tag stress">스트레스 ' + (act.stress > 0 ? '+' : '') + act.stress + '</span>');
      Object.keys(act.gains || {}).forEach((k) => {
        const v = act.gains[k];
        if (v > 0) tags.push('<span class="tag gain">' + E.STAT_META[k].label + ' +' + v + '</span>');
        else if (v < 0) tags.push('<span class="tag cost">' + E.STAT_META[k].label + ' ' + v + '</span>');
      });
      if (disabled) tags.push('<span class="tag cost">자산 부족</span>');
      card.innerHTML = '<span class="act-icon">' + act.icon + '</span>' +
        '<span class="act-body"><span class="act-name">' + act.name + '</span>' +
        '<span class="act-desc">' + act.desc + '</span>' +
        '<span class="act-meta">' + tags.join('') + '</span></span>' +
        '<span class="act-check">✓</span>';
      card.addEventListener('click', () => {
        state.slots[pickerSlot] = act.id;
        save();
        overlay.remove();
        renderAll();
        Sound.sfx('coin');
      });
      list.appendChild(card);
    });
  }

  /* ==========================================================
     일정 실행 연출
     ========================================================== */
  function chipsHtml(chips) {
    return chips.map((c) => {
      const up = c.delta > 0;
      if (c.kind === 'stat') {
        return '<span class="chip ' + (up ? '' : 'down') + '">' + c.label + ' ' + (up ? '+' : '') + c.delta + '</span>';
      }
      if (c.kind === 'money') {
        return '<span class="chip money ' + (up ? '' : 'down') + '">자산 ' + (up ? '+' : '') + fmt(c.delta) + '</span>';
      }
      if (c.kind === 'stress') {
        return '<span class="chip stress ' + (up ? '' : 'down') + '">스트레스 ' + (up ? '+' : '') + c.delta + '</span>';
      }
      return '';
    }).join('');
  }

  function resultCard(res) {
    const el = document.createElement('div');
    el.className = 'res';
    let gradeHtml;
    if (res.grade === 'great') gradeHtml = '<span class="res-grade great">대성공</span>';
    else if (res.grade === 'fail') gradeHtml = '<span class="res-grade fail">실패</span>';
    else if (res.grade === 'free') gradeHtml = '<span class="res-grade success" style="background:#f2ece3;color:#8a7662">자유시간</span>';
    else gradeHtml = '<span class="res-grade success">성공</span>';
    el.innerHTML = '<div class="res-head"><span class="res-ico">' + res.act.icon + '</span>' +
      '<span class="res-name">' + res.act.name + '</span>' + gradeHtml + '</div>' +
      '<p class="res-text">' + res.flavor + '</p>' +
      '<div class="chips">' + chipsHtml(res.chips) + '</div>';
    return el;
  }

  async function runTurn() {
    if (busy || !state) return;
    const chosen = state.slots.filter(Boolean).map((id) => E.ACT_BY_ID[id]);
    if (!chosen.length) {
      toast('일정을 하나 이상 선택해 주세요.');
      return;
    }
    const totalCost = chosen.reduce((a, x) => a + (x.cost || 0), 0);
    if (totalCost > state.money) {
      toast('자산이 부족해요. 일정을 조정해 주세요.', 'bad');
      return;
    }

    busy = true;
    renderAll();
    const p = E.periodInfo(state);
    const overlay = document.createElement('div');
    overlay.className = 'overlay is-open';
    overlay.id = 'exec-overlay';
    overlay.innerHTML = '<div class="sheet">' +
      '<div class="sheet-body" style="padding-bottom:0">' +
      '<div class="exec-date"><b>' + p.label + ' ' + p.emoji + '</b><span>' + state.name + ', ' + p.age + '살</span></div>' +
      '<div class="exec-track"><i id="exec-fill"></i></div></div>' +
      '<div class="exec-log" id="exec-log"></div>' +
      '<div class="exec-foot" id="exec-foot"></div></div>';
    document.getElementById('overlay-root').appendChild(overlay);

    const logEl = overlay.querySelector('#exec-log');
    const fill = overlay.querySelector('#exec-fill');
    const foot = overlay.querySelector('#exec-foot');

    for (let i = 0; i < state.slots.length; i++) {
      await sleep(340);
      const id = state.slots[i];
      let res;
      if (!id) {
        const before = E.snapshot(state);
        state.stress = clamp(state.stress - 4, 0, 100);
        res = {
          act: { icon: '☁️', name: '자유시간' },
          grade: 'free',
          flavor: '아무 일정 없이 보낸 시간. 멍하니 창밖을 보다가 스트레스가 조금 줄었어요.',
          chips: E.diffChips(before, state),
        };
      } else {
        res = E.resolveSlot(state, id);
      }
      logEl.appendChild(resultCard(res));
      logEl.scrollTop = logEl.scrollHeight;

      if (res.grade === 'great') Sound.sfx('great');
      else if (res.grade === 'fail') Sound.sfx('fail');
      else if (res.act.money || res.act.cost) Sound.sfx('coin');
      else Sound.sfx('click');

      renderStats(true);
      renderPortrait();
      fill.style.width = Math.round(((i + 1) / state.slots.length) * 100) + '%';
      save();
      await sleep(560);
    }

    const allowance = E.addAllowance(state);
    const summary = document.createElement('div');
    summary.className = 'res';
    summary.innerHTML = '<div class="res-head"><span class="res-ico">💰</span><span class="res-name">' +
      E.TEMPO[state.tempo].unit + ' 정산</span><span class="res-grade success">정산</span></div>' +
      '<p class="res-text">생활비 ' + allowance + '만 원이 들어왔어요. 보유 자산은 ' + fmt(state.money) + '만 원입니다.' +
      (state.stress >= 75 ? ' 스트레스가 많이 쌓였어요. 다음 일정에는 휴식을 넣어 주세요.' : '') + '</p>' +
      '<div class="chips"><span class="chip money">자산 +' + allowance + '</span>' +
      '<span class="chip ' + (state.stress >= 65 ? 'stress' : 'stress down') + '">스트레스 ' + state.stress + '</span></div>';
    logEl.appendChild(summary);
    logEl.scrollTop = logEl.scrollHeight;
    renderPortrait();
    renderStats();
    save();

    foot.innerHTML = '<button class="btn btn-primary btn-lg" id="exec-next">다음으로</button>';
    foot.querySelector('#exec-next').addEventListener('click', async () => {
      overlay.remove();
      busy = false;
      Sound.sfx('ok');
      await postTurn();
    }, { once: true });
  }

  function rememberEvent(id) {
    state.recentEvents = (state.recentEvents || []).concat(id).slice(-3);
  }

  async function postTurn() {
    const prev = E.periodInfo(state);
    state.turn += 1;
    state.slots = new Array(E.TEMPO[state.tempo].slotsPerTurn).fill(null);
    save();

    const p = E.periodInfo(state);
    if (state.turn >= E.TEMPO[state.tempo].turns) {
      showEnding();
      return;
    }
    renderAll();

    if (p.age > prev.age) {
      toast('🎂 ' + state.name + ', ' + p.age + '살이 되었어요!', 'good');
      Sound.sfx('win');
      await sleep(620);
    }

    let didFestival = false;
    if (prev.isAutumn && !state.flags['festival_' + prev.year]) {
      state.flags['festival_' + prev.year] = true;
      didFestival = true;
      await showFestival(prev);
      renderAll();
      save();
    }

    if (!didFestival) {
      let ev = null;
      if (state.stress >= 82) {
        ev = E.EVENT_BY_ID.burnout;
      } else if (Math.random() < 0.44) {
        ev = E.pickEvent(state);
      }
      if (ev) {
        rememberEvent(ev.id);
        await showEvent(ev);
        renderAll();
        save();
      }
    }

    busy = false;
    renderAll();
  }

  /* ==========================================================
     이벤트 · 축제 모달
     ========================================================== */
  function appendSheet(html, id) {
    const overlay = document.createElement('div');
    overlay.className = 'overlay is-open';
    overlay.id = id || '';
    overlay.innerHTML = '<div class="sheet"><div class="sheet-body" style="padding-top:18px">' + html + '</div></div>';
    document.getElementById('overlay-root').appendChild(overlay);
    return overlay;
  }

  function showEvent(ev) {
    return new Promise((resolve) => {
      const overlay = appendSheet('<span class="event-kicker">돌발 이벤트 · ' + ev.kicker + '</span>' +
        '<h3 class="event-title">' + ev.title + '</h3>' +
        '<p class="event-desc">' + ev.desc + '</p>' +
        '<div class="choices" id="ev-choices"></div>' +
        '<div id="ev-after"></div>', 'event-overlay');

      const box = overlay.querySelector('#ev-choices');
      const after = overlay.querySelector('#ev-after');

      ev.choices.forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice';
        btn.innerHTML = '<span><span class="choice-label">' + c.label + '</span>' +
          '<span class="choice-hint">' + (c.hint || '') + '</span></span><span class="choice-arrow">›</span>';
        btn.addEventListener('click', () => {
          const before = E.snapshot(state);
          const text = c.apply(state) || '';
          const chips = E.diffChips(before, state);
          box.innerHTML = '';
          box.style.display = 'none';
          after.innerHTML = '<div class="event-result"><div class="result-title">' + c.label + '</div>' +
            '<p>' + text + '</p><div class="chips">' + chipsHtml(chips) + '</div></div>' +
            '<div class="event-actions"><button class="btn btn-primary" id="ev-done">계속</button></div>';
          Sound.sfx('ok');
          renderAll(true);
          renderPortrait();
          save();
          after.querySelector('#ev-done').addEventListener('click', () => {
            overlay.remove();
            resolve();
          }, { once: true });
        });
        box.appendChild(btn);
      });
    });
  }

  function showFestival(period) {
    return new Promise((resolve) => {
      const overlay = appendSheet('<span class="event-kicker">' + E.FESTIVAL.kicker + ' · ' + period.year + '</span>' +
        '<h3 class="event-title">' + E.FESTIVAL.title + '</h3>' +
        '<p class="event-desc">' + E.FESTIVAL.desc + '</p>' +
        '<div class="choices" id="f-choices"></div>' +
        '<div id="f-after"></div>', 'festival-overlay');

      const box = overlay.querySelector('#f-choices');
      const after = overlay.querySelector('#f-after');

      E.FESTIVAL.choices.forEach((c) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'choice';
        let hint;
        if (c.test) {
          const val = state.stats[c.test];
          hint = E.STAT_META[c.test].label + ' ' + val + ' · 우승 시 300만 원';
        } else {
          hint = '스트레스가 조금 줄어요';
        }
        btn.innerHTML = '<span style="font-size:20px">' + c.icon + '</span>' +
          '<span><span class="choice-label">' + c.label + '</span>' +
          '<span class="choice-hint">' + hint + '</span></span><span class="choice-arrow">›</span>';
        btn.addEventListener('click', () => {
          const res = E.resolveFestival(state, c.id);
          box.style.display = 'none';
          after.innerHTML = '<div class="event-result"><div class="result-title">' + res.title + '</div>' +
            '<p>' + res.text + '</p><div class="chips">' + chipsHtml(res.chips) + '</div></div>' +
            '<div class="event-actions"><button class="btn btn-primary" id="f-done">계속</button></div>';
          Sound.sfx(res.win ? 'win' : res.second ? 'great' : 'ok');
          renderAll(true);
          renderPortrait();
          save();
          after.querySelector('#f-done').addEventListener('click', () => {
            overlay.remove();
            resolve();
          }, { once: true });
        });
        box.appendChild(btn);
      });
    });
  }

  /* ==========================================================
     엔딩
     ========================================================== */
  function showEnding() {
    if (!state) return;
    const ending = E.computeEnding(state);
    const snapshot = {
      name: state.name,
      stats: Object.assign({}, state.stats),
      money: state.money,
      stress: state.stress,
      turn: state.turn,
      tempo: state.tempo,
    };
    const isNew = unlockEnding(ending.id);
    state = null;
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }

    const card = $('#ending-card');
    card.style.background = 'linear-gradient(150deg, ' + ending.grad[0] + ', ' + ending.grad[1] + ')';
    $('#ending-emoji').textContent = ending.emoji;
    $('#ending-title').textContent = ending.title;
    $('#ending-tag').textContent = ending.tag;
    $('#ending-desc').textContent = ending.desc;
    $('#ending-kicker').textContent = snapshot.name + ' · 20세, 성인이 되었습니다';

    // 결과 능력치
    const statsHtml = E.STAT_KEYS.map((k) => {
      const m = E.STAT_META[k];
      return '<div class="ending-stat"><span>' + m.icon + ' ' + m.label + '</span><b>' + snapshot.stats[k] + '</b></div>';
    }).join('') +
      '<div class="ending-stat"><span>💰 자산(만 원)</span><b>' + fmt(snapshot.money) + '</b></div>' +
      '<div class="ending-stat"><span>😮‍💨 스트레스</span><b>' + snapshot.stress + '</b></div>';
    $('#ending-stats').innerHTML = statsHtml;

    const uniq = new Set(loadEndings().map((x) => x.id));
    $('#ending-note').textContent = (isNew ? '새로운 엔딩을 도감에 기록했어요! ' : '') +
      '엔딩 도감 ' + uniq.size + '/' + E.ENDINGS.length + ' · ' + snapshot.name + '의 10년이 기록되었습니다.';

    // 반짝임
    card.querySelectorAll('.ending-spark').forEach((n) => n.remove());
    for (let i = 0; i < 7; i++) {
      const sp = document.createElement('span');
      sp.className = 'ending-spark';
      sp.textContent = ['✨', '⭐', '💫', '🌟'][i % 4];
      sp.style.left = (8 + Math.random() * 84) + '%';
      sp.style.top = (10 + Math.random() * 70) + '%';
      sp.style.animationDelay = (Math.random() * 2.2) + 's';
      card.appendChild(sp);
    }

    show('ending');
    Sound.sfx('win');
    Sound.stopBgm();
    setTimeout(() => Sound.startBgm(), 1800);
  }

  function renderCollection() {
    const unlocked = loadEndings();
    const map = {};
    unlocked.forEach((u) => { map[u.id] = u; });
    const grid = $('#col-grid');
    grid.innerHTML = '';
    E.ENDINGS.forEach((e) => {
      const u = map[e.id];
      const card = document.createElement('div');
      card.className = 'col-card' + (u ? '' : ' is-locked');
      card.innerHTML = '<div class="col-emoji"' + (u ? ' style="background:linear-gradient(150deg,' + e.grad[0] + ',' + e.grad[1] + ')"' : '') + '>' +
        (u ? e.emoji : '🔒') + '</div>' +
        '<div class="col-body"><div class="col-title">' + (u ? e.title : '??? (미발견)') + '</div>' +
        '<div class="col-tag">' + (u ? u.name + ' · ' + u.date : e.tag) + '</div>' +
        '<div class="col-hint">' + (u ? e.desc : '힌트: ' + e.hint) + '</div></div>';
      grid.appendChild(card);
    });
    const uniq = new Set(unlocked.map((x) => x.id));
    $('#col-count').textContent = uniq.size + '/' + E.ENDINGS.length;
  }

  /* ==========================================================
     메뉴 · 확인 모달
     ========================================================== */
  function confirmModal(title, message, okText, danger) {
    return new Promise((resolve) => {
      const overlay = appendSheet('<h3 class="event-title">' + title + '</h3>' +
        '<p class="event-desc">' + message + '</p>' +
        '<div class="event-actions"><button class="btn btn-soft" id="cf-no">취소</button>' +
        '<button class="btn ' + (danger ? 'btn-primary' : 'btn-primary') + '" id="cf-yes">' + (okText || '확인') + '</button></div>', 'confirm-overlay');
      overlay.querySelector('#cf-no').addEventListener('click', () => { overlay.remove(); resolve(false); });
      overlay.querySelector('#cf-yes').addEventListener('click', () => { overlay.remove(); resolve(true); });
    });
  }

  function openMenu() {
    const overlay = appendSheet('<h3 class="event-title">메뉴</h3>' +
      '<p class="event-desc">' + (state ? state.name + ' · ' + E.periodInfo(state).label + ' · 자산 ' + fmt(state.money) + '만 원' : '') + '</p>' +
      '<div class="choices" style="margin-top:4px">' +
      '<button class="choice" id="m-save"><span><span class="choice-label">저장하고 타이틀로</span><span class="choice-hint">진행 상황은 자동 저장돼요</span></span><span class="choice-arrow">↩</span></button>' +
      '<button class="choice" id="m-sound"><span><span class="choice-label">소리 ' + (Sound.enabled ? '끄기' : '켜기') + '</span><span class="choice-hint">BGM과 효과음</span></span><span class="choice-arrow">🔊</span></button>' +
      '<button class="choice" id="m-new"><span><span class="choice-label">새 게임</span><span class="choice-hint">지금 기록을 지우고 다시 시작해요</span></span><span class="choice-arrow">🔄</span></button>' +
      '<button class="choice" id="m-close"><span><span class="choice-label">닫기</span><span class="choice-hint">계속 육성하기</span></span><span class="choice-arrow">✕</span></button>' +
      '</div>', 'menu-overlay');

    overlay.querySelector('#m-save').addEventListener('click', () => {
      save();
      overlay.remove();
      state = null;
      refreshTitle();
      show('title');
    });
    overlay.querySelector('#m-sound').addEventListener('click', () => {
      Sound.toggle();
      overlay.remove();
      openMenu();
    });
    overlay.querySelector('#m-new').addEventListener('click', async () => {
      const ok = await confirmModal('새 게임을 시작할까요?', '지금까지의 육성 기록이 사라져요. 엔딩 도감은 그대로 남습니다.', '새로 시작', true);
      if (ok) {
        try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ }
        state = null;
        overlay.remove();
        refreshTitle();
        show('setup');
        renderSetup();
      }
    });
    overlay.querySelector('#m-close').addEventListener('click', () => overlay.remove());
  }

  /* ==========================================================
     초기화
     ========================================================== */
  function bind() {
    $('#btn-new').addEventListener('click', () => {
      Sound.sfx('click');
      show('setup');
      renderSetup();
    });
    $('#btn-continue').addEventListener('click', () => {
      const s = readSave();
      if (!s) { toast('저장된 기록이 없어요.'); return; }
      state = s;
      state.frac = state.frac || {};
      const slots = E.TEMPO[state.tempo] ? E.TEMPO[state.tempo].slotsPerTurn : 3;
      if (!Array.isArray(state.slots) || state.slots.length !== slots) state.slots = new Array(slots).fill(null);
      enterGame();
    });
    $('#btn-collection').addEventListener('click', () => {
      Sound.sfx('click');
      renderCollection();
      show('collection');
    });
    $('#btn-random-name').addEventListener('click', () => {
      const name = SUGGEST_NAMES[Math.floor(Math.random() * SUGGEST_NAMES.length)];
      $('#input-name').value = name;
      setup.name = name;
      renderSetup();
      Sound.sfx('click');
    });
    $('#input-name').addEventListener('input', (e) => {
      setup.name = e.target.value;
    });
    $('#btn-start').addEventListener('click', () => {
      Sound.sfx('ok');
      startGame();
    });
    $$('[data-go]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.go;
        if (target === 'title') refreshTitle();
        show(target);
        if (target === 'setup') renderSetup();
      });
    });
    $('#btn-run').addEventListener('click', runTurn);
    $('#btn-menu').addEventListener('click', openMenu);
    $('#btn-sound').addEventListener('click', () => Sound.toggle());
    $('#btn-ending-collection').addEventListener('click', () => {
      renderCollection();
      show('collection');
    });
    $('#btn-ending-title').addEventListener('click', () => {
      refreshTitle();
      show('title');
    });

    // 첫 상호작용에서 오디오 준비 (자동재생 정책)
    const kick = () => {
      if (Sound.enabled) Sound.startBgm();
      document.removeEventListener('pointerdown', kick);
    };
    document.addEventListener('pointerdown', kick);
  }

  function init() {
    buildStats();
    renderSetup();
    refreshTitle();
    updateSoundBtn();
    bind();
    // 새로고침 시 바로 게임으로 이어서 할지: 저장이 있으면 타이틀에서 이어하기 제공
    show('title');
  }

  // 개발/검증용 훅 — 주소에 ?debug 가 있을 때만 열립니다.
  if (window.location.search.indexOf('debug') >= 0) {
    window.__PM = {
      state: () => state,
      patch: (obj) => { if (state) { Object.assign(state, obj); renderAll(); save(); } },
      finish: () => { if (state) { state.turn = E.TEMPO[state.tempo].turns; showEnding(); } },
      fill: (ids) => { if (state) { state.slots = state.slots.map((_, i) => (ids[i] === undefined ? null : ids[i])); renderAll(); } },
      post: () => postTurn(),
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ============================================================
   우리 딸, 스무 살 — 게임 엔진 (UI와 분리된 순수 로직)
   21세기 한국 배경 딸 키우기 시뮬레이션
   ============================================================ */
(function (root) {
  'use strict';

  const START_YEAR = 2026;
  const START_AGE = 10;
  const END_AGE = 20;
  const START_MONEY = 300; // 단위: 만 원

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* ---------------- 능력치 ---------------- */
  const STAT_META = {
    stamina:  { key: 'stamina',  label: '체력',   sub: '건강',   icon: '💪', color: '#3ea36b' },
    academic: { key: 'academic', label: '학업',   sub: '지식',   icon: '📚', color: '#3f74e0' },
    coding:   { key: 'coding',   label: '코딩',   sub: 'IT',     icon: '💻', color: '#7a5cf0' },
    art:      { key: 'art',      label: '예술',   sub: '감각',   icon: '🎨', color: '#ef7b4f' },
    charm:    { key: 'charm',    label: '매력',   sub: '사교',   icon: '✨', color: '#e0558f' },
    mental:   { key: 'mental',   label: '멘탈',   sub: '인성',   icon: '🌱', color: '#1f9d94' },
  };
  const STAT_KEYS = Object.keys(STAT_META);

  /* ---------------- 혈액형 보너스 ---------------- */
  const BLOOD = {
    A:  { key: 'A',  label: 'A형',  desc: '섬세하고 계획적인 성격',   bonus: { academic: 6, mental: 8 } },
    B:  { key: 'B',  label: 'B형',  desc: '자유롭고 감각적인 성격',   bonus: { art: 6, charm: 8 } },
    O:  { key: 'O',  label: 'O형',  desc: '활발하고 체력이 좋은 성격', bonus: { stamina: 8, charm: 6 } },
    AB: { key: 'AB', label: 'AB형', desc: '분석적이고 독특한 성격',   bonus: { coding: 8, art: 5 } },
  };

  /* ---------------- 진행 템포 ---------------- */
  const TEMPO = {
    quarter: {
      key: 'quarter', label: '분기 템포', unit: '분기', perYear: 4, slotsPerTurn: 3,
      allowance: 80, turns: (END_AGE - START_AGE) * 4,
      desc: '1년을 봄·여름·가을·겨울로. 분기마다 3가지 일정 (총 40턴)',
    },
    month: {
      key: 'month', label: '월별 템포', unit: '달', perYear: 12, slotsPerTurn: 1,
      allowance: 27, turns: (END_AGE - START_AGE) * 12,
      desc: '한 달에 한 가지 일정. 더 촘촘하게 기록 (총 120턴)',
    },
  };

  /* ---------------- 집안 형편 ---------------- */
  const HOUSEHOLDS = {
    rich: {
      key: 'rich', label: '여유로운 집안', emoji: '💎',
      money: 2000, allowance: { quarter: 250, month: 84 }, bonus: {},
      desc: '부자 아빠 · 초기 자금 2,000만 원, 분기 생활비 250만 원',
    },
    normal: {
      key: 'normal', label: '평범한 직장인 집안', emoji: '🏠',
      money: 300, allowance: { quarter: 80, month: 27 }, bonus: {},
      desc: '초기 자금 300만 원, 분기 생활비 80만 원',
    },
    poor: {
      key: 'poor', label: '빠듯한 집안', emoji: '🏚️',
      money: 50, allowance: { quarter: 20, month: 7 }, bonus: { mental: 8, stamina: 4 },
      desc: '초기 자금 50만 원, 분기 생활비 20만 원 · 대신 멘탈 보너스',
    },
  };

  const SEASONS = [
    { name: '봄',   months: '3월 – 5월',   emoji: '🌸' },
    { name: '여름', months: '6월 – 8월',   emoji: '☀️' },
    { name: '가을', months: '9월 – 11월',  emoji: '🍂', festival: true },
    { name: '겨울', months: '12월 – 2월',  emoji: '❄️' },
  ];
  const MONTH_EMOJI = { 1: '❄️', 2: '❄️', 3: '🌸', 4: '🌸', 5: '🌸', 6: '☀️', 7: '☀️', 8: '☀️', 9: '🍂', 10: '🍂', 11: '🍂', 12: '❄️' };

  const GRADE_BY_AGE = {
    10: '초3', 11: '초4', 12: '초5', 13: '초6', 14: '중1', 15: '중2',
    16: '중3', 17: '고1', 18: '고2', 19: '고3', 20: '성인',
  };
  const gradeOf = (age) => GRADE_BY_AGE[age] || (age >= 20 ? '성인' : '초3');

  /* ---------------- 활동 ---------------- */
  const ACTIVITIES = [
    /* ---- 학원 · 수업 ---- */
    {
      id: 'exam', cat: 'class', name: '입시·영어학원', icon: '📖', cost: 40, stress: 9, focus: 'academic',
      gains: { academic: 3, mental: 1 },
      desc: '단어장과 모의고사. 내신과 수능을 함께 준비해요.',
      flavor: {
        success: '단어 시험 만점. 선생님께 칭찬을 받고 돌아왔어요.',
        great: '모의고사 반 1등! 원장님이 특별반을 제안했어요.',
        fail: '수업이 머리에 잘 들어오지 않았어요. 졸음과의 싸움이었습니다.',
      },
    },
    {
      id: 'coding', cat: 'class', name: '코딩·AI 학원', icon: '💻', cost: 45, stress: 10, focus: 'coding',
      gains: { coding: 4, academic: 2 },
      desc: '파이썬부터 생성형 AI 활용까지, 직접 만들어 보는 수업.',
      flavor: {
        success: '오늘은 미니 게임을 완성해서 친구들에게 보여줬어요.',
        great: 'AI 해커톤 과제에서 1등! "재능 있다"는 말을 들었어요.',
        fail: '오류가 하나도 안 잡혀서 세 시간을 헤맸어요.',
      },
    },
    {
      id: 'art', cat: 'class', name: '댄스·보컬·미술학원', icon: '🎨', cost: 35, stress: 7, focus: 'art',
      gains: { art: 3, charm: 1 },
      desc: '몸으로, 목소리로, 손끝으로 표현하는 시간.',
      flavor: {
        success: '새 안무를 다 외웠어요. 거울 앞에서 혼자 웃고 있었어요.',
        great: '학원 발표회에서 단독 무대를 맡게 됐어요!',
        fail: '몸이 무거워서 연습에 집중이 안 됐어요.',
      },
    },
    {
      id: 'sports', cat: 'class', name: '태권도·필라테스', icon: '🥋', cost: 30, stress: -4, focus: 'stamina',
      gains: { stamina: 4, mental: 1 },
      desc: '땀 흘리면 마음이 가벼워져요.',
      flavor: {
        success: '킥을 100번 찼어요. 다리는 아프지만 속은 시원해요.',
        great: '승급 심사 통과! 새 띠를 매고 뛰어왔어요.',
        fail: '컨디션이 안 좋아서 중간에 쉬었어요.',
      },
    },
    {
      id: 'speech', cat: 'class', name: '스피치·리더십', icon: '🎤', cost: 40, stress: 8, focus: 'charm',
      gains: { charm: 3, mental: 2 },
      desc: '발표와 토론으로 자신감을 키워요.',
      flavor: {
        success: '발표를 끝내고 박수를 받았어요. 어깨가 펴졌습니다.',
        great: '학급 회장 후보로 추천받았어요!',
        fail: '긴장해서 목소리가 떨렸어요.',
      },
    },

    /* ---- 알바 · 대외활동 ---- */
    {
      id: 'parttime', cat: 'work', name: '편의점·카페 알바', icon: '🥤', money: 45, stress: 10, focus: 'charm', minAge: 17,
      gains: { stamina: 1, charm: 1, academic: -1 },
      desc: '직접 번 돈의 무게를 배워요.',
      flavor: {
        success: '오늘도 정시에 출근해 네 시간을 꼬박 일했어요.',
        great: '사장님이 시급을 올려주겠다고 했어요!',
        fail: '손님이 몰려서 실수를 했어요. 조금 속상했어요.',
      },
    },
    {
      id: 'creator', cat: 'work', name: '유튜브·릴스 크리에이터', icon: '📱', money: 25, stress: 8, focus: 'art', minAge: 13,
      gains: { art: 2, charm: 2 },
      desc: '편집하고 올리고, 반응을 확인해요.',
      flavor: {
        success: '영상 하나를 완성해 올렸어요. 조회수가 천을 넘었습니다.',
        great: '알고리즘을 탔어요! 댓글이 폭발하고 있어요.',
        fail: '편집 파일이 날아갔어요. 오늘은 여기까지…',
      },
    },
    {
      id: 'volunteer', cat: 'work', name: '봉사활동', icon: '🤝', money: 0, stress: 3, focus: 'mental', minAge: 12,
      gains: { mental: 3, charm: 1, academic: 1 },
      desc: '지역 아동센터에서 아이들을 도와요.',
      flavor: {
        success: '"선생님"이라고 불러줬어요. 마음이 따뜻해졌습니다.',
        great: '봉사 인증서와 함께 감사장을 받았어요.',
        fail: '몸이 피곤했지만 끝까지 해냈어요.',
      },
    },
    {
      id: 'tutor', cat: 'work', name: '과외·학습 멘토', icon: '📝', money: 60, stress: 9, focus: 'academic', minAge: 17,
      gains: { academic: 3, mental: 1 },
      desc: '가르치면서 내 실력도 다져요.',
      flavor: {
        success: '동생이 문제를 풀어냈어요. 설명하는 건 생각보다 어려워요.',
        great: '"실력이 확실하다"며 다음 달도 맡겼어요.',
        fail: '설명이 꼬여서 같이 헤맸어요.',
      },
    },
    {
      id: 'intern', cat: 'work', name: 'IT 인턴·공모전', icon: '🧑‍💻', money: 70, stress: 11, focus: 'coding', minAge: 17,
      gains: { coding: 3, academic: 2 },
      desc: '실무 프로젝트와 공모전 준비로 스펙을 쌓아요.',
      flavor: {
        success: '팀 회의에서 아이디어를 냈고, 코드 리뷰도 받았어요.',
        great: '공모전 1차 심사를 통과했어요! 발표까지 달려봐요.',
        fail: '마감에 쫓겨 밤을 새웠지만 결과는 아쉬웠어요.',
      },
    },

    /* ---- 무료 활동 ---- */
    {
      id: 'freeLib', cat: 'free', name: '동네 도서관 독학', icon: '📚', cost: 0, stress: 3, focus: 'academic',
      gains: { academic: 2, mental: 1 },
      desc: '돈이 없어도 책은 읽을 수 있어요.',
      flavor: {
        success: '도서관 구석자리에서 문제집을 반쯤 풀었어요.',
        great: '사서 선생님이 추천한 책이 재미있었는지 두 시간이 훅 갔어요.',
        fail: '집중이 안 돼서 같은 페이지를 계속 보고 있었어요.',
      },
    },
    {
      id: 'freeRun', cat: 'free', name: '공원 달리기', icon: '🏃', cost: 0, stress: -4, focus: 'stamina',
      gains: { stamina: 3 },
      desc: '맨발로 뛰어도 즐거워요.',
      flavor: {
        success: '공원 한 바퀴를 돌고 왔어요. 숨은 차지만 기분은 좋아요.',
        great: '오늘은 두 바퀴! 딸이 "나 달리기 재능 있는 듯"이라며 웃었어요.',
        fail: '돌다가 쉬었어요. 그래도 밖에 나간 것만으로 충분해요.',
      },
    },
    {
      id: 'freeChore', cat: 'free', name: '집안일 돕기', icon: '🧹', cost: 0, money: 5, stress: 2, focus: 'mental',
      gains: { mental: 2 }, bondBonus: 2,
      desc: '같이 살림을 하면 마음도 가까워져요. 소액의 용돈도 받아요.',
      flavor: {
        success: '설거지를 같이 했어요. 물을 튀기며 웃었습니다.',
        great: '딸이 먼저 "오늘은 내가 할게"라고 했어요. 마음이 뭉클했습니다.',
        fail: '하다가 하나를 깼어요. "괜찮아"라고 했지만 조금 속상했나 봐요.',
      },
    },

    /* ---- 프리미엄 수업 ---- */
    {
      id: 'premiumTutor', cat: 'class', name: '1:1 프리미엄 과외', icon: '💎', cost: 150, stress: 6, focus: 'academic', minAge: 12,
      gains: { academic: 8, mental: 1 },
      desc: '유명 강사와 1대1. 비싸지만 확실해요.',
      flavor: {
        success: '선생님이 딸의 약점을 정확히 짚어줬어요. 숙제도 딱 맞게 나왔습니다.',
        great: '한 번에 막힌 단원을 뚫었어요. "이제 이해돼!" 딸이 소리쳤습니다.',
        fail: '수업료는 나갔는데 딸이 피곤해서 집중을 못 했어요.',
      },
    },
    {
      id: 'globalCamp', cat: 'class', name: '해외 글로벌 캠프', icon: '✈️', cost: 350, stress: 2, focus: 'charm', minAge: 12,
      gains: { academic: 4, charm: 6, mental: 2 },
      desc: '여름방학 해외 캠프에서 세상을 배워요.',
      flavor: {
        success: '외국 친구들과 어울리며 자신감이 붙었어요. 사진 속 얼굴이 밝습니다.',
        great: '캠프 우수 참가자로 뽑혀 발표까지 했어요!',
        fail: '낯선 환경에 적응하느라 힘들어했지만, 끝까지 해냈어요.',
      },
    },

    /* ---- 휴식 · 여가 ---- */
    {
      id: 'home', cat: 'rest', name: '집콕 휴식', icon: '🛋️', cost: 0, stress: -22, focus: null,
      gains: { academic: -1 },
      desc: '게임, OTT, 이불 속. 아무것도 안 해도 괜찮아요.',
      flavor: {
        success: '하루 종일 좋아하는 드라마를 정주행했어요.',
        great: '푹 잤더니 얼굴이 환해졌어요. 최고의 하루!',
        fail: '아무것도 안 했는데 하루가 끝나버렸어요.',
      },
    },
    {
      id: 'friends', cat: 'rest', name: '친구들과 놀기', icon: '🎲', cost: 10, stress: -18, focus: 'charm',
      gains: { charm: 2, mental: 3 },
      desc: '떡볶이, 코인노래방, 그리고 수다.',
      flavor: {
        success: '친구들과 웃다가 배가 아팠어요.',
        great: '오랜만에 다 같이 모여 사진을 잔뜩 찍었어요.',
        fail: '약속이 취소돼서 혼자 집에 왔어요.',
      },
    },
    {
      id: 'hotel', cat: 'rest', name: '호캉스·가족여행', icon: '🏖️', cost: 150, stress: -38, focus: null,
      gains: { stamina: 2, charm: 2, mental: 3 },
      desc: '가끔은 일상을 떠나야 해요.',
      flavor: {
        success: '바다를 보고 왔어요. "여기서 살고 싶다"고 했습니다.',
        great: '가족사진이 인생샷으로 남았어요. 잊지 못할 기억!',
        fail: '비가 와서 실내에서만 놀았어요.',
      },
    },
  ];

  const ACT_BY_ID = {};
  ACTIVITIES.forEach((a) => { ACT_BY_ID[a.id] = a; });
  const CAT_META = {
    class: { label: '학원 · 수업', icon: '🏫' },
    free:  { label: '무료·집안일', icon: '🆓' },
    work:  { label: '알바 · 활동', icon: '💼' },
    rest:  { label: '휴식 · 여가', icon: '🌿' },
  };

  /* ---------------- 성향 · 취향 ---------------- */
  const PERSONALITIES = {
    curious:  { key: 'curious',  label: '탐구형', emoji: '🔍', desc: '궁금한 건 끝까지 파고들어요.',
      likes: ['exam', 'coding', 'intern', 'tutor', 'freeLib'], dislikes: ['home', 'friends'] },
    artistic: { key: 'artistic', label: '예술형', emoji: '🎨', desc: '감정과 표현이 풍부해요.',
      likes: ['art', 'creator', 'friends'], dislikes: ['exam', 'tutor', 'intern'] },
    social:   { key: 'social',   label: '사교형', emoji: '💬', desc: '사람들 사이에서 에너지를 얻어요.',
      likes: ['speech', 'friends', 'parttime', 'creator'], dislikes: ['home', 'coding'] },
    active:   { key: 'active',   label: '활동형', emoji: '🏃', desc: '몸을 움직일 때 살아나요.',
      likes: ['sports', 'parttime', 'friends', 'freeRun'], dislikes: ['home', 'exam'] },
    rebel:    { key: 'rebel',    label: '반항기', emoji: '😤', desc: '시키는 대로 하는 건 싫어요.',
      likes: ['friends', 'creator', 'home'], dislikes: ['exam', 'coding', 'speech', 'volunteer', 'tutor', 'freeChore'] },
    warm:     { key: 'warm',     label: '다정형', emoji: '🌷', desc: '사람 마음을 잘 헤아려요.',
      likes: ['volunteer', 'friends', 'speech', 'freeChore'], dislikes: ['intern', 'parttime'] },
  };
  const PERSONALITY_KEYS = Object.keys(PERSONALITIES);

  function buildPrefs(key, rng) {
    const R = rng || Math.random;
    const p = PERSONALITIES[key] || PERSONALITIES.curious;
    const prefs = {};
    ACTIVITIES.forEach((a) => {
      if (p.likes.indexOf(a.id) >= 0) prefs[a.id] = 'like';
      else if (p.dislikes.indexOf(a.id) >= 0) prefs[a.id] = 'dislike';
      else prefs[a.id] = 'neutral';
    });
    const neutrals = ACTIVITIES.filter((a) => prefs[a.id] === 'neutral');
    if (neutrals.length) prefs[neutrals[Math.floor(R() * neutrals.length)].id] = 'like';
    return prefs;
  }

  function pickOne(arr, rng) {
    const R = rng || Math.random;
    return arr[Math.floor(R() * arr.length)];
  }

  /* ---------------- 21세기 이슈 이벤트 ---------------- */
  const EVENTS = [
    {
      id: 'shorts', weight: 6, kicker: '스마트폰 · 숏폼', title: '릴스가 멈추질 않아요',
      desc: '새벽까지 쇼츠를 넘기는 소리가 들려요. "이거 진짜 웃겨"라며 웃고 있는데, 내일은 학교 가는 날입니다.',
      when: (s) => ageOf(s) >= 11,
      choices: [
        { label: '폰을 압수하고 공부시키기', hint: '학업 ↑ · 스트레스 ↑',
          apply(s) { s.stats.academic += 6; s.stress = clamp(s.stress + 12, 0, 100); s.stats.mental = Math.max(0, s.stats.mental - 2); return '딸은 뾰로통했지만 결국 책상에 앉았어요. 시험 범위는 조금 줄었습니다.'; } },
        { label: '영상 감각으로 편집을 시켜 보기', hint: '예술 ↑ · 매력 ↑ · 코딩 ↑',
          apply(s) { s.stats.art += 5; s.stats.charm += 3; s.stats.coding += 3; s.stress = clamp(s.stress + 3, 0, 100); s.flags.creator = true; return '딸이 직접 컷을 고르고 자막을 넣었어요. "편집 재밌다!" 처음 보는 표정이었습니다.'; } },
      ],
    },
    {
      id: 'pandemic', weight: 4, kicker: '전염병 유행 · 비대면', title: '학교가 온라인 수업으로 바뀌었어요',
      desc: '감염병이 다시 유행하면서 한 달간 원격 수업이 시작됐어요. 집에 있는 시간이 확 늘었습니다.',
      when: (s) => ageOf(s) >= 11 && ageOf(s) <= 16,
      choices: [
        { label: '집에서 틈새 코딩·독학 지원', hint: '코딩 ↑ · 학업 ↑ · 스트레스 ↑',
          apply(s) { s.stats.coding += 5; s.stats.academic += 4; s.stress = clamp(s.stress + 8, 0, 100); return '집중이 안 될 법도 한데, 딸은 온라인 강의를 두 배속으로 돌려가며 끝까지 들었어요.'; } },
        { label: '집콕 스트레스, 게임·휴식 허용', hint: '스트레스 ↓ · 체력 ↑',
          apply(s) { s.stress = clamp(s.stress - 16, 0, 100); s.stats.stamina += 4; s.stats.mental += 2; return '방에서 웃음소리가 들려요. 답답한 시기를 버티는 것도 공부입니다.'; } },
      ],
    },
    {
      id: 'genai', weight: 6, kicker: '생성형 AI 시대', title: '"AI로 숙제 끝냈어"',
      desc: '딸이 태연하게 말해요. "요즘 애들은 다 써." 숙제는 30분 만에 끝나 있었습니다.',
      when: (s) => ageOf(s) >= 12,
      choices: [
        { label: 'AI 프롬프트 활용법을 같이 배우기', hint: '코딩 ↑ · 학업 ↑',
          apply(s) { s.stats.coding += 5; s.stats.academic += 4; s.stress = clamp(s.stress + 3, 0, 100); s.flags.aiSkill = true; return '딸이 AI에게 질문을 다듬는 법을 익혔어요. "AI는 답을 주는 게 아니라 같이 생각하는 거네."'; } },
        { label: '직접 손으로 쓰고 생각하게 하기', hint: '멘탈 ↑ · 학업 ↑',
          apply(s) { s.stats.mental += 6; s.stats.academic += 2; s.stress = clamp(s.stress + 4, 0, 100); return '밤 11시까지 공책을 채운 딸. 손은 아프지만 "내가 쓴 거라 기억에 남아"라고 했어요.'; } },
      ],
    },
    {
      id: 'invest', weight: 4, kicker: '재테크 · 영끌', title: '알바로 모은 돈, 어디에 둘까요?',
      desc: '딸의 통장에 알바비가 제법 모였어요. 친구들은 "ETF", "테마주" 이야기를 하고 있습니다.',
      when: (s) => ageOf(s) >= 15 && s.money >= 100,
      choices: [
        { label: '소액 ETF·적금으로 안전 투자', hint: '자산 소폭 ↑ · 멘탈 ↑',
          apply(s) { const g = Math.max(8, Math.round(s.money * 0.06)); s.money += g; s.stats.mental += 2; s.flags.safeInvest = true; return '수익률은 크지 않지만 매달 자동이체를 걸었어요. "천천히 가는 게 편해."'; } },
        { label: '고위험 테마주에 도전', hint: '대박 아니면 손실', apply(s) {
          const win = Math.random() < 0.35;
          if (win) { const g = Math.round(s.money * 0.7); s.money += g; s.stats.mental += 2; s.flags.riskInvest = true; return `테마주가 급등했어요! +${g}만 원. 딸은 "내가 봤다니까"라며 좋아합니다.`; }
          const l = Math.round(s.money * 0.45); s.money = Math.max(0, s.money - l); s.stress = clamp(s.stress + 10, 0, 100); s.flags.riskInvest = true; s.flags.riskLoss = true; s.debt = (s.debt || 0) + 90;
          return `차트가 무너졌어요. -${l}만 원. 게다가 친구에게 빌린 90만 원까지 갚아야 합니다. 딸은 한동안 앱을 열지 않았습니다.`;
        } },
        { label: '학원비에 올인', hint: '학업 ↑ · 자산 ↓',
          apply(s) { s.money = Math.max(0, s.money - 80); s.stats.academic += 6; s.stress = clamp(s.stress + 6, 0, 100); return '딸은 "차라리 공부에 쓰는 게 낫다"며 특강을 신청했어요.'; } },
      ],
    },
    {
      id: 'audition', weight: 4, kicker: 'K-POP · 글로벌 붐', title: '길거리 캐스팅 제안을 받았어요',
      desc: '홍대에서 연습생 스카우트가 명함을 건넸어요. "목소리랑 표정이 좋다"고 합니다.',
      when: (s) => ageOf(s) >= 12 && s.stats.charm >= 38,
      choices: [
        { label: '오디션에 도전해 보기', hint: '매력 ↑ · 예술 ↑ · 학업 ↓',
          apply(s) { s.stats.charm += 5; s.stats.art += 4; s.stats.academic = Math.max(0, s.stats.academic - 2); s.stress = clamp(s.stress + 8, 0, 100); s.money += 30; s.flags.cast = true; return '오디션장에서 세 시간을 기다렸어요. 결과는 아직이지만 딸의 눈이 반짝입니다.'; } },
        { label: '지금은 본업에 집중', hint: '학업 ↑ · 멘탈 ↑',
          apply(s) { s.stats.academic += 4; s.stats.mental += 4; return '명함을 서랍에 넣고 다시 책상에 앉았어요. "지금은 때가 아니야."'; } },
      ],
    },
    {
      id: 'hagwon', weight: 6, kicker: '사교육 경쟁', title: '반 친구들은 다 선행학습 중이래요',
      desc: '학부모 단체방에 "이번 방학 특강" 안내가 올라왔어요. 옆집 아이는 이미 두 단계 앞서 있습니다.',
      when: (s) => ageOf(s) >= 11 && s.money >= 50,
      choices: [
        { label: '특강 추가 등록', hint: '학업 ↑ · 자산 ↓ · 스트레스 ↑',
          apply(s) { s.money = Math.max(0, s.money - 50); s.stats.academic += 7; s.stress = clamp(s.stress + 10, 0, 100); return '주말도 학원이 되었어요. 딸은 조용히 가방을 쌌습니다.'; } },
        { label: '소신껏 딸이 좋아하는 것을 밀어주기', hint: '예술 ↑ · 멘탈 ↑ · 스트레스 ↓',
          apply(s) { s.stats.art += 5; s.stats.mental += 5; s.stress = clamp(s.stress - 6, 0, 100); s.flags.ownPace = true; return '대신 미술 학원을 보내줬어요. "엄마, 나 이거 할 때 제일 행복해."'; } },
      ],
    },
    {
      id: 'examWeek', weight: 5, kicker: '학교 생활', title: '중간고사가 일주일 앞이에요',
      desc: '딸이 시험 범위를 펼쳐 놓고 한숨을 쉬었어요. "밤새면 다 외울 수 있을까?"',
      when: (s) => ageOf(s) >= 11,
      choices: [
        { label: '밤새 함께 공부한다', hint: '학업 ↑ · 체력 ↓ · 스트레스 ↑',
          apply(s) { s.stats.academic += 7; s.stats.stamina = Math.max(0, s.stats.stamina - 3); s.stress = clamp(s.stress + 12, 0, 100); return '새벽 2시, 딸이 스스로 책을 덮었어요. "나 잘했지?"'; } },
        { label: '평소 페이스대로', hint: '학업 ↑ · 스트레스 소폭 ↑',
          apply(s) { s.stats.academic += 2; s.stress = clamp(s.stress + 3, 0, 100); return '무리하지 않고 잠을 지켰어요. 성적은 평소만큼 나왔습니다.'; } },
      ],
    },
    {
      id: 'heatwave', weight: 3, kicker: '기후 위기 · 폭염', title: '폭염 경보가 내렸어요',
      desc: '낮 최고 38도. 에어컨 없이는 지내기 힘든 날이 이어지고 있어요.',
      when: (s) => { const p = periodInfo(s); return p.season === '여름' || (p.month >= 6 && p.month <= 8); },
      choices: [
        { label: '시원하게 집에서 보내기', hint: '스트레스 ↓ · 자산 ↓',
          apply(s) { s.stress = clamp(s.stress - 8, 0, 100); s.stats.stamina += 2; s.money = Math.max(0, s.money - 15); return '전기요금이 걱정되지만, 아이의 건강이 먼저죠. 수박을 먹으며 영화를 봤어요.'; } },
        { label: '그래도 운동은 나간다', hint: '체력 ↑ · 스트레스 ↑',
          apply(s) { s.stats.stamina += 6; s.stress = clamp(s.stress + 6, 0, 100); return '땀을 뻘뻘 흘리며 운동장을 돌았어요. "더위는 이기는 거야."'; } },
      ],
    },
    {
      id: 'cyber', weight: 4, kicker: '사이버 폭력', title: 'SNS에 악플이 달렸어요',
      desc: '딸의 게시물에 모르는 사람이 상처가 되는 댓글을 남겼어요. 딸은 폰을 뒤집어 놓았습니다.',
      when: (s) => ageOf(s) >= 12 && (s.flags.creator || s.counts.creator >= 1 || s.flags.cast),
      choices: [
        { label: '함께 신고하고 마음을 돌보기', hint: '멘탈 ↑ · 스트레스 ↓',
          apply(s) { s.stats.mental += 6; s.stress = clamp(s.stress - 6, 0, 100); s.flags.resilient = true; return '신고 버튼을 누르고, 좋아하는 음식을 먹으며 이야기를 나눴어요. "별일 아니야"라고 말하는 목소리가 조금 안정됐습니다.'; } },
        { label: '신경 쓰지 말라고만 하기', hint: '멘탈 ↓ · 스트레스 ↑',
          apply(s) { s.stats.mental = Math.max(0, s.stats.mental - 4); s.stress = clamp(s.stress + 8, 0, 100); return '딸은 "알았어"라고만 하고 방에 들어갔어요. 문을 닫는 소리가 크게 들렸습니다.'; } },
      ],
    },
    {
      id: 'friend', weight: 4, kicker: '친구 관계', title: '친구와 다툰 날',
      desc: '딸이 가방을 내려놓으며 말했어요. "걔는 나한테만 그렇게 말해."',
      when: (s) => ageOf(s) >= 11,
      choices: [
        { label: '먼저 사과해 보자고 하기', hint: '멘탈 ↑ · 매력 ↑',
          apply(s) { s.stats.mental += 6; s.stats.charm += 3; s.stress = clamp(s.stress - 4, 0, 100); return '다음 날 딸이 먼저 말을 걸었어요. 둘은 떡볶이를 먹으러 갔습니다.'; } },
        { label: '시간을 두고 지켜보기', hint: '스트레스 ↑',
          apply(s) { s.stress = clamp(s.stress + 5, 0, 100); s.stats.mental += 1; return '며칠 조용했지만, 결국 딸이 스스로 방법을 찾았어요.'; } },
      ],
    },
    {
      id: 'health', weight: 4, kicker: '건강', title: '검진 결과가 나왔어요',
      desc: '또래보다 체력이 많이 떨어졌다는 결과가 나왔어요. 요즘 계속 피곤해 보였습니다.',
      when: (s) => s.stats.stamina <= 30,
      choices: [
        { label: '운동을 시작한다', hint: '체력 ↑ · 자산 ↓',
          apply(s) { s.stats.stamina += 8; s.stress = clamp(s.stress - 4, 0, 100); s.money = Math.max(0, s.money - 20); return '주 3회 줄넘기부터 시작했어요. 한 달 뒤, 계단을 쉬지 않고 올라갑니다.'; } },
        { label: '영양제를 챙긴다', hint: '체력 ↑ · 자산 ↓',
          apply(s) { s.stats.stamina += 3; s.money = Math.max(0, s.money - 10); return '비타민과 오메가3를 식탁 위에 올려두었어요.'; } },
      ],
    },
    {
      id: 'scholarship', weight: 3, kicker: '반가운 소식', title: '성적 우수 장학금 대상자로 뽑혔어요',
      desc: '학교에서 장학금 안내문이 왔어요. 딸의 이름이 또렷하게 적혀 있습니다.',
      when: (s) => s.stats.academic >= 65,
      choices: [
        { label: '기쁘게 받는다', hint: '자산 ↑ · 멘탈 ↑',
          apply(s) { s.money += 100; s.stats.mental += 3; return '장학금 100만 원. 딸은 "내가 번 거야"라며 통장을 몇 번이나 열어봤어요.'; } },
      ],
    },
    {
      id: 'club', weight: 4, kicker: '동아리', title: '"코딩 동아리 같이 하자"',
      desc: '딸의 친구가 동아리 가입을 권했어요. 방과 후에 앱을 만든다고 합니다.',
      when: (s) => s.stats.coding >= 35 && ageOf(s) >= 13,
      choices: [
        { label: '수락한다', hint: '코딩 ↑ · 스트레스 ↑',
          apply(s) { s.stats.coding += 5; s.stress = clamp(s.stress + 5, 0, 100); s.flags.club = true; return '첫 프로젝트는 급식 메뉴 알림 앱. 친구들이 진짜로 써줬어요.'; } },
        { label: '지금은 사양한다', hint: '스트레스 ↓',
          apply(s) { s.stress = clamp(s.stress - 3, 0, 100); s.stats.mental += 1; return '딸은 아쉬워했지만, 지금 하는 일에 집중하기로 했어요.'; } },
      ],
    },
    {
      id: 'burnout', weight: 12, kicker: '마음 건강', title: '요즘 딸이 말수가 줄었어요',
      desc: '밥을 반쯤 남기고 방에 들어갑니다. "괜찮아"라고만 해요. 스트레스가 한계에 가까워 보입니다.',
      when: (s) => s.stress >= 72,
      choices: [
        { label: '무조건 하루 쉬게 한다', hint: '스트레스 ↓↓ · 학업 소폭 ↓',
          apply(s) { s.stress = clamp(s.stress - 25, 0, 100); s.stats.academic = Math.max(0, s.stats.academic - 2); s.stats.mental += 4; return '아무 계획 없이 하루를 보냈어요. 저녁에 딸이 먼저 "고마워"라고 했습니다.'; } },
        { label: '조금만 더 버텨보자', hint: '스트레스 ↑ · 멘탈 ↓',
          apply(s) { s.stress = clamp(s.stress + 8, 0, 100); s.stats.mental = Math.max(0, s.stats.mental - 5); return '딸은 고개를 끄덕였지만, 방 문은 오래 닫혀 있었어요.'; } },
      ],
    },
    {
      id: 'career', weight: 5, kicker: '진로 대화', title: '"나 커서 뭐 해야 해?"',
      desc: '저녁 식탁에서 딸이 물었어요. "좋아하는 걸 해야 해, 아니면 잘하는 걸 해야 해?"',
      when: (s) => ageOf(s) >= 15,
      choices: [
        { label: '안정적인 길도 좋다고 말하기', hint: '멘탈 ↑ · 학업 ↑',
          apply(s) { s.stats.mental += 5; s.stats.academic += 3; s.flags.stable = true; return '딸은 "그럼 공무원이나 대기업?"이라며 웃었어요. 현실적인 감각이 생겼습니다.'; } },
        { label: '하고 싶은 걸 해보라고 말하기', hint: '매력 ↑ · 예술 ↑',
          apply(s) { s.stats.charm += 3; s.stats.art += 3; s.flags.dreamer = true; return '딸의 눈이 커졌어요. "진짜? 실패해도?" "응, 우리가 있잖아."'; } },
        { label: '아직 모르겠다고 솔직하게', hint: '멘탈 ↑',
          apply(s) { s.stats.mental += 3; s.stress = clamp(s.stress - 3, 0, 100); return '"같이 찾아보자." 딸이 고개를 끄덕였어요.'; } },
      ],
    },
  ];

  /* ---------------- 이중생활 발각 이벤트 (조건부) ----------------
     유대감·스트레스·도덕성이 엇나가 일탈도가 쌓였을 때만 찾아옵니다. */
  const DISCOVERY_EVENTS = [
    {
      id: 'disc_absence', discovery: true, weight: 12,
      kicker: '수상한 낌새 · 학원 문자', title: '학원에서 결석 문자가 왔어요',
      desc: '"오늘 수업에 참석하지 않았습니다." 문자를 보고 물었더니, 딸은 "조퇴했어"라고만 합니다. 가방에서는 PC방 영수증이 떨어졌습니다.',
      when: (s) => (s.deviance || 0) >= 25,
      choices: [
        { label: '단호하게 사실을 확인한다', hint: '유대감 ↓ · 일탈도 ↓↓',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance - 12, 0, 100); s.bond = clamp(s.bond - 6, 0, 100); s.stress = clamp(s.stress + 6, 0, 100); s.stats.mental += 2; return '딸은 결국 학원에 가지 않았다고 인정했어요. "죄송해요"라는 말을 남기고 방에 들어갔습니다.'; } },
        { label: '왜 그랬는지 들어준다', hint: '유대감 ↑ · 일탈도 ↓',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance - 7, 0, 100); s.bond = clamp(s.bond + 8, 0, 100); s.stress = clamp(s.stress - 6, 0, 100); s.stats.mental += 3; return '"숨이 막혔어." 딸이 처음으로 솔직하게 말했어요. 안아주자 어깨가 풀렸습니다.'; } },
        { label: '모른 척 넘어간다', hint: '유대감 ↓ · 일탈도 ↑',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance + 8, 0, 100); s.bond = clamp(s.bond - 4, 0, 100); return '딸은 안도한 듯했지만, 다음 주에도 같은 문자가 왔습니다.'; } },
      ],
    },
    {
      id: 'disc_witness', discovery: true, weight: 10,
      kicker: '수상한 낌새 · 지인의 제보', title: '"어제 PC방에서 딸을 봤어요"',
      desc: '이웃집 엄마에게서 연락이 왔어요. "학원 시간에 애들이랑 PC방에 있던데…" 딸은 그 시간에 학원에 있었다고 했습니다.',
      when: (s) => (s.deviance || 0) >= 25,
      choices: [
        { label: '증거를 들고 조용히 이야기한다', hint: '유대감 ↓ · 일탈도 ↓↓',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance - 11, 0, 100); s.bond = clamp(s.bond - 5, 0, 100); s.stress = clamp(s.stress + 4, 0, 100); return '딸의 얼굴이 굳었어요. 변명을 하다가 결국 고개를 숙였습니다.'; } },
        { label: '친구 문제부터 물어본다', hint: '유대감 ↑ · 일탈도 ↓',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance - 6, 0, 100); s.bond = clamp(s.bond + 7, 0, 100); s.stats.mental += 2; return '"그 애들이랑 있으면 편해. 집에서는 자꾸 뭐라 하잖아." 딸의 말에 할 말을 잃었습니다.'; } },
      ],
    },
    {
      id: 'disc_card', discovery: true, weight: 9,
      kicker: '수상한 낌새 · 카드 내역', title: '카드 내역에 모르는 결제가 찍혔어요',
      desc: '용돈을 준 적 없는 시간에 편의점, 코인노래방, PC방 결제가 줄줄이 찍혀 있어요. 딸은 "친구가 샀어"라고 합니다.',
      when: (s) => (s.deviance || 0) >= 25 && ageOf(s) >= 12,
      choices: [
        { label: '용돈과 지출을 함께 정리한다', hint: '유대감 ↑ · 일탈도 ↓',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance - 8, 0, 100); s.bond = clamp(s.bond + 6, 0, 100); s.money = Math.max(0, s.money - 20); return '가계부를 같이 쓰기로 했어요. 딸이 "다음엔 말하고 쓸게"라고 했습니다.'; } },
        { label: '크게 혼낸다', hint: '유대감 ↓ · 일탈도 ↓',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance - 10, 0, 100); s.bond = clamp(s.bond - 7, 0, 100); s.stress = clamp(s.stress + 8, 0, 100); return '딸은 울면서 방에 들어갔어요. 다음 날부터 말수가 확 줄었습니다.'; } },
        { label: '그냥 넘긴다', hint: '일탈도 ↑',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance + 9, 0, 100); s.bond = clamp(s.bond - 2, 0, 100); return '딸은 웃으며 "고마워"라고 했지만, 카드 내역은 계속 늘었습니다.'; } },
      ],
    },
    {
      id: 'disc_street', discovery: true, weight: 8,
      kicker: '수상한 낌새 · 우연한 목격', title: '길에서 딸을 마주쳤어요',
      desc: '퇴근길, 골목에서 딸을 봤어요. 교복 위에 후드티를 걸치고, 담배 연기가 나는 무리 속에 있었습니다. 딸은 "잠깐 지나가는 길"이라고 합니다.',
      when: (s) => (s.deviance || 0) >= 35 && ageOf(s) >= 14,
      choices: [
        { label: '그 자리에서 데리고 집으로 온다', hint: '유대감 ↓ · 일탈도 ↓↓',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance - 14, 0, 100); s.bond = clamp(s.bond - 8, 0, 100); s.stress = clamp(s.stress + 10, 0, 100); s.stats.mental += 2; return '집으로 오는 내내 딸은 아무 말도 하지 않았어요. 현관에서 "미안해요"라고 했습니다.'; } },
        { label: '다음 날 조용히 물어본다', hint: '유대감 ↑ · 일탈도 ↓',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance - 8, 0, 100); s.bond = clamp(s.bond + 6, 0, 100); s.stats.mental += 3; return '"그냥… 집에 있기 싫었어." 딸이 처음으로 약한 모습을 보였습니다.'; } },
        { label: '모른 척 지나친다', hint: '일탈도 ↑↑',
          apply(s) { s.clues = Math.min(9, (s.clues || 0) + 1); s.deviance = clamp(s.deviance + 12, 0, 100); s.bond = clamp(s.bond - 5, 0, 100); return '딸은 우리를 보지 못한 척했습니다. 다음 날, 딸의 방에서 낯선 향 냄새가 났어요.'; } },
      ],
    },
  ];
  EVENTS.push({
    id: 'overspend', weight: 5,
    kicker: '21세기 소비 · 영끌', title: '친구들은 다 가진 게 있대요',
    desc: '한정판 운동화와 최신 스마트폰 이야기가 식탁에서 나옵니다. 딸은 "할부로 하면 한 달에 얼마 안 해"라고 말해요.',
    when: (s) => ageOf(s) >= 13,
    choices: [
      { label: '할부로 사준다', hint: '매력 ↑ · 자산 ↓ · 빚 ↑',
        apply(s) { const price = 120; const pay = Math.min(s.money, price); s.money -= pay; s.debt = (s.debt || 0) + (price - pay); s.stats.charm += 6; s.stress = clamp(s.stress + 4, 0, 100); s.flags.overspent = true; return '딸은 좋아했지만, 다음 달 할부 문자가 날아왔습니다. ' + (price - pay) + '만 원이 빚으로 남았어요.'; } },
      { label: '필요한 것만 사 준다', hint: '멘탈 ↑',
        apply(s) { s.stats.mental += 4; s.money = Math.max(0, s.money - 20); return '딸은 조금 아쉬워했지만, "지금은 이걸로 충분해"라고 했습니다.'; } },
      { label: '스스로 모아서 사게 한다', hint: '멘탈 ↑ · 학업 ↑',
        apply(s) { s.stats.mental += 3; s.stats.academic += 2; s.bond = clamp(s.bond + 3, 0, 100); return '딸은 알바를 시작했어요. 석 달 뒤, 직접 산 운동화를 신고 나갔습니다.'; } },
    ],
  });

  /* ---------------- 집안 형편 · 가족 이벤트 ---------------- */
  EVENTS.push(
    {
      id: 'hh_startup', weight: 5, kicker: '가족 경제 · 도전', title: '아빠가 창업을 고민하고 있어요',
      desc: '퇴사하고 작은 가게를 열고 싶다는 말을 꺼냈어요. 딸은 식탁에서 조용히 듣고 있습니다.',
      when: (s) => ageOf(s) >= 12,
      choices: [
        { label: '딸과 상의하고 도전한다', hint: '대박 또는 위기 · 유대감 ↑',
          apply(s) {
            if (Math.random() < 0.45) {
              s.money += 700; s.bond = clamp(s.bond + 8, 0, 100); s.stress = clamp(s.stress - 4, 0, 100); s.stats.mental += 2; s.flags.familyBiz = true;
              return '가게가 자리를 잡았어요! 첫 달 매출이 생각보다 좋습니다. 딸이 "우리 아빠 멋있다"고 했어요.';
            }
            const loss = Math.min(s.money, 150);
            s.money -= loss; s.bond = clamp(s.bond + 3, 0, 100); s.stress = clamp(s.stress + 10, 0, 100); s.stats.mental += 1;
            return '생각보다 손님이 없었어요. ' + loss + '만 원이 사라졌지만, 딸은 "그래도 도전한 거잖아"라고 했습니다.';
          } },
        { label: '지금은 안정이 먼저', hint: '자산 소폭 ↑ · 멘탈 ↑',
          apply(s) { s.money += 40; s.stats.mental += 2; s.bond = clamp(s.bond - 1, 0, 100); return '월급은 소중하니까요. 딸은 "그럴 수 있지"라고 담담하게 말했어요.'; } },
        { label: '작게 시작해 본다', hint: '자산 ↑ · 유대감 ↑ · 스트레스 ↑',
          apply(s) { s.money += 120; s.stress = clamp(s.stress + 4, 0, 100); s.bond = clamp(s.bond + 4, 0, 100); return '주말에만 여는 작은 가게를 시작했어요. 딸도 가끔 계산대에 서 봅니다.'; } },
      ],
    },
    {
      id: 'hh_crisis', weight: 6, kicker: '가족 경제 · 위기', title: '갑작스러운 병원비가 생겼어요',
      desc: '할머니가 다치셔서 병원비가 필요합니다. 통장 잔고를 보며 한숨이 나옵니다.',
      when: (s) => ageOf(s) >= 11,
      choices: [
        { label: '딸에게 솔직히 말한다', hint: '유대감 ↑↑ · 자산 ↓',
          apply(s) { const cost = Math.min(s.money, 80); s.money -= cost; s.bond = clamp(s.bond + 10, 0, 100); s.stats.mental += 3; s.stress = clamp(s.stress + 4, 0, 100); return '"우리 조금 아껴 쓰자." 딸이 먼저 말했어요. ' + cost + '만 원이 나갔지만 마음은 가까워졌습니다.'; } },
        { label: '숨기고 혼자 해결한다', hint: '스트레스 ↑ · 유대감 ↓',
          apply(s) { const cost = Math.min(s.money, 120); s.money -= cost; s.stress = clamp(s.stress + 14, 0, 100); s.bond = clamp(s.bond - 4, 0, 100); s.deviance = clamp((s.deviance || 0) + 2, 0, 100); return '딸은 뭔가 이상하다는 걸 눈치챘지만 아무것도 묻지 않았어요. 밤마다 계산기를 두드렸습니다.'; } },
        { label: '가족회의를 연다', hint: '유대감 ↑ · 자산 ↓',
          apply(s) { const cost = Math.min(s.money, 90); s.money -= cost; s.bond = clamp(s.bond + 6, 0, 100); s.stats.mental += 2; return '셋이 머리를 맞대고 지출을 정리했어요. 딸이 "나도 아껴 쓸게"라고 했습니다.'; } },
      ],
    },
    {
      id: 'hh_scam', weight: 4, kicker: '가족 경제 · 사기', title: '"고수익 보장" 투자 리딩방 초대',
      desc: '아빠 휴대폰에 낯선 사람이 "3개월 안에 두 배"라며 투자방 링크를 보냈어요. 딸도 옆에서 화면을 보고 있습니다.',
      when: (s) => ageOf(s) >= 13,
      choices: [
        { label: '참여해 본다', hint: '대박 또는 사기 피해',
          apply(s) {
            if (Math.random() < 0.3) { s.money += 400; s.stats.mental += 1; return '운 좋게 수익이 났어요. 하지만 이런 일이 다시 오지 않기를 바랍니다.'; }
            const loss = Math.min(s.money, 300); s.money -= loss; s.stress = clamp(s.stress + 12, 0, 100); s.flags.scammed = true;
            return '링크가 사라지고 연락도 끊겼어요. ' + loss + '만 원을 잃었습니다. 딸이 "역시 사기였네"라고 했어요.';
          } },
        { label: '딸과 함께 사기 수법을 알아본다', hint: '코딩 ↑ · 유대감 ↑',
          apply(s) { s.stats.coding += 3; s.bond = clamp(s.bond + 4, 0, 100); s.stats.mental += 2; return '둘이서 보이스피싱 사례를 찾아봤어요. 딸이 "이건 진짜 위험하다"며 링크를 지웠습니다.'; } },
        { label: '무시하고 차단한다', hint: '멘탈 ↑',
          apply(s) { s.stats.mental += 2; return '수상한 링크는 차단하는 게 최고예요. 오늘도 무사히 넘어갔습니다.'; } },
      ],
    },
    {
      id: 'hh_appliance', weight: 5, kicker: '가족 경제 · 지출', title: '세탁기가 고장 났어요',
      desc: '빨래가 쌓여 있는데 세탁기가 멈췄어요. 수리비 견적은 60만 원입니다.',
      when: (s) => ageOf(s) >= 10,
      choices: [
        { label: '바로 고친다', hint: '자산 ↓ · 멘탈 ↑',
          apply(s) { const cost = Math.min(s.money, 60); s.money -= cost; s.stats.mental += 1; return '수리 기사님이 와서 30분 만에 고쳐주셨어요. ' + cost + '만 원이 들었지만 집이 다시 평화로워졌습니다.'; } },
        { label: '일단 미룬다', hint: '스트레스 ↑ · 유대감 ↓',
          apply(s) { s.stress = clamp(s.stress + 6, 0, 100); s.bond = clamp(s.bond - 2, 0, 100); return '한 주 동안 손빨래를 했어요. 딸은 "왜 아직도 안 고쳐?"라고 했습니다.'; } },
        { label: '딸과 함께 고쳐본다', hint: '코딩 ↑ · 유대감 ↑',
          apply(s) { s.stats.coding += 2; s.bond = clamp(s.bond + 4, 0, 100); s.stress = clamp(s.stress + 2, 0, 100); return '유튜브를 보며 부품을 분해했어요. 결국 고쳤고, 딸이 "우리 팀워크 대박"이라며 웃었습니다.'; } },
      ],
    },
    {
      id: 'hh_help', weight: 6, kicker: '가족 경제 · 살림', title: '딸이 살림을 보태겠대요',
      desc: '딸이 알바로 모은 돈을 내밀며 "학원비에 보태 써"라고 합니다. 통장 잔고가 빠듯한 걸 알고 있었어요.',
      when: (s) => s.money < 220 && ageOf(s) >= 14,
      choices: [
        { label: '고맙게 받는다', hint: '자산 ↑ · 유대감 ↑↑',
          apply(s) { s.money += 100; s.bond = clamp(s.bond + 8, 0, 100); s.stats.mental += 3; s.stress = clamp(s.stress - 2, 0, 100); return '딸의 손에서 100만 원을 받았어요. "우리 같이 버티자." 코끝이 찡했습니다.'; } },
        { label: '네 몫은 네가 써', hint: '유대감 ↑ · 멘탈 ↑',
          apply(s) { s.bond = clamp(s.bond + 4, 0, 100); s.stats.mental += 2; return '딸은 조금 서운했지만, "내 돈은 내가 쓸게"라며 웃었습니다.'; } },
      ],
    },
    {
      id: 'hh_housing', weight: 4, kicker: '가족 경제 · 주거', title: '월세가 올랐어요',
      desc: '집주인이 월세를 올리겠다고 합니다. 이사할지, 버틸지 고민됩니다.',
      when: (s) => ageOf(s) >= 13,
      choices: [
        { label: '이사한다', hint: '자산 ↓ · 스트레스 ↑',
          apply(s) { const cost = Math.min(s.money, 100); s.money -= cost; s.stress = clamp(s.stress + 6, 0, 100); s.bond = clamp(s.bond + 2, 0, 100); return '짐을 싸는 데 한 달이 걸렸어요. 새 집은 조금 작지만 햇빛이 좋습니다.'; } },
        { label: '버틴다', hint: '자산 ↓ · 스트레스 ↑',
          apply(s) { const cost = Math.min(s.money, 50); s.money -= cost; s.stress = clamp(s.stress + 8, 0, 100); return '월세를 올려 드리고 버티기로 했어요. 지출이 늘었습니다.'; } },
        { label: '딸과 함께 지출을 줄인다', hint: '유대감 ↑ · 자산 ↓',
          apply(s) { const cost = Math.min(s.money, 30); s.money -= cost; s.bond = clamp(s.bond + 6, 0, 100); s.stats.mental += 2; return '가계부를 같이 쓰며 구독을 정리했어요. 딸이 "이거 안 쓰면 아껴"라고 알려줬습니다.'; } },
      ],
    }
  );

  DISCOVERY_EVENTS.forEach((e) => { EVENTS.push(e); });

  const EVENT_BY_ID = {};
  EVENTS.forEach((e) => { EVENT_BY_ID[e.id] = e; });

  /* ---------------- 가을 축제 · 전국 대회 ---------------- */
  const FESTIVAL = {
    kicker: '가을 · 교내 축제 & 전국 대회',
    title: '올해의 가을, 무엇에 도전할까요?',
    desc: '참가 신청서가 책상 위에 놓여 있어요. 딸이 어떤 무대에 서고 싶은지 물어봐 주세요.',
    choices: [
      { id: 'hack', label: '코딩 해커톤', icon: '💻', test: 'coding', flag: 'hackWin' },
      { id: 'exam', label: '전국 학력 경시대회', icon: '📚', test: 'academic', flag: 'examWin' },
      { id: 'song', label: '교내 댄스·가요제', icon: '🎤', test: 'art', flag: 'songWin' },
      { id: 'skip', label: '이번엔 쉬어갈래요', icon: '🛋️', test: null, flag: null },
    ],
  };

  function resolveFestival(s, choiceId, rng) {
    const R = rng || Math.random;
    const c = FESTIVAL.choices.find((x) => x.id === choiceId) || FESTIVAL.choices[3];
    const before = snapshot(s);
    if (!c.test) {
      s.stress = clamp(s.stress - 4, 0, 100);
      s.stats.mental += 2;
      return { choice: c, title: '이번 가을은 쉬어가기', text: '딸은 축제 구경만 하기로 했어요. 친구들과 솜사탕을 먹으며 웃는 얼굴이 좋았습니다.', chips: diffChips(before, s) };
    }
    const value = s.stats[c.test] || 0;
    const score = value + (R() * 26 - 10) + (s.stats.mental * 0.12);
    s.stress = clamp(s.stress + 9, 0, 100);
    let title, text;
    if (score >= 66) {
      s.money += 300;
      s.flags[c.flag] = true;
      s.stats[c.test] += 5;
      s.stats.charm += 3;
      title = '🏆 우승!';
      text = '이름이 호명되는 순간, 딸이 관중석을 바라봤어요. 우승 상금 300만 원과 함께 집으로 돌아왔습니다.';
    } else if (score >= 50) {
      s.money += 100;
      s.stats[c.test] += 2;
      s.stats.mental += 2;
      title = '🥈 준우승';
      text = '한 끗 차이였어요. 상금 100만 원. 딸은 "다음엔 내가 1등"이라며 웃었습니다.';
    } else {
      s.money += 20;
      s.stats.mental += 3;
      title = '참가 완료';
      text = '결과는 아쉬웠지만, 무대에 끝까지 서 있었어요. 참가 기념품과 20만 원을 받았습니다.';
    }
    return { choice: c, title, text, chips: diffChips(before, s), win: score >= 66, second: score >= 50 && score < 66 };
  }

  /* ---------------- 상태 ---------------- */
  function newState(name, blood, tempoKey, householdKey) {
    const tKey = TEMPO[tempoKey] ? tempoKey : 'quarter';
    const hKey = householdKey === 'random'
      ? pickOne(Object.keys(HOUSEHOLDS))
      : (HOUSEHOLDS[householdKey] ? householdKey : 'normal');
    const hh = HOUSEHOLDS[hKey];
    const s = {
      v: 3,
      name: (name || '').trim().slice(0, 10) || '서연',
      blood: BLOOD[blood] ? blood : 'A',
      tempo: tKey,
      turn: 0,
      stats: { stamina: 12, academic: 14, coding: 8, art: 10, charm: 12, mental: 14 },
      stress: 8,
      money: hh.money,
      household: hKey,
      bond: 55,
      dadMode: 'time',
      debt: 0,
      deviance: 0,
      clues: 0,
      personality: PERSONALITY_KEYS[Math.floor(Math.random() * PERSONALITY_KEYS.length)],
      personalityRevealed: false,
      prefs: null,
      revealedPrefs: [],
      suggestion: null,
      hooked: 0,
      flags: {},
      counts: {},
      slots: new Array(TEMPO[tKey].slotsPerTurn).fill(null),
      history: [],
      createdAt: Date.now(),
    };
    const b = BLOOD[s.blood];
    Object.keys(b.bonus).forEach((k) => { s.stats[k] += b.bonus[k]; });
    Object.keys(hh.bonus || {}).forEach((k) => { s.stats[k] += hh.bonus[k]; });
    s.prefs = buildPrefs(s.personality);
    s.titleHistory = [];
    const t0 = personalityTitle(s);
    s.titleId = t0.id;
    s.titleLabel = t0.label;
    s.titleHistory.push({
      turn: 0, age: START_AGE, period: START_YEAR + '년',
      from: null, to: t0.label, toId: t0.id, reason: '10세, 육성이 시작되었어요',
    });
    return s;
  }

  function periodInfo(s, turnOverride) {
    const t = typeof turnOverride === 'number' ? turnOverride : s.turn;
    const tempo = TEMPO[s.tempo] || TEMPO.quarter;
    const yearIdx = Math.floor(t / tempo.perYear);
    const i = ((t % tempo.perYear) + tempo.perYear) % tempo.perYear;
    const year = START_YEAR + yearIdx;
    const age = START_AGE + yearIdx;
    let season = null;
    let month = null;
    let emoji = '';
    if (tempo.perYear === 4) {
      season = SEASONS[i];
      emoji = season.emoji;
    } else {
      month = i + 1;
      emoji = MONTH_EMOJI[month] || '';
    }
    return {
      turn: t, year, age, grade: gradeOf(age), season: season ? season.name : null,
      month, emoji, yearIdx,
      label: season ? `${year}년 ${season.name}` : `${year}년 ${month}월`,
      sub: season ? season.months : `${month}월`,
      isAutumn: season ? !!season.festival : month === 10,
      progress: clamp(t / tempo.turns, 0, 1),
    };
  }

  function ageOf(s) {
    if (typeof s.age === 'number') return s.age;
    return periodInfo(s).age;
  }

  function snapshot(s) {
    return { stats: Object.assign({}, s.stats), stress: s.stress, money: s.money, bond: s.bond };
  }

  function diffChips(before, s) {
    const chips = [];
    STAT_KEYS.forEach((k) => {
      const d = s.stats[k] - before.stats[k];
      if (d) chips.push({ key: k, label: STAT_META[k].label, delta: d, kind: 'stat' });
    });
    const dm = s.money - before.money;
    if (dm) chips.push({ key: 'money', label: '자산', delta: dm, kind: 'money' });
    const ds = s.stress - before.stress;
    if (ds) chips.push({ key: 'stress', label: '스트레스', delta: ds, kind: 'stress' });
    const db = (s.bond || 0) - (before.bond || 0);
    if (db) chips.push({ key: 'bond', label: '유대감', delta: db, kind: 'bond' });
    return chips;
  }

  /* ---------------- 일정 실행 ---------------- */
  // 능력치가 높아질수록 성장 폭이 줄어드는 감쇠 성장 (상한 220)
  function applyGain(s, key, raw) {
    const cur = s.stats[key] || 0;
    const damp = clamp(1 - cur / 220, 0.05, 1);
    if (!s.frac) s.frac = {};
    s.frac[key] = (s.frac[key] || 0) + raw * damp;
    const step = Math.trunc(s.frac[key]);
    if (step !== 0) {
      s.frac[key] -= step;
      s.stats[key] = clamp(cur + step, 0, 999);
    }
    return step;
  }

  function canDo(s, act) {
    return !!act && (!act.minAge || ageOf(s) >= act.minAge);
  }

  function prefOf(s, act) {
    return (s.prefs && s.prefs[act.id]) || 'neutral';
  }

  // 땡땡이 확률 — 바르게 자라면(유대감 높음·스트레스 낮음·일탈도 낮음) 0
  function hookyChance(s, act) {
    if (!act || act.cat === 'rest') return 0;
    if ((s.deviance || 0) < 15) return 0;
    let p = 0.04;
    p += Math.max(0, s.stress - 60) * 0.006;
    p += Math.max(0, 55 - s.bond) * 0.007;
    p += ((s.deviance || 0) - 15) * 0.006;
    const pref = prefOf(s, act);
    if (pref === 'like') p -= 0.10;
    if (pref === 'dislike') p += 0.08;
    if (s.bond >= 75) p -= 0.08;
    if (s.personality === 'rebel') p += 0.03;
    return clamp(p, 0, 0.5);
  }

  function resolveHooky(s, act, pref, before, R) {
    s.hooked = (s.hooked || 0) + 1;
    s.counts.hooky = (s.counts.hooky || 0) + 1;
    const known = (s.clues || 0) > 0;
    const alt = pickOne(['친구들과 놀기', '몰래 집에서 쉬기', 'PC방', '뒷골목 서성거리기'], R);
    s.deviance = clamp((s.deviance || 0) + 5, 0, 100);
    s.stress = clamp(s.stress - 7, 0, 100);
    if (known) s.bond = clamp(s.bond - 1, 0, 100);
    if (alt === 'PC방' || alt === '뒷골목 서성거리기') s.money = Math.max(0, s.money - 10);
    const flavor = known
      ? '학원에 가지 않고 ' + alt + '을(를) 했어요. 이제는 숨기지도 않습니다.'
      : '"학원 잘 다녀왔어요!" 딸이 환하게 웃으며 방에 들어갔어요. 그런데 오늘은 이상하게 성과가 없었습니다.';
    return {
      act: act, grade: 'hooky', flavor: flavor,
      reaction: known ? '뻔뻔하게 웃고 있어요.' : '표정이 조금 피곤해 보여요.',
      pref: pref, chips: known ? diffChips(before, s) : [], hiddenHooky: !known,
    };
  }

  function resolveSlot(s, actId, rng) {
    const R = rng || Math.random;
    const act = ACT_BY_ID[actId];
    if (!act) return null;
    if (!canDo(s, act)) return null;
    const before = snapshot(s);
    const pref = prefOf(s, act);

    // 조건이 쌓였을 때만 땡땡이 (유대감 낮음·스트레스·일탈도)
    if (act.cat !== 'rest' && R() < hookyChance(s, act)) {
      return resolveHooky(s, act, pref, before, R);
    }

    const focusVal = act.focus ? (s.stats[act.focus] || 0) : 0;
    let grade;

    if (act.cat === 'rest') {
      grade = R() < 0.22 ? 'great' : 'success';
    } else if (s.stress >= 88) {
      grade = 'fail';
    } else {
      let p = 0.94 - Math.max(0, s.stress - 45) * 0.006 + Math.min(0.05, focusVal / 2000);
      p = clamp(p, 0.52, 0.97);
      if (R() > p) grade = 'fail';
      else grade = R() < (0.10 + Math.min(0.14, focusVal / 700)) ? 'great' : 'success';
    }

    let mult = grade === 'great' ? 1.8 : grade === 'fail' ? 0.25 : 1;
    if (pref === 'like') mult *= 1.5;
    else if (pref === 'dislike') mult *= (s.bond >= 70 ? 0.7 : 0.5);

    Object.keys(act.gains || {}).forEach((k) => {
      applyGain(s, k, act.gains[k] * mult);
    });

    if (act.money) {
      let m = act.money * (grade === 'great' ? 1.6 : grade === 'fail' ? 0.5 : 1);
      if (pref === 'like') m *= 1.3;
      else if (pref === 'dislike') m *= 0.7;
      s.money += Math.max(1, Math.round(m));
    }
    if (act.cost) s.money = Math.max(0, s.money - act.cost);

    let ds = act.stress || 0;
    if (act.cat === 'rest') {
      if (pref === 'like' && ds < 0) ds *= 1.25;
      if (grade === 'great' && ds < 0) ds *= 1.3;
    } else {
      if (pref === 'like' && ds > 0) ds *= 0.65;
      if (pref === 'dislike' && ds > 0) ds *= (s.bond >= 70 ? 1.5 : 2);
      if (grade === 'great' && ds > 0) ds *= 0.85;
      if (grade === 'fail' && ds > 0) ds += 4;
    }
    s.stress = clamp(s.stress + Math.round(ds), 0, 100);

    s.counts[act.id] = (s.counts[act.id] || 0) + 1;

    if (act.id === 'creator' && grade !== 'fail' && R() < 0.10) {
      s.money += 80;
      s.flags.viral = true;
    }

    // 유대감 · 일탈도
    if (act.cat === 'rest') {
      s.bond = clamp(s.bond + (act.id === 'home' ? 1 : 3), 0, 100);
      s.deviance = clamp((s.deviance || 0) - 2, 0, 100);
    } else {
      if (pref === 'like') {
        s.bond = clamp(s.bond + 2, 0, 100);
        s.deviance = clamp((s.deviance || 0) - 1, 0, 100);
      } else if (pref === 'dislike') {
        // 스트레스가 쌓인 상태에서의 강요만 관계를 상하게 합니다.
        s.bond = clamp(s.bond - (s.stress >= 65 ? 2 : s.stress >= 45 ? 1 : 0), 0, 100);
        if (s.stress >= 65 || s.bond < 35) s.deviance = clamp((s.deviance || 0) + 1, 0, 100);
      }
      if (grade === 'fail' && s.stress >= 80) s.deviance = clamp((s.deviance || 0) + 1, 0, 100);
    }
    if (s.stress >= 85) s.deviance = clamp((s.deviance || 0) + 1, 0, 100);
    if (act.bondBonus) s.bond = clamp(s.bond + act.bondBonus, 0, 100);

    if (s.revealedPrefs.indexOf(act.id) < 0) s.revealedPrefs.push(act.id);

    const flavor = act.flavor[grade] || act.flavor.success;
    let reaction = '';
    if (pref === 'like') {
      reaction = pickOne(['눈이 반짝이며 먼저 나섰어요.', '시간 가는 줄 모르고 몰입했어요.', '"이거 재밌어!" 스스로 말했어요.'], R);
    } else if (pref === 'dislike') {
      reaction = pickOne(['"또 이거야…" 투덜거리며 나갔어요.', '시큰둥한 얼굴로 가방을 쌌습니다.', '하는 둥 마는 둥, 집중하지 못했어요.'], R);
    }
    return { act: act, grade: grade, flavor: flavor, reaction: reaction, pref: pref, chips: diffChips(before, s) };
  }

  /* ---------------- 대화 해석 (응원 vs 압박) ---------------- */
  function toneOf(s) {
    if (s.stress >= 72 || s.bond <= 38) return 'pressure';
    if (s.bond >= 64 && s.stress < 68) return 'support';
    return 'neutral';
  }

  function toneLine(tone, personality) {
    if (tone === 'support') {
      const m = {
        curious: '"같이 생각해줘서 고마워."', artistic: '"내 편이 되어줘서 좋아."',
        social: '"이야기 들어줘서 고마워."', active: '"믿어줘서 고마워!"',
        rebel: '"…뭐, 고맙다고."', warm: '"사랑해."',
      };
      return m[personality] || '"응원해줘서 고마워."';
    }
    if (tone === 'pressure') {
      const m = {
        curious: '"또 정답만 강요하잖아."', artistic: '"내 마음은 안 물어보면서."',
        social: '"그냥 들어주기만 해줘도 되는데."', active: '"숨 막혀 죽겠어."',
        rebel: '"됐어, 내가 알아서 할게."', warm: '"너무해…"',
      };
      return m[personality] || '"또 잔소리야…"';
    }
    return '딸은 조용히 고개를 끄덕였어요.';
  }

  function applyTone(s) {
    const tone = toneOf(s);
    if (tone === 'support') {
      s.bond = clamp(s.bond + 2, 0, 100);
      s.stats.mental += 1;
    } else if (tone === 'pressure') {
      s.bond = clamp(s.bond - 3, 0, 100);
      s.deviance = clamp((s.deviance || 0) + 2, 0, 100);
    } else {
      s.bond = clamp(s.bond + 1, 0, 100);
    }
    const label = tone === 'support' ? '응원으로 받아들였어요'
      : tone === 'pressure' ? '압박으로 받아들였어요' : '담담하게 받아들였어요';
    return { tone: tone, label: label, line: toneLine(tone, s.personality) };
  }

  function suggestActivity(s, rng) {
    if (!s.prefs) return null;
    const liked = ACTIVITIES.filter((a) => s.prefs[a.id] === 'like');
    if (!liked.length) return null;
    return pickOne(liked, rng).id;
  }

  // 턴 종료 시 가정 분위기 정산 — 바르게 키우면 일탈도가 0으로 수렴
  function endTurn(s) {
    if (s.stress >= 75) {
      s.bond = clamp(s.bond - 1, 0, 100);
      s.deviance = clamp((s.deviance || 0) + 1, 0, 100);
    }
    if (s.bond <= 35) s.deviance = clamp((s.deviance || 0) + 1, 0, 100);
    if (s.stress <= 45 && s.bond >= 65 && s.stats.mental >= 55) {
      s.deviance = clamp((s.deviance || 0) - 3, 0, 100);
    }
    if (s.bond >= 80 && s.stress <= 55) s.stress = clamp(s.stress - 1, 0, 100);
    if (s.dadMode === 'work') {
      s.bond = clamp(s.bond - 3, 0, 100);
      s.stress = clamp(s.stress + 2, 0, 100);
    } else {
      s.bond = clamp(s.bond + 2, 0, 100);
    }
    s.deviance = clamp(s.deviance || 0, 0, 100);
    return s;
  }

  function addAllowance(s) {
    const t = TEMPO[s.tempo] || TEMPO.quarter;
    const h = HOUSEHOLDS[s.household] || HOUSEHOLDS.normal;
    const base = (h.allowance && h.allowance[s.tempo]) || t.allowance;
    const extra = s.dadMode === 'work' ? Math.round(base * 0.9) : 0;
    const amt = base + extra;
    s.money += amt;
    return amt;
  }

  function pickEvent(s, rng) {
    const R = rng || Math.random;
    const recent = s.recentEvents || [];
    const pool = EVENTS.filter((e) => {
      if (recent.indexOf(e.id) >= 0) return false;
      try { return e.when ? !!e.when(s) : true; } catch (err) { return false; }
    });
    if (!pool.length) return null;
    const total = pool.reduce((a, e) => a + (e.weight || 1), 0);
    let r = R() * total;
    for (const e of pool) {
      r -= (e.weight || 1);
      if (r <= 0) return e;
    }
    return pool[pool.length - 1];
  }

  function pickDiscovery(s, rng) {
    if ((s.deviance || 0) < 25) return null;
    const R = rng || Math.random;
    const chance = clamp(0.16 + (s.deviance || 0) / 320, 0.16, 0.5);
    if (R() > chance) return null;
    const pool = EVENTS.filter((e) => e.discovery && !(s.flags && s.flags['disc_' + e.id]) && (!e.when || e.when(s)));
    if (!pool.length) return null;
    return pool[Math.floor(R() * pool.length)];
  }

  /* ---------------- 성격 칭호 (스탯·유대감·일탈도로 실시간 결정) ---------------- */
  const TITLES = {
    mask:     { id: 'mask',     label: '겉과 속이 다른 아이', emoji: '🫥', desc: '집에서는 착한데, 밖에서는 다른 얼굴이에요.' },
    secret:   { id: 'secret',   label: '비밀을 가진 아이',     emoji: '🤫', desc: '요즘 뭔가 숨기는 게 있는 것 같아요.' },
    rebel:    { id: 'rebel',    label: '예민한 반항아',       emoji: '😤', desc: '말을 걸면 날카롭게 튕겨내요.' },
    tired:    { id: 'tired',    label: '지친 완벽주의자',     emoji: '😮‍💨', desc: '잘 해내지만, 웃음이 줄었어요.' },
    artist:   { id: 'artist',   label: '자유로운 예술가',     emoji: '🎨', desc: '자기만의 색이 뚜렷해요.' },
    star:     { id: 'star',     label: '인기 많은 사교왕',    emoji: '✨', desc: '어디서든 사람이 모여요.' },
    model:    { id: 'model',    label: '다정한 모범생',       emoji: '📚', desc: '공부도 마음도 반듯해요.' },
    dev:      { id: 'dev',      label: '꿈꾸는 개발자',       emoji: '💻', desc: '코드로 뭔가 만들어 보는 게 즐거워요.' },
    ambition: { id: 'ambition', label: '당찬 야망가',         emoji: '🚀', desc: '목표가 생기면 물러서지 않아요.' },
    athlete:  { id: 'athlete',  label: '에너지 넘치는 활동가', emoji: '🏃', desc: '몸으로 부딪히며 자라요.' },
    warm:     { id: 'warm',     label: '따뜻한 마음씨',       emoji: '🤝', desc: '남의 아픔을 그냥 지나치지 못해요.' },
    homebody: { id: 'homebody', label: '방구석 아이',         emoji: '🛋️', desc: '밖으로 나가는 일이 점점 줄었어요.' },
    curious:  { id: 'curious',  label: '호기심 많은 꿈나무',  emoji: '🔍', desc: '"왜?"를 달고 살아요.' },
    artistic: { id: 'artistic', label: '감성 가득한 아이',    emoji: '🎨', desc: '조용히 자기 세계를 그려요.' },
    social:   { id: 'social',   label: '수다스러운 친구',     emoji: '💬', desc: '말하는 걸 좋아하고 사람을 좋아해요.' },
    active:   { id: 'active',   label: '밖에서 노는 아이',    emoji: '⚽', desc: '집에 있으면 몸이 근질근질해요.' },
    rebelKid: { id: 'rebelKid', label: '말 안 듣는 아이',     emoji: '🙄', desc: '"싫어"가 먼저 나와요.' },
    warmKid:  { id: 'warmKid',  label: '다정한 아이',         emoji: '🌷', desc: '먼저 손 내미는 걸 좋아해요.' },
    ordinary: { id: 'ordinary', label: '평범하지만 씩씩한 아이', emoji: '🌱', desc: '매일 조금씩 자라고 있어요.' },
  };

  function personalityTitle(s) {
    const st = s.stats;
    if ((s.deviance || 0) >= 50) return TITLES.mask;
    if ((s.deviance || 0) >= 30) return TITLES.secret;
    if (s.stress >= 75 && s.bond <= 45) return TITLES.rebel;
    if (s.stress >= 72) return TITLES.tired;
    if (st.art >= 80 && st.charm >= 65) return TITLES.artist;
    if (st.charm >= 80) return TITLES.star;
    if (st.academic >= 80 && st.mental >= 65) return TITLES.model;
    if (st.coding >= 75) return TITLES.dev;
    if (st.coding >= 55 && st.charm >= 55) return TITLES.ambition;
    if (st.stamina >= 75) return TITLES.athlete;
    if (st.mental >= 70 && (s.counts.volunteer || 0) >= 3) return TITLES.warm;
    if (st.charm <= 35 && st.stamina <= 35 && s.stress >= 55) return TITLES.homebody;
    const def = {
      curious: TITLES.curious, artistic: TITLES.artistic, social: TITLES.social,
      active: TITLES.active, rebel: TITLES.rebelKid, warm: TITLES.warmKid,
    }[s.personality];
    return def || TITLES.ordinary;
  }

  function syncTitle(s, reason) {
    const t = personalityTitle(s);
    if (!s.titleId) {
      s.titleId = t.id;
      s.titleLabel = t.label;
      s.titleHistory = s.titleHistory || [];
      return null;
    }
    if (s.titleId === t.id) return null;
    const prev = s.titleLabel;
    s.titleId = t.id;
    s.titleLabel = t.label;
    const p = periodInfo(s);
    s.titleHistory = s.titleHistory || [];
    s.titleHistory.push({
      turn: s.turn, age: p.age, period: p.label,
      from: prev, to: t.label, toId: t.id, reason: reason || '',
    });
    return { from: prev, to: t.label, emoji: t.emoji, reason: reason || '' };
  }

  /* ---------------- 엔딩 ---------------- */
  const ENDINGS = [
    {
      id: 'hikikomori', emoji: '🏠', title: '방구석 은둔형 외톨이', tag: '닫힌 문',
      grad: ['#7d8a97', '#3f4854'], bad: true,
      desc: '스무 살 딸의 방문은 늘 닫혀 있어요. 커튼은 밤낮없이 내려져 있고, 대화는 문 너머로만 오갑니다. 밥은 문 앞에 놓아둡니다.',
      hint: '스트레스가 높고 체력·매력·유대감이 모두 낮으면 찾아옵니다.',
      cond: (s) => s.stress >= 70 && s.stats.charm <= 50 && s.stats.stamina <= 50 && s.bond <= 50,
    },
    {
      id: 'troublemaker', emoji: '🕶️', title: '뒷골목 비행 성인', tag: '집을 나간 스무 살',
      grad: ['#6b7280', '#2b313b'], bad: true,
      desc: '스무 살 생일, 딸의 방은 비어 있었어요. 마지막 문자는 "미안해요" 세 글자였습니다. 그래도 현관 불은 켜 두었습니다. 언젠가 돌아올 딸을 위해.',
      hint: '이중생활 일탈도가 75 이상으로 깊어지고, 멘탈과 유대감이 무너지면 찾아옵니다.',
      cond: (s) => (s.deviance || 0) >= 75 && (s.stats.mental <= 45 || s.bond <= 30),
    },
    {
      id: 'fallen', emoji: '🎭', title: '뒷계정 폭로 · 나락 인플루언서', tag: '무너진 인기',
      grad: ['#a06bd6', '#5b2f86'], bad: true,
      desc: '겉으로는 반에서 가장 인기 있는 아이였어요. 그러나 뒷계정의 글이 캡처되어 퍼지고, 학교와 SNS가 들끓었습니다. 딸은 방문을 걸어 잠갔습니다.',
      hint: '매력이나 예술이 높은데 이중생활이 두 번 이상 발각되면 위험합니다.',
      cond: (s) => (s.clues || 0) >= 2 && (s.deviance || 0) >= 45 && (s.stats.charm >= 110 || s.stats.art >= 110),
    },
    {
      id: 'doublelife', emoji: '🫥', title: '가면을 쓴 이중생활 셀럽', tag: '아무도 모르는 얼굴',
      grad: ['#8b7bb8', '#463a6b'], bad: true,
      desc: '카메라 앞에서는 완벽한 모범생, 계정 뒤에서는 전혀 다른 얼굴. 아무도 그 가면을 의심하지 않았습니다. 엄마·아빠만이 그 미소가 연습이라는 걸 알고 있습니다.',
      hint: '발각되지 않은 채 일탈도가 50 이상으로 깊어지고 매력·예술이 높으면 찾아옵니다.',
      cond: (s) => (s.deviance || 0) >= 50 && (s.clues || 0) === 0 && (s.stats.charm >= 95 || s.stats.art >= 95),
    },
    {
      id: 'debt', emoji: '💸', title: '빚더미 · 영끌 인생', tag: '알바비보다 빚이 먼저',
      grad: ['#c47a5a', '#7a3b2a'], bad: true,
      desc: '알바비보다 할부금이 먼저 도착합니다. 딸의 통장은 늘 비어 있고, 서류 봉투에는 독촉장이 쌓였어요. "한 번만 더 하면 갚을 수 있어"라는 말이 반복됩니다.',
      hint: '무리한 투자·할부로 빚이 260만 원을 넘으면 찾아옵니다.',
      cond: (s) => (s.debt || 0) >= 260 || ((s.debt || 0) >= 140 && s.money <= 100),
    },
    {
      id: 'burnout', emoji: '🌧️', title: '쉼표가 필요한 청춘', tag: '잠시 멈춤',
      grad: ['#8f9aa8', '#5a6472'], bad: true,
      desc: '스무 살, 딸은 멋지게 성장했지만 마음의 신호는 이미 빨간불이었어요. 잠시 멈추고 자신을 돌보는 시간이 필요합니다. 그것도 충분히 잘하고 있는 일이에요.',
      hint: '스트레스를 95 이상으로 두면 찾아오는 엔딩입니다.',
      cond: (s) => s.stress >= 95,
    },
    {
      id: 'freeter', emoji: '🪑', title: '무기력한 단기 알바 프리터', tag: '목표 없는 하루',
      grad: ['#9aa39b', '#5b645c'], bad: true,
      desc: '뚜렷한 목표도, 오래 다닌 일도 없어요. 딸은 단기 알바를 전전하며 하루하루를 보냅니다. "괜찮아, 나중에 뭐든 하면 되지"라고 말하지만, 나중은 계속 미뤄집니다.',
      hint: '모든 능력치가 55 이하로 남으면 찾아옵니다. 아무것도 하지 않은 10년의 결과입니다.',
      cond: (s) => Math.max(s.stats.stamina, s.stats.academic, s.stats.coding, s.stats.art, s.stats.charm, s.stats.mental) <= 55,
    },
    {
      id: 'idol', emoji: '🎤', title: 'K-POP 아이돌', tag: '무대 위의 별',
      grad: ['#ff8fb1', '#ff4f86'],
      desc: '데뷔 무대의 조명이 켜지고, 딸의 이름이 전광판에 떠올랐어요. 수많은 연습실의 밤이 오늘의 무대가 되었습니다. 앙코르 무대에서 딸이 관중석의 우리를 찾아 손을 흔들었어요.',
      hint: '예술과 매력을 함께 키우고, 가을 가요제에서 우승해 보세요.',
      cond: (s) => s.stats.art >= 105 && s.stats.charm >= 105 && s.flags.songWin,
    },
    {
      id: 'athlete', emoji: '🏅', title: '국가대표 스포츠 스타', tag: '태극마크',
      grad: ['#5fc48a', '#2b8f66'],
      desc: '태극마크를 달고 경기장에 섰어요. 관중석의 함성이 딸의 이름을 부릅니다. 어릴 적 매일같이 땀 흘리던 운동장이 결승선이 되었습니다.',
      hint: '체력을 최고치까지 끌어올려 보세요.',
      cond: (s) => s.stats.stamina >= 155,
    },
    {
      id: 'aidev', emoji: '🤖', title: '글로벌 AI·IT 개발자', tag: '코드로 세상을 만드는 사람',
      grad: ['#7a8cff', '#4a5cf0'],
      desc: '세계 무대의 개발자 컨퍼런스에서 딸이 키노트 무대에 섰어요. 어릴 적 완성했던 미니 게임이 첫 번째 코드였습니다. 이제는 전 세계가 딸의 코드를 씁니다.',
      hint: '코딩을 최고 수준으로 올리고, 학업도 함께 챙겨 보세요.',
      cond: (s) => s.stats.coding >= 150 && s.stats.academic >= 70,
    },
    {
      id: 'medical', emoji: '🩺', title: '의사 · 법조인', tag: '가장 힘든 순간의 곁',
      grad: ['#6fb7d9', '#2b7fa8'],
      desc: '흰 가운을 입고, 누군가의 가장 힘든 순간에 곁을 지키는 사람이 되었어요. 밤새 공부하던 책상과 지금의 책상이 닮아 있습니다.',
      hint: '학업을 최고 수준으로 올리고, 멘탈도 단단하게 키워 보세요.',
      cond: (s) => s.stats.academic >= 140 && s.stats.mental >= 70,
    },
    {
      id: 'youtuber', emoji: '📹', title: '백만 유튜버 · 인플루언서', tag: '구독자 100만',
      grad: ['#ff8080', '#e33b5c'],
      desc: '구독자 백만 명. 카메라 앞에서 웃는 딸은 예전보다 훨씬 편안해 보여요. 첫 영상은 방 안에서 찍은 3분짜리였습니다.',
      hint: '예술과 매력을 키우고 크리에이터 활동을 꾸준히 해 보세요.',
      cond: (s) => s.stats.art >= 100 && s.stats.charm >= 100 && (s.flags.viral || (s.counts.creator || 0) >= 6),
    },
    {
      id: 'webtoon', emoji: '🖌️', title: '웹툰 작가 · 크리에이티브 디렉터', tag: '이야기를 그리는 사람',
      grad: ['#ffab6b', '#ef6b3f'],
      desc: '연재 첫 화가 공개되고 댓글창이 뜨거워졌어요. 그림일기로 시작한 재능이 직업이 되었습니다. 마감은 힘들지만, 딸의 표정은 즐겁습니다.',
      hint: '예술을 꾸준히 키워 보세요.',
      cond: (s) => s.stats.art >= 130,
    },
    {
      id: 'ceo', emoji: '🚀', title: '스타트업 CEO', tag: '작은 팀이 회사가 되다',
      grad: ['#8d7bff', '#5b3bd6'],
      desc: '작은 공모전 팀이 회사가 되었어요. 딸의 이름이 사업자등록증에 올랐습니다. 첫 투자 유치 날, 딸은 "우리 팀이 해냈어요"라고 말했습니다.',
      hint: '코딩·매력·자산을 쌓고 해커톤 우승이나 IT 인턴 경험을 만들어 보세요.',
      cond: (s) => s.stats.coding >= 90 && s.stats.charm >= 70 && s.money >= 700 && (s.flags.hackWin || (s.counts.intern || 0) >= 4),
    },
    {
      id: 'exec', emoji: '💼', title: '대기업 임원', tag: '가장 젊은 임원',
      grad: ['#5b7bb5', '#2f4f86'],
      desc: '회의실에서 가장 젊은 임원이 되었어요. 차분하게 사람을 이끄는 힘은 어릴 때부터였습니다. 퇴근길, 딸이 전화를 겁니다. "오늘 좀 늦어."',
      hint: '학업과 매력을 함께 높여 보세요.',
      cond: (s) => s.stats.academic >= 110 && s.stats.charm >= 85,
    },
    {
      id: 'teacher', emoji: '🍎', title: '따뜻한 선생님', tag: '아이들을 좋아하는 사람',
      grad: ['#7fc9a5', '#3d9673'],
      desc: '칠판 앞에 선 딸을 아이들이 좋아해요. 봉사활동에서 배운 마음이 그대로 이어졌습니다. 졸업식 날, 아이들이 편지를 잔뜩 건넸어요.',
      hint: '멘탈을 높이고 봉사활동을 꾸준히 해 보세요.',
      cond: (s) => s.stats.mental >= 130 && (s.counts.volunteer || 0) >= 8,
    },
    {
      id: 'mc', emoji: '🎙️', title: '톱스타 MC · 아나운서', tag: '목소리로 사람을 잇는 사람',
      grad: ['#ffb36b', '#e07a2e'],
      desc: '카메라 앞에서 딸이 자연스럽게 웃어요. 말 한마디로 분위기를 바꾸는 재능이 직업이 되었습니다. 생방송이 끝나면 딸이 "오늘 잘했죠?"라고 묻습니다.',
      hint: '매력을 최고 수준으로 끌어올리고, 멘탈도 함께 키워 보세요.',
      cond: (s) => s.stats.charm >= 165 && s.stats.mental >= 100,
    },
    {
      id: 'public', emoji: '🏛️', title: '공기업 · 공무원', tag: '든든한 안정',
      grad: ['#9aa8b8', '#5c6f85'],
      desc: '든든한 안정을 얻었어요. 퇴근길에 웃는 딸의 얼굴이 참 편안합니다. 주말에는 가족과 함께 시간을 보냅니다.',
      hint: '학업과 멘탈을 고르게 키워 보세요.',
      cond: (s) => s.stats.academic >= 80 && s.stats.mental >= 90,
    },
    {
      id: 'landlord', emoji: '🏢', title: '건물주 · 파이어족', tag: '경제적 자유',
      grad: ['#d6b25e', '#a07c2e'],
      desc: '처음 모은 용돈이 종잣돈이 되었어요. 이제 딸은 좋아하는 일만 골라서 할 수 있습니다. 월세 통장을 확인하며 딸이 웃었습니다. "이게 진짜야?"',
      hint: '알바·인턴으로 꾸준히 벌어 자산을 5,500만 원 이상 모아 보세요.',
      cond: (s) => s.money >= 5500 && ((s.counts.parttime || 0) + (s.counts.intern || 0) + (s.counts.tutor || 0) + (s.counts.creator || 0)) >= 20,
    },
    {
      id: 'ordinary', emoji: '🌷', title: '행복한 사회인', tag: '평범하지만 단단한',
      grad: ['#f0a6a6', '#d97878'],
      desc: '특별한 직함은 없지만, 매일 아침 스스로 일어나 좋아하는 일을 하러 나가는 사람이 되었어요. 그것이 가장 어려운 일이라는 걸 엄마·아빠는 알고 있습니다.',
      hint: '어떤 결말이든, 딸의 10년은 소중합니다.',
      cond: () => true,
    },
  ];

  const ENDING_BY_ID = {};
  ENDINGS.forEach((e) => { ENDING_BY_ID[e.id] = e; });

  function computeEnding(s) {
    for (const e of ENDINGS) {
      try {
        if (e.cond(s)) return e;
      } catch (err) { /* ignore */ }
    }
    return ENDING_BY_ID.ordinary;
  }

  const API = {
    START_YEAR, START_AGE, END_AGE, START_MONEY,
    STAT_META, STAT_KEYS, BLOOD, TEMPO, SEASONS, MONTH_EMOJI, GRADE_BY_AGE,
    ACTIVITIES, ACT_BY_ID, CAT_META, EVENTS, EVENT_BY_ID, FESTIVAL,
    ENDINGS, ENDING_BY_ID,
    PERSONALITIES, PERSONALITY_KEYS, buildPrefs, TITLES, personalityTitle, syncTitle, HOUSEHOLDS,
    clamp, gradeOf, periodInfo, ageOf, newState, snapshot, diffChips, applyGain,
    resolveSlot, resolveFestival, addAllowance, pickEvent, pickDiscovery, computeEnding,
    hookyChance, toneOf, applyTone, suggestActivity, endTurn, prefOf, canDo,
  };

  root.PMEngine = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);

// ════════════════════════════════════════════════════
// CSnote — 앱 셸 (vanilla): 탭 / 네비게이션 스택 / 화면 렌더
// ════════════════════════════════════════════════════

// ── localStorage ────────────────────────────────────
const LS = {
  get(k, d) { try { const v = localStorage.getItem('csn_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('csn_' + k, JSON.stringify(v)); } catch (e) {} },
};

// ── 상태 ────────────────────────────────────────────
const S = {
  tab: LS.get('tab', 'home'),
  stack: [],                       // [{subject}|{term}]
  dark: LS.get('dark', false),
  fs: LS.get('fs', 1),
  bookmarks: LS.get('bm', []),
  recents: LS.get('recents', []),
  lang: LS.get('lang', 'ko'),
  q: '',                           // 검색어 (검색 탭)
  filter: '',                      // 과목 목록 필터
};

// ── i18n ────────────────────────────────────────────
let T = {};
async function loadLang(lang) {
  try { T = await (await fetch(`config/lang/${lang}.json`)).json(); }
  catch (e) { T = {}; }
}
// UI 문자열 사전 (콘텐츠 외 앱 크롬)
const UI = {
  ko: {
    tagline: '컴퓨터과학 핵심 키워드 노트', home: '홈', search: '검색', bookmarks: '즐겨찾기', settings: '설정',
    subjects: '과목', continue: '이어서 보기', viewAll: '모두 보기',
    searchEntry: (n) => `용어 검색 · ${n}개 키워드`, searchPlaceholder: '용어 · 영문 · 정의 검색',
    popular: '자주 찾는 용어', results: (n) => `${n} results`,
    noResults: (q) => `'${q}' 검색 결과가 없어요`, tryOther: '다른 키워드로 검색해 보세요.',
    definition: '정의', related: '관련 용어', reference: '참조', prev: '이전', next: '다음',
    bmCount: (n) => `${n}개 용어를 저장했어요`, bmEmpty: '아직 저장한 용어가 없어요',
    bmEmptyHint: '용어 상세 화면에서 별 아이콘을 눌러<br>자주 보는 용어를 모아 보세요.',
    screen: '화면', darkMode: '다크 모드', fontSize: '글자 크기', language: '언어',
    fsOpts: [['작게', 0.9], ['보통', 1], ['크게', 1.12], ['아주 크게', 1.24]],
    refBooks: '참조 도서', info: '정보', version: '버전', source: '원본',
    filterPh: (s) => `${s} 용어 필터`, noFilter: (q) => `'${q}'와 일치하는 용어가 없어요`,
    footer: '컴퓨터과학 핵심 키워드 노트<br>모바일 리디자인', terms: (n) => `${n} terms`, subjectsCount: (n) => `${n} subjects`,
  },
  en: {
    tagline: 'CS core keyword notes', home: 'Home', search: 'Search', bookmarks: 'Bookmarks', settings: 'Settings',
    subjects: 'Subjects', continue: 'Continue', viewAll: 'See all',
    searchEntry: (n) => `Search · ${n} keywords`, searchPlaceholder: 'Search term · English · definition',
    popular: 'Popular terms', results: (n) => `${n} results`,
    noResults: (q) => `No results for '${q}'`, tryOther: 'Try another keyword.',
    definition: 'Definition', related: 'Related', reference: 'Reference', prev: 'Prev', next: 'Next',
    bmCount: (n) => `${n} term${n === 1 ? '' : 's'} saved`, bmEmpty: 'No saved terms yet',
    bmEmptyHint: 'Tap the star on a term page<br>to collect the ones you revisit.',
    screen: 'Display', darkMode: 'Dark mode', fontSize: 'Text size', language: 'Language',
    fsOpts: [['Small', 0.9], ['Normal', 1], ['Large', 1.12], ['XL', 1.24]],
    refBooks: 'Reference books', info: 'About', version: 'Version', source: 'Source',
    filterPh: (s) => `Filter ${s} terms`, noFilter: (q) => `No term matches '${q}'`,
    footer: 'CS core keyword notes<br>mobile redesign', terms: (n) => `${n} terms`, subjectsCount: (n) => `${n} subjects`,
  },
};
const L = (key, ...args) => { const v = (UI[S.lang] || UI.ko)[key]; return typeof v === 'function' ? v(...args) : v; };

// ── 헬퍼 ────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const subjOf = (id) => window.CS_SUBJECTS.find((s) => s.id === id);
const termOf = (id) => window.CS_TERMS.find((t) => t.id === id);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => d ? d.replace(/-/g, '. ') : '';

function highlight(text, q) {
  if (!q) return esc(text);
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return esc(text);
  return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + q.length)) + '</mark>' + esc(text.slice(i + q.length));
}

// ── 아이콘 (라인 SVG) ───────────────────────────────
const IC = {
  _s: (p, size = 24, sw = 1.8, fill = 'none') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`,
  home: (sz, sw) => IC._s('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>', sz, sw),
  search: (sz, sw) => IC._s('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>', sz, sw),
  star: (sz, sw, fill) => IC._s('<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.6 1-5.8L3.5 9.7l5.9-.9z"/>', sz, sw, fill),
  cog: (sz, sw) => IC._s('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.7l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V19a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 17.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.7.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.7V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>', sz, sw),
  sun: (sz, sw) => IC._s('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>', sz, sw),
  moon: (sz, sw) => IC._s('<path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/>', sz, sw),
  chevR: (sz, sw) => IC._s('<path d="m9 6 6 6-6 6"/>', sz, sw),
  back: (sz, sw) => IC._s('<path d="m15 6-6 6 6 6"/>', sz, sw),
  arrowL: (sz, sw) => IC._s('<path d="M19 12H5M11 18l-6-6 6-6"/>', sz, sw),
  arrowR: (sz, sw) => IC._s('<path d="M5 12h14M13 6l6 6-6 6"/>', sz, sw),
  layers: (sz, sw) => IC._s('<path d="m12 3 9 5-9 5-9-5 9-5z"/><path d="m3 13 9 5 9-5"/>', sz, sw),
  link: (sz, sw) => IC._s('<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>', sz, sw),
  book: (sz, sw) => IC._s('<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20"/>', sz, sw),
  clock: (sz, sw) => IC._s('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', sz, sw),
  close: (sz, sw) => IC._s('<path d="M18 6 6 18M6 6l12 12"/>', sz, sw),
  aa: (sz, sw) => IC._s('<path d="M4 18 8 6l4 12M5.5 14h5M14 18l3-9 3 9M15 15h4"/>', sz, sw),
  share: (sz, sw) => IC._s('<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7"/>', sz, sw),
  plus: (sz, sw) => IC._s('<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M12 8v8M8 12h8"/>', sz, sw),
  globe: (sz, sw) => IC._s('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>', sz, sw),
};

// ── 네비게이션 ──────────────────────────────────────
function persist() {
  LS.set('tab', S.tab); LS.set('dark', S.dark); LS.set('fs', S.fs);
  LS.set('bm', S.bookmarks); LS.set('recents', S.recents); LS.set('lang', S.lang);
}
function go(a) {
  if (a.tab) { S.stack = []; S.tab = a.tab; persist(); return render(); }
  if (a.subject) { S.filter = ''; S.stack.push({ subject: a.subject }); persist(); return render(); }
  if (a.term) {
    S.recents = [a.term, ...S.recents.filter((x) => x !== a.term)].slice(0, 8);
    if (a.replace && S.stack.length && S.stack[S.stack.length - 1].term) S.stack[S.stack.length - 1] = { term: a.term };
    else S.stack.push({ term: a.term });
    persist(); return render();
  }
}
function back() { S.stack.pop(); render(); }
const isBm = (id) => S.bookmarks.includes(id);
function toggleBm(id) { S.bookmarks = isBm(id) ? S.bookmarks.filter((x) => x !== id) : [id, ...S.bookmarks]; persist(); render(); }

// ════════════════════════════════════════════════════
// 화면 렌더 (HTML 문자열 반환)
// ════════════════════════════════════════════════════
const TABS = [
  { id: 'home', icon: 'home' }, { id: 'search', icon: 'search' },
  { id: 'bookmarks', icon: 'star' }, { id: 'settings', icon: 'cog' },
];
const TAB_LABEL = { home: () => L('home'), search: () => L('search'), bookmarks: () => L('bookmarks'), settings: () => L('settings') };

function termRowHtml(t, { q = '', showSubject = false } = {}) {
  const s = subjOf(t.subject);
  return `<div class="tap subj term-row" style="--hue:${s.hue}" data-act="term" data-id="${esc(t.id)}">
    <div class="lead-dot"></div>
    <div style="flex:1;min-width:0">
      <div class="row-ko">${highlight(t.ko, q)}</div>
      <div class="en row-en">${highlight(t.en, q)}</div>
    </div>
    ${showSubject ? `<span class="en row-tag">${esc(s.ko)}</span>` : ''}
    <span style="color:var(--text-3);display:flex;flex-shrink:0">${IC.chevR(16)}</span>
  </div>`;
}

function homeHtml() {
  const subjects = window.CS_SUBJECTS;
  const total = window.CS_TERMS.length;
  const count = (id) => window.CS_TERMS.filter((t) => t.subject === id).length;
  const recents = S.recents.map(termOf).filter(Boolean);
  const bms = S.bookmarks.map(termOf).filter(Boolean);

  return `<div class="csn-screen">
    <div class="csn-top-pad" style="display:flex;align-items:flex-end;justify-content:space-between;padding-left:20px;padding-right:20px;padding-bottom:12px">
      <div>
        <div style="font-size:30px;font-weight:800;letter-spacing:-0.6px;line-height:1;padding:8px 0">CS<span style="color:var(--accent)">note</span></div>
        <div style="font-size:13px;color:var(--text-2);margin-top:6px;font-weight:500">${L('tagline')}</div>
      </div>
      <button class="round-btn tap" data-act="theme" aria-label="theme">${S.dark ? IC.sun(20) : IC.moon(19)}</button>
    </div>
    <div class="csn-scroll" style="padding-bottom:28px">
      <div style="padding:6px 20px">
        <div class="tap" data-act="tab" data-tab="search" style="display:flex;align-items:center;gap:10px;padding:13px 16px;background:var(--surface);border:1px solid var(--border-2);border-radius:16px;color:var(--text-3);box-shadow:var(--shadow)">
          ${IC.search(19)}<span style="font-size:15px;font-weight:500;white-space:nowrap">${L('searchEntry', total)}</span>
        </div>
      </div>
      ${recents.length ? `<div class="section-label"><span>${L('continue')}</span></div>
      <div style="display:flex;gap:9px;overflow-x:auto;scrollbar-width:none;padding:4px 20px 8px">
        ${recents.map((t) => { const s = subjOf(t.subject); return `<div class="tap subj" style="--hue:${s.hue};flex:none;width:150px;padding:13px 14px;background:var(--surface);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)" data-act="term" data-id="${esc(t.id)}">
          <span class="en" style="font-size:10px;font-weight:600;color:var(--c)">${esc(s.ko)}</span>
          <div style="font-size:16px;font-weight:700;margin-top:6px;letter-spacing:-0.3px">${esc(t.ko)}</div>
          <div class="en" style="font-size:10.5px;color:var(--text-3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.en)}</div>
        </div>`; }).join('')}
      </div>` : ''}

      <div class="section-label"><span>${L('subjects')}</span><span class="en" style="font-size:11px;color:var(--text-3)">${L('subjectsCount', subjects.length)}</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;padding:4px 20px 8px">
        ${subjects.map((s) => `<div class="tap subj card" style="--hue:${s.hue};padding:15px;display:flex;flex-direction:column" data-act="subject" data-id="${esc(s.id)}">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <div style="width:38px;height:38px;border-radius:12px;background:var(--c-soft);color:var(--c);display:flex;align-items:center;justify-content:center">${IC.layers(21)}</div>
            <span class="en" style="font-size:11px;font-weight:600;color:var(--text-3)">${count(s.id)}</span>
          </div>
          <div style="font-size:17px;font-weight:750;margin-top:13px;letter-spacing:-0.3px">${esc(s.ko)}</div>
          <div class="en" style="font-size:10.5px;color:var(--c);margin-top:2px;font-weight:500">${esc(s.en)}</div>
          <div style="font-size:11.5px;color:var(--text-2);margin-top:7px;line-height:1.35">${esc(s.desc)}</div>
        </div>`).join('')}
      </div>

      ${bms.length ? `<div class="section-label"><span>${L('bookmarks')}</span><span class="tap en" style="font-size:11.5px;font-weight:600;color:var(--accent)" data-act="tab" data-tab="bookmarks">${L('viewAll')}</span></div>
      <div class="card" style="margin:0 20px;padding:2px 14px">
        ${bms.slice(0, 3).map((t) => termRowHtml(t)).join('')}
      </div>` : ''}

      <div style="padding:30px 22px 4px">
        <div style="font-size:11.5px;color:var(--text-3);line-height:1.6"><span class="en">csnote.net</span> · ${L('footer')}</div>
      </div>
    </div>
  </div>`;
}

function searchHtml() {
  return `<div class="csn-screen">
    <div class="csn-top-pad" style="padding-left:16px;padding-right:16px;padding-bottom:12px;display:flex;align-items:center;gap:10px">
      <div style="flex:1;display:flex;align-items:center;gap:9px;padding:11px 14px;background:var(--surface);border:1px solid var(--border-2);border-radius:14px;box-shadow:var(--shadow)">
        <span style="color:var(--text-3);display:flex">${IC.search(19)}</span>
        <input id="searchInput" value="${esc(S.q)}" placeholder="${esc(L('searchPlaceholder'))}" autocomplete="off"
          style="flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--text);font-size:16px;font-family:var(--pretendard);font-weight:500">
        <span class="tap" data-act="clear-q" style="color:var(--text-3);display:${S.q ? 'flex' : 'none'}">${IC.close(17)}</span>
      </div>
    </div>
    <div class="csn-scroll" id="searchResults" style="padding-bottom:24px">${searchResultsHtml()}</div>
  </div>`;
}
function searchResultsHtml() {
  const k = S.q.trim().toLowerCase();
  if (!k) {
    const find1 = (kw) => window.CS_TERMS.find((t) => t.ko.includes(kw) || t.en.toLowerCase().includes(kw.toLowerCase()));
    const popular = ['프로세스', 'TCP', '트랜잭션', '해시', '캐시'].map(find1).filter(Boolean);
    const seen = new Set(); const dedup = popular.filter((t) => !seen.has(t.id) && seen.add(t.id));
    const pool = dedup.length ? dedup : window.CS_TERMS.slice(0, 5);
    return `<div style="padding:6px 20px">
      <div style="font-size:13.5px;font-weight:700;color:var(--text-2);margin-bottom:12px">${L('popular')}</div>
      <div style="display:flex;flex-wrap:wrap;gap:9px">
        ${pool.map((t) => { const s = subjOf(t.subject); return `<span class="chip subj tap" style="--hue:${s.hue}" data-act="term" data-id="${esc(t.id)}"><span class="dot"></span>${esc(t.ko)}</span>`; }).join('')}
      </div></div>`;
  }
  const results = window.CS_TERMS.filter((t) => t.ko.toLowerCase().includes(k) || t.en.toLowerCase().includes(k) || t.def.toLowerCase().includes(k));
  if (!results.length) return `<div style="padding:60px 30px;text-align:center;color:var(--text-3)"><div style="font-size:15px;font-weight:600;color:var(--text-2)">${esc(L('noResults', S.q))}</div><div style="font-size:13px;margin-top:6px">${esc(L('tryOther'))}</div></div>`;
  const m = {}; results.forEach((t) => (m[t.subject] = m[t.subject] || []).push(t));
  const grouped = window.CS_SUBJECTS.filter((s) => m[s.id]).map((s) => ({ s, items: m[s.id] }));
  return `<div class="en" style="padding:2px 22px 6px;font-size:11.5px;color:var(--text-3)">${L('results', results.length)}</div>
    ${grouped.map(({ s, items }) => `<div><div class="csn-group">${esc(s.ko)}</div><div style="padding:0 20px;margin-bottom:4px">${items.map((t) => termRowHtml(t, { q: S.q })).join('')}</div></div>`).join('')}`;
}

function bookmarksHtml() {
  const items = S.bookmarks.map(termOf).filter(Boolean);
  const m = {}; items.forEach((t) => (m[t.subject] = m[t.subject] || []).push(t));
  const grouped = window.CS_SUBJECTS.filter((s) => m[s.id]).map((s) => ({ s, items: m[s.id] }));
  return `<div class="csn-screen">
    <div class="csn-top-pad" style="padding-left:20px;padding-right:20px;padding-bottom:8px">
      <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px">${L('bookmarks')}</div>
      <div style="font-size:13px;color:var(--text-2);margin-top:4px">${L('bmCount', S.bookmarks.length)}</div>
    </div>
    <div class="csn-scroll" style="padding-bottom:24px">
      ${items.length === 0
        ? `<div style="padding:70px 36px;text-align:center;color:var(--text-3)"><div style="display:inline-flex;margin-bottom:14px">${IC.star(40, 1.6)}</div><div style="font-size:15px;font-weight:650;color:var(--text-2)">${L('bmEmpty')}</div><div style="font-size:13px;margin-top:6px;line-height:1.5">${L('bmEmptyHint')}</div></div>`
        : grouped.map(({ s, items }) => `<div><div class="csn-group">${esc(s.ko)}</div><div style="padding:0 20px;margin-bottom:4px">${items.map((t) => termRowHtml(t)).join('')}</div></div>`).join('')}
    </div>
  </div>`;
}

function settingsHtml() {
  const books = [...new Set(window.CS_TERMS.flatMap((t) => t.refs.map((r) => r.book)).filter(Boolean))].slice(0, 8);
  const fsOpts = L('fsOpts');
  return `<div class="csn-screen">
    <div class="csn-top-pad" style="padding-left:20px;padding-right:20px;padding-bottom:8px">
      <div style="font-size:28px;font-weight:800;letter-spacing:-0.5px">${L('settings')}</div>
    </div>
    <div class="csn-scroll" style="padding-bottom:24px">
      <div class="section-label"><span>${L('screen')}</span></div>
      <div class="card" style="margin:0 20px;overflow:hidden">
        <div class="set-row"><span style="display:flex;align-items:center;gap:11px;font-size:15px;font-weight:600">${S.dark ? IC.moon(19) : IC.sun(19)} ${L('darkMode')}</span><div class="switch tap" data-on="${S.dark}" data-act="theme"><div class="knob"></div></div></div>
        <div class="set-row"><span style="display:flex;align-items:center;gap:11px;font-size:15px;font-weight:600">${IC.aa(20)} ${L('fontSize')}</span>
          <div style="display:flex;align-items:center;gap:4px">${fsOpts.map(([l, v]) => `<button class="fs-seg tap" data-act="fs" data-v="${v}" data-active="${Math.abs(S.fs - v) < 0.01}">${l}</button>`).join('')}</div>
        </div>
        <div class="set-row"><span style="display:flex;align-items:center;gap:11px;font-size:15px;font-weight:600">${IC.globe(19)} ${L('language')}</span>
          <div style="display:flex;align-items:center;gap:4px">${[['한국어', 'ko'], ['EN', 'en']].map(([l, v]) => `<button class="fs-seg tap" data-act="lang" data-v="${v}" data-active="${S.lang === v}">${l}</button>`).join('')}</div>
        </div>
      </div>
      ${books.length ? `<div class="section-label"><span>${L('refBooks')}</span></div>
      <div class="card" style="margin:0 20px;overflow:hidden">
        ${books.map((b) => `<div class="set-row"><span style="display:flex;align-items:center;gap:11px;font-size:14px;font-weight:500"><span style="color:var(--text-3);display:flex">${IC.book(18)}</span>${esc(b)}</span></div>`).join('')}
      </div>` : ''}
      <div class="section-label"><span>${L('info')}</span></div>
      <div class="card" style="margin:0 20px;overflow:hidden">
        <div class="set-row"><span style="font-size:14.5px;font-weight:600">${L('version')}</span><span class="en" style="font-size:13px;color:var(--text-3)">redesign · v${esc(window.CS_VERSION || '')}</span></div>
        <div class="set-row"><span style="font-size:14.5px;font-weight:600">${L('source')}</span><a class="en" href="https://github.com/kangtegong/csnote" target="_blank" rel="noopener" style="font-size:12px;color:var(--accent);text-decoration:none">github.com/kangtegong/csnote</a></div>
      </div>
    </div>
  </div>`;
}

// 과목별 목록 (push 화면)
function subjectHtml(subjectId) {
  const s = subjOf(subjectId);
  const total = window.CS_TERMS.filter((t) => t.subject === subjectId).length;
  return `<div class="csn-push subj" data-subject="${esc(subjectId)}" style="--hue:${s.hue};position:absolute;inset:0;z-index:30;background:var(--bg);display:flex;flex-direction:column">
    <div style="flex:none">
      <div class="csn-top-pad" style="padding-left:14px;padding-right:14px;display:flex;align-items:center;gap:4px">
        <span class="tap" data-act="back" style="display:flex;align-items:center;color:var(--accent);font-weight:600;font-size:15px;padding:6px 6px 6px 2px">${IC.back(22)} ${L('home')}</span>
      </div>
      <div style="padding:8px 22px 4px">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:40px;height:40px;border-radius:13px;background:var(--c-soft);color:var(--c);display:flex;align-items:center;justify-content:center">${IC.layers(22)}</div>
          <div><div style="font-size:26px;font-weight:800;letter-spacing:-0.5px;line-height:1">${esc(s.ko)}</div>
          <div class="en" style="font-size:12px;color:var(--c);margin-top:4px;font-weight:500">${esc(s.en)} · ${L('terms', total)}</div></div>
        </div>
      </div>
      <div style="padding:12px 20px 10px">
        <div style="display:flex;align-items:center;gap:9px;padding:10px 13px;background:var(--surface);border:1px solid var(--border-2);border-radius:13px;box-shadow:var(--shadow)">
          <span style="color:var(--text-3);display:flex">${IC.search(18)}</span>
          <input id="filterInput" value="${esc(S.filter)}" placeholder="${esc(L('filterPh', s.ko))}" autocomplete="off"
            style="flex:1;min-width:0;border:none;outline:none;background:transparent;color:var(--text);font-size:15px;font-family:var(--pretendard);font-weight:500">
          <span class="tap" data-act="clear-filter" style="color:var(--text-3);display:${S.filter ? 'flex' : 'none'}">${IC.close(16)}</span>
        </div>
      </div>
    </div>
    <div class="csn-scroll" id="subjectList" style="position:relative;padding-bottom:40px">${subjectListHtml(subjectId)}</div>
    <div id="subjectRail">${subjectRailHtml(subjectId)}</div>
  </div>`;
}
function subjectGroups(subjectId) {
  const k = S.filter.trim().toLowerCase();
  let items = window.CS_TERMS.filter((t) => t.subject === subjectId);
  if (k) items = items.filter((t) => t.ko.toLowerCase().includes(k) || t.en.toLowerCase().includes(k));
  items.sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
  const m = {}; items.forEach((t) => { const ini = window.getInitial(t.ko); (m[ini] = m[ini] || []).push(t); });
  return window.CHO_ORDER.filter((c) => m[c]).map((c) => ({ ini: c, items: m[c] }));
}
function subjectListHtml(subjectId) {
  const groups = subjectGroups(subjectId);
  const pad = (!S.filter && groups.length > 3) ? 30 : 20;
  if (!groups.length) return `<div style="padding:50px 30px;text-align:center;color:var(--text-3);font-size:14px">${esc(L('noFilter', S.filter))}</div>`;
  return groups.map(({ ini, items }) => `<div data-ini="${esc(ini)}"><div class="csn-group">${esc(ini)}</div><div style="padding:0 ${pad}px 2px 20px">${items.map((t) => termRowHtml(t)).join('')}</div></div>`).join('');
}
function subjectRailHtml(subjectId) {
  if (S.filter) return '';
  const groups = subjectGroups(subjectId);
  if (groups.length <= 3) return '';
  return `<div class="csn-rail">${groups.map(({ ini }) => `<span class="tap" data-act="jump" data-ini="${esc(ini)}">${ini.length > 1 ? 'A' : ini}</span>`).join('')}</div>`;
}

// 용어 상세 (push 화면)
function termDetailHtml(termId) {
  const t = termOf(termId); const s = subjOf(t.subject);
  const arr = window.CS_TERMS.filter((x) => x.subject === t.subject).sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
  const idx = arr.findIndex((x) => x.id === t.id);
  const prev = arr[idx - 1], next = arr[idx + 1];
  const marked = isBm(t.id);
  const related = (t.related || []).map(termOf).filter(Boolean);

  const navBtn = (dir, term) => {
    const isNext = dir === 'next';
    return `<button class="nav-btn ${term ? 'tap' : ''}" ${term ? '' : 'disabled'} data-act="${term ? 'term-replace' : ''}" data-id="${term ? esc(term.id) : ''}" style="justify-content:${isNext ? 'flex-end' : 'flex-start'};text-align:${isNext ? 'right' : 'left'}">
      ${!isNext ? `<span style="color:var(--text-3);display:flex;flex-shrink:0">${IC.arrowL(18)}</span>` : ''}
      <span style="min-width:0"><div class="nb-label">${isNext ? L('next') : L('prev')}</div><div class="nb-title">${term ? esc(term.ko) : '—'}</div></span>
      ${isNext ? `<span style="color:var(--text-3);display:flex;flex-shrink:0">${IC.arrowR(18)}</span>` : ''}
    </button>`;
  };

  return `<div class="csn-push subj" style="--hue:${s.hue};position:absolute;inset:0;z-index:31;background:var(--bg);display:flex;flex-direction:column">
    <div class="csn-top-pad" style="flex:none;padding-left:14px;padding-right:14px;padding-bottom:6px;display:flex;align-items:center;justify-content:space-between">
      <span class="tap" data-act="back" style="display:flex;align-items:center;color:var(--accent);font-weight:600;font-size:15px;padding:6px 6px 6px 2px">${IC.back(22)} ${esc(s.ko)}</span>
      <button class="round-btn tap" data-act="bm" data-id="${esc(t.id)}" aria-label="즐겨찾기"><span style="color:${marked ? 'oklch(0.72 0.16 70)' : 'var(--text-3)'};display:flex">${IC.star(21, 1.8, marked ? 'currentColor' : 'none')}</span></button>
    </div>
    <div class="csn-scroll" style="padding-bottom:20px">
      <div style="padding:8px 24px 4px">
        <span class="en subj" style="display:inline-flex;align-items:center;gap:6px;font-size:11.5px;font-weight:600;color:var(--c);background:var(--c-soft);padding:5px 11px;border-radius:999px"><span style="width:6px;height:6px;border-radius:999px;background:var(--c)"></span>${esc(s.ko)}</span>
        <h1 style="font-size:calc(33px * var(--fs));font-weight:800;letter-spacing:-0.8px;line-height:1.1;margin:14px 0 0;word-break:keep-all">${esc(t.ko)}</h1>
        ${t.en ? `<div class="en" style="font-size:calc(15px * var(--fs));color:var(--text-2);margin-top:7px;font-weight:500">${esc(t.en)}</div>` : ''}
      </div>
      <div style="padding:20px 24px 4px">
        <div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--text-3);letter-spacing:0.3px;margin-bottom:10px"><span style="width:16px;height:2px;background:var(--c);border-radius:2px"></span>${L('definition')}</div>
        ${t.image ? `<img class="def-img" src="${esc(t.image)}" alt="${esc(t.ko)}" loading="lazy">` : ''}
        <p style="font-size:calc(16.5px * var(--fs));line-height:1.78;color:var(--text);margin:0;font-weight:420;word-break:keep-all">${t.defHtml}</p>
      </div>
      ${related.length ? `<div style="padding:24px 24px 4px">
        <div style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:var(--text-3);letter-spacing:0.3px;margin-bottom:12px"><span style="display:flex;color:var(--c)">${IC.link(15)}</span>${L('related')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:9px">${related.map((r) => { const rs = subjOf(r.subject); return `<span class="chip subj tap" style="--hue:${rs.hue}" data-act="term" data-id="${esc(r.id)}"><span class="dot"></span>${esc(r.ko)}</span>`; }).join('')}</div>
      </div>` : ''}
      ${t.refs.length ? `<div style="padding:26px 24px 6px">
        <div class="card" style="padding:4px 15px">
          ${t.refs.map((r, i) => `<div style="display:flex;align-items:center;gap:11px;padding:12px 0;${i < t.refs.length - 1 ? 'border-bottom:0.5px solid var(--border)' : ''}">
            <span style="color:var(--text-3);display:flex">${IC.book(18)}</span>
            <span style="font-size:13px;color:var(--text-2);flex:1">${esc(r.book)}</span>
            ${r.page ? `<span class="en" style="font-size:12.5px;font-weight:600;text-align:right">${esc(r.page)}</span>` : ''}
          </div>`).join('')}
        </div>
      </div>` : ''}
    </div>
    <div class="nav-btns">${navBtn('prev', prev)}${navBtn('next', next)}</div>
  </div>`;
}

// ════════════════════════════════════════════════════
// 메인 렌더
// ════════════════════════════════════════════════════
function render() {
  const root = $('#app');
  const tabScreen = S.tab === 'home' ? homeHtml() : S.tab === 'search' ? searchHtml() : S.tab === 'bookmarks' ? bookmarksHtml() : settingsHtml();
  const stackHtml = S.stack.map((e) => e.subject ? subjectHtml(e.subject) : termDetailHtml(e.term)).join('');

  root.className = 'csn';
  root.setAttribute('data-theme', S.dark ? 'dark' : 'light');
  root.style.setProperty('--fs', S.fs);

  root.innerHTML = `
    <div style="flex:1;display:flex;flex-direction:column;min-height:0;position:relative">${tabScreen}</div>
    <div class="csn-tabbar">
      ${TABS.map((tb) => { const active = S.tab === tb.id; const fill = active && tb.id === 'bookmarks' ? 'currentColor' : 'none'; return `<button class="csn-tab" data-active="${active}" data-act="tab" data-tab="${tb.id}">${IC[tb.icon](24, active ? 2 : 1.7, fill)}<span>${TAB_LABEL[tb.id]()}</span></button>`; }).join('')}
    </div>
    ${stackHtml}`;

  wireScreen();
}

// 입력/스크롤 등 포커스 유지가 필요한 비위임 핸들러
function wireScreen() {
  const si = $('#searchInput');
  if (si) {
    si.addEventListener('input', (e) => {
      S.q = e.target.value;
      $('#searchResults').innerHTML = searchResultsHtml();
      const clr = document.querySelector('[data-act="clear-q"]');
      if (clr) clr.style.display = S.q ? 'flex' : 'none';
    });
  }
  const fi = $('#filterInput');
  if (fi) {
    // subject는 입력 요소가 속한 화면에서 읽는다 (스택 최상단이 용어 상세일 수 있음)
    const subjectId = fi.closest('.csn-push').dataset.subject;
    fi.addEventListener('input', (e) => {
      S.filter = e.target.value;
      $('#subjectList').innerHTML = subjectListHtml(subjectId);
      $('#subjectRail').innerHTML = subjectRailHtml(subjectId);
      const clr = document.querySelector('[data-act="clear-filter"]');
      if (clr) clr.style.display = S.filter ? 'flex' : 'none';
    });
  }
}

// ── 이벤트 위임 ─────────────────────────────────────
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.getAttribute('data-act');
  const id = el.getAttribute('data-id');
  switch (act) {
    case 'tab': go({ tab: el.getAttribute('data-tab') }); break;
    case 'subject': go({ subject: id }); break;
    case 'term': go({ term: id }); break;
    case 'term-replace': go({ term: id, replace: true }); break;
    case 'back': back(); break;
    case 'theme': { S.dark = !S.dark; persist(); render(); const ib = $('#installBanner'); if (ib) ib.classList.toggle('dark', S.dark); break; }
    case 'bm': toggleBm(id); break;
    case 'fs': S.fs = parseFloat(el.getAttribute('data-v')); persist(); render(); break;
    case 'lang': switchLang(el.getAttribute('data-v')); break;
    case 'clear-q': { S.q = ''; const si = $('#searchInput'); if (si) { si.value = ''; si.focus(); } $('#searchResults').innerHTML = searchResultsHtml(); el.style.display = 'none'; break; }
    case 'clear-filter': { S.filter = ''; const fi = $('#filterInput'); const sid = el.closest('.csn-push').dataset.subject; if (fi) { fi.value = ''; fi.focus(); } $('#subjectList').innerHTML = subjectListHtml(sid); $('#subjectRail').innerHTML = subjectRailHtml(sid); el.style.display = 'none'; break; }
    case 'jump': {
      const ini = el.getAttribute('data-ini');
      const sc = $('#subjectList'); const target = sc && sc.querySelector(`[data-ini="${CSS.escape(ini)}"]`);
      if (sc && target) sc.scrollTo({ top: target.offsetTop - 4, behavior: 'smooth' });
      break;
    }
    case 'dismiss-install': dismissInstall(); break;
  }
});

async function switchLang(lang) {
  if (lang === S.lang) return;
  S.lang = lang; persist();
  await loadLang(lang);
  showLoading();
  await window.loadCSData(lang);
  S.stack = [];
  render();
}

// ── 로딩 화면 ───────────────────────────────────────
function showLoading() {
  $('#app').innerHTML = `<div class="csn-loading"><div class="csn-spin"></div><div style="font-size:13px">불러오는 중…</div></div>`;
}

// ════════════════════════════════════════════════════
// PWA: iOS 설치 안내 배너 + 서비스워커
// ════════════════════════════════════════════════════
let deferredPrompt = null;
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
function dismissInstall() { LS.set('install_dismissed', Date.now()); const b = $('#installBanner'); if (b) b.remove(); }
function maybeShowInstall() {
  if (isStandalone()) return;
  const dismissed = LS.get('install_dismissed', 0);
  if (Date.now() - dismissed < 1000 * 60 * 60 * 24 * 7) return; // 7일 숨김
  const frame = $('.app-frame');
  if (!frame || $('#installBanner')) return;
  const msg = isIOS()
    ? `공유 버튼 ${'↑'} 을 누른 뒤 <b>'홈 화면에 추가'</b>를 선택하면 앱처럼 사용할 수 있어요.`
    : `브라우저 메뉴에서 <b>'홈 화면에 추가'</b> 또는 <b>설치</b>를 선택해 앱처럼 사용해 보세요.`;
  const banner = document.createElement('div');
  banner.id = 'installBanner';
  // .app-frame은 .csn 바깥이라 테마 변수를 못 받음 → 자체 색상 + dark 클래스 사용
  banner.className = 'install-banner' + (S.dark ? ' dark' : '');
  banner.innerHTML = `<span class="ib-icon" style="display:flex;flex-shrink:0;margin-top:1px">${isIOS() ? IC.share(22) : IC.plus(22)}</span>
    <div style="flex:1;min-width:0"><div class="ib-title" style="font-size:14px;font-weight:700;margin-bottom:3px">앱으로 설치하기</div><div class="ib-desc" style="font-size:12.5px;line-height:1.5">${msg}</div></div>
    <button class="ib-close tap" data-act="dismiss-install" aria-label="닫기">${IC.close(18)}</button>`;
  frame.appendChild(banner);
}

window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredPrompt = e; });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// ════════════════════════════════════════════════════
// 부트스트랩
// ════════════════════════════════════════════════════
(async function init() {
  showLoading();
  await loadLang(S.lang);
  try {
    await window.loadCSData(S.lang);
    render();
    setTimeout(maybeShowInstall, 1200);
  } catch (e) {
    $('#app').innerHTML = `<div class="csn-loading"><div style="font-size:14px;color:var(--text-2)">데이터를 불러오지 못했어요.</div><div style="font-size:12px">${esc(e.message || e)}</div></div>`;
  }
})();

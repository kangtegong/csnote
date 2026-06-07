// ════════════════════════════════════════════════════
// CSnote — 데이터 레이어
// 실제 subjects/*.yaml 을 런타임 로드 → UI 모델로 평탄화
// term→ko, superscript→en, description→def,
// references→참조(책/페이지), image→정의 이미지, related→자동 추론
// ════════════════════════════════════════════════════

// 과목 메타: config.json 순서와 무관하게 hue/desc 부여
window.SUBJECT_META = {
  os:   { hue: 256, desc: '프로세스·메모리·동기화', descEn: 'Process · Memory · Sync' },
  net:  { hue: 192, desc: 'TCP/IP·프로토콜·계층',   descEn: 'TCP/IP · Protocols · Layers' },
  db:   { hue: 152, desc: '트랜잭션·정규화·인덱스', descEn: 'Transactions · Normalization · Index' },
  ds:   { hue: 78,  desc: '배열·트리·그래프',       descEn: 'Array · Tree · Graph' },
  arch: { hue: 32,  desc: 'CPU·캐시·파이프라인',    descEn: 'CPU · Cache · Pipeline' },
};
// 홈에서 보여줄 과목 순서
window.SUBJECT_ORDER = ['os', 'net', 'db', 'ds', 'arch'];

window.CS_SUBJECTS = [];
window.CS_TERMS = [];

// ── 한글 초성 추출 ──────────────────────────────────
window.getInitial = function (str) {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const ch = (str || '').trim().charCodeAt(0);
  if (ch >= 0xAC00 && ch <= 0xD7A3) return CHO[Math.floor((ch - 0xAC00) / 588)];
  if (ch >= 65 && ch <= 90) return String.fromCharCode(ch);          // A-Z
  if (ch >= 97 && ch <= 122) return String.fromCharCode(ch - 32);    // a-z → A-Z
  if (ch >= 48 && ch <= 57) return '0–9';
  return '#';
};
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
window.CHO_ORDER = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ', ...ALPHA, '0–9','#'];

// ── 헬퍼: slug id 생성 (영문 superscript 우선, 없으면 한글 음차) ──
function slugify(s, fallbackIdx) {
  if (!s) return 't' + fallbackIdx;
  const base = s.split(/[;,(]/)[0].trim().toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || ('t' + fallbackIdx);
}

// 참조 도서 영문 제목 (en 모드 런타임 매핑)
const BOOK_EN = {
  '이것이 취업을 위한 컴퓨터과학이다': 'This Is Computer Science for Your Career',
  '혼자 공부하는 네트워크': 'Network for Self-Study',
  '혼자 공부하는 컴퓨터구조 운영체제': 'Computer Architecture & OS for Self-Study',
};
let CUR_LANG = 'ko';

// ── 헬퍼: 참조 문자열 정리 "책_이름/37_페이지" → {book, page} ──
function parseReference(ref) {
  const [bookRaw, pageRaw] = String(ref).split('/');
  let book = (bookRaw || '').replace(/_/g, ' ').trim();
  let page = (pageRaw || '').replace(/_/g, ' ').trim();
  if (CUR_LANG === 'en') {
    book = BOOK_EN[book] || book;
    page = page.replace(/(\d+)\s*페이지/, 'p. $1'); // "512 페이지" → "p. 512"
  }
  return { book, page, label: page ? `${book} · ${page}` : book };
}

// ── 헬퍼: 용어의 핵심 키워드(괄호 안·영문 포함) 추출 ──
function coreTokens(term) {
  const out = new Set();
  const ko = term.ko || '';
  // 괄호 밖 본체
  out.add(ko.replace(/\(.*?\)/g, '').trim());
  // 괄호 안 약어 (CPU, RDBMS …)
  const m = ko.match(/\(([^)]+)\)/);
  if (m) out.add(m[1].trim());
  // 영문 약어 (superscript의 첫 토큰)
  if (term.en) out.add(term.en.split(/[;,]/)[0].trim());
  return [...out].filter((x) => x && x.length >= 2);
}

// ── 관련 용어 자동 추론 ─────────────────────────────
// 점수: 정의 내 상호 언급(+3), 동일 하위섹션(+1)
function inferRelated(terms) {
  terms.forEach((t) => {
    const myTokens = coreTokens(t);
    const scored = [];
    terms.forEach((o) => {
      if (o.id === t.id || o.subject !== t.subject) return;
      let score = 0;
      const otherTokens = coreTokens(o);
      // 내 정의가 상대 용어를 언급
      if (otherTokens.some((tok) => tok.length >= 2 && t.def.includes(tok))) score += 3;
      // 상대 정의가 내 용어를 언급
      if (myTokens.some((tok) => tok.length >= 2 && o.def.includes(tok))) score += 3;
      // 같은 하위섹션
      if (o._group && t._group && o._group === t._group) score += 1;
      if (score > 0) scored.push({ id: o.id, score });
    });
    scored.sort((a, b) => b.score - a.score);
    t.related = scored.slice(0, 4).map((x) => x.id);
  });
}

// ── 한 YAML 문서를 평탄화하여 terms에 push ───────────
function flattenSubject(subjectId, doc, terms) {
  const usedIds = new Set();
  const pushItems = (items, groupKey) => {
    if (!items) return;
    items.forEach((item, i) => {
      if (!item || !item.term) return;
      // 과목 접두사로 전역 고유 id 보장 (과목 간 동음 용어 충돌 방지)
      let id = subjectId + '-' + slugify(item.superscript || item.term, terms.length + i);
      // 동일 과목 내 중복 방지
      let uid = id, n = 2;
      while (usedIds.has(uid)) uid = id + '-' + (n++);
      usedIds.add(uid);

      const refs = (item.references || (item.reference ? [item.reference] : []))
        .map(parseReference);

      terms.push({
        id: uid,
        subject: subjectId,
        ko: item.term,
        en: item.superscript || '',
        def: (item.description || '').replace(/<br\s*\/?>/gi, ' '),
        defHtml: item.description || '',
        refs,
        ref: refs[0] ? refs[0].book : '',
        image: item.image || null,
        related: [],
        _group: groupKey,
      });
    });
  };

  const walk = (nodes, groupKey) => {
    if (!nodes) return;
    nodes.forEach((node) => {
      const key = node.subtitle || node.subsubtitle || groupKey;
      if (node.items) pushItems(node.items, key);
      if (node.content) walk(node.content, key);
    });
  };

  (doc.sections || []).forEach((section) => {
    walk(section.content, section.title);
  });
}

// ── 전체 로드 ───────────────────────────────────────
window.loadCSData = async function (lang) {
  lang = lang || 'ko';
  CUR_LANG = lang;
  const cfgRes = await fetch('config/config.json');
  const cfg = await cfgRes.json();

  // 과목 메타 구성 (config 기반 + hue/desc 병합)
  const subjects = cfg.subjects.map((s) => {
    const id = s.file.split('.')[0];
    const meta = window.SUBJECT_META[id] || { hue: 200, desc: '' };
    // 주 표기는 현재 언어를 따르고, 부제는 반대 언어로
    const primary = lang === 'en' ? s.name_en : s.name_ko;
    const secondary = lang === 'en' ? s.name_ko : s.name_en;
    return { id, ko: primary, en: secondary, hue: meta.hue, desc: (meta.descEn && lang === 'en') ? meta.descEn : meta.desc, file: s.file };
  });
  // 정의된 순서로 정렬
  subjects.sort((a, b) => window.SUBJECT_ORDER.indexOf(a.id) - window.SUBJECT_ORDER.indexOf(b.id));
  window.CS_SUBJECTS = subjects;

  const terms = [];
  await Promise.all(subjects.map(async (s) => {
    // en 선택 시 -en.yaml 시도, 실패하면 ko 폴백
    const tryFiles = lang === 'en'
      ? [s.file.replace('.yaml', '-en.yaml'), s.file]
      : [s.file];
    let doc = null;
    for (const f of tryFiles) {
      try {
        const res = await fetch(`subjects/${f}`);
        if (!res.ok) continue;
        doc = jsyaml.load(await res.text());
        if (doc) break;
      } catch (e) { /* 다음 후보 */ }
    }
    if (doc) flattenSubject(s.id, doc, terms);
  }));

  inferRelated(terms);
  window.CS_TERMS = terms;
  window.CS_VERSION = cfg.version;
  return { subjects, terms, version: cfg.version };
};

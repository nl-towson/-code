/**
 * 數位經案 — App JS
 * Handles: navigation, search overlay, bookmarks, tag input,
 *          hexagram rendering, form draft/publish, dark mode.
 */

/* ─────────────────────────────────────────
   Constants / helpers
───────────────────────────────────────── */
const STORAGE = {
  bookmarks: 'mozhai_bookmarks',
  drafts:    'mozhai_drafts',
  darkMode:  'mozhai_dark',
};

/* ─────────────────────────────────────────
   Dynamic category system (localStorage)
───────────────────────────────────────── */
const _DEFAULT_CATS = {
  roots: [
    { id: 'tcm',   label: '中醫學',   icon: 'local_hospital' },
    { id: 'psych', label: '心理學',   icon: 'psychology' },
    { id: 'econ',  label: '經濟學',   icon: 'monitoring' },
    { id: 'notes', label: '個人隨筆', icon: 'history_edu' },
    { id: 'phil',  label: '哲學',     icon: 'menu_book' },
    { id: 'lit',   label: '文學',     icon: 'auto_stories' },
  ],
  subs: {
    tcm:   [{value:'classic',label:'經典醫籍'},{value:'case',label:'名醫醫案'},{value:'herb',label:'本草考證'},{value:'acu',label:'針灸經絡'},{value:'formula',label:'方劑學'}],
    psych: [{value:'cognitive',label:'認知心理學'},{value:'behavioural',label:'行為心理學'},{value:'developmental',label:'發展心理學'},{value:'clinical',label:'臨床心理學'}],
    econ:  [{value:'macro',label:'宏觀經濟學'},{value:'micro',label:'微觀經濟學'},{value:'finance',label:'金融理論'},{value:'history',label:'經濟思想史'}],
    phil:  [{value:'classical',label:'先秦諸子'},{value:'western',label:'西方哲學'},{value:'ethics',label:'倫理學'}],
    lit:   [{value:'classical',label:'古典文學'},{value:'modern',label:'現代文學'},{value:'criticism',label:'文學評論'}],
    notes: [{value:'reflection',label:'個人感悟'},{value:'reading',label:'讀書筆記'},{value:'idea',label:'靈感火花'}],
  },
};
const CUSTOM_CATS_KEY = 'mozhai_custom_cats';
let _catsCache = null;

function getCats() {
  if (!_catsCache) {
    const saved = load(CUSTOM_CATS_KEY, null);
    _catsCache = saved ? saved : JSON.parse(JSON.stringify(_DEFAULT_CATS));
  }
  return _catsCache;
}

function saveCats(c) {
  _catsCache = c;
  store(CUSTOM_CATS_KEY, c);
}

function categoryLabel(id) {
  return (getCats().roots.find(r => r.id === id) || {}).label || id;
}

/* ─────────────────────────────────────────
   Search index (pre-built at startup)
───────────────────────────────────────── */
let _searchIndex = [];

function store(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function load(key, def)  { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }

function showToast(msg, ms = 2200) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ─────────────────────────────────────────
   Fetch helpers (with simple in-memory cache)
   Resolve URL relative to the app root so it
   works both on file:// and on a local server.
───────────────────────────────────────── */
const _cache = {};

/* ─────────────────────────────────────────
   Hexagram local overrides (localStorage)
   Allows editing hexagram data in-browser.
───────────────────────────────────────── */
const HEX_OVERRIDES_KEY = 'mozhai_hex_overrides';

function getHexOverrides() { return load(HEX_OVERRIDES_KEY, {}); }

function saveHexOverride(h) {
  const ov = getHexOverrides();
  ov[h.id] = h;
  store(HEX_OVERRIDES_KEY, ov);
}

async function getHexagramData() {
  const data = await fetchJSON('data/hexagrams.json');
  const ov = getHexOverrides();
  if (!Object.keys(ov).length) return data;
  return {
    ...data,
    hexagrams: data.hexagrams.map(h => ov[h.id] ? { ...h, ...ov[h.id] } : h),
  };
}

/* ─────────────────────────────────────────
   Record local overrides (localStorage)
───────────────────────────────────────── */
const RECORD_OVERRIDES_KEY = 'mozhai_record_overrides';

function getRecordOverrides() { return load(RECORD_OVERRIDES_KEY, {}); }

function saveRecordOverride(r) {
  const ov = getRecordOverrides();
  ov[r.id] = r;
  store(RECORD_OVERRIDES_KEY, ov);
}

async function getRecordsData() {
  const data = await fetchJSON('data/records.json');
  const ov = getRecordOverrides();
  if (!Object.keys(ov).length) return data;
  return {
    ...data,
    records: data.records.map(r => ov[r.id] ? { ...r, ...ov[r.id] } : r),
  };
}

function resolveAppURL(path) {
  // Find the root of the app by walking up from the current page
  // until we find the directory that contains index.html.
  // For a flat structure (all HTML files at the same level as data/),
  // the app root is always the same directory as the current page.
  const base = document.querySelector('base')?.href
    || window.location.href.replace(/\/[^/]*(\?.*)?$/, '/');
  return new URL(path, base).href;
}

async function fetchJSON(path) {
  const url = resolveAppURL(path);
  if (_cache[url]) return _cache[url];
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  _cache[url] = await res.json();
  return _cache[url];
}

/* ─────────────────────────────────────────
   Dark-mode toggle
───────────────────────────────────────── */
function initDarkMode() {
  const saved = load(STORAGE.darkMode, false);
  if (saved) document.documentElement.classList.add('dark');

  document.querySelectorAll('[data-dark-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      store(STORAGE.darkMode, isDark);
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.textContent = isDark ? 'light_mode' : 'dark_mode';
    });
  });
}

/* ─────────────────────────────────────────
   Search index — built at page load
───────────────────────────────────────── */
async function buildSearchIndex() {
  try {
    const [recData, hexData] = await Promise.all([
      getRecordsData().catch(() => ({ records: [] })),
      getHexagramData().catch(() => ({ hexagrams: [] })),
    ]);

    const recItems = recData.records.map(r => ({
      badge:      categoryLabel(r.category),
      badgeColor: '#5e5e5e',
      title:      r.title,
      sub:        `${r.date} · ${categoryLabel(r.category)}`,
      snippet:    r.excerpt || (r.content || '').slice(0, 100),
      url:        `article.html?id=${r.id}`,
      text:       [r.title, r.excerpt, r.content, categoryLabel(r.category), ...(r.tags || [])].join(' ').toLowerCase(),
    }));

    const hexItems = hexData.hexagrams.map(h => {
      const yaoText = (h.yao || []).map(y => `${y.name || ''} ${y.text || ''} ${y.translation || ''}`).join(' ');
      return {
        badge:      '卦象',
        badgeColor: '#390002',
        title:      h.name,
        sub:        `第 ${String(h.id).padStart(2, '0')} 卦 · ${h.core || ''}`,
        snippet:    h.desc || h.judgment || '',
        url:        `hexagram-detail.html?id=${h.id}`,
        text:       [h.name, h.core, h.judgment, h.desc, h.detail, yaoText].join(' ').toLowerCase(),
      };
    });

    _searchIndex = [...recItems, ...hexItems];
  } catch (e) {
    console.warn('Search index build failed:', e);
    _searchIndex = [];
  }
}

/* ─────────────────────────────────────────
   Search overlay
───────────────────────────────────────── */
function initSearch() {
  const overlay = document.getElementById('search-overlay');
  if (!overlay) return;

  const input   = overlay.querySelector('input[type="search"]');
  const results = document.getElementById('search-results');

  // open
  document.querySelectorAll('[data-open-search]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.classList.add('active');
      setTimeout(() => input?.focus(), 50);
    });
  });

  // close
  function closeSearch() {
    overlay.classList.remove('active');
    if (input)   input.value = '';
    if (results) results.innerHTML = '';
  }
  overlay.querySelectorAll('[data-close-search]').forEach(btn => btn.addEventListener('click', closeSearch));
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

  if (!input) return;

  input.addEventListener('input', debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ''; return; }

    if (!_searchIndex.length) {
      results.innerHTML = `<div style="color:#747878;font-size:14px;text-align:center;padding:24px">索引建立中，請稍候再試…</div>`;
      buildSearchIndex().then(() => { if (input.value.trim()) input.dispatchEvent(new Event('input')); });
      return;
    }

    const hits = _searchIndex.filter(item => item.text.includes(q));

    if (!hits.length) {
      results.innerHTML = `<div style="color:#747878;font-size:14px;text-align:center;padding:24px">未找到「${q}」相關內容</div>`;
      return;
    }

    results.innerHTML = hits.slice(0, 20).map(h => `
      <div class="search-result-item" data-url="${h.url}">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
          <span style="font-size:11px;color:#fff;background:${h.badgeColor};padding:2px 7px;border-radius:3px;letter-spacing:.05em">${h.badge}</span>
          <span style="font-size:12px;color:#747878;letter-spacing:.05em">${h.sub}</span>
        </div>
        <div style="font-family:'Noto Serif TC',serif;font-size:18px;color:#171818;margin-bottom:4px">${highlight(h.title, q)}</div>
        <div style="font-size:14px;color:#444748;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${highlight(h.snippet, q)}</div>
      </div>`).join('');

    results.querySelectorAll('[data-url]').forEach(el => {
      el.addEventListener('click', () => {
        window.location.href = resolveAppURL(el.dataset.url);
        closeSearch();
      });
    });
  }, 180));
}

function highlight(text, q) {
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'), '<mark style="background:#ffdad6;color:#390002">$1</mark>');
}

/* ─────────────────────────────────────────
   Bookmarks
───────────────────────────────────────── */
function initBookmarks() {
  const bookmarks = new Set(load(STORAGE.bookmarks, []));

  document.querySelectorAll('[data-bookmark]').forEach(btn => {
    const id = btn.dataset.bookmark;
    updateBookmarkIcon(btn, bookmarks.has(id));

    btn.addEventListener('click', () => {
      if (bookmarks.has(id)) {
        bookmarks.delete(id);
        showToast('已取消收藏');
      } else {
        bookmarks.add(id);
        showToast('已加入收藏');
      }
      store(STORAGE.bookmarks, [...bookmarks]);
      updateBookmarkIcon(btn, bookmarks.has(id));
    });
  });
}

function updateBookmarkIcon(btn, active) {
  const icon = btn.querySelector('.material-symbols-outlined');
  if (!icon) return;
  icon.style.fontVariationSettings = active ? "'FILL' 1" : "'FILL' 0";
  btn.setAttribute('aria-pressed', String(active));
}

/* ─────────────────────────────────────────
   Tag management (add.html)
───────────────────────────────────────── */
function initTagInput() {
  const container = document.getElementById('tag-container');
  const addBtn    = document.getElementById('add-tag-btn');
  if (!container || !addBtn) return;

  addBtn.addEventListener('click', () => {
    const val = prompt('請輸入新標籤:');
    if (!val?.trim()) return;
    addTag(val.trim());
  });

  container.addEventListener('click', e => {
    const removeBtn = e.target.closest('.remove-tag');
    if (!removeBtn) return;
    removeBtn.closest('[data-tag]')?.remove();
  });

  function addTag(label) {
    const existing = container.querySelector(`[data-tag="${label}"]`);
    if (existing) { showToast('標籤已存在'); return; }
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.dataset.tag = label;
    chip.innerHTML = `${label}<span class="material-symbols-outlined remove-tag">close</span>`;
    container.insertBefore(chip, addBtn);
  }
}

/* ─────────────────────────────────────────
   Subcategory select (add.html)
   Dynamically populate sub-category options
   when root category changes.
───────────────────────────────────────── */
function initCategorySelect() {
  const rootSel = document.getElementById('select-root');
  const subSel  = document.getElementById('select-sub');
  if (!rootSel || !subSel) return;

  function populateRoots(selectedVal) {
    const cats = getCats();
    rootSel.innerHTML = `<option value="" disabled ${selectedVal ? '' : 'selected'}>請選擇領域...</option>` +
      cats.roots.map(r => `<option value="${r.id}" ${r.id === selectedVal ? 'selected' : ''}>${r.label}</option>`).join('');
  }

  function updateSubs(rootVal) {
    const subs = getCats().subs[rootVal] || [];
    subSel.innerHTML = subs.length
      ? `<option value="" disabled selected>請選擇子目錄...</option>` +
        subs.map(s => `<option value="${s.value}">${s.label}</option>`).join('')
      : `<option value="" disabled selected>（此類別無子目錄）</option>`;
    subSel.disabled = subs.length === 0;
  }

  const saved = load(STORAGE.drafts, null);
  populateRoots(saved?.category || '');
  if (saved?.category) {
    updateSubs(saved.category);
    if (saved.subcategory) subSel.value = saved.subcategory;
  } else {
    subSel.disabled = true;
    subSel.innerHTML = `<option value="" disabled selected>請先選擇根目錄...</option>`;
  }

  rootSel.addEventListener('change', () => updateSubs(rootSel.value));

  // Expose refresh for category manager
  rootSel._refreshOptions = (val) => populateRoots(val || rootSel.value);
}

/* ─────────────────────────────────────────
   Draft / publish / edit (add.html)
───────────────────────────────────────── */
async function initForm() {
  const form     = document.getElementById('entry-form');
  const draftBtn = document.getElementById('btn-draft');
  if (!form) return;

  const editId = new URLSearchParams(location.search).get('id');
  let editRecord = null;

  // Edit mode: load existing record
  if (editId) {
    const h1 = document.getElementById('form-page-title');
    if (h1) h1.textContent = '編輯文獻';
    document.title = '編輯文獻 — 墨齋數據';
    document.querySelector('.page-subtitle')?.remove();
    try {
      const data = await getRecordsData();
      editRecord = data.records.find(r => r.id === editId) || null;
    } catch { /* ignore */ }

    if (editRecord) {
      const rootSel = document.getElementById('select-root');
      const subSel  = document.getElementById('select-sub');
      const titleEl = form.querySelector('[name="title"]');
      const contentEl = form.querySelector('[name="content"]');

      if (titleEl)   titleEl.value   = editRecord.title   ?? '';
      if (contentEl) contentEl.value = editRecord.content ?? '';
      if (rootSel && editRecord.category) {
        rootSel.value = editRecord.category;
        rootSel.dispatchEvent(new Event('change'));
        setTimeout(() => {
          if (subSel && editRecord.subcategory) subSel.value = editRecord.subcategory;
        }, 50);
      }
      // Restore tags
      const tagContainer = document.getElementById('tag-container');
      const addTagBtn    = document.getElementById('add-tag-btn');
      if (tagContainer && addTagBtn && editRecord.tags?.length) {
        tagContainer.querySelectorAll('[data-tag]').forEach(el => el.remove());
        editRecord.tags.forEach(t => {
          const chip = document.createElement('span');
          chip.className = 'tag-chip';
          chip.dataset.tag = t;
          chip.innerHTML = `${t}<span class="material-symbols-outlined remove-tag">close</span>`;
          tagContainer.insertBefore(chip, addTagBtn);
        });
      }
    }
  } else {
    // New record: restore draft
    const saved = load(STORAGE.drafts, null);
    if (saved) {
      const titleEl   = form.querySelector('[name="title"]');
      const contentEl = form.querySelector('[name="content"]');
      if (titleEl)   titleEl.value   = saved.title   ?? '';
      if (contentEl) contentEl.value = saved.content ?? '';
    }
  }

  function gatherDraft() {
    return {
      id:          editId || editRecord?.id || `r${Date.now()}`,
      title:       form.querySelector('[name="title"]')?.value       ?? '',
      content:     form.querySelector('[name="content"]')?.value     ?? '',
      category:    document.getElementById('select-root')?.value     ?? '',
      subcategory: document.getElementById('select-sub')?.value      ?? '',
      date:        editRecord?.date    ?? new Date().toLocaleDateString('zh-Hant-TW'),
      dateISO:     editRecord?.dateISO ?? new Date().toISOString().split('T')[0],
      tags: [...form.querySelectorAll('[data-tag]')].map(el => el.dataset.tag),
      excerpt:     editRecord?.excerpt ?? '',
      bookmarked:  editRecord?.bookmarked ?? false,
    };
  }

  draftBtn?.addEventListener('click', () => {
    if (editId) {
      saveRecordOverride(gatherDraft());
      showToast('✓ 已儲存到本機');
    } else {
      store(STORAGE.drafts, gatherDraft());
      showToast('草稿已儲存');
    }
  });

  // Export JSON button
  document.getElementById('btn-export-records')?.addEventListener('click', async () => {
    if (editId) saveRecordOverride(gatherDraft());
    const base = JSON.parse(JSON.stringify(await fetchJSON('data/records.json')));
    const ov = getRecordOverrides();
    base.records = base.records.map(r => ov[r.id] ? { ...r, ...ov[r.id] } : r);
    const blob = new Blob([JSON.stringify(base, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'records.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('✓ 已匯出 records.json');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const draft = gatherDraft();
    if (!draft.title.trim())   { showToast('請填寫標題'); return; }
    if (!draft.content.trim()) { showToast('請填寫正文'); return; }
    if (!draft.category)       { showToast('請選擇根目錄'); return; }

    if (editId) {
      saveRecordOverride(draft);
      showToast('✓ 已儲存');
      setTimeout(() => { window.location.href = resolveAppURL(`article.html?id=${editId}`); }, 1000);
    } else {
      localStorage.removeItem(STORAGE.drafts);
      showToast('已發佈！');
      setTimeout(() => { window.location.href = resolveAppURL('index.html'); }, 1200);
    }
  });

  // Image upload area (drag-and-drop visual only)
  const dropZone = document.getElementById('media-dropzone');
  const fileInput = document.getElementById('media-input');
  if (dropZone && fileInput) {
    dropZone.addEventListener('click', () => fileInput.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleImageFile(file, dropZone);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) handleImageFile(fileInput.files[0], dropZone);
    });
  }
}

function handleImageFile(file, zone) {
  if (!file.type.startsWith('image/')) { showToast('請上傳圖片檔案'); return; }
  if (file.size > 5 * 1024 * 1024)    { showToast('檔案不可超過 5MB'); return; }
  const reader = new FileReader();
  reader.onload = ev => {
    zone.style.backgroundImage = `url(${ev.target.result})`;
    zone.style.backgroundSize  = 'cover';
    zone.style.backgroundPosition = 'center';
    zone.querySelector('.dropzone-hint')?.remove();
    showToast('圖片已載入');
  };
  reader.readAsDataURL(file);
}

/* ─────────────────────────────────────────
   Hexagram page — render all 64 from JSON
───────────────────────────────────────── */
async function initHexagrams() {
  const grid = document.getElementById('hexagram-grid');
  if (!grid) return;

  grid.innerHTML = `<div class="col-span-full flex items-center justify-center py-20 text-secondary text-label-lg">載入中…</div>`;

  let data;
  try { data = await getHexagramData(); }
  catch (err) {
    grid.innerHTML = `
      <div class="col-span-full text-center py-20">
        <p style="color:#ba1a1a;font-size:16px;margin-bottom:8px">載入失敗</p>
        <p style="color:#747878;font-size:13px">請確認 data/hexagrams.json 文件存在，並透過本地伺服器（非 file://）開啟頁面</p>
      </div>`;
    return;
  }

  grid.innerHTML = data.hexagrams.map(h => `
    <a href="${resolveAppURL('hexagram-detail.html')}?id=${h.id}"
       class="flex items-center gap-6 p-6 border border-secondary/10 rounded-xl
              bg-surface hover:bg-surface-variant transition-colors duration-300
              group cursor-pointer relative overflow-hidden"
       data-hexagram="${h.id}">
      <div class="flex-shrink-0 w-10 flex flex-col justify-between gap-[5px] opacity-60
                  group-hover:opacity-100 transition-opacity">
        ${renderLines(h.symbol)}
      </div>
      <div class="flex flex-col z-10 min-w-0 flex-1">
        <div class="flex items-baseline gap-3 mb-1">
          <span class="text-label-sm text-secondary font-mono tracking-[0.2em] flex-shrink-0">${String(h.id).padStart(2, '0')}</span>
          <h2 class="text-headline-md text-primary m-0" style="font-family:'Noto Serif TC',serif">${h.name}</h2>
        </div>
        <div class="flex items-center gap-2" style="font-size:12px;color:#92030f">
          <span class="material-symbols-outlined" style="font-size:13px;font-variation-settings:'FILL' 1">lens</span>
          <span>${h.core}</span>
        </div>
      </div>
      <span class="material-symbols-outlined text-outline/40 group-hover:text-outline transition-colors flex-shrink-0">chevron_right</span>
    </a>`).join('');
}

function renderLines(symbol) {
  // symbol: 6-char binary string, read top→bottom (index 0 = top line)
  return symbol.split('').map(bit =>
    bit === '1'
      ? `<div style="height:4px;background:#171818;border-radius:2px;width:100%"></div>`
      : `<div style="display:flex;justify-content:space-between;width:100%">
           <div style="height:4px;background:#171818;border-radius:2px;width:44%"></div>
           <div style="height:4px;background:#171818;border-radius:2px;width:44%"></div>
         </div>`
  ).join('');
}

/* ─────────────────────────────────────────
   Hexagram detail page — load single hexagram
───────────────────────────────────────── */
async function initHexagramDetail() {
  const content = document.getElementById('detail-content');
  if (!content) return;

  const loading = document.getElementById('detail-loading');
  const error   = document.getElementById('detail-error');
  const id      = parseInt(new URLSearchParams(location.search).get('id'), 10);

  let data;
  try { data = await getHexagramData(); }
  catch {
    loading?.classList.add('hidden');
    error?.classList.remove('hidden');
    return;
  }

  const h = data.hexagrams.find(x => x.id === id);
  if (!h) {
    loading?.classList.add('hidden');
    error?.classList.remove('hidden');
    return;
  }

  document.title = `${h.name} — 墨齋數據`;
  document.getElementById('detail-id').textContent   = `第 ${String(h.id).padStart(2, '0')} 卦`;
  document.getElementById('detail-name').textContent = h.name;
  document.getElementById('detail-core').textContent = h.core;
  document.getElementById('detail-judgment').textContent = h.judgment;
  document.getElementById('detail-desc').textContent = h.desc ?? '';

  // 詳細說明
  if (h.detail) {
    document.getElementById('detail-detail').textContent = h.detail;
    document.getElementById('detail-detail-section')?.classList.remove('hidden');
  }

  // 六爻詳解
  const yaoEl = document.getElementById('detail-yao');
  if (yaoEl && h.yao?.length) {
    document.getElementById('detail-yao-divider')?.classList.remove('hidden');
    document.getElementById('detail-yao-section')?.classList.remove('hidden');
    yaoEl.innerHTML = h.yao.map((y, i) => `
      <div class="pl-6 border-l-2 border-secondary/15 py-1">
        <div class="flex items-baseline gap-3 mb-3">
          <span class="font-mono text-xs tracking-widest text-secondary">${String(i + 1).padStart(2, '0')}</span>
          <span class="font-label-lg text-label-lg text-primary" style="font-family:'Noto Serif TC',serif">${y.name ?? ''}</span>
        </div>
        <p class="text-lg text-primary mb-3" style="font-family:'Noto Serif TC',serif;line-height:1.9">${y.text ?? ''}</p>
        <p class="text-body-md text-on-surface-variant" style="line-height:1.9">${y.translation ?? ''}</p>
      </div>`).join('');
  }

  const symEl = document.getElementById('detail-symbol');
  symEl.innerHTML = h.symbol.split('').map(bit =>
    bit === '1'
      ? `<div style="height:5px;background:#171818;border-radius:2px;width:100%"></div>`
      : `<div style="display:flex;justify-content:space-between;width:100%">
           <div style="height:5px;background:#171818;border-radius:2px;width:44%"></div>
           <div style="height:5px;background:#171818;border-radius:2px;width:44%"></div>
         </div>`
  ).join('');

  loading?.classList.add('hidden');
  content.classList.remove('hidden');

  const editLink = document.getElementById('hex-edit-link');
  if (editLink) editLink.href = `edit-hexagram.html?id=${id}`;
}

/* ─────────────────────────────────────────
   Collection page — render category list from JSON
───────────────────────────────────────── */
async function initCollection() {
  const grid = document.getElementById('category-grid');
  if (!grid) return;

  let data;
  try { data = await fetchJSON('data/records.json'); }
  catch { return; }

  // Count records per category
  const counts = {};
  data.records.forEach(r => { counts[r.category] = (counts[r.category] || 0) + 1; });

  const cats = data.categories;
  if (!cats?.length) return;

  const [featured, ...rest] = cats;

  const featuredSubs = getCats().subs[featured.id] || [];

  grid.innerHTML = `
    <!-- Featured category -->
    <div class="md:col-span-8 group">
      <div class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 md:p-12 relative overflow-hidden transition-all duration-500 hover:border-outline/40">
        <div class="absolute inset-0 ink-bleed-bg opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
        <div class="relative z-10 flex items-start justify-between mb-8">
          <div>
            <div class="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-6">
              <span class="material-symbols-outlined text-tertiary text-2xl" style="font-variation-settings:'FILL' 1">${featured.icon}</span>
            </div>
            <h3 class="font-headline-lg text-headline-lg text-primary mb-2">${featured.label}</h3>
            <p class="font-body-md text-body-md text-on-surface-variant">${featured.desc}</p>
          </div>
          ${featured.badge ? `<span class="font-label-sm text-label-sm text-outline px-3 py-1 border border-outline-variant rounded-full">${featured.badge}</span>` : ''}
        </div>
        <div class="space-y-6 mt-12 pl-4 border-l border-outline-variant/40">
          ${featuredSubs.slice(0, 3).map((sub, i) => `
            <a href="collection.html?cat=${featured.id}&sub=${sub.value}"
               class="relative group/item cursor-pointer block">
              <div class="absolute -left-[21px] top-3 w-2.5 h-2.5 rounded-full bg-surface-container ${i === 0 ? 'border-2 border-tertiary' : 'border-2 border-outline'}
                          group-hover/item:bg-tertiary group-hover/item:border-tertiary transition-colors duration-300"></div>
              <div class="pl-6 py-2">
                <h4 class="font-headline-md text-headline-md text-primary mb-1 group-hover/item:text-tertiary transition-colors duration-300">${sub.label}</h4>
              </div>
            </a>`).join('')}
        </div>
        <div class="mt-8 pt-6 border-t border-outline-variant/20 flex justify-between items-center relative z-10">
          <span class="font-label-sm text-label-sm text-outline">${counts[featured.id] ?? featured.count ?? 0} 篇目</span>
          <a href="collection.html?cat=${featured.id}" class="flex items-center gap-1 text-secondary hover:text-primary transition-colors font-label-sm text-label-sm">
            瀏覽全部 <span class="material-symbols-outlined text-sm">arrow_forward</span>
          </a>
        </div>
      </div>
    </div>

    <!-- Side categories -->
    <div class="md:col-span-4 flex flex-col gap-8">
      ${rest.map(cat => `
        <a href="collection.html?cat=${cat.id}"
           class="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-8 relative overflow-hidden group cursor-pointer hover:bg-surface-container-low transition-colors duration-500 block">
          <div class="flex items-center gap-4 mb-4">
            <span class="material-symbols-outlined text-outline text-xl">${cat.icon}</span>
            <h3 class="font-headline-md text-headline-md text-primary group-hover:text-tertiary transition-colors duration-300">${cat.label}</h3>
          </div>
          <p class="font-body-md text-body-md text-on-surface-variant">${cat.desc}</p>
          <div class="mt-6 flex justify-between items-center">
            <span class="font-label-sm text-label-sm text-outline">${counts[cat.id] ?? cat.count ?? 0} 篇目</span>
            <span class="material-symbols-outlined text-outline group-hover:translate-x-1 transition-transform duration-300">arrow_forward</span>
          </div>
        </a>`).join('')}
    </div>`;
}

/* ─────────────────────────────────────────
   Home page — render recent records
───────────────────────────────────────── */
async function initHome() {
  const list = document.getElementById('recent-list');
  if (!list) return;

  let data;
  try { data = await fetchJSON('data/records.json'); }
  catch {
    list.innerHTML = `<p style="color:#747878;font-size:14px">暫無記錄</p>`;
    return;
  }

  const recent = [...data.records].sort((a, b) =>
    new Date(b.dateISO) - new Date(a.dateISO)
  ).slice(0, 3);

  list.innerHTML = recent.map(r => `
    <article class="group relative pl-8 py-2 border-l border-outline/20
                    hover:border-primary/40 transition-colors duration-500">
      <div class="absolute left-[-4px] top-4 w-[7px] h-[9px] rounded-full
                  bg-secondary/80 group-hover:bg-tertiary transition-colors rotate-12"></div>
      <div class="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div class="flex-1 space-y-3">
          <div class="flex items-center gap-3">
            <span class="font-label-sm text-label-sm text-on-surface-variant tracking-widest">${r.date}</span>
            <span class="w-1 h-1 rounded-full bg-outline-variant"></span>
            <span class="font-label-sm text-label-sm text-primary tracking-wider">${categoryLabel(r.category)}</span>
          </div>
          <h3 class="font-headline-lg text-headline-lg text-primary
                     group-hover:text-tertiary-container transition-colors">
            <a href="${resolveAppURL('article.html')}?id=${r.id}">${r.title}</a>
          </h3>
          <p class="font-body-md text-body-md text-on-surface-variant max-w-3xl leading-relaxed">
            ${r.excerpt}
          </p>
        </div>
        <button aria-label="收藏" data-bookmark="${r.id}"
                class="flex-shrink-0 mt-2 md:mt-0 text-outline hover:text-tertiary transition-colors p-2">
          <span class="material-symbols-outlined">bookmark</span>
        </button>
      </div>
    </article>`).join('');

  initBookmarks();
}

/* ─────────────────────────────────────────
   Article page — load from query param
───────────────────────────────────────── */
async function initArticle() {
  const articleMain = document.getElementById('article-body');
  if (!articleMain) return;

  const id = new URLSearchParams(location.search).get('id');

  const titleEl   = document.getElementById('article-title');
  const dateEl    = document.getElementById('article-date');
  const bodyEl    = document.getElementById('article-content');
  const tagsEl    = document.getElementById('article-tags');

  if (!id) {
    if (titleEl) titleEl.textContent = '未指定文章';
    return;
  }

  let data;
  try { data = await getRecordsData(); }
  catch {
    if (titleEl) titleEl.textContent = '載入失敗';
    if (bodyEl)  bodyEl.innerHTML = '<p style="color:#ba1a1a">資料載入失敗，請檢查 data/records.json 是否存在。</p>';
    return;
  }

  const record = data.records.find(r => r.id === id);
  if (!record) {
    if (titleEl) titleEl.textContent = '找不到此文章';
    if (bodyEl)  bodyEl.innerHTML = `<p style="color:#747878">ID 為「${id}」的記錄不存在。</p>`;
    return;
  }

  document.title = `${record.title} — 墨齋數據`;
  if (titleEl) titleEl.textContent = record.title;
  if (dateEl)  dateEl.textContent  = `${record.date} · ${categoryLabel(record.category)}`;
  if (bodyEl)  bodyEl.innerHTML    = record.content
    .split(/\n\n+/)
    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
    .join('');
  if (tagsEl)  tagsEl.innerHTML    = record.tags.map(t =>
    `<span class="px-4 py-1.5 rounded-full border border-outline-variant text-secondary
                  font-label-sm text-label-sm hover:bg-surface-container transition-colors cursor-pointer">${t}</span>`
  ).join('');

  // Wire edit link to add.html?id=xxx
  const editLink = document.getElementById('edit-link');
  if (editLink) editLink.href = `add.html?id=${id}`;
}

/* ─────────────────────────────────────────
   Edit hexagram page
───────────────────────────────────────── */
async function initEditHexagram() {
  const form = document.getElementById('hex-edit-form');
  if (!form) return;

  let id = parseInt(new URLSearchParams(location.search).get('id'), 10) || 1;

  function updateSymRow(el, bit) {
    el.innerHTML = bit === '1'
      ? `<div style="height:6px;background:#171818;border-radius:3px;width:100%"></div>`
      : `<div style="display:flex;justify-content:space-between"><div style="height:6px;background:#171818;border-radius:3px;width:44%"></div><div style="height:6px;background:#171818;border-radius:3px;width:44%"></div></div>`;
  }

  function buildSymbolEditor(symbol) {
    const el = document.getElementById('symbol-editor');
    el.innerHTML = '';
    (symbol || '111111').split('').forEach((bit, i) => {
      const row = document.createElement('div');
      row.dataset.idx = i;
      row.dataset.val = bit;
      row.className = 'sym-row';
      updateSymRow(row, bit);
      row.addEventListener('click', () => {
        const nv = row.dataset.val === '1' ? '0' : '1';
        row.dataset.val = nv;
        updateSymRow(row, nv);
      });
      el.appendChild(row);
    });
  }

  function buildYaoUI() {
    document.getElementById('yao-container').innerHTML = Array.from({length: 6}, (_, i) => `
      <details class="yao-section" id="yao-details-${i}">
        <summary>
          <span class="material-symbols-outlined chevron" style="font-size:18px;color:#747878">chevron_right</span>
          <span class="font-mono text-sm tracking-widest" style="color:#747878">第 ${i + 1} 爻</span>
          <span id="yao-summary-${i}" class="text-sm ml-2 truncate flex-1" style="color:#1b1c18"></span>
        </summary>
        <div class="space-y-4 pt-4 pb-2">
          <div>
            <label class="field-label">爻名</label>
            <input id="yao-name-${i}" class="field-input" type="text" placeholder="例：初九"/>
          </div>
          <div>
            <label class="field-label">爻辭（原文）</label>
            <textarea id="yao-text-${i}" class="field-input" rows="2" placeholder="例：潛龍勿用。"></textarea>
          </div>
          <div>
            <label class="field-label">白話解釋</label>
            <textarea id="yao-trans-${i}" class="field-input" rows="3" placeholder="白話文解釋…"></textarea>
          </div>
        </div>
      </details>`).join('');

    for (let i = 0; i < 6; i++) {
      document.getElementById(`yao-name-${i}`).addEventListener('input', () => {
        document.getElementById(`yao-summary-${i}`).textContent =
          document.getElementById(`yao-name-${i}`).value;
      });
    }
  }

  function readForm() {
    const symbol = [...document.querySelectorAll('#symbol-editor [data-idx]')]
      .map(el => el.dataset.val).join('');
    return {
      id,
      name:     document.getElementById('edit-name').value,
      symbol,
      judgment: document.getElementById('edit-judgment').value,
      core:     document.getElementById('edit-core').value,
      desc:     document.getElementById('edit-desc').value,
      detail:   document.getElementById('edit-detail').value,
      yao: Array.from({length: 6}, (_, i) => ({
        name:        document.getElementById(`yao-name-${i}`).value,
        text:        document.getElementById(`yao-text-${i}`).value,
        translation: document.getElementById(`yao-trans-${i}`).value,
      })),
    };
  }

  async function populatePage() {
    id = parseInt(new URLSearchParams(location.search).get('id'), 10) || 1;

    let allData;
    try { allData = await getHexagramData(); }
    catch { showToast('資料載入失敗'); return; }

    const h = allData.hexagrams.find(x => x.id === id) || {
      id, name: '', symbol: '111111', judgment: '', core: '', desc: '', detail: '',
      yao: Array.from({length: 6}, () => ({name: '', text: '', translation: ''})),
    };

    document.title = `編輯：第 ${String(id).padStart(2, '0')} 卦 — 墨齋數據`;
    document.getElementById('edit-id-label').textContent = `第 ${String(id).padStart(2, '0')} 卦`;
    document.getElementById('edit-name').value     = h.name     ?? '';
    document.getElementById('edit-judgment').value = h.judgment ?? '';
    document.getElementById('edit-core').value     = h.core     ?? '';
    document.getElementById('edit-desc').value     = h.desc     ?? '';
    document.getElementById('edit-detail').value   = h.detail   ?? '';

    buildSymbolEditor(h.symbol);

    (h.yao || []).forEach((y, i) => {
      document.getElementById(`yao-name-${i}`).value  = y.name        ?? '';
      document.getElementById(`yao-text-${i}`).value  = y.text        ?? '';
      document.getElementById(`yao-trans-${i}`).value = y.translation ?? '';
      document.getElementById(`yao-summary-${i}`).textContent = y.name ?? '';
    });

    const btnPrev = document.getElementById('btn-prev');
    const btnNext = document.getElementById('btn-next');
    if (btnPrev) btnPrev.disabled = id <= 1;
    if (btnNext) btnNext.disabled = id >= 64;
  }

  buildYaoUI();
  await populatePage();

  document.getElementById('btn-save').addEventListener('click', () => {
    saveHexOverride(readForm());
    showToast('✓ 已儲存到本機');
  });

  document.getElementById('btn-export').addEventListener('click', async () => {
    saveHexOverride(readForm());
    const base = JSON.parse(JSON.stringify(await fetchJSON('data/hexagrams.json')));
    const ov = getHexOverrides();
    base.hexagrams = base.hexagrams.map(h => ov[h.id] ? { ...h, ...ov[h.id] } : h);
    const blob = new Blob([JSON.stringify(base, null, 2)], {type: 'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'hexagrams.json'; a.click();
    URL.revokeObjectURL(url);
    showToast('✓ 已匯出 hexagrams.json');
  });

  document.getElementById('btn-prev')?.addEventListener('click', () => {
    saveHexOverride(readForm());
    history.pushState({}, '', `?id=${id - 1}`);
    populatePage();
  });

  document.getElementById('btn-next')?.addEventListener('click', () => {
    saveHexOverride(readForm());
    history.pushState({}, '', `?id=${id + 1}`);
    populatePage();
  });
}

/* ─────────────────────────────────────────
   Category Manager (add.html)
   Modal UI to add/remove roots and subs.
───────────────────────────────────────── */
function initCategoryManager() {
  const btn = document.getElementById('btn-manage-cats');
  if (!btn) return;

  const modal = document.createElement('div');
  modal.id = 'cat-manager-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML = `
    <div style="background:#fafaf3;border-radius:16px;width:100%;max-width:520px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.15)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px;border-bottom:1px solid #e3e3dc">
        <span style="font-family:'Newsreader',serif;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#747878">管理分類</span>
        <button id="cat-modal-close" style="color:#747878;background:none;border:none;cursor:pointer;padding:4px;border-radius:6px;line-height:1">
          <span class="material-symbols-outlined" style="font-size:20px">close</span>
        </button>
      </div>
      <div style="flex:1;overflow-y:auto;padding:20px 24px">
        <p style="font-family:'Newsreader',serif;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#747878;margin-bottom:8px">根目錄（點擊查看子目錄）</p>
        <div id="cat-roots-list" style="margin-bottom:16px"></div>
        <div style="display:flex;gap:8px;margin-bottom:28px;align-items:flex-end">
          <input id="cat-new-root-label" type="text" placeholder="根目錄名稱" style="flex:1;border:none;border-bottom:1px solid #c4c7c7;background:transparent;padding:6px 0;font-size:14px;font-family:'Noto Serif TC',serif;color:#1b1c18;outline:none"/>
          <input id="cat-new-root-id" type="text" placeholder="ID (英文小寫)" style="width:110px;border:none;border-bottom:1px solid #c4c7c7;background:transparent;padding:6px 0;font-size:14px;font-family:monospace;color:#1b1c18;outline:none"/>
          <button id="cat-add-root" style="padding:6px 14px;background:#1b1c18;color:#fafaf3;border:none;border-radius:6px;font-size:12px;letter-spacing:.08em;cursor:pointer;white-space:nowrap">新增</button>
        </div>
        <div id="cat-sub-panel" style="display:none;border-top:1px solid #e3e3dc;padding-top:20px">
          <p style="font-family:'Newsreader',serif;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#747878;margin-bottom:8px">
            子目錄：<span id="cat-sub-panel-title" style="color:#1b1c18;font-style:italic"></span>
          </p>
          <div id="cat-subs-list" style="margin-bottom:12px"></div>
          <div style="display:flex;gap:8px;align-items:flex-end">
            <input id="cat-new-sub-label" type="text" placeholder="子目錄名稱" style="flex:1;border:none;border-bottom:1px solid #c4c7c7;background:transparent;padding:6px 0;font-size:14px;font-family:'Noto Serif TC',serif;color:#1b1c18;outline:none"/>
            <input id="cat-new-sub-value" type="text" placeholder="value (英文)" style="width:110px;border:none;border-bottom:1px solid #c4c7c7;background:transparent;padding:6px 0;font-size:14px;font-family:monospace;color:#1b1c18;outline:none"/>
            <button id="cat-add-sub" style="padding:6px 14px;background:#1b1c18;color:#fafaf3;border:none;border-radius:6px;font-size:12px;letter-spacing:.08em;cursor:pointer;white-space:nowrap">新增</button>
          </div>
        </div>
      </div>
      <div style="padding:16px 24px;border-top:1px solid #e3e3dc;display:flex;justify-content:space-between;align-items:center;gap:12px">
        <button id="cat-reset-btn" style="padding:8px 16px;background:transparent;color:#ba1a1a;border:1px solid #ba1a1a;border-radius:8px;font-size:12px;letter-spacing:.08em;cursor:pointer">還原預設</button>
        <button id="cat-save-btn" style="padding:8px 20px;background:#1b1c18;color:#fafaf3;border:none;border-radius:8px;font-size:13px;letter-spacing:.08em;cursor:pointer">儲存並套用</button>
      </div>
    </div>`;
  document.body.appendChild(modal);

  let activeCatId = null;

  function renderRoots() {
    const cats = getCats();
    const list = document.getElementById('cat-roots-list');
    if (!cats.roots.length) {
      list.innerHTML = `<p style="color:#a0a0a0;font-size:13px;padding:8px 0">尚無根目錄</p>`;
      return;
    }
    list.innerHTML = cats.roots.map(r => `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid #f0f0e8;cursor:pointer" data-root-row="${r.id}">
        <span style="flex:1;font-family:'Noto Serif TC',serif;font-size:15px;color:${activeCatId === r.id ? '#92030f' : '#1b1c18'};font-weight:${activeCatId === r.id ? '600' : '400'}">${r.label}</span>
        <span style="font-family:monospace;font-size:11px;color:#c4c7c7">${r.id}</span>
        <button data-del-root="${r.id}" style="color:#c4c7c7;background:none;border:none;cursor:pointer;padding:4px;line-height:1" title="刪除此根目錄">
          <span class="material-symbols-outlined" style="font-size:16px">delete</span>
        </button>
      </div>`).join('');

    list.querySelectorAll('[data-root-row]').forEach(row => {
      row.addEventListener('click', e => {
        if (e.target.closest('[data-del-root]')) return;
        activeCatId = row.dataset.rootRow;
        renderRoots();
        renderSubs(activeCatId);
      });
    });

    list.querySelectorAll('[data-del-root]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        const rid = btn.dataset.delRoot;
        const cats = getCats();
        cats.roots = cats.roots.filter(r => r.id !== rid);
        delete cats.subs[rid];
        saveCats(cats);
        if (activeCatId === rid) {
          activeCatId = null;
          document.getElementById('cat-sub-panel').style.display = 'none';
        }
        renderRoots();
      });
    });
  }

  function renderSubs(rootId) {
    const panel   = document.getElementById('cat-sub-panel');
    const titleEl = document.getElementById('cat-sub-panel-title');
    const list    = document.getElementById('cat-subs-list');
    const root    = getCats().roots.find(r => r.id === rootId);
    if (!root) { panel.style.display = 'none'; return; }
    titleEl.textContent = root.label;
    panel.style.display = 'block';
    const subs = getCats().subs[rootId] || [];
    list.innerHTML = subs.length
      ? subs.map(s => `
          <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid #f0f0e8">
            <span style="flex:1;font-size:14px;color:#1b1c18">${s.label}</span>
            <span style="font-family:monospace;font-size:11px;color:#c4c7c7">${s.value}</span>
            <button data-del-sub="${s.value}" style="color:#c4c7c7;background:none;border:none;cursor:pointer;padding:4px;line-height:1">
              <span class="material-symbols-outlined" style="font-size:16px">delete</span>
            </button>
          </div>`).join('')
      : `<p style="color:#a0a0a0;font-size:13px;padding:8px 0">尚無子目錄</p>`;

    list.querySelectorAll('[data-del-sub]').forEach(btn => {
      btn.addEventListener('click', () => {
        const sv = btn.dataset.delSub;
        const cats = getCats();
        cats.subs[rootId] = (cats.subs[rootId] || []).filter(s => s.value !== sv);
        saveCats(cats);
        renderSubs(rootId);
      });
    });
  }

  btn.addEventListener('click', () => {
    activeCatId = null;
    renderRoots();
    document.getElementById('cat-sub-panel').style.display = 'none';
    modal.style.display = 'flex';
  });

  document.getElementById('cat-modal-close').addEventListener('click', () => { modal.style.display = 'none'; });
  modal.addEventListener('click', e => { if (e.target === modal) modal.style.display = 'none'; });

  document.getElementById('cat-add-root').addEventListener('click', () => {
    const label = document.getElementById('cat-new-root-label').value.trim();
    const id    = document.getElementById('cat-new-root-id').value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!label || !id) { showToast('請填寫名稱與 ID'); return; }
    const cats = getCats();
    if (cats.roots.find(r => r.id === id)) { showToast('此 ID 已存在'); return; }
    cats.roots.push({ id, label, icon: 'folder' });
    cats.subs[id] = [];
    saveCats(cats);
    document.getElementById('cat-new-root-label').value = '';
    document.getElementById('cat-new-root-id').value    = '';
    renderRoots();
  });

  document.getElementById('cat-add-sub').addEventListener('click', () => {
    if (!activeCatId) { showToast('請先點選左側根目錄'); return; }
    const label = document.getElementById('cat-new-sub-label').value.trim();
    const value = document.getElementById('cat-new-sub-value').value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!label || !value) { showToast('請填寫名稱與 value'); return; }
    const cats = getCats();
    const subs  = cats.subs[activeCatId] = cats.subs[activeCatId] || [];
    if (subs.find(s => s.value === value)) { showToast('此子目錄已存在'); return; }
    subs.push({ value, label });
    saveCats(cats);
    document.getElementById('cat-new-sub-label').value = '';
    document.getElementById('cat-new-sub-value').value = '';
    renderSubs(activeCatId);
  });

  document.getElementById('cat-reset-btn').addEventListener('click', () => {
    if (!confirm('確定還原為預設分類？此操作不可撤銷。')) return;
    _catsCache = null;
    localStorage.removeItem(CUSTOM_CATS_KEY);
    activeCatId = null;
    renderRoots();
    document.getElementById('cat-sub-panel').style.display = 'none';
    showToast('已還原預設分類');
  });

  document.getElementById('cat-save-btn').addEventListener('click', () => {
    modal.style.display = 'none';
    const rootSel = document.getElementById('select-root');
    if (rootSel?._refreshOptions) rootSel._refreshOptions();
    showToast('✓ 分類已更新');
  });
}

/* ─────────────────────────────────────────
   Nav — highlight active page link
───────────────────────────────────────── */
function initNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('[data-nav]').forEach(link => {
    const isActive = link.dataset.nav === page;
    if (isActive) {
      link.classList.add('text-red-700', 'dark:text-red-500', 'font-bold');
      link.classList.remove('text-zinc-500', 'text-zinc-400', 'dark:text-zinc-400');
    }
  });
}

/* ─────────────────────────────────────────
   Utility: debounce
───────────────────────────────────────── */
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

/* ─────────────────────────────────────────
   Bootstrap
───────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initDarkMode();
  initNav();
  initBookmarks();
  initTagInput();
  initCategorySelect();
  initCategoryManager();
  initForm();
  initHexagrams();
  initHexagramDetail();
  initEditHexagram();
  initCollection();
  initHome();
  initArticle();
  initSearch();
  buildSearchIndex();
});

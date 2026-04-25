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

// Category ID → Chinese label map (kept in sync with records.json)
const CATEGORY_LABELS = {
  tcm:   '中醫學',
  psych: '心理學',
  econ:  '經濟學',
  notes: '個人隨筆',
  phil:  '哲學',
  lit:   '文學',
};

// Subcategory definitions keyed by root category
const SUBCATEGORIES = {
  tcm:   [
    { value: 'classic', label: '經典醫籍' },
    { value: 'case',    label: '名醫醫案' },
    { value: 'herb',    label: '本草考證' },
    { value: 'acu',    label: '針灸經絡' },
    { value: 'formula', label: '方劑學' },
  ],
  psych: [
    { value: 'cognitive',    label: '認知心理學' },
    { value: 'behavioural',  label: '行為心理學' },
    { value: 'developmental',label: '發展心理學' },
    { value: 'clinical',     label: '臨床心理學' },
  ],
  econ:  [
    { value: 'macro',  label: '宏觀經濟學' },
    { value: 'micro',  label: '微觀經濟學' },
    { value: 'finance',label: '金融理論' },
    { value: 'history',label: '經濟思想史' },
  ],
  phil:  [
    { value: 'classical', label: '先秦諸子' },
    { value: 'western',   label: '西方哲學' },
    { value: 'ethics',    label: '倫理學' },
  ],
  lit:   [
    { value: 'classical', label: '古典文學' },
    { value: 'modern',    label: '現代文學' },
    { value: 'criticism', label: '文學評論' },
  ],
  notes: [
    { value: 'reflection', label: '個人感悟' },
    { value: 'reading',    label: '讀書筆記' },
    { value: 'idea',       label: '靈感火花' },
  ],
};

function store(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function load(key, def)  { try { return JSON.parse(localStorage.getItem(key)) ?? def; } catch { return def; } }

function categoryLabel(id) {
  return CATEGORY_LABELS[id] || id;
}

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
   Search overlay
───────────────────────────────────────── */
function initSearch() {
  const overlay = document.getElementById('search-overlay');
  if (!overlay) return;

  const input    = overlay.querySelector('input[type="search"]');
  const results  = document.getElementById('search-results');

  // open
  document.querySelectorAll('[data-open-search]').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.classList.add('active');
      setTimeout(() => input?.focus(), 50);
    });
  });

  // close
  overlay.querySelectorAll('[data-close-search]').forEach(btn =>
    btn.addEventListener('click', closeSearch)
  );
  overlay.addEventListener('click', e => { if (e.target === overlay) closeSearch(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSearch(); });

  function closeSearch() {
    overlay.classList.remove('active');
    if (input) input.value = '';
    if (results) results.innerHTML = '';
  }

  // live search against records.json
  if (!input) return;
  input.addEventListener('input', debounce(async () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ''; return; }

    let data;
    try { data = await fetchJSON('data/records.json'); }
    catch (err) {
      results.innerHTML = `<div style="color:#ba1a1a;font-size:14px;text-align:center;padding:24px">搜尋失敗，請確認資料文件存在</div>`;
      return;
    }

    const hits = data.records.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.excerpt.toLowerCase().includes(q) ||
      r.tags.some(t => t.toLowerCase().includes(q)) ||
      categoryLabel(r.category).includes(q)
    );

    results.innerHTML = hits.length
      ? hits.map(r => `
          <div class="search-result-item" data-id="${r.id}">
            <div style="font-size:12px;letter-spacing:.1em;color:#747878;margin-bottom:4px">${r.date} · ${categoryLabel(r.category)}</div>
            <div style="font-family:'Noto Serif TC',serif;font-size:18px;color:#171818;margin-bottom:4px">${highlight(r.title, q)}</div>
            <div style="font-size:14px;color:#444748;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical">${r.excerpt}</div>
          </div>`).join('')
      : `<div style="color:#747878;font-size:14px;text-align:center;padding:24px">未找到相關記錄</div>`;

    results.querySelectorAll('[data-id]').forEach(el => {
      el.addEventListener('click', () => {
        window.location.href = resolveAppURL(`article.html?id=${el.dataset.id}`);
      });
    });
  }, 250));
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

  function updateSubs(rootVal) {
    const subs = SUBCATEGORIES[rootVal] || [];
    subSel.innerHTML = subs.length
      ? `<option value="" disabled selected>請選擇子目錄...</option>` +
        subs.map(s => `<option value="${s.value}">${s.label}</option>`).join('')
      : `<option value="" disabled selected>（此類別無子目錄）</option>`;
    subSel.disabled = subs.length === 0;
  }

  // Restore from draft if present
  const saved = load(STORAGE.drafts, null);
  if (saved?.category) {
    rootSel.value = saved.category;
    updateSubs(saved.category);
    if (saved.subcategory) subSel.value = saved.subcategory;
  } else {
    subSel.disabled = true;
    subSel.innerHTML = `<option value="" disabled selected>請先選擇根目錄...</option>`;
  }

  rootSel.addEventListener('change', () => {
    updateSubs(rootSel.value);
  });
}

/* ─────────────────────────────────────────
   Draft / publish (add.html)
───────────────────────────────────────── */
function initForm() {
  const form     = document.getElementById('entry-form');
  const draftBtn = document.getElementById('btn-draft');
  if (!form) return;

  // Restore draft
  const saved = load(STORAGE.drafts, null);
  if (saved) {
    const titleEl   = form.querySelector('[name="title"]');
    const contentEl = form.querySelector('[name="content"]');
    if (titleEl)   titleEl.value   = saved.title   ?? '';
    if (contentEl) contentEl.value = saved.content ?? '';
  }

  function gatherDraft() {
    return {
      title:       form.querySelector('[name="title"]')?.value       ?? '',
      content:     form.querySelector('[name="content"]')?.value     ?? '',
      category:    document.getElementById('select-root')?.value     ?? '',
      subcategory: document.getElementById('select-sub')?.value      ?? '',
      tags: [...form.querySelectorAll('[data-tag]')].map(el => el.dataset.tag),
    };
  }

  draftBtn?.addEventListener('click', () => {
    store(STORAGE.drafts, gatherDraft());
    showToast('草稿已儲存');
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const draft = gatherDraft();
    if (!draft.title.trim())   { showToast('請填寫標題'); return; }
    if (!draft.content.trim()) { showToast('請填寫正文'); return; }
    if (!draft.category)       { showToast('請選擇根目錄'); return; }

    // Simulate publish: clear draft, redirect home
    localStorage.removeItem(STORAGE.drafts);
    showToast('已發佈！');
    setTimeout(() => { window.location.href = resolveAppURL('index.html'); }, 1200);
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
  try { data = await fetchJSON('data/hexagrams.json'); }
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
  try { data = await fetchJSON('data/hexagrams.json'); }
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

  // Build featured card subcategory list from SUBCATEGORIES definition
  const featuredSubs = SUBCATEGORIES[featured.id] || [];

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
  try { data = await fetchJSON('data/records.json'); }
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
  initSearch();
  initBookmarks();
  initTagInput();
  initCategorySelect();
  initForm();
  initHexagrams();
  initHexagramDetail();
  initCollection();
  initHome();
  initArticle();
});

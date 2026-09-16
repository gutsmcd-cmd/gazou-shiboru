import './style.css';
import {
  compressImage,
  formatBytes,
  outputFilename,
  type CompressResult,
  type OutputFormat,
} from './compress';
import { getLang, setLang, t, type Lang } from './i18n';

interface QueueItem {
  id: string;
  file: File;
  objectUrl: string;
  width: number;
  height: number;
}

interface Settings {
  maxWidth: number;
  quality: number;
  format: OutputFormat;
  preset: string | null;
}

interface Preset {
  id: string;
  labelKey: string;
  maxWidth: number;
  quality: number;
  format: OutputFormat;
}

const PRESETS: Preset[] = [
  {
    id: 'line',
    labelKey: 'presetLine',
    maxWidth: 1280,
    quality: 0.75,
    format: 'image/jpeg',
  },
  {
    id: 'mail',
    labelKey: 'presetMail',
    maxWidth: 1024,
    quality: 0.65,
    format: 'image/jpeg',
  },
  {
    id: 'web',
    labelKey: 'presetWeb',
    maxWidth: 1600,
    quality: 0.8,
    format: 'image/webp',
  },
  {
    id: 'near',
    labelKey: 'presetNear',
    maxWidth: 4096,
    quality: 0.92,
    format: 'image/jpeg',
  },
];

const queue: QueueItem[] = [];
let activeId: string | null = null;
let lang: Lang = getLang();
let settings: Settings = {
  maxWidth: 1280,
  quality: 0.75,
  format: 'image/jpeg',
  preset: 'line',
};
let previewMode: 'side' | 'toggle' = 'side';
let toggleShow: 'before' | 'after' = 'after';
let result: CompressResult | null = null;
let resultUrl: string | null = null;
let compressToken = 0;
let busy = false;
let toastTimer = 0;

const app = document.querySelector<HTMLDivElement>('#app')!;

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function showToast(msg: string): void {
  let el = document.querySelector<HTMLDivElement>('.toast');
  if (!el) {
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('show'), 2200);
}

function loadDims(objectUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error('decode'));
    img.src = objectUrl;
  });
}

async function addFiles(fileList: FileList | File[]): Promise<void> {
  const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
  if (!files.length) {
    showToast(t(lang, 'toastError'));
    return;
  }
  let added = 0;
  for (const file of files) {
    const objectUrl = URL.createObjectURL(file);
    try {
      const { w, h } = await loadDims(objectUrl);
      const item: QueueItem = {
        id: uid(),
        file,
        objectUrl,
        width: w,
        height: h,
      };
      queue.push(item);
      activeId = item.id;
      added++;
    } catch {
      URL.revokeObjectURL(objectUrl);
    }
  }
  if (added) showToast(t(lang, 'toastAdded'));
  else showToast(t(lang, 'toastError'));
  render();
  void recompress();
}

function removeItem(id: string): void {
  const i = queue.findIndex((q) => q.id === id);
  if (i < 0) return;
  URL.revokeObjectURL(queue[i]!.objectUrl);
  queue.splice(i, 1);
  if (activeId === id) {
    activeId = queue[i]?.id ?? queue[i - 1]?.id ?? null;
  }
  if (!activeId) {
    clearResult();
  }
  render();
  if (activeId) void recompress();
}

function clearAll(): void {
  for (const q of queue) URL.revokeObjectURL(q.objectUrl);
  queue.length = 0;
  activeId = null;
  clearResult();
  render();
}

function clearResult(): void {
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = null;
  result = null;
}

function activeItem(): QueueItem | null {
  return queue.find((q) => q.id === activeId) ?? null;
}

function applyPreset(id: string): void {
  const p = PRESETS.find((x) => x.id === id);
  if (!p) return;
  settings = {
    maxWidth: p.maxWidth,
    quality: p.quality,
    format: p.format,
    preset: p.id,
  };
  render();
  void recompress();
}

function markCustom(): void {
  settings = { ...settings, preset: null };
}

async function recompress(): Promise<void> {
  const item = activeItem();
  if (!item) {
    clearResult();
    render();
    return;
  }
  const token = ++compressToken;
  busy = true;
  updateStatus();
  try {
    const out = await compressImage(item.file, {
      maxWidth: settings.maxWidth,
      quality: settings.quality,
      format: settings.format,
    });
    if (token !== compressToken) return;
    clearResult();
    result = out;
    resultUrl = URL.createObjectURL(out.blob);
  } catch {
    if (token !== compressToken) return;
    clearResult();
    showToast(t(lang, 'toastError'));
  } finally {
    if (token === compressToken) {
      busy = false;
      render();
    }
  }
}

function updateStatus(): void {
  const el = document.querySelector('.status-line');
  if (el) {
    el.textContent = busy ? t(lang, 'compressing') : result ? t(lang, 'ready') : '';
  }
}

function downloadResult(): void {
  const item = activeItem();
  if (!result || !resultUrl || !item) return;
  const a = document.createElement('a');
  a.href = resultUrl;
  a.download = outputFilename(item.file.name, result.mime);
  document.body.appendChild(a);
  a.click();
  a.remove();
  showToast(t(lang, 'toastDownloaded'));
}

async function shareResult(): Promise<void> {
  const item = activeItem();
  if (!result || !item) return;
  const file = new File([result.blob], outputFilename(item.file.name, result.mime), {
    type: result.mime,
  });
  const can =
    typeof navigator.share === 'function' &&
    (!navigator.canShare || navigator.canShare({ files: [file] }));
  if (!can) {
    downloadResult();
    return;
  }
  try {
    await navigator.share({ files: [file], title: t(lang, 'appTitle') });
    showToast(t(lang, 'toastShared'));
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return;
    showToast(t(lang, 'toastShareFailed'));
    downloadResult();
  }
}

function savingsPct(orig: number, next: number): number {
  if (orig <= 0) return 0;
  return Math.max(0, Math.round((1 - next / orig) * 100));
}

function render(): void {
  const item = activeItem();
  const hasItems = queue.length > 0;

  document.documentElement.lang = lang === 'ja' ? 'ja' : 'en';
  document.title = t(lang, 'appTitle');

  app.innerHTML = `
    <header>
      <div class="header-row">
        <div class="titles">
          <h1>${t(lang, 'appTitle')}</h1>
          <p class="subtitle">${t(lang, 'appSubtitle')}</p>
        </div>
        <div class="lang-toggle" role="group" aria-label="${t(lang, 'langToggle')}">
          <button type="button" data-lang="ja" class="${lang === 'ja' ? 'active' : ''}">${t(lang, 'langJa')}</button>
          <button type="button" data-lang="en" class="${lang === 'en' ? 'active' : ''}">${t(lang, 'langEn')}</button>
        </div>
      </div>
    </header>

    ${
      !hasItems
        ? `
    <div class="dropzone" id="dropzone" tabindex="0" role="button" aria-label="${t(lang, 'addPhotos')}">
      <p class="hint-main">${t(lang, 'emptyHint')}</p>
      <p class="hint-sub">${t(lang, 'dropHint')}</p>
      <button type="button" class="btn btn-primary" id="pick-btn">${t(lang, 'addPhotos')}</button>
    </div>`
        : `
    <div class="card">
      <div class="toolbar-inline">
        <h2 style="margin:0">${t(lang, 'queue')}</h2>
        <div style="display:flex;gap:4px">
          <button type="button" class="btn btn-ghost" id="add-more">${t(lang, 'addMore')}</button>
          <button type="button" class="btn btn-ghost" id="clear-all">${t(lang, 'clearAll')}</button>
        </div>
      </div>
      <div class="queue" id="queue">
        ${queue
          .map(
            (q) => `
          <div class="queue-item ${q.id === activeId ? 'active' : ''}" data-id="${q.id}" title="${escapeAttr(q.file.name)}">
            <img src="${q.objectUrl}" alt="" />
            <button type="button" class="qi-remove" data-remove="${q.id}" aria-label="${t(lang, 'remove')}">×</button>
          </div>`,
          )
          .join('')}
      </div>
    </div>

    <div class="card">
      <h2>${t(lang, 'presets')}</h2>
      <div class="presets">
        ${PRESETS.map(
          (p) => `
          <button type="button" class="preset-btn ${settings.preset === p.id ? 'active' : ''}" data-preset="${p.id}">
            ${t(lang, p.labelKey)}
          </button>`,
        ).join('')}
      </div>
    </div>

    <div class="card controls">
      <div class="field">
        <label>
          <span>${t(lang, 'maxWidth')}</span>
          <strong id="mw-val">${settings.maxWidth}</strong>
        </label>
        <input type="range" id="max-width" min="320" max="4096" step="16" value="${settings.maxWidth}" />
      </div>
      <div class="field">
        <label>
          <span>${t(lang, 'quality')}</span>
          <strong id="q-val">${Math.round(settings.quality * 100)}%</strong>
        </label>
        <input type="range" id="quality" min="10" max="100" step="1" value="${Math.round(settings.quality * 100)}" ${settings.format === 'image/png' ? 'disabled' : ''} />
      </div>
      <div>
        <div class="field"><label><span>${t(lang, 'format')}</span></label></div>
        <div class="format-row">
          <button type="button" data-format="image/jpeg" class="${settings.format === 'image/jpeg' ? 'active' : ''}">${t(lang, 'formatJpeg')}</button>
          <button type="button" data-format="image/webp" class="${settings.format === 'image/webp' ? 'active' : ''}">${t(lang, 'formatWebp')}</button>
          <button type="button" data-format="image/png" class="${settings.format === 'image/png' ? 'active' : ''}">${t(lang, 'formatPng')}</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="toolbar-inline">
        <h2 style="margin:0">${t(lang, 'preview')}</h2>
        <div class="preview-toolbar" style="margin:0;flex:0 0 auto">
          <button type="button" class="seg ${previewMode === 'side' ? 'active' : ''}" data-pmode="side">${t(lang, 'sideBySide')}</button>
          <button type="button" class="seg ${previewMode === 'toggle' ? 'active' : ''}" data-pmode="toggle">${t(lang, 'toggleView')}</button>
        </div>
      </div>
      ${
        previewMode === 'toggle'
          ? `<div class="preview-toolbar">
              <button type="button" class="seg ${toggleShow === 'before' ? 'active' : ''}" data-toggle="before">${t(lang, 'toggleBefore')}</button>
              <button type="button" class="seg ${toggleShow === 'after' ? 'active' : ''}" data-toggle="after">${t(lang, 'toggleAfter')}</button>
            </div>`
          : ''
      }
      <div class="preview-pane ${previewMode}">
        <div class="pane ${previewMode === 'toggle' && toggleShow !== 'before' ? 'pane-hidden' : ''}">
          <div class="pane-label">${t(lang, 'before')}</div>
          ${item ? `<img src="${item.objectUrl}" alt="${t(lang, 'before')}" />` : `<div class="pane-label">${t(lang, 'noPreview')}</div>`}
        </div>
        <div class="pane ${previewMode === 'toggle' && toggleShow !== 'after' ? 'pane-hidden' : ''}">
          <div class="pane-label">${t(lang, 'after')}</div>
          ${resultUrl ? `<img src="${resultUrl}" alt="${t(lang, 'after')}" />` : `<div class="pane-label">${busy ? t(lang, 'processing') : t(lang, 'noPreview')}</div>`}
        </div>
      </div>
      ${
        item
          ? `<div class="stats">
          <div class="stat">
            <div class="label">${t(lang, 'original')}</div>
            <div class="value">${formatBytes(item.file.size)}</div>
            <div class="dims">${t(lang, 'dims', { w: item.width, h: item.height })}</div>
          </div>
          <div class="stat savings">
            <div class="label">${t(lang, 'compressed')}${result ? ` · ${t(lang, 'savings')} ${savingsPct(item.file.size, result.blob.size)}%` : ''}</div>
            <div class="value">${result ? formatBytes(result.blob.size) : '—'}</div>
            <div class="dims">${result ? t(lang, 'dims', { w: result.width, h: result.height }) : ''}</div>
          </div>
        </div>`
          : ''
      }
      <p class="status-line">${busy ? t(lang, 'compressing') : result ? t(lang, 'ready') : ''}</p>
      <div class="btn-row" style="margin-top:8px">
        <button type="button" class="btn btn-secondary" id="share-btn" ${!result ? 'disabled' : ''}>${t(lang, 'share')}</button>
        <button type="button" class="btn btn-primary" id="dl-btn" ${!result ? 'disabled' : ''}>${t(lang, 'download')}</button>
      </div>
    </div>`
    }

    <input type="file" id="file-input" class="hidden-input" accept="image/*" multiple />

    <footer class="note">${t(lang, 'footer')}</footer>
  `;

  wireEvents();
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function wireEvents(): void {
  const fileInput = document.querySelector<HTMLInputElement>('#file-input')!;

  const openPicker = () => fileInput.click();

  document.querySelector('#pick-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    openPicker();
  });
  document.querySelector('#add-more')?.addEventListener('click', openPicker);
  document.querySelector('#dropzone')?.addEventListener('click', openPicker);

  fileInput.addEventListener('change', () => {
    if (fileInput.files?.length) void addFiles(fileInput.files);
    fileInput.value = '';
  });

  const dz = document.querySelector('#dropzone') ?? app;
  ;['dragenter', 'dragover'].forEach((ev) => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      document.querySelector('#dropzone')?.classList.add('dragover');
    });
  });
  ;['dragleave', 'drop'].forEach((ev) => {
    dz.addEventListener(ev, (e) => {
      e.preventDefault();
      document.querySelector('#dropzone')?.classList.remove('dragover');
    });
  });
  dz.addEventListener('drop', (e) => {
    const de = e as DragEvent;
    de.preventDefault();
    if (de.dataTransfer?.files?.length) void addFiles(de.dataTransfer.files);
  });

  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = (btn as HTMLElement).dataset.lang as Lang;
      lang = next;
      setLang(next);
      render();
    });
  });

  document.querySelector('#clear-all')?.addEventListener('click', clearAll);

  document.querySelectorAll('.queue-item').forEach((el) => {
    el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.dataset.remove) return;
      const id = (el as HTMLElement).dataset.id!;
      if (id === activeId) return;
      activeId = id;
      render();
      void recompress();
    });
  });

  document.querySelectorAll('[data-remove]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem((btn as HTMLElement).dataset.remove!);
    });
  });

  document.querySelectorAll('[data-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyPreset((btn as HTMLElement).dataset.preset!);
    });
  });

  const mw = document.querySelector<HTMLInputElement>('#max-width');
  const q = document.querySelector<HTMLInputElement>('#quality');
  mw?.addEventListener('input', () => {
    settings.maxWidth = Number(mw.value);
    markCustom();
    const v = document.querySelector('#mw-val');
    if (v) v.textContent = String(settings.maxWidth);
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
  });
  mw?.addEventListener('change', () => void recompress());

  q?.addEventListener('input', () => {
    settings.quality = Number(q.value) / 100;
    markCustom();
    const v = document.querySelector('#q-val');
    if (v) v.textContent = `${Math.round(settings.quality * 100)}%`;
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active'));
  });
  q?.addEventListener('change', () => void recompress());

  document.querySelectorAll('[data-format]').forEach((btn) => {
    btn.addEventListener('click', () => {
      settings.format = (btn as HTMLElement).dataset.format as OutputFormat;
      markCustom();
      render();
      void recompress();
    });
  });

  document.querySelectorAll('[data-pmode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      previewMode = (btn as HTMLElement).dataset.pmode as 'side' | 'toggle';
      render();
    });
  });

  document.querySelectorAll('[data-toggle]').forEach((btn) => {
    btn.addEventListener('click', () => {
      toggleShow = (btn as HTMLElement).dataset.toggle as 'before' | 'after';
      render();
    });
  });

  document.querySelector('#dl-btn')?.addEventListener('click', downloadResult);
  document.querySelector('#share-btn')?.addEventListener('click', () => void shareResult());
}

// Global paste (images from clipboard)
window.addEventListener('paste', (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;
  const files: File[] = [];
  for (const item of Array.from(items)) {
    if (item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) files.push(f);
    }
  }
  if (files.length) {
    e.preventDefault();
    void addFiles(files);
  }
});

// Also accept drops on the whole app when queue is non-empty
app.addEventListener('dragover', (e) => {
  e.preventDefault();
});
app.addEventListener('drop', (e) => {
  e.preventDefault();
  if (e.dataTransfer?.files?.length) void addFiles(e.dataTransfer.files);
});

render();

if ('serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => {
    registerSW({ immediate: true });
  }).catch(() => {
    /* PWA register optional in non-PWA preview */
  });
}

export type Lang = 'ja' | 'en';

const LANG_KEY = 'gazou-shiboru-lang';

export function getLang(): Lang {
  const v = localStorage.getItem(LANG_KEY);
  if (v === 'en' || v === 'ja') return v;
  return 'ja';
}

export function setLang(lang: Lang): void {
  localStorage.setItem(LANG_KEY, lang);
}

type Dict = Record<string, string>;

const ja: Dict = {
  appTitle: '画像しぼる',
  appSubtitle: 'この端末だけで圧縮',
  emptyHint: '写真を追加 — この端末だけで圧縮します',
  addPhotos: '写真を選ぶ',
  dropHint: 'ドロップ / 貼り付け / ファイル選択',
  queue: 'キュー',
  active: '編集中',
  remove: '削除',
  clearAll: 'すべてクリア',
  presets: 'プリセット',
  presetLine: 'LINE向け',
  presetMail: 'メール向け',
  presetWeb: 'Web用',
  presetNear: '原寸に近い',
  maxWidth: '最大幅 (px)',
  quality: '画質',
  format: '形式',
  formatJpeg: 'JPEG',
  formatWebp: 'WebP',
  formatPng: 'PNG',
  preview: 'プレビュー',
  before: '圧縮前',
  after: '圧縮後',
  toggleBefore: '前',
  toggleAfter: '後',
  sideBySide: '並べて表示',
  toggleView: '切り替え',
  original: '元のサイズ',
  compressed: '圧縮後',
  savings: '削減',
  download: 'ダウンロード',
  share: '共有',
  compressing: '圧縮中…',
  ready: '準備完了',
  toastDownloaded: 'ダウンロードしました',
  toastShared: '共有しました',
  toastShareFailed: '共有できませんでした',
  toastAdded: '追加しました',
  toastError: '読み込めませんでした',
  toastPasteNone: '画像がありません',
  footer: 'ファイルはこの端末から出ません · 無料 · 広告なし · ログイン不要',
  langJa: '日本語',
  langEn: 'English',
  langToggle: '言語',
  dims: '{w} × {h}',
  noPreview: 'プレビューなし',
  processing: '処理中…',
  addMore: '追加',
};

const en: Dict = {
  appTitle: 'Shiboru',
  appSubtitle: 'Compress on this device only',
  emptyHint: 'Add photos — compressed only on this device',
  addPhotos: 'Choose photos',
  dropHint: 'Drop / paste / file picker',
  queue: 'Queue',
  active: 'Active',
  remove: 'Remove',
  clearAll: 'Clear all',
  presets: 'Presets',
  presetLine: 'For LINE',
  presetMail: 'For email',
  presetWeb: 'For web',
  presetNear: 'Near original',
  maxWidth: 'Max width (px)',
  quality: 'Quality',
  format: 'Format',
  formatJpeg: 'JPEG',
  formatWebp: 'WebP',
  formatPng: 'PNG',
  preview: 'Preview',
  before: 'Before',
  after: 'After',
  toggleBefore: 'Before',
  toggleAfter: 'After',
  sideBySide: 'Side by side',
  toggleView: 'Toggle',
  original: 'Original',
  compressed: 'Compressed',
  savings: 'Saved',
  download: 'Download',
  share: 'Share',
  compressing: 'Compressing…',
  ready: 'Ready',
  toastDownloaded: 'Downloaded',
  toastShared: 'Shared',
  toastShareFailed: 'Share failed',
  toastAdded: 'Added',
  toastError: 'Could not load image',
  toastPasteNone: 'No image in clipboard',
  footer: 'Files never leave this device · free · no ads · no login',
  langJa: '日本語',
  langEn: 'English',
  langToggle: 'Language',
  dims: '{w} × {h}',
  noPreview: 'No preview',
  processing: 'Working…',
  addMore: 'Add more',
};

const dictionaries: Record<Lang, Dict> = { ja, en };

export function t(
  lang: Lang,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const raw = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  if (!vars) return raw;
  return Object.entries(vars).reduce(
    (s, [k, v]) => s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v)),
    raw,
  );
}

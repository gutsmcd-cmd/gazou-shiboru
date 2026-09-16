# 画像しぼる（gazou-shiboru）

端末だけで動く、日本語ファーストの画像圧縮 Progressive Web App。**無料・広告なし・ログイン不要・アナリティクスなし・クラウドアップロードなし。**  
Sibling to [Long Shot](../long-shot)（stitch → shrink → send の「shrink」役）。

写真を追加し、最大幅・画質・形式（JPEG / WebP / PNG）を調整。LINE向け・メール向けなどのプリセット付き。圧縮前後のサイズ（KB）と削減率を表示し、ダウンロード／Web Share（対応ブラウザ）で渡せます。

## English (short)

**Shiboru** is an offline-first, Squoosh-class local image compressor. Everything stays on your device. Install as a PWA (Add to Home Screen). Japanese UI by default; toggle 日本語 / English (`gazou-shiboru-lang`).

## Scripts

```bash
npm install
npm run dev       # Vite 開発サーバー
npm run build     # 型チェック + 本番ビルド → dist/
npm run preview   # 本番ビルドのプレビュー
```

## Deploy

GitHub Pages: `.github/workflows/pages.yml`（npm ci → build → upload `dist` → deploy-pages）。`base: './'` なのでサブパスでも動作します。

## Privacy

ファイルはこの端末から出ません。圧縮はブラウザ内の Canvas エンコードのみ。リモート圧縮 API・トラッキングはありません。

## Tech notes

- Vite + vanilla TypeScript + `vite-plugin-pwa`
- Compression: Canvas `drawImage` + `toBlob`（依存ゼロ、ランタイムネットワーク不要）
- iOS: WebP エンコード非対応環境では JPEG に自動フォールバック。HEIC はブラウザによって読めない場合があります。Web Share with files は Safari の対応端末のみ。

# Cloudflare Media Transformations Setup for MP4 Proxy

## 前提条件
- Cloudflareアカウントとゾーン設定済み
- Wrangler CLIインストール済み（`npm install -g wrangler`）
- Google Cloud Storage (GCS) バケット設定済み

## 1. Media Transformationsを有効化

1. Cloudflareダッシュボードにログイン
2. **Stream** → **Transformations** に移動
3. 対象のゾーンを見つけて **Enable** をクリック

## 2. 許可されたソースオリジンを設定

Media Transformationsがstorage.googleapis.comからビデオを取得できるようにする：

1. **Stream** → **Transformations** → **Sources** に移動
2. **Add origin** をクリック
3. 以下のいずれかを設定：
   - **Domain**: `https://storage.googleapis.com`
   - **Path**: `/cf-transform-external-s3-compat-bucket/` (オプション：特定のバケットに制限)
   
   または、バケット固有のサブドメイン：
   - **Domain**: `https://cf-transform-external-s3-compat-bucket.storage.googleapis.com`
   - **Path**: 空欄

4. **Add** → **Save** をクリック

## 3. GCS CORS設定（必要に応じて）

`cors.json`を作成：
```json
[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "OPTIONS"],
    "responseHeader": ["Content-Type", "Accept"],
    "maxAgeSeconds": 3600
  }
]
```

適用：
```bash
gcloud storage buckets update gs://cf-transform-external-s3-compat-bucket --cors-file=cors.json
```

## 4. ローカルテスト

```bash
# 開発サーバーを起動
npm run dev

# 別ターミナルでテスト実行
./test-video.sh
```

## 5. デプロイ

```bash
# プロダクションにデプロイ
npm run deploy

# デプロイ後のテスト（実際のURLに置き換え）
curl -I https://your-worker.example.com/sample-video.mp4
```

## 動作確認ポイント

1. MP4ファイルにアクセスした時に `X-Media-Transform: mp4-proxy` ヘッダーが返される
2. 非MP4ファイルは通常の画像変換処理が行われる
3. Media Transformationsのログでリクエストが確認できる

## トラブルシューティング

### "Origin not allowed" エラー
- Cloudflareダッシュボードで storage.googleapis.com が許可されているか確認
- URLのフォーマットが正しいか確認（signed URLを使用）

### HEAD リクエストが失敗する
- GCS HMAC認証情報が正しく設定されているか確認
- バケットへのアクセス権限を確認

### Media Transformations が動作しない
- ゾーンでMedia Transformationsが有効になっているか確認
- `/cdn-cgi/media/` パスへのリクエストが正しく処理されているか確認
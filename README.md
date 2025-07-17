# GCS Image Resize with Cloudflare Workers

A service that fetches images from private GCS buckets and automatically resizes/optimizes them for delivery using Cloudflare Workers.

## Features

- 🔐 Secure access to private GCS buckets (HMAC authentication)
- 🎨 Automatic format conversion based on Accept header (AVIF/WebP)
- 🚀 Image optimization with Cloudflare Image Resizing & Polish
- 💾 Cache control by status code

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Create GCS HMAC Keys

1. Access your target bucket in Google Cloud Console
2. Create HMAC keys from the "Interoperability" tab
3. Save the access key ID and secret key

### 3. Configure Environment Variables

#### Development Environment

Create a `.dev.vars` file with the following:

```
GCS_HMAC_ACCESS_KEY_ID=your-gcs-hmac-access-key-id
GCS_HMAC_SECRET_ACCESS_KEY=your-gcs-hmac-secret-access-key
```

#### Production Environment

Set `GCS_BUCKET` in `wrangler.jsonc`:

```json
{
  "vars": {
    "GCS_BUCKET": "your-bucket-name"
  }
}
```

Configure production secrets:

```bash
wrangler secret put GCS_HMAC_ACCESS_KEY_ID
wrangler secret put GCS_HMAC_SECRET_ACCESS_KEY
```

## Development

```bash
pnpm dev
```

Local server will start at http://localhost:8787

## Deployment

```bash
pnpm deploy
```

## Usage

After deployment, access images using the following URL pattern:

```
https://your-worker.your-subdomain.workers.dev/path/to/image.jpg
```

### Automatic Format Conversion

The optimal format is automatically selected based on the browser's Accept header:

- AVIF-capable browsers → AVIF format
- WebP-capable browsers → WebP format
- Others → Original format

### Cache Behavior

- 200-series responses: 24-hour cache
- 404 errors: 5-minute cache
- 500-series errors: No cache

## Tech Stack

- Cloudflare Workers
- TypeScript
- aws4fetch (S3-compatible API client)
- Cloudflare Image Resizing
- Cloudflare Polish

## License

MIT

# GCS Image Resize with Cloudflare Workers

A service that fetches images from private GCS buckets and automatically resizes/optimizes them for delivery using Cloudflare Workers.

## Features

- 🔐 Secure access to private GCS buckets (HMAC authentication)
- 🎨 Automatic format conversion based on Accept header (AVIF/WebP)
- 🚀 Image optimization with Cloudflare Image Resizing & Polish
- 💾 Cache control by status code

## Important Requirements

### Cloudflare Image Resizing Requirements

**Image Resizing is a paid feature** that requires:
1. **Cloudflare Pro, Business, or Enterprise plan**
2. **Image Resizing addon enabled** (additional cost)
3. Image Resizing must be enabled in your Cloudflare dashboard

Without these requirements, the worker will still serve images but without format conversion or optimization.

### Alternative: Polish Only

If you don't have Image Resizing enabled, you can still use Polish for compression:
- Polish is available on Pro plans and above
- Polish will compress images but won't convert formats

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
- 404 errors: No cache
- 500-series errors: No cache

## Testing Format Conversion

### Using the Test Script

A test script is provided to verify format conversion:

```bash
# Test local development server
./test-formats.sh http://localhost:8787 path/to/test.jpg

# Test production deployment
./test-formats.sh https://your-worker.workers.dev path/to/test.jpg
```

### Manual Testing

1. **Check Response Headers**
   ```bash
   # Request AVIF format
   curl -I -H "Accept: image/avif,image/webp,image/*" \
     http://localhost:8787/test.jpg
   
   # Look for these headers:
   # X-Requested-Format: avif
   # Content-Type: image/avif
   ```

2. **Download and Verify Format**
   ```bash
   # Download with AVIF support
   curl -H "Accept: image/avif" \
     http://localhost:8787/test.jpg \
     -o test-avif.avif
   
   # Check file type
   file test-avif.avif
   # Should output: "AVIF Image"
   ```

3. **Browser Testing**
   - Modern browsers automatically send appropriate Accept headers
   - Chrome/Edge: Supports AVIF and WebP
   - Firefox: Supports AVIF and WebP
   - Safari: Supports WebP (AVIF support varies by version)

### Debug Headers

The service adds debug headers to help verify format conversion:
- `X-Requested-Format`: The format requested based on Accept header
- `X-Accept-Header`: The original Accept header from the request

## Tech Stack

- Cloudflare Workers
- TypeScript
- aws4fetch (S3-compatible API client)
- Cloudflare Image Resizing
- Cloudflare Polish

## License

MIT

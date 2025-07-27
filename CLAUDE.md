# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Cloudflare Worker service that acts as a proxy for Google Cloud Storage (GCS) buckets with automatic media transformation capabilities. It serves images and videos from private GCS buckets through Cloudflare's edge network, applying optimizations based on the media type.

### Key Features
- **Image Optimization**: Automatic format conversion (AVIF/WebP) based on browser capabilities using Cloudflare Image Resizing
- **Video Streaming**: MP4 files are served through Cloudflare Media Transformations for optimized delivery
- **Authentication**: Uses HMAC authentication to securely access private GCS buckets
- **Caching**: Intelligent caching strategy with different TTLs based on response status

## Architecture Overview

### Request Flow
1. **Path Extraction**: Incoming requests to `/*` are mapped to GCS object keys
2. **Content Type Detection**: Uses mime-types package to determine file type from extension
3. **Routing Decision**:
   - MP4 files → Cloudflare Media Transformations (`/cdn-cgi/media/`)
   - Other video files → Direct proxy without transformations
   - Images → Cloudflare Image Resizing with format optimization
4. **GCS Authentication**: aws4fetch creates signed requests using HMAC credentials
5. **Response Enhancement**: Debug headers added for monitoring and troubleshooting

### Key Components
- **src/index.ts**: Main application logic using Hono framework
- **Media Transformations Handler**: Special route `/cdn-cgi/media/*` for video processing
- **Image Processing Pipeline**: Uses `cf.image` options for automatic format conversion
- **Cache Configuration**: Different TTLs for success (30s for testing, 24h in production) and error responses

## Development Commands

```bash
# Install dependencies
pnpm install

# Start local development server (http://localhost:8787)
pnpm dev

# Deploy to production
pnpm deploy

# Format code
pnpm format

# Check code formatting
pnpm format:check

# Generate TypeScript types for Cloudflare bindings
pnpm cf-typegen
```

## Testing

```bash
# Test image format conversion (AVIF/WebP)
./test-formats.sh http://localhost:8787 path/to/test.jpg

# Test MP4 video proxy through Media Transformations
./test-video.sh

# Manual testing with curl
curl -I -H "Accept: image/avif,image/webp,image/*" http://localhost:8787/test.jpg
```

## Environment Configuration

### Local Development (.dev.vars)
```
GCS_HMAC_ACCESS_KEY_ID=your-gcs-hmac-access-key-id
GCS_HMAC_SECRET_ACCESS_KEY=your-gcs-hmac-secret-access-key
```

### Production Secrets
```bash
wrangler secret put GCS_HMAC_ACCESS_KEY_ID
wrangler secret put GCS_HMAC_SECRET_ACCESS_KEY
```

### wrangler.jsonc Configuration
- `GCS_BUCKET`: Set in the vars section (currently "cf-transform-external-s3-compat-bucket")
- `name`: Worker name is "gcs-image-resize"
- `compatibility_date`: Set to "2025-07-15"

## Cloudflare Feature Requirements

### Image Resizing (for image optimization)
- Requires Cloudflare Pro, Business, or Enterprise plan
- Image Resizing addon must be enabled (additional cost)
- Without this, images are served without format conversion

### Media Transformations (for video optimization)
- Must be enabled in Cloudflare Stream → Transformations
- storage.googleapis.com must be added as an allowed origin
- See SETUP.md for detailed configuration steps

## Code Patterns and Best Practices

### Error Handling
- HEAD request failures are caught and logged, with fallback to normal processing
- All fetch operations include proper cache configuration
- Response headers include debug information for troubleshooting

### Type Safety
- TypeScript strict mode enabled
- Bindings interface defines environment variables
- RequestInitCfProperties used for Cloudflare-specific options

### Performance Considerations
- Cache TTL currently set to 30 seconds for testing (should be increased for production)
- Different cache strategies for different response types
- Signed URLs use query parameters for Media Transformations, headers for direct fetches

### Security
- HMAC credentials stored as secrets, never in code
- Signed requests prevent unauthorized GCS access
- origin-auth set to "share-publicly" for Image Resizing to forward auth headers

## Recent Changes
- Switched from HEAD request content-type detection to mime-types package for better performance
- MP4 files now detected by extension and routed through Media Transformations
- Debug headers updated to show MIME type instead of Content-Type

## Monitoring and Debugging

### Debug Headers
- `X-Media-Transform`: "mp4-proxy" for videos through Media Transformations
- `X-Video-Direct-Proxy`: "true" for non-MP4 videos
- `X-Mime-Type`: Detected MIME type from extension
- `X-Requested-Format`: Image format requested (avif/webp/original)
- `X-Accept-Header`: Original Accept header from request
- `X-Image-Resizing-Status`: Success/failure status of format conversion
import { Hono } from "hono";
import { AwsClient } from "aws4fetch";

type Bindings = {
  GCS_HMAC_ACCESS_KEY_ID: string;
  GCS_HMAC_SECRET_ACCESS_KEY: string;
  GCS_BUCKET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// 1) Media Transform itself - pass through as-is
app.all("/cdn-cgi/media/*", (c) => {
  console.log("Media Transform passthrough:", c.req.url);
  return fetch(c.req.raw);
});

// 2) Handle video files with Media Transformations
app.get(/\.(mp4|webm|mov|avi|mkv)$/i, async (c) => {
  const url = new URL(c.req.url);
  const key = c.req.path.slice(1); // "/videos/foo.mp4" → "videos/foo.mp4"
  
  if (!key) {
    return c.text("Not Found", 404);
  }

  console.log("Video request for key:", key);

  // Generate signed URL with query parameters for video
  const aws = new AwsClient({
    accessKeyId: c.env.GCS_HMAC_ACCESS_KEY_ID,
    secretAccessKey: c.env.GCS_HMAC_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const originUrl = `https://storage.googleapis.com/${c.env.GCS_BUCKET}/${key}`;
  const signedReq = await aws.sign(
    new Request(originUrl, { method: "GET" }),
    {
      aws: { signQuery: true } // Use query parameters for Media Transformations
    }
  );

  // Media Transform options
  // mode=video: video transformation mode
  // width=720: resize to 720px width
  // fit=contain: maintain aspect ratio
  // format=mp4: output as MP4
  const mediaOptions = [
    "mode=video",
    "width=720",
    "fit=contain",
    "format=mp4"
  ];

  // Build Media Transform URL
  const transformUrl = 
    `https://${url.host}/cdn-cgi/media/${mediaOptions.join(",")}/` +
    encodeURIComponent(signedReq.url);

  console.log("Media Transform URL:", transformUrl);

  // Execute transformation with caching
  const response = await fetch(transformUrl, {
    cf: {
      cacheTtl: 3600, // 1 hour for videos
      cacheEverything: true,
      cacheTtlByStatus: {
        "200-299": 3600,
        "404": -1,
        "500-599": -1,
      },
    }
  });

  // Add debug headers
  const newResponse = new Response(response.body, response);
  newResponse.headers.set("X-Media-Transform", "video");
  newResponse.headers.set("X-Original-Key", key);
  newResponse.headers.set("X-Transform-Options", mediaOptions.join(","));

  return newResponse;
});

// 3) Handle all other paths for image serving (existing code)
app.get("/*", async (c) => {
  // (1) Extract object key from URL
  const key = c.req.path.slice(1); // /images/foo.png → "images/foo.png"

  // Return 404 if key is empty
  if (!key) {
    return c.text("Not Found", 404);
  }

  // (2) Generate signed request with aws4fetch
  const aws = new AwsClient({
    accessKeyId: c.env.GCS_HMAC_ACCESS_KEY_ID,
    secretAccessKey: c.env.GCS_HMAC_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const signedReq = await aws.sign(
    new Request(`https://storage.googleapis.com/${c.env.GCS_BUCKET}/${key}`, {
      method: "GET",
    }),
    {
      aws: { signQuery: false } // Use Authorization header instead of query parameters
    }
  );

  // (3) Determine format from Accept header
  const accept = c.req.header("Accept") || "";
  let format: "avif" | "webp" | undefined;
  if (/\bimage\/avif\b/.test(accept)) {
    format = "avif";
  } else if (/\bimage\/webp\b/.test(accept)) {
    format = "webp";
  }
  // Use original format if not specified

  // (4) Build cf options with origin-auth to forward Authorization headers
  const cfOptions: RequestInitCfProperties = {
    image: {
      format,
      quality: 85,
      "origin-auth": "share-publicly" // Forward Authorization headers to origin
    },
    cacheTtl: 30, // Reduced from 86400 (24h) to 30 seconds for testing
    cacheEverything: true,
    cacheTtlByStatus: {
      "200-299": 30, // Reduced from 86400 (24h) to 30 seconds for testing
      "404": -1,
      "500-599": -1,
    },
  };

  // Log for debugging
  console.log("Request URL:", c.req.url);
  console.log("Accept header:", accept);
  console.log("Detected format:", format || "original");
  console.log("CF options:", JSON.stringify(cfOptions));

  // (5) Pass signed request through transformation pipeline and return
  const response = await fetch(signedReq, { cf: cfOptions });
  
  // Clone response to add debug headers
  const newResponse = new Response(response.body, response);
  
  // Add debug headers
  newResponse.headers.set("X-Requested-Format", format || "original");
  newResponse.headers.set("X-Accept-Header", accept);
  newResponse.headers.set("X-Original-Content-Type", response.headers.get("Content-Type") || "unknown");
  newResponse.headers.set("X-CF-Ray", response.headers.get("CF-RAY") || "unknown");
  
  // Check if Image Resizing worked
  const contentType = response.headers.get("Content-Type") || "";
  if (format === "avif" && !contentType.includes("avif")) {
    newResponse.headers.set("X-Image-Resizing-Status", "failed-avif");
  } else if (format === "webp" && !contentType.includes("webp")) {
    newResponse.headers.set("X-Image-Resizing-Status", "failed-webp");
  } else if (format) {
    newResponse.headers.set("X-Image-Resizing-Status", "success");
  }
  
  return newResponse;
});

export default app;
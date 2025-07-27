import { Hono } from "hono";
import { AwsClient } from "aws4fetch";
import { lookup } from "mime-types";

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

// 2) Handle all paths - check for video files first, then process as images
app.get("/*", async (c) => {
  // (1) Extract object key from URL
  const key = c.req.path.slice(1); // /images/foo.png → "images/foo.png"

  // Return 404 if key is empty
  if (!key) {
    return c.text("Not Found", 404);
  }

  // (2) Generate signed request to check content type
  const aws = new AwsClient({
    accessKeyId: c.env.GCS_HMAC_ACCESS_KEY_ID,
    secretAccessKey: c.env.GCS_HMAC_SECRET_ACCESS_KEY,
    service: "s3",
    region: "auto",
  });

  const originUrl = `https://storage.googleapis.com/${c.env.GCS_BUCKET}/${key}`;
  
  // Use mime-types package to determine content type from file extension
  const mimeType = lookup(key) || "";
  
  console.log("MIME type for", key, ":", mimeType);
  
  // Check if it's an MP4 file based on MIME type
  const isMp4 = mimeType === "video/mp4";
  
  if (isMp4) {
    console.log("MP4 detected via mime-types, using Media Transformations");
    
    // Generate signed URL for the source video
    const signedUrlReq = await aws.sign(
      new Request(originUrl, { method: "GET" }),
      {
        aws: { signQuery: true }
      }
    );
    
    // Build Media Transformations URL
    const url = new URL(c.req.url);
    const transformUrl = `${url.origin}/cdn-cgi/media/mode=video/${signedUrlReq.url}`;
    
    console.log("Media Transformations URL:", transformUrl);
    
    // Proxy through Media Transformations
    const transformResponse = await fetch(transformUrl, {
      headers: c.req.raw.headers,
      cf: {
        cacheTtl: 30, // 30 seconds for testing
        cacheEverything: true,
        cacheTtlByStatus: {
          "200-299": 30, // 30 seconds for testing
          "404": -1,
          "500-599": -1,
        },
      }
    });
    
    const newResponse = new Response(transformResponse.body, transformResponse);
    newResponse.headers.set("X-Media-Transform", "mp4-proxy");
    newResponse.headers.set("X-Original-Key", key);
    newResponse.headers.set("X-Mime-Type", mimeType);
    
    return newResponse;
  }
  
  // Check if it's another video type that shouldn't go through image processing
  const isVideo = mimeType.startsWith("video/");
  
  if (isVideo) {
    console.log("Non-MP4 video file detected, direct proxy without transformations");
    
    const signedVideoReq = await aws.sign(
      new Request(originUrl, { method: "GET" }),
      {
        aws: { signQuery: true }
      }
    );
    
    const videoResponse = await fetch(signedVideoReq, {
      cf: {
        cacheTtl: 30, // 30 seconds for testing
        cacheEverything: true,
        cacheTtlByStatus: {
          "200-299": 30, // 30 seconds for testing
          "404": -1,
          "500-599": -1,
        },
      }
    });
    
    const newResponse = new Response(videoResponse.body, videoResponse);
    newResponse.headers.set("X-Video-Direct-Proxy", "true");
    newResponse.headers.set("X-Original-Key", key);
    newResponse.headers.set("X-Mime-Type", mimeType);
    
    return newResponse;
  }

  // (3) For non-video files, continue with image processing

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
import { Hono } from "hono";
import { AwsClient } from "aws4fetch";

type Bindings = {
  GCS_HMAC_ACCESS_KEY_ID: string;
  GCS_HMAC_SECRET_ACCESS_KEY: string;
  GCS_BUCKET: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Handle all paths for image serving
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

  // (3) Polish-only mode - let Cloudflare decide format based on Accept header
  const accept = c.req.header("Accept") || "";

  // (4) Build cf options with polish-only (no explicit format)
  const cfOptions: RequestInitCfProperties = {
    // Using polish without specifying format - should auto-convert to WebP when supported
    polish: "lossy",
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
  console.log("Polish mode: lossy (auto-format detection)");
  console.log("CF options:", JSON.stringify(cfOptions));

  // (5) Pass signed request through transformation pipeline and return
  const response = await fetch(signedReq, { cf: cfOptions });
  
  // Clone response to add debug headers
  const newResponse = new Response(response.body, response);
  
  // Add debug headers
  newResponse.headers.set("X-Polish-Mode", "lossy");
  newResponse.headers.set("X-Accept-Header", accept);
  newResponse.headers.set("X-Original-Content-Type", response.headers.get("Content-Type") || "unknown");
  newResponse.headers.set("X-CF-Ray", response.headers.get("CF-RAY") || "unknown");
  
  // Check if Polish auto-converted to WebP
  const contentType = response.headers.get("Content-Type") || "";
  if (accept.includes("webp") && contentType.includes("webp")) {
    newResponse.headers.set("X-Polish-Auto-Convert", "webp-success");
  } else if (accept.includes("webp") && !contentType.includes("webp")) {
    newResponse.headers.set("X-Polish-Auto-Convert", "webp-not-converted");
  } else {
    newResponse.headers.set("X-Polish-Auto-Convert", "no-webp-in-accept");
  }
  
  return newResponse;
});

export default app;

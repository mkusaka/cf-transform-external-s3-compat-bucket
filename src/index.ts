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
    })
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

  // (4) Build cf options
  const cfOptions: RequestInitCfProperties = {
    image: format ? { format } : undefined,
    polish: "lossy",
    cacheTtl: 86400,
    cacheEverything: true,
    cacheTtlByStatus: {
      "200-299": 86400,
      "404": -1,
      "500-599": -1,
    },
  };

  // (5) Pass signed request through transformation pipeline and return
  return fetch(signedReq, { cf: cfOptions });
});

export default app;

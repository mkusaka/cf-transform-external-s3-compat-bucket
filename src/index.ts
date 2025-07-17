import { AwsClient } from "aws4fetch";

interface Env {
  GCS_HMAC_ACCESS_KEY_ID: string;
  GCS_HMAC_SECRET_ACCESS_KEY: string;
  GCS_BUCKET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // (1) Extract object key from URL
    const url = new URL(request.url);
    const key = url.pathname.slice(1); // /images/foo.png → "images/foo.png"

    // Return 404 if key is empty
    if (!key) {
      return new Response("Not Found", { status: 404 });
    }

    // (2) Generate signed request with aws4fetch
    const aws = new AwsClient({
      accessKeyId: env.GCS_HMAC_ACCESS_KEY_ID,
      secretAccessKey: env.GCS_HMAC_SECRET_ACCESS_KEY,
      service: "s3",
      region: "auto",
    });

    const signedReq = await aws.sign(
      new Request(`https://storage.googleapis.com/${env.GCS_BUCKET}/${key}`, {
        method: "GET",
      })
    );

    // (3) Determine format from Accept header
    const accept = request.headers.get("Accept") || "";
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
        "404": 300,
        "500-599": -1,
      },
    };

    // (5) Pass signed request through transformation pipeline and return
    return fetch(signedReq, { cf: cfOptions });
  },
};

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// Load .env.local if present
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
} catch {
  // ignore
}

import {
  createPresignedPutUrl,
  createPresignedGetUrl,
  verifyR2ObjectHead,
  deleteR2Object,
} from "@/lib/r2/signed-urls";
import { isR2Configured, getR2BucketName, getR2Client } from "@/lib/r2/client";

describe("Cloudflare R2 — Live Security, Storage & Lifecycle Verification", () => {
  it("enforces bucket privacy: unauthenticated direct requests are rejected", async () => {
    if (!isR2Configured()) {
      console.warn("Skipping live R2 bucket privacy test: R2 not configured.");
      return;
    }

    const bucket = getR2BucketName();
    const endpoint = process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const directUrl = `${endpoint}/${bucket}/private-check-${Date.now()}.txt`;

    // Attempt direct unsigned GET without S3/AWS SigV4 headers
    const directRes = await fetch(directUrl);
    // Cloudflare R2 rejects unsigned requests to private endpoints with 400/401/403
    expect([400, 401, 403]).toContain(directRes.status);
    expect(directRes.status).toBeGreaterThanOrEqual(400);
  });

  it("completes full lifecycle: presigned PUT upload, presigned GET download, HEAD validation, and deletion", async () => {
    if (!isR2Configured()) {
      console.warn("Skipping live R2 lifecycle test: R2 credentials not configured.");
      return;
    }

    const testItemId = `item_${Date.now()}`;
    const testKey = `workspaces/ws_live_test/items/${testItemId}/document.pdf`;
    const testPdfContent = Buffer.from("%PDF-1.4 sample content for SyncShelf production readiness audit\n%%EOF");

    // 1. Generate presigned PUT URL
    const presignedPutUrl = await createPresignedPutUrl({
      objectKey: testKey,
      contentType: "application/pdf",
      contentLength: testPdfContent.length,
      expiresIn: 300,
    });

    expect(presignedPutUrl).toContain("https://");
    expect(presignedPutUrl).toContain("X-Amz-Signature");

    // 2. Perform direct HTTP PUT simulating browser upload with CORS Origin
    const uploadRes = await fetch(presignedPutUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "application/pdf",
        Origin: "http://localhost:3000",
      },
      body: testPdfContent,
    });

    expect(uploadRes.status).toBe(200);

    // 3. Verify object metadata via S3 HEAD
    const head = await verifyR2ObjectHead({
      objectKey: testKey,
      expectedSizeBytes: testPdfContent.length,
      expectedMimeType: "application/pdf",
    });

    expect(head.exists).toBe(true);
    expect(head.valid).toBe(true);
    expect(head.sizeBytes).toBe(testPdfContent.length);

    // 4. Generate presigned GET URL and verify download content
    const presignedGetUrl = await createPresignedGetUrl({
      objectKey: testKey,
      expiresIn: 300,
      downloadFileName: "document.pdf",
    });

    const getRes = await fetch(presignedGetUrl);
    expect(getRes.status).toBe(200);
    const downloadedBuffer = Buffer.from(await getRes.arrayBuffer());
    expect(downloadedBuffer.equals(testPdfContent)).toBe(true);

    // 5. Clean up test object
    await deleteR2Object({ objectKey: testKey });

    // 6. Confirm object no longer exists
    const postDeleteHead = await verifyR2ObjectHead({
      objectKey: testKey,
      expectedSizeBytes: testPdfContent.length,
      expectedMimeType: "application/pdf",
    });
    expect(postDeleteHead.exists).toBe(false);
  });
});


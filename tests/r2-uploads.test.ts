import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as signUpload } from "@/app/api/workspaces/[workspaceId]/uploads/sign/route";
import { POST as finalizeUpload } from "@/app/api/workspaces/[workspaceId]/uploads/finalize/route";
import { GET as getFileUrl } from "@/app/api/workspaces/[workspaceId]/items/[itemId]/url/route";
import { DELETE as deleteItem } from "@/app/api/workspaces/[workspaceId]/items/[itemId]/route";
import {
  signUploadSchema,
  finalizeUploadSchema,
  isMimeTypeAllowed,
  MAX_FILE_SIZE_BYTES,
} from "@/lib/validation/item";
import {
  createUploadIntentToken,
  verifyUploadIntentToken,
} from "@/lib/r2/intent-token";
import * as tokenModule from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";
import * as permModule from "@/lib/authz/permissions";
import * as envModule from "@/lib/env";
import * as signedUrlsModule from "@/lib/r2/signed-urls";

describe("Milestone 7 — Cloudflare R2 File Storage & API", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Validation & Intent Tokens", () => {
    it("validates file sizes within 25 MB limit and rejects oversized files", () => {
      const valid = signUploadSchema.safeParse({
        fileName: "spec.pdf",
        fileSize: 10 * 1024 * 1024, // 10 MB
        mimeType: "application/pdf",
        type: "file",
      });
      expect(valid.success).toBe(true);

      const oversized = signUploadSchema.safeParse({
        fileName: "huge.zip",
        fileSize: 26 * 1024 * 1024, // 26 MB (over 25MB limit)
        mimeType: "application/zip",
        type: "file",
      });
      expect(oversized.success).toBe(false);
    });

    it("enforces allowed MIME types correctly", () => {
      expect(isMimeTypeAllowed("image", "image/png")).toBe(true);
      expect(isMimeTypeAllowed("image", "image/jpeg")).toBe(true);
      expect(isMimeTypeAllowed("image", "application/x-msdownload")).toBe(false);

      expect(isMimeTypeAllowed("audio", "audio/mpeg")).toBe(true);
      expect(isMimeTypeAllowed("audio", "audio/wav")).toBe(true);
      expect(isMimeTypeAllowed("audio", "image/png")).toBe(false);

      expect(isMimeTypeAllowed("file", "application/pdf")).toBe(true);
      expect(isMimeTypeAllowed("file", "text/plain")).toBe(true);
    });

    it("generates and verifies cryptographic HMAC intent tokens", () => {
      vi.spyOn(envModule, "getServerEnv").mockReturnValue({
        NODE_ENV: "test",
        FIREBASE_ADMIN_PRIVATE_KEY: "test-secret-key-for-signing",
        MAX_UPLOAD_SIZE_BYTES: 26214400,
      } as any);

      const payload = {
        workspaceId: "ws_test",
        itemId: "item_123",
        objectKey: "workspaces/ws_test/items/item_123/file.pdf",
        expectedSizeBytes: 2048,
        expectedMimeType: "application/pdf",
        type: "file" as const,
        title: "Test File",
        tags: ["doc"],
        isPinned: false,
        originalFileName: "file.pdf",
        userId: "user_owner",
      };

      const token = createUploadIntentToken(payload, 300);
      expect(token).toBeDefined();
      expect(token.split(".")).toHaveLength(2);

      const verified = verifyUploadIntentToken(token);
      expect(verified.workspaceId).toBe("ws_test");
      expect(verified.itemId).toBe("item_123");
      expect(verified.expectedSizeBytes).toBe(2048);
    });

    it("rejects tampered intent tokens", () => {
      vi.spyOn(envModule, "getServerEnv").mockReturnValue({
        NODE_ENV: "test",
        FIREBASE_ADMIN_PRIVATE_KEY: "test-secret-key-for-signing",
        MAX_UPLOAD_SIZE_BYTES: 26214400,
      } as any);

      const payload = {
        workspaceId: "ws_test",
        itemId: "item_123",
        objectKey: "workspaces/ws_test/items/item_123/file.pdf",
        expectedSizeBytes: 2048,
        expectedMimeType: "application/pdf",
        type: "file" as const,
        title: "Test File",
        tags: [],
        isPinned: false,
        originalFileName: "file.pdf",
        userId: "user_owner",
      };

      const token = createUploadIntentToken(payload, 300);
      const [payloadB64] = token.split(".");
      const tamperedToken = `${payloadB64}.tampered_signature_xyz`;

      expect(() => verifyUploadIntentToken(tamperedToken)).toThrow("Invalid upload intent token signature");
    });

    it("rejects expired intent tokens", () => {
      vi.spyOn(envModule, "getServerEnv").mockReturnValue({
        NODE_ENV: "test",
        FIREBASE_ADMIN_PRIVATE_KEY: "test-secret-key-for-signing",
        MAX_UPLOAD_SIZE_BYTES: 26214400,
      } as any);

      const payload = {
        workspaceId: "ws_test",
        itemId: "item_123",
        objectKey: "workspaces/ws_test/items/item_123/file.pdf",
        expectedSizeBytes: 2048,
        expectedMimeType: "application/pdf",
        type: "file" as const,
        title: "Test File",
        tags: [],
        isPinned: false,
        originalFileName: "file.pdf",
        userId: "user_owner",
      };

      // Expired -1 second ago
      const expiredToken = createUploadIntentToken(payload, -1);
      expect(() => verifyUploadIntentToken(expiredToken)).toThrow("expired");
    });
  });

  describe("POST /api/workspaces/[workspaceId]/uploads/sign", () => {
    it("returns 401 when token is missing or invalid", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/uploads/sign", {
        method: "POST",
        body: JSON.stringify({
          fileName: "photo.png",
          fileSize: 1024,
          mimeType: "image/png",
          type: "image",
        }),
      });

      const res = await signUpload(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when user is a Viewer (Viewers cannot upload)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/uploads/sign", {
        method: "POST",
        headers: { authorization: "Bearer viewer_token" },
        body: JSON.stringify({
          fileName: "photo.png",
          fileSize: 1024,
          mimeType: "image/png",
          type: "image",
        }),
      });

      const res = await signUpload(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 503 if R2 is not configured on server", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");
      vi.spyOn(envModule, "hasR2Config").mockReturnValue(false);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/uploads/sign", {
        method: "POST",
        headers: { authorization: "Bearer editor_token" },
        body: JSON.stringify({
          fileName: "photo.png",
          fileSize: 1024,
          mimeType: "image/png",
          type: "image",
        }),
      });

      const res = await signUpload(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(503);
      const json = await res.json();
      expect(json.code).toBe("R2_NOT_CONFIGURED");
    });

    it("returns presigned PUT URL and intent token for Editor/Owner", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");
      vi.spyOn(envModule, "hasR2Config").mockReturnValue(true);
      vi.spyOn(envModule, "getServerEnv").mockReturnValue({
        NODE_ENV: "test",
        R2_BUCKET_NAME: "test-bucket",
        FIREBASE_ADMIN_PRIVATE_KEY: "admin-secret-key",
      } as any);

      vi.spyOn(signedUrlsModule, "createPresignedPutUrl").mockResolvedValue(
        "https://r2.cloudflarestorage.com/test-bucket/workspaces/ws_1/items/item_1/signed_put"
      );

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/uploads/sign", {
        method: "POST",
        headers: { authorization: "Bearer editor_token" },
        body: JSON.stringify({
          fileName: "chart.png",
          fileSize: 50000,
          mimeType: "image/png",
          type: "image",
          title: "Quarterly Revenue Chart",
        }),
      });

      const res = await signUpload(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.uploadUrl).toContain("signed_put");
      expect(json.intentToken).toBeDefined();
      expect(json.itemId).toBeDefined();
    });
  });

  describe("POST /api/workspaces/[workspaceId]/uploads/finalize", () => {
    it("returns 403 if user is Viewer", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/uploads/finalize", {
        method: "POST",
        headers: { authorization: "Bearer viewer_token" },
        body: JSON.stringify({ intentToken: "some_token" }),
      });

      const res = await finalizeUpload(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects when R2 HEAD verification fails (file missing in bucket)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");
      vi.spyOn(envModule, "hasR2Config").mockReturnValue(true);
      vi.spyOn(envModule, "getServerEnv").mockReturnValue({
        NODE_ENV: "test",
        FIREBASE_ADMIN_PRIVATE_KEY: "admin-secret-key",
      } as any);

      const token = createUploadIntentToken({
        workspaceId: "ws_1",
        itemId: "item_999",
        objectKey: "workspaces/ws_1/items/item_999/test.pdf",
        expectedSizeBytes: 1024,
        expectedMimeType: "application/pdf",
        type: "file",
        title: "Test Doc",
        tags: [],
        isPinned: false,
        originalFileName: "test.pdf",
        userId: "owner_user",
      });

      // Mock HEAD check returns not found
      vi.spyOn(signedUrlsModule, "verifyR2ObjectHead").mockResolvedValue({
        exists: false,
        valid: false,
        error: "Object does not exist in Cloudflare R2 storage",
      });

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/uploads/finalize", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({ intentToken: token }),
      });

      const res = await finalizeUpload(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Object does not exist");
    });

    it("creates Firestore document after successful R2 HEAD verification", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");
      vi.spyOn(envModule, "hasR2Config").mockReturnValue(true);
      vi.spyOn(envModule, "getServerEnv").mockReturnValue({
        NODE_ENV: "test",
        FIREBASE_ADMIN_PRIVATE_KEY: "admin-secret-key",
      } as any);

      const token = createUploadIntentToken({
        workspaceId: "ws_1",
        itemId: "item_success",
        objectKey: "workspaces/ws_1/items/item_success/invoice.pdf",
        expectedSizeBytes: 2048,
        expectedMimeType: "application/pdf",
        type: "file",
        title: "Invoice #101",
        tags: ["finance"],
        isPinned: true,
        originalFileName: "invoice.pdf",
        userId: "owner_user",
      });

      vi.spyOn(signedUrlsModule, "verifyR2ObjectHead").mockResolvedValue({
        exists: true,
        valid: true,
        sizeBytes: 2048,
        mimeType: "application/pdf",
      });

      let storedDocData: any = null;
      const mockDocRef = {
        get: vi.fn().mockResolvedValue({ exists: false }),
        set: vi.fn().mockImplementation((data) => {
          storedDocData = data;
          return Promise.resolve();
        }),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue(mockDocRef),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue(mockCollection),
          }),
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/uploads/finalize", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({ intentToken: token }),
      });

      const res = await finalizeUpload(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.item.id).toBe("item_success");
      expect(json.item.sizeBytes).toBe(2048);
      expect(json.item.objectKey).toBe("workspaces/ws_1/items/item_success/invoice.pdf");
      expect(storedDocData).toBeDefined();
      expect(storedDocData.originalFileName).toBe("invoice.pdf");
    });
  });

  describe("GET /api/workspaces/[workspaceId]/items/[itemId]/url", () => {
    it("allows Viewers to generate presigned GET URLs for viewing/downloading", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");
      vi.spyOn(envModule, "hasR2Config").mockReturnValue(true);

      const mockItemData = {
        id: "item_view_1",
        workspaceId: "ws_1",
        objectKey: "workspaces/ws_1/items/item_view_1/doc.pdf",
        originalFileName: "doc.pdf",
        mimeType: "application/pdf",
        sizeBytes: 4096,
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => mockItemData,
                }),
              }),
            }),
          }),
        }),
      } as any);

      vi.spyOn(signedUrlsModule, "createPresignedGetUrl").mockResolvedValue(
        "https://r2.cloudflarestorage.com/test-bucket/workspaces/ws_1/items/item_view_1/doc.pdf?X-Amz-Signature=abc"
      );

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/items/item_view_1/url?download=true", {
        method: "GET",
        headers: { authorization: "Bearer viewer_token" },
      });

      const res = await getFileUrl(req, {
        params: Promise.resolve({ workspaceId: "ws_1", itemId: "item_view_1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.url).toContain("X-Amz-Signature");
      expect(json.originalFileName).toBe("doc.pdf");
    });

    it("returns 403 when non-member requests access URL", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "outsider_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/items/item_1/url", {
        method: "GET",
        headers: { authorization: "Bearer outsider_token" },
      });

      const res = await getFileUrl(req, {
        params: Promise.resolve({ workspaceId: "ws_1", itemId: "item_1" }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/workspaces/[workspaceId]/items/[itemId] R2 Cleanup", () => {
    it("calls deleteR2Object when deleting an item with an objectKey", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_user",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");
      vi.spyOn(envModule, "hasR2Config").mockReturnValue(true);

      const mockDeleteR2 = vi.spyOn(signedUrlsModule, "deleteR2Object").mockResolvedValue();

      const itemRef = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            id: "item_del_1",
            objectKey: "workspaces/ws_1/items/item_del_1/delete-me.png",
          }),
        }),
        delete: vi.fn().mockResolvedValue({}),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue(itemRef),
            }),
          }),
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/items/item_del_1", {
        method: "DELETE",
        headers: { authorization: "Bearer owner_token" },
      });

      const res = await deleteItem(req, {
        params: Promise.resolve({ workspaceId: "ws_1", itemId: "item_del_1" }),
      });
      expect(res.status).toBe(200);
      expect(mockDeleteR2).toHaveBeenCalledWith({
        objectKey: "workspaces/ws_1/items/item_del_1/delete-me.png",
      });
      expect(itemRef.delete).toHaveBeenCalled();
    });
  });
});

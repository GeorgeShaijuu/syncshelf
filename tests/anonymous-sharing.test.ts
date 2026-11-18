import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  POST as createShare,
  GET as listShares,
} from "@/app/api/workspaces/[workspaceId]/shares/route";
import { DELETE as revokeShare } from "@/app/api/workspaces/[workspaceId]/shares/[shareId]/route";
import { GET as resolvePublicShare } from "@/app/api/public/shares/[token]/route";
import {
  generateShareToken,
  parseShareToken,
  hashShareSecret,
  verifyShareSecret,
} from "@/lib/shares/share-crypto";
import * as tokenModule from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";
import * as permModule from "@/lib/authz/permissions";
import * as auditModule from "@/lib/audit/audit-logger";
import * as r2SignedModule from "@/lib/r2/signed-urls";
import * as r2ClientModule from "@/lib/r2/client";

describe("Milestone 9 — Anonymous Public Sharing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("1. Token Generation, Cryptography & Constant-Time Verification", () => {
    it("generates 48 bytes of cryptographic randomness (384 bits entropy) with prefix 'shr_'", () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();

      expect(token).toMatch(/^shr_[0-9a-f]{32}_[0-9a-f]{64}$/);
      expect(shareId).toHaveLength(32); // 16 bytes in hex
      expect(tokenSecret).toHaveLength(64); // 32 bytes in hex
      expect(tokenHash).toBe(hashShareSecret(tokenSecret));
      expect(tokenHash).toHaveLength(64); // SHA-256 output
    });

    it("parses valid tokens correctly", () => {
      const { shareId, tokenSecret, token } = generateShareToken();
      const parsed = parseShareToken(token);

      expect(parsed).not.toBeNull();
      expect(parsed?.shareId).toBe(shareId);
      expect(parsed?.tokenSecret).toBe(tokenSecret);
    });

    it("rejects malformed tokens, invalid lengths, and non-hex inputs", () => {
      expect(parseShareToken("invalid-token")).toBeNull();
      expect(parseShareToken("shr_short_secret")).toBeNull();
      expect(parseShareToken("shr_" + "a".repeat(32) + "_" + "g".repeat(64))).toBeNull(); // non-hex
      expect(parseShareToken("")).toBeNull();
    });

    it("verifies secrets using timing-safe constant-time comparison", () => {
      const { tokenSecret, tokenHash } = generateShareToken();

      expect(verifyShareSecret(tokenSecret, tokenHash)).toBe(true);
      expect(verifyShareSecret("wrongsecret" + "0".repeat(53), tokenHash)).toBe(false);
      expect(verifyShareSecret("", tokenHash)).toBe(false);
    });
  });

  describe("2. POST /api/workspaces/[workspaceId]/shares — Share Creation Security", () => {
    const mockOwner = {
      uid: "owner_123",
      email: "owner@example.com",
      decodedToken: {} as any,
    };

    it("returns 401 when Authorization token is missing or invalid", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        body: JSON.stringify({ itemIds: ["item_1"] }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(401);
    });

    it("returns 403 when user is an Editor (only Owner can share)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_456",
        email: "editor@example.com",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ itemIds: ["item_1"] }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Only workspace owners");
    });

    it("returns 403 when user is a Viewer", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_789",
        email: "viewer@example.com",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ itemIds: ["item_1"] }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(403);
    });

    it("returns 400 when itemIds is empty", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ itemIds: [] }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(400);
    });

    it("returns 400 when itemIds contains duplicates", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ itemIds: ["item_1", "item_1"] }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.details.itemIds).toContain("Duplicate item IDs are not allowed in share selection");
    });

    it("returns 400 when selection exceeds 25 items", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const itemIds = Array.from({ length: 26 }, (_, i) => `item_${i}`);
      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ itemIds }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(400);
    });

    it("rejects non-existent or cross-workspace item IDs with 400", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockImplementation((id: string) => ({
            id,
            get: vi.fn().mockResolvedValue({
              exists: id === "ws_1", // workspace exists
            }),
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockImplementation((itemId: string) => ({
                id: itemId,
                get: vi.fn().mockResolvedValue({
                  // Item item_valid exists, foreign_item does not
                  exists: itemId === "item_valid",
                }),
              })),
            }),
          })),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ itemIds: ["item_valid", "foreign_item"] }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.missingItemId).toBe("foreign_item");
    });

    it("creates single-item share, stores ONLY tokenHash (NEVER raw token), and logs audit event", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const batchSets: Array<{ ref: any; data: any }> = [];
      const mockBatch = {
        set: vi.fn().mockImplementation((ref, data) => {
          batchSets.push({ ref, data });
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      const mockDb = {
        collection: vi.fn().mockImplementation((col: string) => {
          if (col === "publicSharePointers") {
            return {
              doc: vi.fn().mockImplementation((id: string) => ({ id, col })),
            };
          }
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ name: "Engineering" }) }),
              collection: vi.fn().mockImplementation((sub: string) => ({
                doc: vi.fn().mockImplementation((id: string) => ({
                  id,
                  sub,
                  get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ title: "Snippet" }) }),
                })),
              })),
            }),
          };
        }),
        batch: vi.fn().mockReturnValue(mockBatch),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);
      const auditSpy = vi.spyOn(auditModule, "logAuditEvent").mockResolvedValue("log_1");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ itemIds: ["item_1"], expiry: "24h" }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(201);
      const json = await res.json();

      expect(json.scope).toBe("item");
      expect(json.itemCount).toBe(1);
      expect(json.token).toMatch(/^shr_/);
      expect(json.url).toContain(`/s/${json.token}`);

      // Verify batch writes
      expect(batchSets.length).toBe(2);
      const shareDocData = batchSets[0].data;

      // CRITICAL: Raw token must NEVER be stored in Firestore!
      expect(shareDocData.token).toBeUndefined();
      expect(shareDocData.tokenSecret).toBeUndefined();
      expect(shareDocData.tokenHash).toHaveLength(64);
      expect(shareDocData.scope).toBe("item");
      expect(shareDocData.status).toBe("active");

      // Verify audit record
      expect(auditSpy).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          workspaceId: "ws_1",
          actorUid: "owner_123",
          action: "SHARE_CREATED",
          metadata: expect.objectContaining({
            scope: "item",
            itemCount: 1,
            expiry: "24h",
          }),
        })
      );
    });

    it("creates selected-items share with scope='selected_items'", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const batchSets: Array<{ ref: any; data: any }> = [];
      const mockBatch = {
        set: vi.fn().mockImplementation((ref, data) => batchSets.push({ ref, data })),
        commit: vi.fn().mockResolvedValue(undefined),
      };

      const mockDb = {
        collection: vi.fn().mockImplementation((col: string) => ({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: true }),
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: true }),
              }),
            }),
          }),
        })),
        batch: vi.fn().mockReturnValue(mockBatch),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);
      vi.spyOn(auditModule, "logAuditEvent").mockResolvedValue("log_2");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ itemIds: ["item_1", "item_2", "item_3"], expiry: "7d" }),
      });
      const res = await createShare(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.scope).toBe("selected_items");
      expect(json.itemCount).toBe(3);
    });
  });

  describe("3. GET & DELETE /api/workspaces/[workspaceId]/shares — List & Revocation", () => {
    const mockOwner = { uid: "owner_123", email: "owner@example.com", decodedToken: {} as any };

    it("GET: rejects non-owners with 403", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_1",
        email: "ed@example.com",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        headers: { authorization: "Bearer valid" },
      });
      const res = await listShares(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });
      expect(res.status).toBe(403);
    });

    it("GET: lists shares and NEVER exposes tokenHash or raw tokens", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  docs: [
                    {
                      id: "share_123",
                      data: () => ({
                        shareId: "share_123",
                        tokenHash: "secret_hash_value_1234567890", // sensitive!
                        scope: "item",
                        itemIds: ["item_1"],
                        status: "active",
                        createdBy: "owner_123",
                        createdAt: { toDate: () => new Date("2026-11-17T00:00:00Z") },
                        expiresAt: { toDate: () => new Date("2026-11-24T00:00:00Z") },
                        viewCount: 5,
                      }),
                    },
                  ],
                }),
              }),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares", {
        headers: { authorization: "Bearer valid" },
      });
      const res = await listShares(req, { params: Promise.resolve({ workspaceId: "ws_1" }) });
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.shares).toHaveLength(1);
      const firstShare = json.shares[0];
      expect(firstShare.id).toBe("share_123");
      expect(firstShare.itemCount).toBe(1);
      expect(firstShare.tokenHash).toBeUndefined(); // NEVER returned
      expect(firstShare.token).toBeUndefined(); // NEVER returned
      expect(firstShare.status).toBe("active");
    });

    it("DELETE: rejects non-owner revocation attempts with 403", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_1",
        email: "v@example.com",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares/share_1", {
        method: "DELETE",
        headers: { authorization: "Bearer valid" },
      });
      const res = await revokeShare(req, {
        params: Promise.resolve({ workspaceId: "ws_1", shareId: "share_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("DELETE: revokes share, marks status='revoked', and logs SHARE_REVOKED audit event", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const updateSpy = vi.fn().mockResolvedValue(undefined);
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ status: "active", scope: "item", itemIds: ["item_1"] }),
                }),
                update: updateSpy,
              }),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);
      const auditSpy = vi.spyOn(auditModule, "logAuditEvent").mockResolvedValue("log_3");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares/share_1", {
        method: "DELETE",
        headers: { authorization: "Bearer valid" },
      });
      const res = await revokeShare(req, {
        params: Promise.resolve({ workspaceId: "ws_1", shareId: "share_1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("revoked");
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "revoked",
          revokedBy: "owner_123",
        })
      );
      expect(auditSpy).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          workspaceId: "ws_1",
          actorUid: "owner_123",
          action: "SHARE_REVOKED",
          shareId: "share_1",
        })
      );
    });

    it("DELETE: handles repeated revocation idempotently without errors", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ status: "revoked" }), // already revoked
                }),
              }),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/shares/share_1", {
        method: "DELETE",
        headers: { authorization: "Bearer valid" },
      });
      const res = await revokeShare(req, {
        params: Promise.resolve({ workspaceId: "ws_1", shareId: "share_1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.alreadyRevoked).toBe(true);
    });
  });

  describe("4. GET /api/public/shares/[token] — Anonymous Resolution Security", () => {
    it("returns 404 for malformed token format", async () => {
      const req = new NextRequest("http://localhost:3000/api/public/shares/malformed_token");
      const res = await resolvePublicShare(req, {
        params: Promise.resolve({ token: "malformed_token" }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 when share pointer does not exist", async () => {
      const { token } = generateShareToken();
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: false }),
          }),
        }),
        collectionGroup: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ empty: true }),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });
      expect(res.status).toBe(404);
    });

    it("returns 404 when token secret hash does not match stored hash", async () => {
      const { shareId, token } = generateShareToken();
      const mockDb = {
        collection: vi.fn().mockImplementation((col: string) => {
          if (col === "publicSharePointers") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ workspaceId: "ws_1" }),
                }),
              }),
            };
          }
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({
                      shareId,
                      tokenHash: "different_stored_hash_value_1234567890",
                      status: "active",
                      itemIds: ["item_1"],
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });
      expect(res.status).toBe(404);
    });

    it("returns 410 with status='revoked' when share has been revoked", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      const mockDb = {
        collection: vi.fn().mockImplementation((col: string) => {
          if (col === "publicSharePointers") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ workspaceId: "ws_1" }),
                }),
              }),
            };
          }
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({
                      shareId,
                      tokenHash,
                      status: "revoked",
                      itemIds: ["item_1"],
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });

      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.status).toBe("revoked");
    });

    it("returns 410 with status='expired' when share has expired", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      const mockDb = {
        collection: vi.fn().mockImplementation((col: string) => {
          if (col === "publicSharePointers") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ workspaceId: "ws_1" }),
                }),
              }),
            };
          }
          return {
            doc: vi.fn().mockReturnValue({
              collection: vi.fn().mockReturnValue({
                doc: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({
                    exists: true,
                    data: () => ({
                      shareId,
                      tokenHash,
                      status: "active",
                      expiresAt: { toDate: () => new Date("2020-01-01T00:00:00Z") }, // past date
                      itemIds: ["item_1"],
                    }),
                  }),
                }),
              }),
            }),
          };
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });

      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.status).toBe("expired");
    });

    it("resolves active share and returns ONLY selected public items with security headers", async () => {
      const { shareId, token, tokenHash } = generateShareToken();

      const mockDb = {
        collection: vi.fn().mockImplementation((col: string) => {
          if (col === "publicSharePointers") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ workspaceId: "ws_1" }),
                }),
              }),
            };
          }
          return {
            doc: vi.fn().mockReturnValue({
              // workspace doc
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ name: "Acme Product Shelf", ownerUid: "super_secret_owner_uid" }),
              }),
              collection: vi.fn().mockImplementation((sub: string) => {
                if (sub === "shares") {
                  return {
                    doc: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                          shareId,
                          tokenHash,
                          scope: "selected_items",
                          status: "active",
                          itemIds: ["item_1", "item_2"],
                          createdAt: { toDate: () => new Date("2026-11-17T00:00:00Z") },
                          expiresAt: null,
                        }),
                      }),
                      update: vi.fn().mockResolvedValue(undefined),
                    }),
                  };
                }
                if (sub === "items") {
                  return {
                    doc: vi.fn().mockImplementation((itemId: string) => ({
                      get: vi.fn().mockResolvedValue({
                        exists: true,
                        id: itemId,
                        data: () => ({
                          title: itemId === "item_1" ? "React Hook" : "SQL Query",
                          content: itemId === "item_1" ? "const useItem = () => {}" : "SELECT * FROM items;",
                          type: "code",
                          language: itemId === "item_1" ? "typescript" : "sql",
                          createdAt: { toDate: () => new Date("2026-11-17T00:00:00Z") },
                        }),
                      }),
                    })),
                  };
                }
                return {};
              }),
            }),
          };
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });

      expect(res.status).toBe(200);

      // Verify strict security headers
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      expect(res.headers.get("Referrer-Policy")).toBe("no-referrer");
      expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow, noarchive");

      const json = await res.json();

      // Metadata check: generic workspace name present, ownerUid STRICTLY absent
      expect(json.share.workspaceName).toBe("Acme Product Shelf");
      expect(json.share.ownerUid).toBeUndefined();
      expect(json.items).toHaveLength(2);

      // Content check
      expect(json.items[0].title).toBe("React Hook");
      expect(json.items[1].title).toBe("SQL Query");
    });

    it("generates short-lived (5 min) presigned GET URLs for shared images/media in Cloudflare R2", async () => {
      const { shareId, token, tokenHash } = generateShareToken();

      vi.spyOn(r2ClientModule, "isR2Configured").mockReturnValue(true);
      const presignSpy = vi
        .spyOn(r2SignedModule, "createPresignedGetUrl")
        .mockResolvedValue("https://r2.syncshelf.com/temporary-image.png?signature=shortlived");

      const mockDb = {
        collection: vi.fn().mockImplementation((col: string) => {
          if (col === "publicSharePointers") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ workspaceId: "ws_1" }),
                }),
              }),
            };
          }
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({
                exists: true,
                data: () => ({ name: "Design Shelf" }),
              }),
              collection: vi.fn().mockImplementation((sub: string) => {
                if (sub === "shares") {
                  return {
                    doc: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                          shareId,
                          tokenHash,
                          scope: "item",
                          status: "active",
                          itemIds: ["image_item_1"],
                          createdAt: { toDate: () => new Date() },
                        }),
                      }),
                      update: vi.fn().mockResolvedValue(undefined),
                    }),
                  };
                }
                if (sub === "items") {
                  return {
                    doc: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({
                        exists: true,
                        id: "image_item_1",
                        data: () => ({
                          type: "image",
                          title: "Mockup Banner",
                          fileName: "banner.png",
                          fileSizeBytes: 204800,
                          mimeType: "image/png",
                          r2ObjectKey: "workspaces/ws_1/items/image_item_1/banner.png",
                          createdAt: { toDate: () => new Date() },
                        }),
                      }),
                    }),
                  };
                }
                return {};
              }),
            }),
          };
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });

      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.items[0].type).toBe("image");
      expect(json.items[0].presignedUrl).toBe(
        "https://r2.syncshelf.com/temporary-image.png?signature=shortlived"
      );

      // Verify presigned URL requested 300 seconds lifetime (5 mins)
      expect(presignSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          objectKey: "workspaces/ws_1/items/image_item_1/banner.png",
          expiresIn: 300,
          downloadFileName: "banner.png",
        })
      );
    });

    it("silently omits deleted items; returns 404 when all shared items were deleted", async () => {
      const { shareId, token, tokenHash } = generateShareToken();

      const mockDb = {
        collection: vi.fn().mockImplementation((col: string) => {
          if (col === "publicSharePointers") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  data: () => ({ workspaceId: "ws_1" }),
                }),
              }),
            };
          }
          return {
            doc: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ name: "Shelf" }) }),
              collection: vi.fn().mockImplementation((sub: string) => {
                if (sub === "shares") {
                  return {
                    doc: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({
                        exists: true,
                        data: () => ({
                          shareId,
                          tokenHash,
                          status: "active",
                          itemIds: ["deleted_item"],
                        }),
                      }),
                      update: vi.fn().mockResolvedValue(undefined),
                    }),
                  };
                }
                if (sub === "items") {
                  return {
                    doc: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({ exists: false }), // item deleted!
                    }),
                  };
                }
                return {};
              }),
            }),
          };
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });

      expect(res.status).toBe(404);
      const json = await res.json();
      expect(json.status).toBe("unavailable");
    });
  });
});

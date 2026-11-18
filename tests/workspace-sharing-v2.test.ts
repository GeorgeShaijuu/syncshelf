import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  POST as createShare,
  GET as listShares,
} from "@/app/api/workspaces/[workspaceId]/shares/route";
import {
  PATCH as updateShare,
  DELETE as revokeShare,
} from "@/app/api/workspaces/[workspaceId]/shares/[shareId]/route";
import { GET as resolvePublicShare } from "@/app/api/public/shares/[token]/route";
import { POST as createSharedItem } from "@/app/api/public/shares/[token]/items/route";
import {
  PATCH as updateSharedItem,
  DELETE as deleteSharedItem,
} from "@/app/api/public/shares/[token]/items/[itemId]/route";
import {
  POST as recordRecentShare,
  GET as getRecentShares,
} from "@/app/api/user/recent-shares/route";
import { generateShareToken } from "@/lib/shares/share-crypto";
import { verifyShareAccess } from "@/lib/shares/share-auth";
import * as tokenModule from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";
import * as permModule from "@/lib/authz/permissions";
import * as auditModule from "@/lib/audit/audit-logger";

describe("Workspace Sharing 2.0 — Live Collaborative Board & Calendar Sharing", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockOwner = {
    uid: "owner_123",
    email: "owner@example.com",
    decodedToken: {} as any,
  };

  const mockEditor = {
    uid: "editor_456",
    email: "editor@example.com",
    decodedToken: {} as any,
  };

  const mockViewer = {
    uid: "viewer_789",
    email: "viewer@example.com",
    decodedToken: {} as any,
  };

  const mockInvitedPerson = {
    uid: "alice_guest",
    email: "alice@colleague.com",
    decodedToken: {} as any,
  };

  const mockStranger = {
    uid: "stranger_999",
    email: "stranger@other.com",
    decodedToken: {} as any,
  };

  // Mock workspace
  const mockWorkspace = {
    id: "ws_test_1",
    name: "Acme Creative Studio",
    ownerUid: "owner_123",
  };

  // Setup Firestore mocks
  function setupFirestoreMock(options: {
    shares?: Record<string, any>;
    items?: Record<string, any>;
    pointers?: Record<string, any>;
    recentShares?: Record<string, any>;
  }) {
    const sharesMap = new Map(Object.entries(options.shares || {}));
    const itemsMap = new Map(Object.entries(options.items || {}));
    const pointersMap = new Map(Object.entries(options.pointers || {}));
    const recentSharesMap = new Map(Object.entries(options.recentShares || {}));

    const mockAdminDb: any = {
      collection: vi.fn((colName: string) => {
        if (colName === "workspaces") {
          return {
            doc: vi.fn((wsId: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: wsId === mockWorkspace.id,
                data: () => mockWorkspace,
              }),
              collection: vi.fn((subCol: string) => {
                if (subCol === "shares") {
                  return {
                    doc: vi.fn((shareId: string) => ({
                      get: vi.fn().mockResolvedValue({
                        exists: sharesMap.has(shareId),
                        data: () => sharesMap.get(shareId),
                        ref: { id: shareId },
                      }),
                      update: vi.fn().mockImplementation((updates: any) => {
                        const existing = sharesMap.get(shareId) || {};
                        sharesMap.set(shareId, { ...existing, ...updates });
                        return Promise.resolve();
                      }),
                      onSnapshot: vi.fn(),
                    })),
                    orderBy: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({
                        docs: Array.from(sharesMap.entries()).map(([id, data]) => ({
                          id,
                          data: () => data,
                        })),
                      }),
                    }),
                  };
                }
                if (subCol === "items") {
                  return {
                    doc: vi.fn((itemId: string) => ({
                      get: vi.fn().mockResolvedValue({
                        exists: itemsMap.has(itemId),
                        data: () => itemsMap.get(itemId),
                        id: itemId,
                      }),
                      set: vi.fn().mockImplementation((data: any) => {
                        itemsMap.set(itemId, data);
                        return Promise.resolve();
                      }),
                      update: vi.fn().mockImplementation((updates: any) => {
                        const existing = itemsMap.get(itemId) || {};
                        itemsMap.set(itemId, { ...existing, ...updates });
                        return Promise.resolve();
                      }),
                      delete: vi.fn().mockImplementation(() => {
                        itemsMap.delete(itemId);
                        return Promise.resolve();
                      }),
                    })),
                    orderBy: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({
                        docs: Array.from(itemsMap.entries()).map(([id, data]) => ({
                          id,
                          data: () => data,
                        })),
                      }),
                    }),
                  };
                }
                return {};
              }),
            })),
          };
        }
        if (colName === "publicSharePointers") {
          return {
            doc: vi.fn((shareId: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: pointersMap.has(shareId),
                data: () => pointersMap.get(shareId),
              }),
              set: vi.fn().mockImplementation((data: any) => {
                pointersMap.set(shareId, data);
                return Promise.resolve();
              }),
            })),
          };
        }
        if (colName === "users") {
          return {
            doc: vi.fn((uid: string) => ({
              collection: vi.fn((subCol: string) => {
                if (subCol === "recentShares") {
                  return {
                    doc: vi.fn((shareId: string) => ({
                      set: vi.fn().mockImplementation((data: any) => {
                        recentSharesMap.set(`${uid}_${shareId}`, data);
                        return Promise.resolve();
                      }),
                    })),
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        get: vi.fn().mockResolvedValue({
                          docs: Array.from(recentSharesMap.entries()).map(
                            ([id, data]) => ({ id, data: () => data })
                          ),
                        }),
                      }),
                    }),
                  };
                }
                return {};
              }),
            })),
          };
        }
        return {};
      }),
      collectionGroup: vi.fn(() => ({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          }),
        }),
      })),
      batch: vi.fn(() => ({
        set: vi.fn((ref: any, data: any) => {
          if (data.tokenHash) {
            sharesMap.set(data.shareId, data);
          } else {
            pointersMap.set(data.shareId, data);
          }
        }),
        commit: vi.fn().mockResolvedValue(undefined),
      })),
    };

    vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockAdminDb);
    vi.spyOn(auditModule, "logAuditEvent").mockResolvedValue("event_id_1");

    return { sharesMap, itemsMap, pointersMap, recentSharesMap };
  }

  describe("1. Scope Creation & Validation", () => {
    it("creates a board-scope share successfully without requiring itemIds", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");
      const { sharesMap } = setupFirestoreMock({});

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_test_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({
          scope: "board",
          accessMode: "public",
          expiry: "7d",
          title: "Public Board Showcase",
        }),
      });

      const res = await createShare(req, {
        params: Promise.resolve({ workspaceId: "ws_test_1" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.scope).toBe("board");
      expect(json.title).toBe("Public Board Showcase");
      expect(json.token).toMatch(/^shr_/);
      expect(sharesMap.has(json.id)).toBe(true);
    });

    it("creates a calendar-scope share successfully", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");
      setupFirestoreMock({});

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_test_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({
          scope: "calendar",
          accessMode: "authenticated",
          defaultPermission: "viewer",
          expiry: "30d",
        }),
      });

      const res = await createShare(req, {
        params: Promise.resolve({ workspaceId: "ws_test_1" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.scope).toBe("calendar");
      expect(json.accessMode).toBe("authenticated");
    });

    it("creates a unified workspace share (both Board + Calendar)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");
      setupFirestoreMock({});

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_test_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({
          scope: "workspace",
          accessMode: "specific_people",
          invitedRecipients: [
            { email: "alice@colleague.com", permission: "editor" },
          ],
        }),
      });

      const res = await createShare(req, {
        params: Promise.resolve({ workspaceId: "ws_test_1" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.scope).toBe("workspace");
      expect(json.accessMode).toBe("specific_people");
      expect(json.invitedRecipients).toHaveLength(1);
      expect(json.invitedRecipients[0].email).toBe("alice@colleague.com");
    });

    it("rejects specific_people share when invitedRecipients is empty", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");
      setupFirestoreMock({});

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_test_1/shares", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({
          scope: "board",
          accessMode: "specific_people",
          invitedRecipients: [],
        }),
      });

      const res = await createShare(req, {
        params: Promise.resolve({ workspaceId: "ws_test_1" }),
      });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
    });
  });

  describe("2. Audience Access Modes & Authorization", () => {
    it("Public Access Mode: anonymous visitors receive effectivePermission='viewer'", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "public",
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
        items: {
          item_1: {
            id: "item_1",
            type: "text",
            title: "Project note",
            content: "Board note content",
            createdAt: new Date(),
          },
        },
      });

      const result = await verifyShareAccess({ token });
      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.effectivePermission).toBe("viewer");
      }
    });

    it("Public Access Mode with allowPublicEditing=true: logged-in user receives effectivePermission='editor'", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "public",
            allowPublicEditing: true,
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue(null);

      // Authenticated visitor
      const resultAuth = await verifyShareAccess({
        token,
        reqUserUid: "user_logged_in_1",
        reqUserEmail: "user@example.com",
      });
      expect(resultAuth.authorized).toBe(true);
      if (resultAuth.authorized) {
        expect(resultAuth.effectivePermission).toBe("editor");
      }

      // Anonymous visitor still receives viewer
      const resultAnon = await verifyShareAccess({ token });
      expect(resultAnon.authorized).toBe(true);
      if (resultAnon.authorized) {
        expect(resultAnon.effectivePermission).toBe("viewer");
      }
    });

    it("Authenticated Access Mode: rejects anonymous visitor with 401 & requiresAuth=true", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "authenticated",
            defaultPermission: "editor",
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
      });

      const res = await verifyShareAccess({ token });
      expect(res.authorized).toBe(false);
      if (!res.authorized) {
        expect(res.status).toBe(401);
        expect(res.requiresAuth).toBe(true);
      }
    });

    it("Specific People Mode: grants assigned permission to invited email and denies uninvited email with 403", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "specific_people",
            invitedRecipients: [
              { email: "alice@colleague.com", permission: "editor", addedAt: "now" },
              { email: "bob@client.com", permission: "viewer", addedAt: "now" },
            ],
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue(null);

      // Alice (invited as editor)
      const resAlice = await verifyShareAccess({
        token,
        reqUserUid: mockInvitedPerson.uid,
        reqUserEmail: mockInvitedPerson.email,
      });
      expect(resAlice.authorized).toBe(true);
      if (resAlice.authorized) {
        expect(resAlice.effectivePermission).toBe("editor");
      }

      // Stranger (not on invite list)
      const resStranger = await verifyShareAccess({
        token,
        reqUserUid: mockStranger.uid,
        reqUserEmail: mockStranger.email,
      });
      expect(resStranger.authorized).toBe(false);
      if (!resStranger.authorized) {
        expect(resStranger.status).toBe(403);
      }
    });
  });

  describe("3. Workspace Membership Precedence", () => {
    it("Workspace Viewer is NEVER elevated into an Editor by a share link", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "authenticated",
            defaultPermission: "editor", // Share grants editor
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
      });

      // User has existing workspace membership with role 'viewer'
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const res = await verifyShareAccess({
        token,
        reqUserUid: mockViewer.uid,
        reqUserEmail: mockViewer.email,
      });

      expect(res.authorized).toBe(true);
      if (res.authorized) {
        // Must remain 'viewer' per workspace membership precedence
        expect(res.effectivePermission).toBe("viewer");
      }
    });

    it("Workspace Owner/Editor retains Editor privileges on the shared link", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "public",
            defaultPermission: "viewer",
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
      });

      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const res = await verifyShareAccess({
        token,
        reqUserUid: mockOwner.uid,
        reqUserEmail: mockOwner.email,
      });

      expect(res.authorized).toBe(true);
      if (res.authorized) {
        expect(res.effectivePermission).toBe("editor");
      }
    });
  });

  describe("4. Collaborative Mutations via Shared Link", () => {
    it("Authorized Editor can create/paste items into shared scope via POST /api/public/shares/[token]/items", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      const { itemsMap } = setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "public",
            allowPublicEditing: true,
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
      });
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockEditor);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}/items`, {
        method: "POST",
        headers: { authorization: "Bearer editor_token" },
        body: JSON.stringify({
          type: "code",
          title: "Algorithm snippet",
          content: "const gcd = (a, b) => b ? gcd(b, a % b) : a;",
          language: "javascript",
          calendarDate: "2026-11-20",
        }),
      });

      const res = await createSharedItem(req, {
        params: Promise.resolve({ token }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.item).toBeDefined();
      expect(json.item.title).toBe("Algorithm snippet");
      expect(json.item.calendarDate).toBe("2026-11-20");
      expect(itemsMap.has(json.item.id)).toBe(true);
    });

    it("Viewer is rejected with 403 when attempting to create/paste items", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "public",
            allowPublicEditing: false, // Viewer only
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
      });
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/public/shares/${token}/items`, {
        method: "POST",
        body: JSON.stringify({
          content: "Attempting write as viewer",
        }),
      });

      const res = await createSharedItem(req, {
        params: Promise.resolve({ token }),
      });
      expect(res.status).toBe(403);
    });

    it("Authorized Editor can update and delete shared items", async () => {
      const { shareId, tokenSecret, token, tokenHash } = generateShareToken();
      const existingItemId = "item_target_1";
      const { itemsMap } = setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash,
            scope: "board",
            accessMode: "public",
            allowPublicEditing: true,
            status: "active",
          },
        },
        pointers: {
          [shareId]: { shareId, workspaceId: "ws_test_1" },
        },
        items: {
          [existingItemId]: {
            id: existingItemId,
            workspaceId: "ws_test_1",
            type: "text",
            title: "Old Title",
            content: "Old Content",
            createdAt: { toDate: () => new Date() },
          },
        },
      });
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockEditor);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue(null);

      // PATCH update
      const patchReq = new NextRequest(
        `http://localhost:3000/api/public/shares/${token}/items/${existingItemId}`,
        {
          method: "PATCH",
          headers: { authorization: "Bearer editor_token" },
          body: JSON.stringify({ title: "Updated Title By Shared Editor" }),
        }
      );

      const patchRes = await updateSharedItem(patchReq, {
        params: Promise.resolve({ token, itemId: existingItemId }),
      });
      expect(patchRes.status).toBe(200);
      expect(itemsMap.get(existingItemId).title).toBe("Updated Title By Shared Editor");

      // DELETE item
      const deleteReq = new NextRequest(
        `http://localhost:3000/api/public/shares/${token}/items/${existingItemId}`,
        {
          method: "DELETE",
          headers: { authorization: "Bearer editor_token" },
        }
      );

      const deleteRes = await deleteSharedItem(deleteReq, {
        params: Promise.resolve({ token, itemId: existingItemId }),
      });
      expect(deleteRes.status).toBe(200);
      expect(itemsMap.has(existingItemId)).toBe(false);
    });
  });

  describe("5. Profile-Based Recently Viewed Shares", () => {
    it("records a recently viewed share for authenticated visitors without workspace membership", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockInvitedPerson);
      const { recentSharesMap } = setupFirestoreMock({});

      const req = new NextRequest("http://localhost:3000/api/user/recent-shares", {
        method: "POST",
        headers: { authorization: "Bearer alice_token" },
        body: JSON.stringify({
          shareId: "share_xyz_1",
          token: "shr_test_token_123",
          workspaceName: "Acme Creative Studio",
          title: "Q4 Roadmap",
          scope: "calendar",
          effectivePermission: "viewer",
        }),
      });

      const res = await recordRecentShare(req);
      expect(res.status).toBe(200);
      expect(recentSharesMap.has("alice_guest_share_xyz_1")).toBe(true);
    });

    it("retrieves recently viewed shares for authenticated user", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockInvitedPerson);
      setupFirestoreMock({
        recentShares: {
          rec_1: {
            shareId: "share_xyz_1",
            token: "shr_test_token_123",
            workspaceName: "Acme Creative Studio",
            title: "Q4 Roadmap",
            scope: "calendar",
            effectivePermission: "viewer",
            visitedAt: new Date(),
          },
        },
      });

      const req = new NextRequest("http://localhost:3000/api/user/recent-shares", {
        method: "GET",
        headers: { authorization: "Bearer alice_token" },
      });

      const res = await getRecentShares(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.recentShares).toHaveLength(1);
      expect(json.recentShares[0].workspaceName).toBe("Acme Creative Studio");
    });
  });

  describe("6. Share Settings & Recipient Management (PATCH)", () => {
    it("workspace owner can update permissions and invited recipients on existing share", async () => {
      const shareId = "share_settings_1";
      const { sharesMap } = setupFirestoreMock({
        shares: {
          [shareId]: {
            shareId,
            workspaceId: "ws_test_1",
            tokenHash: "hash123",
            scope: "workspace",
            accessMode: "specific_people",
            defaultPermission: "viewer",
            invitedRecipients: [{ email: "alice@colleague.com", permission: "viewer", addedAt: "now" }],
            status: "active",
            createdAt: new Date(),
          },
        },
      });

      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockOwner);
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const req = new NextRequest(
        `http://localhost:3000/api/workspaces/ws_test_1/shares/${shareId}`,
        {
          method: "PATCH",
          headers: { authorization: "Bearer owner_token" },
          body: JSON.stringify({
            invitedRecipients: [
              { email: "alice@colleague.com", permission: "editor" },
              { email: "charlie@colleague.com", permission: "viewer" },
            ],
            allowPublicEditing: true,
          }),
        }
      );

      const res = await updateShare(req, {
        params: Promise.resolve({ workspaceId: "ws_test_1", shareId }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.invitedRecipients).toHaveLength(2);
      expect(json.allowPublicEditing).toBe(true);
    });
  });
});

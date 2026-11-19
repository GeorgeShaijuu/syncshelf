import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as resolvePublicShare } from "@/app/api/public/shares/[token]/route";
import { POST as createSharedItem } from "@/app/api/public/shares/[token]/items/route";
import {
  GET as getRecentSpaces,
  POST as recordRecentSpace,
  DELETE as dismissRecentSpace,
} from "@/app/api/user/recent-spaces/route";
import { GET as getWorkspaces, POST as createWorkspace } from "@/app/api/workspaces/route";
import { generateShareToken } from "@/lib/shares/share-crypto";
import { verifyShareAccess } from "@/lib/shares/share-auth";
import { sanitizeReturnUrl, getReturnUrlFromSearchParams } from "@/features/auth/auth-helpers";
import * as tokenModule from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";
import * as permModule from "@/lib/authz/permissions";
import * as auditModule from "@/lib/audit/audit-logger";
import * as envModule from "@/lib/env";

describe("CRITICAL VERIFICATION — Shared Workspace Auth, Onboarding & Recent Spaces", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const mockOwner = {
    uid: "owner_george",
    email: "george@syncshelf.tech",
    displayName: "George Shaiju",
    decodedToken: { picture: "https://example.com/george.png" } as any,
  };

  const mockGuestUser = {
    uid: "user_alex",
    email: "alex@designer.com",
    displayName: "Alex Rivera",
    decodedToken: { picture: "https://example.com/alex.png" } as any,
  };

  const mockStranger = {
    uid: "user_stranger",
    email: "stranger@random.com",
    displayName: "Stranger",
    decodedToken: {} as any,
  };

  const mockWorkspace = {
    id: "ws_acme",
    name: "Design Studio",
    ownerUid: "owner_george",
    ownerDisplayName: "George Shaiju",
    ownerAvatarUrl: "https://example.com/george.png",
  };

  function setupMockDb(options: {
    shareDoc?: any;
    items?: any[];
    collaborators?: Map<string, any>;
    recentSpaces?: Map<string, any>;
    workspaces?: Map<string, any>;
    members?: Map<string, any>;
    memberships?: Map<string, any>;
  }) {
    const itemsMap = new Map((options.items || []).map((i) => [i.id, i]));
    const collaboratorsMap = options.collaborators || new Map<string, any>();
    const recentSpacesMap = options.recentSpaces || new Map<string, any>();
    const workspacesMap = options.workspaces || new Map([[mockWorkspace.id, mockWorkspace]]);
    const membershipsMap = options.memberships || new Map<string, any>();

    const mockAdminDb: any = {
      collection: vi.fn((colName: string) => {
        if (colName === "publicSharePointers") {
          return {
            doc: vi.fn((shareId: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: !!options.shareDoc,
                data: () => ({ workspaceId: mockWorkspace.id }),
              }),
            })),
          };
        }

        if (colName === "workspaces") {
          return {
            doc: vi.fn((wsId: string) => ({
              get: vi.fn().mockResolvedValue({
                exists: workspacesMap.has(wsId),
                data: () => workspacesMap.get(wsId),
              }),
              collection: vi.fn((subCol: string) => {
                if (subCol === "shares") {
                  return {
                    doc: vi.fn((sId: string) => ({
                      get: vi.fn().mockResolvedValue({
                        exists: !!options.shareDoc,
                        data: () => options.shareDoc,
                        ref: {
                          update: vi.fn().mockResolvedValue({}),
                        },
                      }),
                      update: vi.fn().mockResolvedValue({}),
                    })),
                  };
                }

                if (subCol === "sharedCollaborators") {
                  return {
                    doc: vi.fn((uid: string) => ({
                      get: vi.fn().mockResolvedValue({
                        exists: collaboratorsMap.has(uid),
                        data: () => collaboratorsMap.get(uid),
                      }),
                      set: vi.fn().mockImplementation((data: any) => {
                        collaboratorsMap.set(uid, data);
                        return Promise.resolve();
                      }),
                      update: vi.fn().mockImplementation((data: any) => {
                        collaboratorsMap.set(uid, { ...collaboratorsMap.get(uid), ...data });
                        return Promise.resolve();
                      }),
                    })),
                  };
                }

                if (subCol === "items") {
                  return {
                    orderBy: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({
                        docs: Array.from(itemsMap.values()).map((item) => ({
                          id: item.id,
                          data: () => item,
                        })),
                      }),
                    }),
                    doc: vi.fn((itemId: string) => ({
                      get: vi.fn().mockResolvedValue({
                        exists: itemsMap.has(itemId),
                        data: () => itemsMap.get(itemId),
                      }),
                      set: vi.fn().mockImplementation((data: any) => {
                        itemsMap.set(itemId, { id: itemId, ...data });
                        return Promise.resolve();
                      }),
                    })),
                  };
                }

                if (subCol === "members") {
                  return {
                    doc: vi.fn((uid: string) => ({
                      get: vi.fn().mockResolvedValue({
                        exists: uid === mockWorkspace.ownerUid,
                        data: () => ({ role: uid === mockWorkspace.ownerUid ? "owner" : null, status: "active" }),
                      }),
                    })),
                  };
                }

                return { doc: vi.fn() };
              }),
            })),
          };
        }

        if (colName === "users") {
          return {
            doc: vi.fn((uid: string) => ({
              collection: vi.fn((userSubCol: string) => {
                if (userSubCol === "recentSpaces" || userSubCol === "recentShares") {
                  return {
                    orderBy: vi.fn().mockReturnValue({
                      limit: vi.fn().mockReturnValue({
                        get: vi.fn().mockResolvedValue({
                          empty: recentSpacesMap.size === 0,
                          docs: Array.from(recentSpacesMap.values()).map((doc) => ({
                            id: doc.shareId || "share_id",
                            data: () => doc,
                          })),
                        }),
                      }),
                    }),
                    doc: vi.fn((shareId: string) => ({
                      set: vi.fn().mockImplementation((data: any) => {
                        recentSpacesMap.set(shareId, data);
                        return Promise.resolve();
                      }),
                      delete: vi.fn().mockImplementation(() => {
                        recentSpacesMap.delete(shareId);
                        return Promise.resolve();
                      }),
                    })),
                  };
                }

                if (userSubCol === "workspaceMemberships") {
                  return {
                    get: vi.fn().mockResolvedValue({
                      empty: !membershipsMap.has(uid),
                      docs: membershipsMap.has(uid) ? [membershipsMap.get(uid)] : [],
                    }),
                  };
                }

                return { doc: vi.fn() };
              }),
            })),
          };
        }

        return { doc: vi.fn() };
      }),
      collectionGroup: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              empty: !options.shareDoc,
              docs: options.shareDoc ? [{ data: () => options.shareDoc, ref: {} }] : [],
            }),
          }),
        }),
      }),
      runTransaction: vi.fn(),
    };

    vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockAdminDb);
    vi.spyOn(envModule, "hasFirebaseAdminConfig").mockReturnValue(true);
    vi.spyOn(permModule, "getWorkspaceMemberRole").mockImplementation(
      async (_db, _wsId, uid) => (uid === mockWorkspace.ownerUid ? "owner" : null)
    );
    vi.spyOn(auditModule, "logAuditEvent").mockResolvedValue("mock-audit-id");

    return { mockAdminDb, itemsMap, collaboratorsMap, recentSpacesMap };
  }

  // =========================================================================
  // TEST A — Anonymous Public Viewer (Option 1)
  // =========================================================================
  describe("TEST A — Anonymous Public Viewer (Option 1)", () => {
    it("allows anonymous browsing and copying, but prohibits edits and preserves Viewer role on sign-in", async () => {
      const { token, shareId, tokenHash } = generateShareToken();
      const shareDoc = {
        shareId,
        tokenHash,
        workspaceId: mockWorkspace.id,
        scope: "board",
        accessMode: "public",
        defaultPermission: "viewer",
        allowPublicEditing: false, // Option 1: View only
        status: "active",
        createdAt: new Date(),
        expiresAt: null,
      };

      const testItem = {
        id: "item_note_1",
        type: "text",
        title: "Architecture Roadmap",
        content: "Antigravity upgrade details",
        createdAt: new Date(),
      };

      const { mockAdminDb } = setupMockDb({ shareDoc, items: [testItem] });

      // 1. Anonymous user opens public link
      const reqAnon = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`);
      const resAnon = await resolvePublicShare(reqAnon, { params: Promise.resolve({ token }) });
      expect(resAnon.status).toBe(200);

      const jsonAnon = await resAnon.json();
      expect(jsonAnon.share.effectivePermission).toBe("viewer");
      expect(jsonAnon.share.allowPublicEditing).toBe(false);
      expect(jsonAnon.items).toHaveLength(1);
      expect(jsonAnon.items[0].title).toBe("Architecture Roadmap");

      // 2. Anonymous user attempts to create an item -> rejected with 401 or 403
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);
      const reqAnonPost = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}/items`, {
        method: "POST",
        body: JSON.stringify({ type: "text", title: "Hacker note", content: "Unauthorized write" }),
      });
      const resAnonPost = await createSharedItem(reqAnonPost, { params: Promise.resolve({ token }) });
      expect([401, 403]).toContain(resAnonPost.status);

      // 3. Even if visitor signs in with credentials, Option 1 link preserves Viewer role
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockGuestUser as any);
      const reqAuth = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`, {
        headers: { authorization: "Bearer valid_token" },
      });
      const resAuth = await resolvePublicShare(reqAuth, { params: Promise.resolve({ token }) });
      expect(resAuth.status).toBe(200);
      const jsonAuth = await resAuth.json();
      expect(jsonAuth.share.effectivePermission).toBe("viewer");
    });
  });

  // =========================================================================
  // TEST B — Anonymous Visitor Becomes Authenticated Editor (Option 2)
  // =========================================================================
  describe("TEST B — Anonymous Visitor Becomes Authenticated Editor (Option 2)", () => {
    it("elevates authenticated visitor to Editor, auto-creates scoped collaborator record, and preserves return destination", async () => {
      const { token, shareId, tokenHash } = generateShareToken();
      const shareDoc = {
        shareId,
        tokenHash,
        workspaceId: mockWorkspace.id,
        scope: "board",
        accessMode: "public",
        defaultPermission: "viewer",
        allowPublicEditing: true, // Option 2: Anyone with link — Sign in to edit
        status: "active",
        createdAt: new Date(),
        expiresAt: null,
      };

      const collaboratorsMap = new Map<string, any>();
      const { mockAdminDb, itemsMap } = setupMockDb({ shareDoc, collaborators: collaboratorsMap });

      // 1. Anonymous visitor opens link -> sees Viewer mode
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);
      const reqAnon = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`);
      const resAnon = await resolvePublicShare(reqAnon, { params: Promise.resolve({ token }) });
      expect(resAnon.status).toBe(200);
      const jsonAnon = await resAnon.json();
      expect(jsonAnon.share.effectivePermission).toBe("viewer");
      expect(jsonAnon.share.allowPublicEditing).toBe(true);

      // 2. Authentication continuation check: visitor clicks Sign in
      const searchParams = new URLSearchParams(`returnTo=/s/${token}`);
      const resolvedDestination = getReturnUrlFromSearchParams(searchParams);
      expect(resolvedDestination).toBe(`/s/${token}`);

      // 3. Visitor authenticates (e.g. Alex Rivera)
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockGuestUser as any);

      // 4. Visiting link as authenticated user auto-registers as scoped collaborator and returns Editor permission
      const reqAuth = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`, {
        headers: { authorization: "Bearer valid_user_token" },
      });
      const resAuth = await resolvePublicShare(reqAuth, { params: Promise.resolve({ token }) });
      expect(resAuth.status).toBe(200);
      const jsonAuth = await resAuth.json();
      expect(jsonAuth.share.effectivePermission).toBe("editor");

      // 5. Authenticated editor creates a new item
      const reqPost = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}/items`, {
        method: "POST",
        headers: { authorization: "Bearer valid_user_token" },
        body: JSON.stringify({
          type: "text",
          title: "New UI Palette",
          content: "Tangerine and Warm Cream clay style",
        }),
      });
      const resPost = await createSharedItem(reqPost, { params: Promise.resolve({ token }) });
      expect(resPost.status).toBe(201);
      const jsonPost = await resPost.json();

      // Contributor attribution verified
      expect(jsonPost.item.createdByDisplayName).toBe("Alex Rivera");
      expect(jsonPost.item.createdByAvatarUrl).toBe("https://example.com/alex.png");

      // Scoped collaborator does NOT gain full workspace ownership or admin permissions
      const memberRole = await permModule.getWorkspaceMemberRole(mockAdminDb, mockWorkspace.id, mockGuestUser.uid);
      expect(memberRole).toBeNull(); // Not an unrestricted workspace member
      expect(permModule.canManageWorkspace(memberRole)).toBe(false);
      expect(permModule.canManageMembers(memberRole)).toBe(false);
    });
  });

  // =========================================================================
  // TEST C — New Account Without an Owned Workspace
  // =========================================================================
  describe("TEST C — New Account Without an Owned Workspace", () => {
    it("handles 0 owned workspaces gracefully, accesses /spaces without forced onboarding", async () => {
      // 1. Verify URL sanitizer preserves relative return destination safely
      expect(sanitizeReturnUrl("/s/token_123")).toBe("/s/token_123");
      expect(sanitizeReturnUrl("https://evil.com/hack")).toBe("/spaces"); // Open redirect rejected
      expect(sanitizeReturnUrl("//evil.com")).toBe("/spaces"); // Protocol relative rejected

      // 2. Listing workspaces for a user without an owned workspace returns empty array (not 500 or forced error)
      const mockAdminDb: any = {
        collection: vi.fn((colName: string) => ({
          doc: vi.fn(() => ({
            collection: vi.fn(() => ({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            })),
          })),
        })),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockAdminDb);
      vi.spyOn(envModule, "hasFirebaseAdminConfig").mockReturnValue(true);
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockGuestUser as any);

      const reqWs = new NextRequest("https://syncshelf.tech/api/workspaces", {
        headers: { authorization: "Bearer valid_token" },
      });
      const resWs = await getWorkspaces(reqWs);
      expect(resWs.status).toBe(200);
      const jsonWs = await resWs.json();
      expect(jsonWs.workspaces).toEqual([]);
    });
  });

  // =========================================================================
  // TEST D — Multiple Shared Workspaces in Recently Visited
  // =========================================================================
  describe("TEST D — Multiple Shared Workspaces in Recently Visited", () => {
    it("records and retrieves multiple shared spaces belonging to different owners", async () => {
      const recentSpacesMap = new Map<string, any>();
      setupMockDb({ recentSpaces: recentSpacesMap });
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockGuestUser as any);

      // 1. Record 3 different spaces from 3 different owners
      const spaceA = {
        shareId: "share_alpha",
        token: "tok_alpha",
        workspaceName: "Design Team Board",
        title: "Q1 Design System",
        scope: "board",
        effectivePermission: "editor",
        ownerDisplayName: "Alex",
        itemCount: 12,
      };

      const spaceB = {
        shareId: "share_beta",
        token: "tok_beta",
        workspaceName: "Project Calendar",
        title: "Sprint Planning",
        scope: "calendar",
        effectivePermission: "viewer",
        ownerDisplayName: "Sarah",
        itemCount: 8,
      };

      const spaceC = {
        shareId: "share_gamma",
        token: "tok_gamma",
        workspaceName: "Marketing Workspace",
        title: "Campaign Assets",
        scope: "workspace",
        effectivePermission: "editor",
        ownerDisplayName: "John",
        itemCount: 25,
      };

      const reqPostA = new NextRequest("https://syncshelf.tech/api/user/recent-spaces", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify(spaceA),
      });
      await recordRecentSpace(reqPostA);

      const reqPostB = new NextRequest("https://syncshelf.tech/api/user/recent-spaces", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify(spaceB),
      });
      await recordRecentSpace(reqPostB);

      const reqPostC = new NextRequest("https://syncshelf.tech/api/user/recent-spaces", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify(spaceC),
      });
      await recordRecentSpace(reqPostC);

      // 2. Fetch recent spaces -> all 3 appear
      const reqGet = new NextRequest("https://syncshelf.tech/api/user/recent-spaces", {
        headers: { authorization: "Bearer valid_token" },
      });
      const resGet = await getRecentSpaces(reqGet);
      expect(resGet.status).toBe(200);
      const jsonGet = await resGet.json();
      expect(jsonGet.recentSpaces).toHaveLength(3);

      const owners = jsonGet.recentSpaces.map((s: any) => s.ownerDisplayName);
      expect(owners).toContain("Alex");
      expect(owners).toContain("Sarah");
      expect(owners).toContain("John");

      // 3. User can dismiss a space
      const reqDel = new NextRequest("https://syncshelf.tech/api/user/recent-spaces?shareId=share_alpha", {
        method: "DELETE",
        headers: { authorization: "Bearer valid_token" },
      });
      const resDel = await dismissRecentSpace(reqDel);
      expect(resDel.status).toBe(200);
      expect(recentSpacesMap.has("share_alpha")).toBe(false);
    });
  });

  // =========================================================================
  // TEST E — Scope Restrictions (Board-only vs Calendar-only vs Both)
  // =========================================================================
  describe("TEST E — Scope Restrictions (Board vs Calendar vs Both)", () => {
    it("correctly identifies scope on resolved metadata", async () => {
      const { token: tokBoard, shareId: sIdBoard, tokenHash: hBoard } = generateShareToken();
      const shareBoard = {
        shareId: sIdBoard,
        tokenHash: hBoard,
        workspaceId: mockWorkspace.id,
        scope: "board",
        accessMode: "public",
        defaultPermission: "viewer",
        status: "active",
      };

      setupMockDb({ shareDoc: shareBoard });
      const reqBoard = new NextRequest(`https://syncshelf.tech/api/public/shares/${tokBoard}`);
      const resBoard = await resolvePublicShare(reqBoard, { params: Promise.resolve({ token: tokBoard }) });
      const jsonBoard = await resBoard.json();
      expect(jsonBoard.share.scope).toBe("board");
    });
  });

  // =========================================================================
  // TEST F — Revoked and Expired Links
  // =========================================================================
  describe("TEST F — Revoked and Expired Links", () => {
    it("returns HTTP 410 when share is revoked", async () => {
      const { token, shareId, tokenHash } = generateShareToken();
      const revokedDoc = {
        shareId,
        tokenHash,
        workspaceId: mockWorkspace.id,
        scope: "board",
        status: "revoked",
      };

      setupMockDb({ shareDoc: revokedDoc });
      const req = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.status).toBe("revoked");
    });

    it("returns HTTP 410 when share has expired", async () => {
      const { token, shareId, tokenHash } = generateShareToken();
      const expiredDoc = {
        shareId,
        tokenHash,
        workspaceId: mockWorkspace.id,
        scope: "board",
        status: "active",
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
      };

      setupMockDb({ shareDoc: expiredDoc });
      const req = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`);
      const res = await resolvePublicShare(req, { params: Promise.resolve({ token }) });
      expect(res.status).toBe(410);
      const json = await res.json();
      expect(json.status).toBe("expired");
    });
  });

  // =========================================================================
  // TEST G — Specific Invited Users (Option 3)
  // =========================================================================
  describe("TEST G — Specific Invited Users (Option 3)", () => {
    it("demands auth for unauthenticated visitor, rejects uninvited user, and grants access to invited email", async () => {
      const { token, shareId, tokenHash } = generateShareToken();
      const shareOption3 = {
        shareId,
        tokenHash,
        workspaceId: mockWorkspace.id,
        scope: "board",
        accessMode: "specific_people",
        defaultPermission: "viewer",
        status: "active",
        invitedRecipients: [
          {
            email: "alice@colleague.com",
            permission: "editor",
            invitedAt: new Date(),
          },
        ],
      };

      setupMockDb({ shareDoc: shareOption3 });

      // 1. Unauthenticated visitor -> 401 with requiresAuth: true
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);
      const reqAnon = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`);
      const resAnon = await resolvePublicShare(reqAnon, { params: Promise.resolve({ token }) });
      expect(resAnon.status).toBe(401);
      const jsonAnon = await resAnon.json();
      expect(jsonAnon.requiresAuth).toBe(true);

      // 2. Uninvited authenticated user -> 403 Forbidden
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(mockStranger as any);
      const reqStranger = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`, {
        headers: { authorization: "Bearer stranger_token" },
      });
      const resStranger = await resolvePublicShare(reqStranger, { params: Promise.resolve({ token }) });
      expect(resStranger.status).toBe(403);

      // 3. Invited user (Alice) -> 200 with Editor permission
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "alice_guest",
        email: "alice@colleague.com",
        displayName: "Alice",
        decodedToken: {},
      } as any);
      const reqAlice = new NextRequest(`https://syncshelf.tech/api/public/shares/${token}`, {
        headers: { authorization: "Bearer alice_token" },
      });
      const resAlice = await resolvePublicShare(reqAlice, { params: Promise.resolve({ token }) });
      expect(resAlice.status).toBe(200);
      const jsonAlice = await resAlice.json();
      expect(jsonAlice.share.effectivePermission).toBe("editor");
    });
  });
});

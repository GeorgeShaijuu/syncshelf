import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  POST as createInvite,
  GET as listInvites,
} from "@/app/api/workspaces/[workspaceId]/invites/route";
import { DELETE as revokeInvite } from "@/app/api/workspaces/[workspaceId]/invites/[inviteId]/route";
import { POST as acceptInvite } from "@/app/api/invites/accept/route";
import { GET as getInviteDetails } from "@/app/api/invites/details/route";
import { GET as listMembers } from "@/app/api/workspaces/[workspaceId]/members/route";
import {
  PATCH as updateMemberRole,
  DELETE as removeMember,
} from "@/app/api/workspaces/[workspaceId]/members/[uid]/route";
import { GET as getAuditLogs } from "@/app/api/workspaces/[workspaceId]/audit-logs/route";
import {
  generateInviteToken,
  parseInviteToken,
  hashInviteToken,
} from "@/lib/invites/tokens";
import * as tokenModule from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";
import * as permModule from "@/lib/authz/permissions";

describe("Milestone 8 — Team Management & Invitations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Token Generation & Hashing Security", () => {
    it("generates 32-byte high-entropy tokens and computes SHA-256 hash", () => {
      const { shareableToken, secretToken, tokenHash } = generateInviteToken("ws_acme");

      expect(shareableToken).toContain("ws_acme_");
      expect(secretToken.length).toBeGreaterThanOrEqual(32);
      expect(tokenHash).toBe(hashInviteToken(secretToken));
      expect(tokenHash).toHaveLength(64); // SHA-256 hex length
    });

    it("parses composite shareable tokens correctly", () => {
      const { shareableToken, secretToken, tokenHash } = generateInviteToken("ws_acme");
      const parsed = parseInviteToken(shareableToken);

      expect(parsed.workspaceId).toBe("ws_acme");
      expect(parsed.secretToken).toBe(secretToken);
      expect(parsed.tokenHash).toBe(tokenHash);
    });
  });

  describe("Invitation Creation (POST /invites)", () => {
    it("Requirement 1 & 2: Owner can create Editor and Viewer invitations", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      let storedInviteData: any = null;
      let storedAuditData: any = null;
      const mockInviteDocRef = {
        set: vi.fn().mockImplementation((data) => {
          storedInviteData = data;
          return Promise.resolve();
        }),
      };
      const mockAuditDocRef = {
        set: vi.fn().mockImplementation((data) => {
          storedAuditData = data;
          return Promise.resolve();
        }),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ name: "Acme Corp" }) }),
            collection: vi.fn().mockImplementation((col) => {
              if (col === "auditLogs") return { doc: vi.fn().mockReturnValue(mockAuditDocRef) };
              return { doc: vi.fn().mockReturnValue(mockInviteDocRef) };
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      // Create Editor Invite
      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({ role: "editor", expiresInDays: 7 }),
      });

      const res = await createInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.invite.role).toBe("editor");
      expect(json.inviteUrl).toContain("/invite/ws_1_");

      // Requirement 5: Raw secret token is NEVER stored in Firestore, only SHA-256 tokenHash
      expect(storedInviteData).toBeDefined();
      expect(storedInviteData.tokenHash).toBeDefined();
      expect(storedInviteData.tokenHash).toHaveLength(64);
      expect(storedInviteData.secretToken).toBeUndefined();
    });

    it("Requirement 3 & 4: Editor and Viewer cannot create invitations (403)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites", {
        method: "POST",
        headers: { authorization: "Bearer editor_token" },
        body: JSON.stringify({ role: "viewer" }),
      });

      const res = await createInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("rejects invitations with role 'owner' (Owner cannot be granted via invite)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ name: "Acme Corp" }) }),
          }),
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({ role: "owner" }),
      });

      const res = await createInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(400);
    });

    it("Owner creates Viewer invitation (201)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      let storedInviteData: any = null;
      const mockInviteDocRef = {
        set: vi.fn().mockImplementation((data) => {
          storedInviteData = data;
          return Promise.resolve();
        }),
      };
      const mockAuditDocRef = {
        set: vi.fn().mockResolvedValue(undefined),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ name: "Acme Corp" }) }),
            collection: vi.fn().mockImplementation((col) => {
              if (col === "auditLogs") return { doc: vi.fn().mockReturnValue(mockAuditDocRef) };
              return { doc: vi.fn().mockReturnValue(mockInviteDocRef) };
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({ role: "viewer", expiresInDays: 3 }),
      });

      const res = await createInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });

      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.invite.role).toBe("viewer");
      expect(storedInviteData.role).toBe("viewer");
    });

    it("Unauthenticated user cannot create invite (401)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites", {
        method: "POST",
        body: JSON.stringify({ role: "editor" }),
      });

      const res = await createInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("Listing & Revoking Invitations", () => {
    it("Requirement 6: Raw token and tokenHash are never returned from list APIs", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockInviteDoc = {
        id: "inv_123",
        data: () => ({
          role: "editor",
          email: "colleague@test.com",
          status: "pending",
          tokenHash: "super_secret_sha256_hash",
          createdBy: "owner_uid",
          createdAt: { toDate: () => new Date() },
          expiresAt: { toDate: () => new Date(Date.now() + 86400000) },
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({ docs: [mockInviteDoc] }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites", {
        headers: { authorization: "Bearer owner_token" },
      });

      const res = await listInvites(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.invites).toHaveLength(1);
      expect(json.invites[0].tokenHash).toBeUndefined();
      expect(json.invites[0].role).toBe("editor");
    });

    it("Requirement 8: Revoking sets status to revoked and prevents future acceptance", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      let updatedFields: any = null;
      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: "pending", role: "editor" }),
        }),
        update: vi.fn().mockImplementation((ref, data) => {
          updatedFields = data;
        }),
        set: vi.fn(),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({}),
            }),
          }),
        }),
        runTransaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites/inv_1", {
        method: "DELETE",
        headers: { authorization: "Bearer owner_token" },
      });

      const res = await revokeInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1", inviteId: "inv_1" }),
      });

      expect(res.status).toBe(200);
      expect(updatedFields.status).toBe("revoked");
    });

    it("rejects revoking an invitation that has already been accepted", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: "accepted", role: "editor" }),
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({}),
            }),
          }),
        }),
        runTransaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites/inv_accepted", {
        method: "DELETE",
        headers: { authorization: "Bearer owner_token" },
      });

      const res = await revokeInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1", inviteId: "inv_accepted" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("already been accepted");
    });

    it("Editor and Viewer cannot list invitations (403)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites", {
        headers: { authorization: "Bearer editor_token" },
      });

      const res = await listInvites(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("Non-owner cannot revoke invite (403)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites/inv_1", {
        method: "DELETE",
        headers: { authorization: "Bearer editor_token" },
      });

      const res = await revokeInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1", inviteId: "inv_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("Revoking non-existent invite returns 404", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockTx = {
        get: vi.fn().mockResolvedValue({ exists: false }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({}),
            }),
          }),
        }),
        runTransaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/invites/nonexistent", {
        method: "DELETE",
        headers: { authorization: "Bearer owner_token" },
      });

      const res = await revokeInvite(req, {
        params: Promise.resolve({ workspaceId: "ws_1", inviteId: "nonexistent" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("Public Invite Details (GET /api/invites/details)", () => {
    it("returns 200 with workspace name and role for valid pending token", async () => {
      const mockInviteDoc = {
        exists: true,
        data: () => ({
          status: "pending",
          role: "editor",
          workspaceId: "ws_1",
          expiresAt: { toDate: () => new Date(Date.now() + 86400000) },
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockImplementation((col) => {
          if (col === "workspaces") {
            return {
              doc: vi.fn().mockImplementation((id) => {
                if (id === "ws_1") {
                  return {
                    get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ name: "Acme Corp" }) }),
                    collection: vi.fn().mockReturnValue({
                      where: vi.fn().mockReturnValue({
                        limit: vi.fn().mockReturnValue({
                          get: vi.fn().mockResolvedValue({ empty: false, docs: [mockInviteDoc] }),
                        }),
                      }),
                    }),
                  };
                }
                return { get: vi.fn().mockResolvedValue({ exists: false }) };
              }),
            };
          }
          return {};
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/invites/details?token=ws_1_mysecrettoken");
      const res = await getInviteDetails(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.valid).toBe(true);
      expect(json.role).toBe("editor");
      expect(json.workspaceName).toBe("Acme Corp");
    });

    it("returns isExpired: true and status: expired for expired token", async () => {
      const mockInviteDoc = {
        exists: true,
        data: () => ({
          status: "pending",
          role: "viewer",
          workspaceId: "ws_1",
          expiresAt: { toDate: () => new Date(Date.now() - 10000) },
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockImplementation((col) => {
          if (col === "workspaces") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ name: "Acme Corp" }) }),
                collection: vi.fn().mockReturnValue({
                  where: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({ empty: false, docs: [mockInviteDoc] }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/invites/details?token=ws_1_mysecrettoken");
      const res = await getInviteDetails(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.valid).toBe(false);
      expect(json.isExpired).toBe(true);
      expect(json.status).toBe("expired");
    });

    it("returns 404 for non-existent token", async () => {
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
                }),
              }),
            }),
          }),
        }),
        collectionGroup: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
            }),
          }),
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/invites/details?token=ws_1_badtoken");
      const res = await getInviteDetails(req);
      expect(res.status).toBe(404);
    });
  });

  describe("Invitation Acceptance (POST /api/invites/accept)", () => {
    it("Requirement 10: Only authenticated users can accept invitations (401)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: "ws_1_invalidtoken" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(401);
    });

    function createAcceptInviteDb({
      mockTx,
      wsId,
      userUid,
      inviteDocRef,
      inviteData,
    }: {
      mockTx: any;
      wsId: string;
      userUid: string;
      inviteDocRef: any;
      inviteData?: any;
    }) {
      const mockMemberRef = { id: userUid, path: `workspaces/${wsId}/members/${userUid}` };
      const mockMembershipRef = { id: wsId, path: `users/${userUid}/workspaceMemberships/${wsId}` };
      const mockAuditRef = { id: "audit_1", path: `workspaces/${wsId}/auditLogs/audit_1` };
      const mockWsRef = {
        id: wsId,
        path: `workspaces/${wsId}`,
        collection: vi.fn().mockImplementation((subCol: string) => {
          if (subCol === "invites") {
            return {
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({
                    empty: false,
                    docs: [{ ref: inviteDocRef, data: () => inviteData || {} }],
                  }),
                }),
              }),
              doc: vi.fn().mockReturnValue(inviteDocRef),
            };
          }
          if (subCol === "members") {
            return {
              doc: vi.fn().mockReturnValue(mockMemberRef),
            };
          }
          if (subCol === "auditLogs") {
            return {
              doc: vi.fn().mockReturnValue(mockAuditRef),
            };
          }
          return { doc: vi.fn().mockReturnValue({ id: "sub_1", path: `workspaces/${wsId}/${subCol}/sub_1` }) };
        }),
      };

      return {
        collection: vi.fn().mockImplementation((colName: string) => {
          if (colName === "workspaces") {
            return {
              doc: vi.fn().mockReturnValue(mockWsRef),
            };
          }
          if (colName === "users") {
            return {
              doc: vi.fn().mockReturnValue({
                id: userUid,
                path: `users/${userUid}`,
                collection: vi.fn().mockImplementation(() => ({
                  doc: vi.fn().mockReturnValue(mockMembershipRef),
                })),
              }),
            };
          }
          return { doc: vi.fn().mockReturnValue({ id: "doc_1" }) };
        }),
        runTransaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      };
    }

    it("Requirement 7: Expired invitations are rejected (400)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "joiner_uid",
        decodedToken: {} as any,
      });

      const expiredDate = new Date(Date.now() - 10000); // 10 seconds ago
      const mockInviteDocRef = { id: "inv_1", path: "workspaces/ws_1/invites/inv_1" };
      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            status: "pending",
            role: "editor",
            expiresAt: { toDate: () => expiredDate },
          }),
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(
        createAcceptInviteDb({
          mockTx,
          wsId: "ws_1",
          userUid: "joiner_uid",
          inviteDocRef: mockInviteDocRef,
        }) as any
      );

      const req = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ token: "ws_1_validsecrettoken" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("expired");
    });

    it("Requirement 11: Email-bound invitations enforce email matching and verification", async () => {
      // User with mismatching email
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "wrong_email_uid",
        email: "wrong@domain.com",
        decodedToken: { email_verified: true } as any,
      });

      const futureDate = new Date(Date.now() + 86400000);
      const mockInviteDocRef = { id: "inv_1", path: "workspaces/ws_1/invites/inv_1" };
      const mockTx = {
        get: vi.fn().mockImplementation((ref) => {
          if (ref.path?.includes("workspaces/ws_1") && !ref.path.includes("invites") && !ref.path.includes("members")) {
            return Promise.resolve({
              exists: true,
              data: () => ({ name: "Acme", ownerUid: "owner_123" }),
            });
          }
          return Promise.resolve({
            exists: true,
            data: () => ({
              status: "pending",
              role: "editor",
              email: "target@domain.com", // Expected email
              expiresAt: { toDate: () => futureDate },
              name: "Acme",
            }),
          });
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(
        createAcceptInviteDb({
          mockTx,
          wsId: "ws_1",
          userUid: "wrong_email_uid",
          inviteDocRef: mockInviteDocRef,
        }) as any
      );

      const req = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { authorization: "Bearer user_token" },
        body: JSON.stringify({ token: "ws_1_validsecrettoken" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("issued to target@domain.com");
    });

    it("Requirement 12, 13, 14, 15, 16: Atomic acceptance creates member doc, membership index, updates count, and logs audit", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "new_member_uid",
        email: "colleague@domain.com",
        displayName: "Alice",
        decodedToken: { email_verified: true } as any,
      });

      const futureDate = new Date(Date.now() + 86400000);
      const setOps: Record<string, any> = {};
      const updateOps: Record<string, any> = {};

      const mockTx = {
        get: vi.fn().mockImplementation((ref) => {
          if (ref.path?.includes("members/new_member_uid")) {
            // Not a member yet
            return Promise.resolve({ exists: false });
          }
          if (ref.path === "workspaces/ws_target" || ref.id === "ws_target") {
            // Workspace doc
            return Promise.resolve({
              exists: true,
              data: () => ({ name: "Acme Workspace", ownerUid: "owner_123", memberCount: 1 }),
            });
          }
          // Invite doc
          return Promise.resolve({
            exists: true,
            data: () => ({
              status: "pending",
              role: "editor",
              email: null, // Public link
              expiresAt: { toDate: () => futureDate },
              createdBy: "owner_123",
            }),
          });
        }),
        set: vi.fn().mockImplementation((ref, data) => {
          setOps[ref.path || "set_op"] = data;
        }),
        update: vi.fn().mockImplementation((ref, data) => {
          updateOps[ref.path || "update_op"] = data;
        }),
      };

      const mockInviteRef = { id: "inv_abc", path: "workspaces/ws_target/invites/inv_abc" };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(
        createAcceptInviteDb({
          mockTx,
          wsId: "ws_target",
          userUid: "new_member_uid",
          inviteDocRef: mockInviteRef,
        }) as any
      );

      const req = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { authorization: "Bearer new_member_token" },
        body: JSON.stringify({ token: "ws_target_secret123" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(200);

      // Verify member doc was written (Requirement 14)
      expect(mockTx.set).toHaveBeenCalled();
      // Verify membership index was written (Requirement 15)
      // Verify invitation was marked accepted and memberCount incremented (Requirement 16)
      expect(mockTx.update).toHaveBeenCalled();
    });

    it("Acceptance of revoked invite fails (400)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "joiner_uid",
        decodedToken: {} as any,
      });

      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: "revoked", role: "editor" }),
        }),
      };

      const mockInviteRef = { id: "inv_1", path: "workspaces/ws_1/invites/inv_1" };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(
        createAcceptInviteDb({
          mockTx,
          wsId: "ws_1",
          userUid: "joiner_uid",
          inviteDocRef: mockInviteRef,
        }) as any
      );

      const req = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ token: "ws_1_validsecrettoken" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("revoked");
    });

    it("Acceptance of already-accepted invite fails (400)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "joiner_uid",
        decodedToken: {} as any,
      });

      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({ status: "accepted", role: "editor" }),
        }),
      };

      const mockInviteRef = { id: "inv_1", path: "workspaces/ws_1/invites/inv_1" };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(
        createAcceptInviteDb({
          mockTx,
          wsId: "ws_1",
          userUid: "joiner_uid",
          inviteDocRef: mockInviteRef,
        }) as any
      );

      const req = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ token: "ws_1_validsecrettoken" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("already been accepted");
    });

    it("Email-restricted invite: matching email but unverified fails (403)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "unverified_uid",
        email: "target@domain.com",
        decodedToken: { email_verified: false } as any,
      });

      const futureDate = new Date(Date.now() + 86400000);
      const mockInviteRef = { id: "inv_1", path: "workspaces/ws_1/invites/inv_1" };
      const mockTx = {
        get: vi.fn().mockImplementation((ref) => {
          if (ref.path?.includes("workspaces/ws_1") && !ref.path.includes("invites") && !ref.path.includes("members")) {
            return Promise.resolve({
              exists: true,
              data: () => ({ name: "Acme", ownerUid: "owner_123" }),
            });
          }
          return Promise.resolve({
            exists: true,
            data: () => ({
              status: "pending",
              role: "editor",
              email: "target@domain.com",
              expiresAt: { toDate: () => futureDate },
              name: "Acme",
            }),
          });
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(
        createAcceptInviteDb({
          mockTx,
          wsId: "ws_1",
          userUid: "unverified_uid",
          inviteDocRef: mockInviteRef,
        }) as any
      );

      const req = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { authorization: "Bearer user_token" },
        body: JSON.stringify({ token: "ws_1_validsecrettoken" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("verified");
    });

    it("Existing member accepts invite returns 409 Conflict", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "existing_member_uid",
        email: "existing@domain.com",
        decodedToken: { email_verified: true } as any,
      });

      const futureDate = new Date(Date.now() + 86400000);
      const mockInviteRef = { id: "inv_1", path: "workspaces/ws_1/invites/inv_1" };
      const mockTx = {
        get: vi.fn().mockImplementation((ref) => {
          if (ref.path?.includes("members/existing_member_uid")) {
            return Promise.resolve({ exists: true, data: () => ({ role: "editor", status: "active" }) });
          }
          if (ref.path?.includes("workspaces/ws_1") && !ref.path.includes("invites")) {
            return Promise.resolve({ exists: true, data: () => ({ name: "Acme", ownerUid: "owner_123" }) });
          }
          return Promise.resolve({
            exists: true,
            data: () => ({
              status: "pending",
              role: "editor",
              email: null,
              expiresAt: { toDate: () => futureDate },
            }),
          });
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(
        createAcceptInviteDb({
          mockTx,
          wsId: "ws_1",
          userUid: "existing_member_uid",
          inviteDocRef: mockInviteRef,
        }) as any
      );

      const req = new NextRequest("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: { authorization: "Bearer user_token" },
        body: JSON.stringify({ token: "ws_1_validsecrettoken" }),
      });

      const res = await acceptInvite(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain("already a member");
    });
  });

  describe("Member Management & Scoping", () => {
    it("Requirement 18 & 19: Role changes are Owner-only; Owner cannot be demoted (400)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ ownerUid: "owner_uid" }), // Target is owner
            }),
          }),
        }),
      } as any);

      // Try demoting the workspace owner
      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/members/owner_uid", {
        method: "PATCH",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({ role: "viewer" }),
      });

      const res = await updateMemberRole(req, {
        params: Promise.resolve({ workspaceId: "ws_1", uid: "owner_uid" }),
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain("Cannot change or demote the workspace owner");
    });

    it("Requirement 20 & 21: Owner cannot be removed; member removal cleans up membership index", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const wsDocData = { ownerUid: "owner_uid" };
      const memberDocData = { role: "editor" };

      const mockTx = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => memberDocData,
        }),
        delete: vi.fn(),
        update: vi.fn(),
        set: vi.fn(),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockImplementation((col) => {
          if (col === "workspaces") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: true, data: () => wsDocData }),
                collection: vi.fn().mockReturnValue({
                  doc: vi.fn().mockReturnValue({}),
                }),
              }),
            };
          }
          if (col === "users") {
            return {
              doc: vi.fn().mockReturnValue({
                collection: vi.fn().mockReturnValue({
                  doc: vi.fn().mockReturnValue({}),
                }),
              }),
            };
          }
          return {};
        }),
        runTransaction: vi.fn().mockImplementation((cb) => cb(mockTx)),
      } as any);

      // Test 1: Trying to remove Owner -> rejected (400) (Requirement 20)
      const reqRemoveOwner = new NextRequest("http://localhost:3000/api/workspaces/ws_1/members/owner_uid", {
        method: "DELETE",
        headers: { authorization: "Bearer owner_token" },
      });
      const resOwner = await removeMember(reqRemoveOwner, {
        params: Promise.resolve({ workspaceId: "ws_1", uid: "owner_uid" }),
      });
      expect(resOwner.status).toBe(400);
      expect((await resOwner.json()).error).toContain("cannot be removed");

      // Test 2: Removing regular member -> succeeds & deletes member + index (Requirement 21)
      const reqRemoveMember = new NextRequest("http://localhost:3000/api/workspaces/ws_1/members/member_123", {
        method: "DELETE",
        headers: { authorization: "Bearer owner_token" },
      });
      const resMember = await removeMember(reqRemoveMember, {
        params: Promise.resolve({ workspaceId: "ws_1", uid: "member_123" }),
      });
      expect(resMember.status).toBe(200);
      expect(mockTx.delete).toHaveBeenCalledTimes(2); // Deletes member doc AND user membership index
      expect(mockTx.update).toHaveBeenCalled(); // Decrements count
    });

    it("Requirement 22 & 23: Non-owners cannot access audit logs; Owner retrieves audit records", async () => {
      // Editor gets 403
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const reqEditor = new NextRequest("http://localhost:3000/api/workspaces/ws_1/audit-logs", {
        headers: { authorization: "Bearer editor_token" },
      });
      const resEditor = await getAuditLogs(reqEditor, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(resEditor.status).toBe(403);

      // Owner gets 200
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockLogDoc = {
        id: "evt_1",
        data: () => ({
          action: "INVITE_ACCEPTED",
          actorUid: "member_123",
          createdAt: { toDate: () => new Date() },
          metadata: { role: "editor" },
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({ docs: [mockLogDoc] }),
                }),
              }),
            }),
          }),
        }),
      } as any);

      const reqOwner = new NextRequest("http://localhost:3000/api/workspaces/ws_1/audit-logs", {
        headers: { authorization: "Bearer owner_token" },
      });
      const resOwner = await getAuditLogs(reqOwner, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(resOwner.status).toBe(200);
      const json = await resOwner.json();
      expect(json.logs).toHaveLength(1);
      expect(json.logs[0].action).toBe("INVITE_ACCEPTED");
    });

    it("Non-owner cannot change member roles (403)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/members/member_1", {
        method: "PATCH",
        headers: { authorization: "Bearer editor_token" },
        body: JSON.stringify({ role: "viewer" }),
      });

      const res = await updateMemberRole(req, {
        params: Promise.resolve({ workspaceId: "ws_1", uid: "member_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("Non-owner cannot remove member (403)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/members/member_1", {
        method: "DELETE",
        headers: { authorization: "Bearer viewer_token" },
      });

      const res = await removeMember(req, {
        params: Promise.resolve({ workspaceId: "ws_1", uid: "member_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("Listing members returns 200 for Viewer (all workspace members can list members)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const mockMemberDoc = {
        id: "owner_uid",
        data: () => ({
          role: "owner",
          status: "active",
          joinedAt: { toDate: () => new Date() },
          displayName: "Owner Bob",
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue({
        collection: vi.fn().mockImplementation((col) => {
          if (col === "workspaces") {
            return {
              doc: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ ownerUid: "owner_uid" }) }),
                collection: vi.fn().mockReturnValue({
                  orderBy: vi.fn().mockReturnValue({
                    limit: vi.fn().mockReturnValue({
                      get: vi.fn().mockResolvedValue({ docs: [mockMemberDoc] }),
                    }),
                  }),
                }),
              }),
            };
          }
          return {};
        }),
      } as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_1/members", {
        headers: { authorization: "Bearer viewer_token" },
      });

      const res = await listMembers(req, {
        params: Promise.resolve({ workspaceId: "ws_1" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.members).toHaveLength(1);
      expect(json.members[0].isOwner).toBe(true);
    });
  });
});

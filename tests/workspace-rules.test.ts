import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST, GET } from "@/app/api/workspaces/route";
import { GET as getWorkspaceById, PATCH as patchWorkspaceById } from "@/app/api/workspaces/[workspaceId]/route";
import { createWorkspaceSchema, updateWorkspaceSchema } from "@/lib/validation/workspace";
import * as tokenModule from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";
import * as permissionsModule from "@/lib/authz/permissions";
import * as auditModule from "@/lib/audit/audit-logger";

describe("Workspace Business Rules & API Handlers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Validation Schema", () => {
    it("accepts valid workspace names", () => {
      expect(createWorkspaceSchema.safeParse({ name: "My Team Shelf" }).success).toBe(true);
      expect(createWorkspaceSchema.safeParse({ name: "AB" }).success).toBe(true);
      expect(createWorkspaceSchema.safeParse({ name: "  Trimmed Name  " }).data?.name).toBe("Trimmed Name");
    });

    it("rejects invalid workspace names", () => {
      expect(createWorkspaceSchema.safeParse({ name: "" }).success).toBe(false);
      expect(createWorkspaceSchema.safeParse({ name: "A" }).success).toBe(false);
      expect(createWorkspaceSchema.safeParse({ name: "a".repeat(51) }).success).toBe(false);
      expect(createWorkspaceSchema.safeParse({}).success).toBe(false);
    });
  });

  describe("POST /api/workspaces — 1-Owner Constraint & Creation", () => {
    it("returns 401 when Authorization token is missing or invalid", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: "My Shelf" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Unauthorized");
    });

    it("returns 400 when workspace name fails validation", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "uid_user_1",
        email: "user1@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });

      const req = new NextRequest("http://localhost:3000/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: "X" }), // Too short
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe("Validation failed");
    });

    it("creates workspace with deterministic ID = user.uid and returns 201", async () => {
      const mockUid = "uid_user_123";
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: mockUid,
        email: "user@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });

      const transactionSets: Array<{ ref: unknown; data: unknown }> = [];

      const mockTransaction = {
        get: vi.fn().mockImplementation(async () => {
          // Both workspace and membership index do not exist initially
          return { exists: false };
        }),
        set: vi.fn().mockImplementation((ref, data) => {
          transactionSets.push({ ref, data });
        }),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockImplementation((docId: string) => ({
            id: docId,
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockImplementation((subId: string) => ({ id: subId })),
            }),
          })),
        }),
        runTransaction: vi.fn().mockImplementation(async (cb) => cb(mockTransaction)),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as unknown as ReturnType<typeof adminModule.getAdminDb>);

      const req = new NextRequest("http://localhost:3000/api/workspaces", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ name: "Personal Shelf" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = await res.json();

      // Rule 1: Deterministic ID equals creator's Firebase UID
      expect(json.id).toBe(mockUid);
      expect(json.ownerUid).toBe(mockUid);
      expect(json.name).toBe("Personal Shelf");
      expect(json.role).toBe("owner");

      // Rule 2: Atomically sets workspace, member, and user membership index
      expect(transactionSets.length).toBe(3);
    });

    it("rejects second workspace creation attempt with HTTP 409 Conflict", async () => {
      const mockUid = "uid_user_already_has_workspace";
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: mockUid,
        email: "user@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });

      const mockTransaction = {
        get: vi.fn().mockImplementation(async () => {
          // Existing workspace document found!
          return { exists: true, data: () => ({ name: "First Workspace", ownerUid: mockUid }) };
        }),
        set: vi.fn(),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue({}),
            }),
          }),
        }),
        runTransaction: vi.fn().mockImplementation(async (cb) => cb(mockTransaction)),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as unknown as ReturnType<typeof adminModule.getAdminDb>);

      const req = new NextRequest("http://localhost:3000/api/workspaces", {
        method: "POST",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ name: "Second Workspace" }),
      });

      const res = await POST(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain("already own a workspace");
      expect(mockTransaction.set).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/workspaces — Listing & Multi-Workspace Membership", () => {
    it("returns workspaces user belongs to, including owned and joined", async () => {
      const mockUid = "uid_user_multi";
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: mockUid,
        email: "user@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });

      // User belongs to 2 workspaces:
      // 1. Owned workspace (mockUid)
      // 2. Joined workspace ("ws_external_123" as Editor)
      const mockMembershipDocs = [
        {
          id: mockUid,
          data: () => ({
            workspaceId: mockUid,
            workspaceName: "My Owned Shelf",
            role: "owner",
            ownerUid: mockUid,
          }),
        },
        {
          id: "ws_external_123",
          data: () => ({
            workspaceId: "ws_external_123",
            workspaceName: "Design Team Shelf",
            role: "editor",
            ownerUid: "other_owner_456",
          }),
        },
      ];

      const mockDb = {
        collection: vi.fn().mockImplementation((colName: string) => {
          if (colName === "users") {
            return {
              doc: vi.fn().mockReturnValue({
                collection: vi.fn().mockReturnValue({
                  get: vi.fn().mockResolvedValue({
                    empty: false,
                    docs: mockMembershipDocs,
                  }),
                }),
              }),
            };
          }
          if (colName === "workspaces") {
            return {
              doc: vi.fn().mockImplementation((wsId: string) => ({
                id: wsId,
                get: vi.fn().mockResolvedValue({
                  exists: true,
                  id: wsId,
                  data: () => ({
                    name: wsId === mockUid ? "My Owned Shelf" : "Design Team Shelf",
                    ownerUid: wsId === mockUid ? mockUid : "other_owner_456",
                    memberCount: 2,
                  }),
                }),
                collection: vi.fn().mockReturnValue({
                  doc: vi.fn().mockReturnValue({
                    get: vi.fn().mockResolvedValue({
                      exists: true,
                      data: () => ({
                        role: wsId === mockUid ? "owner" : "editor",
                        status: "active",
                      }),
                    }),
                  }),
                }),
              })),
            };
          }
          return {};
        }),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as unknown as ReturnType<typeof adminModule.getAdminDb>);

      const req = new NextRequest("http://localhost:3000/api/workspaces", {
        headers: { authorization: "Bearer valid_token" },
      });

      const res = await GET(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.workspaces.length).toBe(2);
      expect(json.workspaces[0].role).toBe("owner");
      expect(json.workspaces[0].isOwner).toBe(true);

      expect(json.workspaces[1].role).toBe("editor");
      expect(json.workspaces[1].isOwner).toBe(false);
      expect(json.workspaces[1].name).toBe("Design Team Shelf");
    });
  });

  describe("GET /api/workspaces/[workspaceId] — Workspace Settings & Metadata", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123");
      const res = await getWorkspaceById(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when user is not a member", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "outsider_uid",
        email: "outsider@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });
      vi.spyOn(permissionsModule, "getWorkspaceMemberRole").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123", {
        headers: { authorization: "Bearer valid_token" },
      });
      const res = await getWorkspaceById(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(403);
    });

    it("returns workspace details and safe storage status for active members", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        email: "owner@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });
      vi.spyOn(permissionsModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({
                name: "Engineering Shelf",
                ownerUid: "owner_uid",
                memberCount: 3,
                createdAt: { toDate: () => new Date("2026-01-01T00:00:00Z") },
              }),
            }),
            collection: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                get: vi.fn().mockResolvedValue({ size: 2 }),
              }),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as unknown as ReturnType<typeof adminModule.getAdminDb>);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123", {
        headers: { authorization: "Bearer valid_token" },
      });
      const res = await getWorkspaceById(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.id).toBe("ws_123");
      expect(data.name).toBe("Engineering Shelf");
      expect(data.role).toBe("owner");
      expect(data.isOwner).toBe(true);
      expect(data.storage).toBeDefined();
      expect(data.storage.maxUploadSizeBytes).toBe(26214400);
      expect(data.pendingInvitesCount).toBe(2);
    });
  });

  describe("PATCH /api/workspaces/[workspaceId] — Owner Workspace Renaming", () => {
    it("returns 401 when unauthenticated", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123", {
        method: "PATCH",
        body: JSON.stringify({ name: "New Name" }),
      });
      const res = await patchWorkspaceById(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(401);
    });

    it("returns 403 when user is an editor (only Owner can rename workspace)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_uid",
        email: "editor@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });
      vi.spyOn(permissionsModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123", {
        method: "PATCH",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ name: "Unauthorized Rename" }),
      });
      const res = await patchWorkspaceById(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Only workspace owners");
    });

    it("returns 400 when new name is invalid", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        email: "owner@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });
      vi.spyOn(permissionsModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123", {
        method: "PATCH",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ name: "A" }), // Too short
      });
      const res = await patchWorkspaceById(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toBe("Validation failed");
    });

    it("renames workspace, updates reverse membership index, and logs audit event as Owner", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        email: "owner@example.com",
        decodedToken: {} as unknown as tokenModule.AuthenticatedUser["decodedToken"],
      });
      vi.spyOn(permissionsModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      const mockAuditEvent = vi.spyOn(auditModule, "logAuditEvent").mockResolvedValue("log_renamed_123");

      const transactionUpdates: Array<{ ref: unknown; data: unknown }> = [];
      const mockTransaction = {
        get: vi.fn().mockImplementation(async (ref: { id: string }) => {
          return {
            exists: true,
            data: () => ({ name: "Old Workspace Name", ownerUid: "owner_uid" }),
          };
        }),
        update: vi.fn().mockImplementation((ref, data) => {
          transactionUpdates.push({ ref, data });
        }),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockImplementation((id: string) => ({
            id,
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockImplementation((subId: string) => ({ id: subId })),
            }),
          })),
        }),
        runTransaction: vi.fn().mockImplementation(async (cb) => cb(mockTransaction)),
      };

      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as unknown as ReturnType<typeof adminModule.getAdminDb>);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123", {
        method: "PATCH",
        headers: { authorization: "Bearer valid_token" },
        body: JSON.stringify({ name: "Production Engineering Shelf" }),
      });

      const res = await patchWorkspaceById(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();

      expect(data.name).toBe("Production Engineering Shelf");
      expect(transactionUpdates.length).toBe(2); // updates workspace doc + reverse index
      expect(mockAuditEvent).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          workspaceId: "ws_123",
          actorUid: "owner_uid",
          action: "WORKSPACE_RENAMED",
          metadata: {
            oldName: "Old Workspace Name",
            newName: "Production Engineering Shelf",
          },
        }),
        mockTransaction
      );
    });
  });
});

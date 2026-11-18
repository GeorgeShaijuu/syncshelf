import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getItems, POST as createItem } from "@/app/api/workspaces/[workspaceId]/items/route";
import {
  PATCH as updateItem,
  DELETE as deleteItem,
} from "@/app/api/workspaces/[workspaceId]/items/[itemId]/route";
import { createItemSchema, updateItemSchema } from "@/lib/validation/item";
import * as tokenModule from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";
import * as permModule from "@/lib/authz/permissions";

describe("Clipboard Items API & Security Rules", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Validation Schemas", () => {
    it("accepts valid item payloads", () => {
      const validText = createItemSchema.safeParse({
        type: "text",
        title: "Database Credentials",
        content: "POSTGRES_URL=...",
        tags: ["db", "prod"],
      });
      expect(validText.success).toBe(true);

      const validCode = createItemSchema.safeParse({
        type: "code",
        title: "Quick Sort",
        content: "function quickSort() {}",
        language: "typescript",
        isPinned: true,
      });
      expect(validCode.success).toBe(true);

      const validLink = createItemSchema.safeParse({
        type: "link",
        title: "API Docs",
        content: "https://docs.syncshelf.dev",
      });
      expect(validLink.success).toBe(true);
    });

    it("rejects invalid item types (Requirement 8)", () => {
      const invalid = createItemSchema.safeParse({
        type: "executable", // Invalid
        title: "Bad Type",
        content: "malicious code",
      });
      expect(invalid.success).toBe(false);
    });

    it("rejects oversized content > 50,000 characters (Requirement 9)", () => {
      const oversized = createItemSchema.safeParse({
        type: "text",
        title: "Massive File",
        content: "a".repeat(50001),
      });
      expect(oversized.success).toBe(false);
    });

    it("rejects empty title or content", () => {
      expect(createItemSchema.safeParse({ type: "text", title: "", content: "abc" }).success).toBe(false);
      expect(createItemSchema.safeParse({ type: "text", title: "abc", content: "" }).success).toBe(false);
    });
  });

  describe("Authentication & Authorization Enforcement", () => {
    it("returns 401 when Authorization token is missing or invalid (Requirement 6)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items", {
        method: "POST",
        body: JSON.stringify({ type: "text", title: "Test", content: "Notes" }),
      });

      const res = await createItem(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toContain("Unauthorized");
    });

    it("returns 403 when user is not a member of the workspace (Requirement 7)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "intruder_user",
        decodedToken: {} as any,
      });

      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue(null);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_private/items", {
        headers: { authorization: "Bearer valid_token" },
      });

      const res = await getItems(req, {
        params: Promise.resolve({ workspaceId: "ws_private" }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Forbidden");
    });

    it("allows OWNER to create a clipboard item (Requirement 1)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      let createdDocData: any = null;
      const mockDocRef = {
        id: "item_new_123",
        set: vi.fn().mockImplementation(async (data) => {
          createdDocData = data;
        }),
      };
      const mockItemsCollection = {
        doc: vi.fn().mockReturnValue(mockDocRef),
      };
      const mockWorkspaceDoc = {
        collection: vi.fn().mockReturnValue(mockItemsCollection),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue(mockWorkspaceDoc),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items", {
        method: "POST",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({
          type: "text",
          title: "Owner Stash",
          content: "Confidential Notes",
          tags: ["admin", "security"],
        }),
      });

      const res = await createItem(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.item.title).toBe("Owner Stash");
      expect(json.item.createdBy).toBe("owner_uid");
    });

    it("allows EDITOR to create a clipboard item (Requirement 2)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "editor_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      const mockDocRef = {
        id: "item_editor_456",
        set: vi.fn().mockResolvedValue(undefined),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue(mockDocRef),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items", {
        method: "POST",
        headers: { authorization: "Bearer editor_token" },
        body: JSON.stringify({
          type: "code",
          title: "React Hook",
          content: "export function useHook() {}",
          language: "typescript",
        }),
      });

      const res = await createItem(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.item.type).toBe("code");
      expect(json.item.language).toBe("typescript");
    });

    it("blocks VIEWER from creating a clipboard item with 403 (Requirement 3)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items", {
        method: "POST",
        headers: { authorization: "Bearer viewer_token" },
        body: JSON.stringify({
          type: "text",
          title: "Viewer Attempt",
          content: "Should Fail",
        }),
      });

      const res = await createItem(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toContain("Forbidden");
    });

    it("blocks VIEWER from editing a clipboard item with 403 (Requirement 4)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items/item_1", {
        method: "PATCH",
        headers: { authorization: "Bearer viewer_token" },
        body: JSON.stringify({ title: "Tampered Title" }),
      });

      const res = await updateItem(req, {
        params: Promise.resolve({ workspaceId: "ws_123", itemId: "item_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("blocks VIEWER from deleting a clipboard item with 403 (Requirement 5)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "viewer_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items/item_1", {
        method: "DELETE",
        headers: { authorization: "Bearer viewer_token" },
      });

      const res = await deleteItem(req, {
        params: Promise.resolve({ workspaceId: "ws_123", itemId: "item_1" }),
      });
      expect(res.status).toBe(403);
    });

    it("enforces that a client cannot spoof createdBy (Requirement 10)", async () => {
      const realUserUid = "real_authenticated_uid";
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: realUserUid,
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("editor");

      let savedData: any = null;
      const mockDocRef = {
        id: "item_spoof_test",
        set: vi.fn().mockImplementation(async (data) => {
          savedData = data;
        }),
      };
      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue(mockDocRef),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      // Malicious client supplies a fake createdBy in body
      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items", {
        method: "POST",
        headers: { authorization: "Bearer real_token" },
        body: JSON.stringify({
          type: "text",
          title: "Spoof Test",
          content: "Testing createdBy override",
          createdBy: "attacker_spoofed_uid", // Malicious field
        }),
      });

      const res = await createItem(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(201);
      expect(savedData.createdBy).toBe(realUserUid); // Verified against authenticated UID
    });

    it("updates pinning correctly via PATCH (Requirement 12)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "owner_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("owner");

      let updatedFields: any = null;
      const mockDocRef = {
        get: vi.fn().mockResolvedValue({
          exists: true,
          data: () => ({
            id: "item_pin_1",
            workspaceId: "ws_123",
            type: "text",
            title: "Pinned Note",
            content: "Keep this on top",
            isPinned: false,
          }),
        }),
        update: vi.fn().mockImplementation(async (updates) => {
          updatedFields = updates;
        }),
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue({
              doc: vi.fn().mockReturnValue(mockDocRef),
            }),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items/item_pin_1", {
        method: "PATCH",
        headers: { authorization: "Bearer owner_token" },
        body: JSON.stringify({ isPinned: true }),
      });

      const res = await updateItem(req, {
        params: Promise.resolve({ workspaceId: "ws_123", itemId: "item_pin_1" }),
      });
      expect(res.status).toBe(200);
      expect(updatedFields.isPinned).toBe(true);
    });

    it("correctly handles cursor pagination on GET (Requirement 11)", async () => {
      vi.spyOn(tokenModule, "verifyAuthToken").mockResolvedValue({
        uid: "member_uid",
        decodedToken: {} as any,
      });
      vi.spyOn(permModule, "getWorkspaceMemberRole").mockResolvedValue("viewer");

      const mockDocs = Array.from({ length: 6 }, (_, idx) => ({
        id: `item_${idx + 1}`,
        data: () => ({
          type: "text",
          title: `Item ${idx + 1}`,
          content: `Content ${idx + 1}`,
          isPinned: false,
          tags: ["tag1"],
          contentLength: 10,
        }),
      }));

      const mockQuery = {
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        startAfter: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ docs: mockDocs }),
        }),
      };

      const mockCollection = {
        doc: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ exists: true }),
        }),
        where: vi.fn().mockReturnValue(mockQuery),
        orderBy: vi.fn().mockReturnValue(mockQuery),
        limit: mockQuery.limit,
      };

      const mockDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            collection: vi.fn().mockReturnValue(mockCollection),
          }),
        }),
      };
      vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);

      // Request limit=5, query returned 6 docs -> hasMore=true, nextCursor='item_5'
      const req = new NextRequest("http://localhost:3000/api/workspaces/ws_123/items?limit=5&cursor=item_0", {
        headers: { authorization: "Bearer member_token" },
      });

      const res = await getItems(req, {
        params: Promise.resolve({ workspaceId: "ws_123" }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(5);
      expect(json.hasMore).toBe(true);
      expect(json.nextCursor).toBe("item_5");
    });
  });
});

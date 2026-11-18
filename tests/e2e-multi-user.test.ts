import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST as createWorkspaceHandler } from "@/app/api/workspaces/route";
import { POST as createItemHandler, GET as listItemsHandler } from "@/app/api/workspaces/[workspaceId]/items/route";
import { PATCH as updateItemHandler, DELETE as deleteItemHandler } from "@/app/api/workspaces/[workspaceId]/items/[itemId]/route";
import { POST as createInviteHandler } from "@/app/api/workspaces/[workspaceId]/invites/route";
import { GET as getInviteDetailsHandler } from "@/app/api/invites/details/route";
import { POST as acceptInviteHandler } from "@/app/api/invites/accept/route";
import { POST as createShareHandler } from "@/app/api/workspaces/[workspaceId]/shares/route";
import { DELETE as revokeShareHandler } from "@/app/api/workspaces/[workspaceId]/shares/[shareId]/route";
import { GET as resolvePublicShareHandler } from "@/app/api/public/shares/[token]/route";
import * as verifyTokenModule from "@/lib/auth/verify-id-token";
import * as adminModule from "@/lib/firebase/admin";

// Create in-memory mock Firestore for multi-user integration
class MockDocRef {
  constructor(public id: string, public path: string, private dataStore: Map<string, any>) {}

  async get() {
    const data = this.dataStore.get(this.path);
    return {
      id: this.id,
      exists: data !== undefined,
      data: () => data ? JSON.parse(JSON.stringify(data)) : undefined,
      ref: this,
    };
  }

  async set(data: any, options?: { merge?: boolean }) {
    if (options?.merge) {
      const existing = this.dataStore.get(this.path) || {};
      this.dataStore.set(this.path, { ...existing, ...data });
    } else {
      this.dataStore.set(this.path, JSON.parse(JSON.stringify(data)));
    }
  }

  async update(updates: any) {
    const existing = this.dataStore.get(this.path);
    if (!existing) throw new Error(`Doc ${this.path} not found`);
    this.dataStore.set(this.path, { ...existing, ...updates });
  }

  async delete() {
    this.dataStore.delete(this.path);
  }

  collection(subName: string) {
    return new MockCollectionRef(`${this.path}/${subName}`, this.dataStore);
  }
}

class MockCollectionRef {
  constructor(public path: string, private dataStore: Map<string, any>) {}

  doc(id?: string) {
    const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    return new MockDocRef(docId, `${this.path}/${docId}`, this.dataStore);
  }

  where(field: string, op: string, val: any) {
    return new MockQuery(this.path, this.dataStore, [{ field, op, val }]);
  }

  orderBy(field: string, direction = "asc") {
    return new MockQuery(this.path, this.dataStore, [], [{ field, direction }]);
  }

  limit(n: number) {
    return new MockQuery(this.path, this.dataStore, [], [], n);
  }

  async get() {
    return new MockQuery(this.path, this.dataStore).get();
  }
}

class MockQuery {
  constructor(
    private path: string,
    private dataStore: Map<string, any>,
    private filters: Array<{ field: string; op: string; val: any }> = [],
    private orders: Array<{ field: string; direction: string }> = [],
    private limitCount?: number
  ) {}

  where(field: string, op: string, val: any) {
    return new MockQuery(
      this.path,
      this.dataStore,
      [...this.filters, { field, op, val }],
      this.orders,
      this.limitCount
    );
  }

  orderBy(field: string, direction = "asc") {
    return new MockQuery(
      this.path,
      this.dataStore,
      this.filters,
      [...this.orders, { field, direction }],
      this.limitCount
    );
  }

  limit(n: number) {
    return new MockQuery(this.path, this.dataStore, this.filters, this.orders, n);
  }

  async get() {
    const docs: any[] = [];
    for (const [docPath, data] of this.dataStore.entries()) {
      if (docPath.startsWith(this.path + "/") && docPath.split("/").length === this.path.split("/").length + 1) {
        let matches = true;
        for (const f of this.filters) {
          if (f.op === "==" && data[f.field] !== f.val) {
            matches = false;
            break;
          }
        }
        if (matches) {
          const docId = docPath.substring(this.path.length + 1);
          docs.push({
            id: docId,
            exists: true,
            data: () => JSON.parse(JSON.stringify(data)),
            ref: new MockDocRef(docId, docPath, this.dataStore),
          });
        }
      }
    }

    const limited = this.limitCount ? docs.slice(0, this.limitCount) : docs;
    return {
      docs: limited,
      empty: limited.length === 0,
      size: limited.length,
    };
  }
}

describe("End-to-End Multi-User RBAC & Sharing Lifecycle", () => {
  let mockStore: Map<string, any>;
  let mockDb: any;
  let activeUser: { uid: string; email: string } | null = null;

  beforeEach(() => {
    mockStore = new Map();

    mockDb = {
      collection: (col: string) => new MockCollectionRef(col, mockStore),
      collectionGroup: (col: string) => ({
        where: (field: string, op: string, val: any) => ({
          limit: () => ({
            get: async () => {
              const matched: any[] = [];
              for (const [p, d] of mockStore.entries()) {
                if (p.includes(`/${col}/`) && d[field] === val) {
                  const parts = p.split("/");
                  const id = parts[parts.length - 1];
                  matched.push({
                    id,
                    exists: true,
                    data: () => d,
                    ref: new MockDocRef(id, p, mockStore),
                  });
                }
              }
              return { empty: matched.length === 0, docs: matched };
            },
          }),
        }),
      }),
      batch: () => {
        const ops: Array<() => Promise<void>> = [];
        return {
          set: (ref: any, data: any) => ops.push(async () => ref.set(data)),
          update: (ref: any, data: any) => ops.push(async () => ref.update(data)),
          delete: (ref: any) => ops.push(async () => ref.delete()),
          commit: async () => {
            for (const op of ops) await op();
          },
        };
      },
      runTransaction: async (updateFunction: (tx: any) => Promise<any>) => {
        const tx = {
          get: async (ref: any) => ref.get(),
          set: (ref: any, data: any) => ref.set(data),
          update: (ref: any, data: any) => ref.update(data),
          delete: (ref: any) => ref.delete(),
        };
        return await updateFunction(tx);
      },
    };

    vi.spyOn(adminModule, "getAdminDb").mockReturnValue(mockDb as any);
    vi.spyOn(verifyTokenModule, "verifyAuthToken").mockImplementation(async () => {
      if (!activeUser) return null;
      return {
        uid: activeUser.uid,
        email: activeUser.email,
        displayName: activeUser.email.split("@")[0],
        decodedToken: { uid: activeUser.uid, email: activeUser.email, email_verified: true } as any,
      };
    });
  });

  it("executes the full multi-user collaboration and permissions lifecycle", async () => {
    // -------------------------------------------------------------
    // 1. Account A (Owner) registers and creates their workspace
    // -------------------------------------------------------------
    activeUser = { uid: "user_owner_a", email: "owner@syncshelf.com" };

    const createWsReq = new NextRequest("http://localhost:3000/api/workspaces", {
      method: "POST",
      headers: { authorization: "Bearer valid_token_a", "content-type": "application/json" },
      body: JSON.stringify({ name: "Alpha Research Lab" }),
    });

    const createWsRes = await createWorkspaceHandler(createWsReq);
    expect(createWsRes.status).toBe(201);
    const wsData = await createWsRes.json();
    expect(wsData.id).toBe("user_owner_a");
    expect(wsData.role).toBe("owner");

    // -------------------------------------------------------------
    // 2. Account A creates clipboard items
    // -------------------------------------------------------------
    const createItemReq = new NextRequest("http://localhost:3000/api/workspaces/user_owner_a/items", {
      method: "POST",
      headers: { authorization: "Bearer valid_token_a", "content-type": "application/json" },
      body: JSON.stringify({
        type: "code",
        title: "Database Migration Script",
        content: "ALTER TABLE users ADD COLUMN role VARCHAR(32);",
        language: "sql",
        tags: ["database", "prod"],
      }),
    });

    const createItemRes = await createItemHandler(createItemReq, {
      params: Promise.resolve({ workspaceId: "user_owner_a" }),
    });
    expect(createItemRes.status).toBe(201);
    const { item: createdItem } = await createItemRes.json();
    expect(createdItem.id).toBeDefined();

    // -------------------------------------------------------------
    // 3. Account B (Non-member) is rejected when attempting to access workspace items
    // -------------------------------------------------------------
    activeUser = { uid: "user_intruder_b", email: "intruder@evil.com" };

    const nonMemberReq = new NextRequest("http://localhost:3000/api/workspaces/user_owner_a/items", {
      headers: { authorization: "Bearer valid_token_b" },
    });
    const nonMemberRes = await listItemsHandler(nonMemberReq, {
      params: Promise.resolve({ workspaceId: "user_owner_a" }),
    });
    expect(nonMemberRes.status).toBe(403);

    // -------------------------------------------------------------
    // 4. Account A invites Account B as Editor and Account C as Viewer
    // -------------------------------------------------------------
    activeUser = { uid: "user_owner_a", email: "owner@syncshelf.com" };

    const inviteEditorReq = new NextRequest("http://localhost:3000/api/workspaces/user_owner_a/invites", {
      method: "POST",
      headers: { authorization: "Bearer valid_token_a", "content-type": "application/json" },
      body: JSON.stringify({ role: "editor", email: "editor_b@syncshelf.com" }),
    });
    const inviteEditorRes = await createInviteHandler(inviteEditorReq, {
      params: Promise.resolve({ workspaceId: "user_owner_a" }),
    });
    expect(inviteEditorRes.status).toBe(201);
    const { inviteUrl } = await inviteEditorRes.json();
    const editorInviteToken = inviteUrl.split("/invite/")[1];

    // -------------------------------------------------------------
    // 5. Account B previews and accepts the invitation
    // -------------------------------------------------------------
    const previewReq = new NextRequest(`http://localhost:3000/api/invites/details?token=${editorInviteToken}`);
    const previewRes = await getInviteDetailsHandler(previewReq);
    expect(previewRes.status).toBe(200);
    const previewData = await previewRes.json();
    expect(previewData.valid).toBe(true);
    expect(previewData.role).toBe("editor");

    activeUser = { uid: "user_editor_b", email: "editor_b@syncshelf.com" };
    const acceptReq = new NextRequest("http://localhost:3000/api/invites/accept", {
      method: "POST",
      headers: { authorization: "Bearer valid_token_b", "content-type": "application/json" },
      body: JSON.stringify({ token: editorInviteToken }),
    });
    const acceptRes = await acceptInviteHandler(acceptReq);
    expect(acceptRes.status).toBe(200);

    // -------------------------------------------------------------
    // 6. Verify single-use invitation: Re-accepting fails with 400 (already accepted)
    // -------------------------------------------------------------
    const reAcceptReq = new NextRequest("http://localhost:3000/api/invites/accept", {
      method: "POST",
      headers: { authorization: "Bearer valid_token_b", "content-type": "application/json" },
      body: JSON.stringify({ token: editorInviteToken }),
    });
    const reAcceptRes = await acceptInviteHandler(reAcceptReq);
    expect(reAcceptRes.status).toBe(400);
    const reAcceptData = await reAcceptRes.json();
    expect(reAcceptData.error).toContain("already been accepted");

    // -------------------------------------------------------------
    // 7. Account B (now active Editor) can list and update clipboard items
    // -------------------------------------------------------------
    const editorListReq = new NextRequest("http://localhost:3000/api/workspaces/user_owner_a/items", {
      headers: { authorization: "Bearer valid_token_b" },
    });
    const editorListRes = await listItemsHandler(editorListReq, {
      params: Promise.resolve({ workspaceId: "user_owner_a" }),
    });
    expect(editorListRes.status).toBe(200);

    const updateItemReq = new NextRequest(`http://localhost:3000/api/workspaces/user_owner_a/items/${createdItem.id}`, {
      method: "PATCH",
      headers: { authorization: "Bearer valid_token_b", "content-type": "application/json" },
      body: JSON.stringify({ title: "Updated Migration Script v2" }),
    });
    const updateItemRes = await updateItemHandler(updateItemReq, {
      params: Promise.resolve({ workspaceId: "user_owner_a", itemId: createdItem.id }),
    });
    expect(updateItemRes.status).toBe(200);

    // -------------------------------------------------------------
    // 8. Add Account C as Viewer -> Viewer cannot update or delete items
    // -------------------------------------------------------------
    mockStore.set("workspaces/user_owner_a/members/user_viewer_c", {
      uid: "user_viewer_c",
      role: "viewer",
      status: "active",
      joinedAt: new Date(),
    });

    activeUser = { uid: "user_viewer_c", email: "viewer_c@syncshelf.com" };
    const viewerDeleteReq = new NextRequest(`http://localhost:3000/api/workspaces/user_owner_a/items/${createdItem.id}`, {
      method: "DELETE",
      headers: { authorization: "Bearer valid_token_c" },
    });
    const viewerDeleteRes = await deleteItemHandler(viewerDeleteReq, {
      params: Promise.resolve({ workspaceId: "user_owner_a", itemId: createdItem.id }),
    });
    expect(viewerDeleteRes.status).toBe(403);

    // -------------------------------------------------------------
    // 9. Account A creates an Anonymous Public Share link
    // -------------------------------------------------------------
    activeUser = { uid: "user_owner_a", email: "owner@syncshelf.com" };
    const createShareReq = new NextRequest("http://localhost:3000/api/workspaces/user_owner_a/shares", {
      method: "POST",
      headers: { authorization: "Bearer valid_token_a", "content-type": "application/json" },
      body: JSON.stringify({ itemIds: [createdItem.id], expiry: "7d" }),
    });
    const createShareRes = await createShareHandler(createShareReq, {
      params: Promise.resolve({ workspaceId: "user_owner_a" }),
    });
    expect(createShareRes.status).toBe(201);
    const { id: shareId, token: publicShareToken } = await createShareRes.json();

    // -------------------------------------------------------------
    // 10. Anonymous visitor accesses the public share without credentials
    // -------------------------------------------------------------
    activeUser = null; // Unauthenticated / Anonymous
    const publicReq = new NextRequest(`http://localhost:3000/api/public/shares/${publicShareToken}`);
    const publicRes = await resolvePublicShareHandler(publicReq, {
      params: Promise.resolve({ token: publicShareToken }),
    });
    expect(publicRes.status).toBe(200);
    const publicData = await publicRes.json();
    expect(publicData.items.length).toBe(1);
    expect(publicData.items[0].title).toBe("Updated Migration Script v2");
    // Ensure zero leakage of owner UID or workspace IDs
    expect(publicData.share.workspaceName).toBe("Alpha Research Lab");
    expect((publicData as any).workspace).toBeUndefined();
    expect((publicData.share as any).ownerUid).toBeUndefined();

    // -------------------------------------------------------------
    // 11. Account A revokes the public share
    // -------------------------------------------------------------
    activeUser = { uid: "user_owner_a", email: "owner@syncshelf.com" };
    const revokeShareReq = new NextRequest(`http://localhost:3000/api/workspaces/user_owner_a/shares/${shareId}`, {
      method: "DELETE",
      headers: { authorization: "Bearer valid_token_a" },
    });
    const revokeRes = await revokeShareHandler(revokeShareReq, {
      params: Promise.resolve({ workspaceId: "user_owner_a", shareId }),
    });
    expect(revokeRes.status).toBe(200);

    // -------------------------------------------------------------
    // 12. Anonymous visitor re-accesses revoked share -> Receives HTTP 410 Gone
    // -------------------------------------------------------------
    activeUser = null;
    const revokedPublicRes = await resolvePublicShareHandler(publicReq, {
      params: Promise.resolve({ token: publicShareToken }),
    });
    expect(revokedPublicRes.status).toBe(410);
    const revokedData = await revokedPublicRes.json();
    expect(revokedData.status).toBe("revoked");
  });
});

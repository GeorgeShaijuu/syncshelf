import { describe, it, beforeAll, afterAll } from "vitest";
import {
  initializeTestEnvironment,
  assertFails,
  RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import fs from "fs";
import path from "path";

const PROJECT_ID = "syncshelf-rules-writes-test";

describe("Cloud Firestore Security Rules — Zero Client Write Trust", () => {
  let testEnv: RulesTestEnvironment;

  beforeAll(async () => {
    const rules = fs.readFileSync(path.resolve(process.cwd(), "firestore.rules"), "utf8");

    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: "127.0.0.1",
        port: 8080,
        rules,
      },
    });

    await testEnv.clearFirestore();

    // Seed test data with admin privileges (bypassing security rules)
    await testEnv.withSecurityRulesDisabled(async (adminContext) => {
      const adminDb = adminContext.firestore();

      await adminDb.doc("workspaces/ws_alice").set({
        name: "Alice Workspace",
        ownerUid: "alice",
        createdAt: new Date(),
        memberCount: 3,
      });

      await adminDb.doc("workspaces/ws_alice/members/alice").set({
        uid: "alice",
        role: "owner",
        status: "active",
      });
      await adminDb.doc("workspaces/ws_alice/members/charlie").set({
        uid: "charlie",
        role: "editor",
        status: "active",
      });
      await adminDb.doc("workspaces/ws_alice/members/dave").set({
        uid: "dave",
        role: "viewer",
        status: "active",
      });

      await adminDb.doc("workspaces/ws_alice/items/item_1").set({
        title: "Test Item",
        content: "Content",
      });

      await adminDb.doc("users/alice").set({
        email: "alice@example.com",
      });
      await adminDb.doc("users/alice/workspaceMemberships/ws_alice").set({
        workspaceId: "ws_alice",
        role: "owner",
      });
    });
  });

  afterAll(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  describe("1. Anonymous / Unauthenticated Write Denial", () => {
    it("denies unauthenticated writes across all collections", async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.doc("workspaces/ws_hacked").set({ name: "Hacked" }));
    });
  });

  describe("2. User Profile & Membership Index Write Denial", () => {
    it("denies client-side write to user profiles", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.doc("users/alice").set({ displayName: "New Name" }));
    });

    it("denies client-side write to membership indexes", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        db.doc("users/alice/workspaceMemberships/ws_new").set({ workspaceId: "ws_new" })
      );
    });
  });

  describe("3. Workspace Owner Client Write Denial", () => {
    it("denies OWNER direct client write to workspace document", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.doc("workspaces/ws_alice").update({ name: "Updated" }));
    });

    it("denies OWNER direct client write to workspace members subcollection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        db.doc("workspaces/ws_alice/members/eve").set({ uid: "eve", role: "editor" })
      );
    });

    it("denies OWNER direct client write to workspace items subcollection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        db.collection("workspaces/ws_alice/items").add({ title: "Client Item" })
      );
    });
  });

  describe("4. Editor Client Write Denial", () => {
    it("denies EDITOR direct client write to workspace items subcollection", async () => {
      const db = testEnv.authenticatedContext("charlie").firestore();
      await assertFails(
        db.collection("workspaces/ws_alice/items").add({ title: "Editor Item" })
      );
    });
  });

  describe("5. Viewer Client Write Denial", () => {
    it("denies VIEWER direct client write to workspace items subcollection", async () => {
      const db = testEnv.authenticatedContext("dave").firestore();
      await assertFails(
        db.collection("workspaces/ws_alice/items").add({ title: "Viewer Item" })
      );
    });
  });

  describe("6. Sensitive Collections Client Write Denial", () => {
    it("denies client write to root invites collection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.doc("invites/invite_new").set({ code: "MALICIOUS" }));
    });

    it("denies client write to workspace invites subcollection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        db.doc("workspaces/ws_alice/invites/inv_new").set({ tokenHash: "MALICIOUS" })
      );
    });

    it("denies client write to workspace auditLogs subcollection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        db.doc("workspaces/ws_alice/auditLogs/log_new").set({ action: "TAMPER" })
      );
    });

    it("denies client write to shares collection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.doc("shares/share_new").set({ token: "BAD" }));
    });

    it("denies client write to workspace shares subcollection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        db.doc("workspaces/ws_alice/shares/share_new").set({ tokenHash: "MALICIOUS" })
      );
    });

    it("denies client write to publicSharePointers collection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(
        db.doc("publicSharePointers/ptr_new").set({ workspaceId: "ws_alice" })
      );
    });

    it("denies client write to auditLogs collection", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.doc("auditLogs/log_new").set({ event: "TAMPER" }));
    });
  });

  describe("7. Arbitrary Collections Write Denial", () => {
    it("denies writes to arbitrary unknown collections via fallback rule", async () => {
      const db = testEnv.authenticatedContext("alice").firestore();
      await assertFails(db.doc("billing/test").set({ card: "1234" }));
    });
  });
});
